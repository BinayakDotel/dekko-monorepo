import { describe, expect, test } from "vitest";
import {
  ChangeModelSchema,
  focusRangeError,
  KeyHunkSchema,
  type ChangeModel,
} from "./schema";

function validModel(): ChangeModel {
  return {
    schemaVersion: 1,
    components: [
      {
        id: "auth-service",
        label: "Auth service",
        kind: "service",
        status: "modified",
        hunks: ["h1"],
        confidence: 0.9,
      },
      {
        id: "users-table",
        label: "Users table",
        kind: "model",
        status: "context",
        hunks: [],
        confidence: 0.7,
      },
    ],
    edges: [
      {
        from: "auth-service",
        to: "users-table",
        relation: "reads",
        hunks: ["h1"],
        confidence: 0.8,
      },
    ],
    keyHunks: [
      { hunkId: "h1", why: "Changes token validation.", rank: 1, focusStart: null, focusEnd: null },
    ],
    questions: [
      { id: "q1", kind: "data-flow", text: "Where does the token go?", expectedAnswer: "To the DB.", hunks: ["h1"] },
      { id: "q2", kind: "failure", text: "What if the DB is down?", expectedAnswer: "401.", hunks: ["h1"] },
      { id: "q3", kind: "debugging", text: "Where would you look?", expectedAnswer: "Auth logs.", hunks: ["h1"] },
    ],
    summary: ["One.", "Two.", "Three."],
    edgeCase: "Expired tokens are not rejected.",
  };
}

function expectIssueAt(
  result: ReturnType<typeof ChangeModelSchema.safeParse>,
  path: Array<string | number>,
): void {
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues.map((i) => i.path)).toContainEqual(path);
}

describe("ChangeModelSchema", () => {
  test("parses a minimal valid model", () => {
    expect(ChangeModelSchema.safeParse(validModel()).success).toBe(true);
  });

  test("rejects a modified component with no hunks", () => {
    const model = validModel();
    model.components[0]!.hunks = [];
    expectIssueAt(ChangeModelSchema.safeParse(model), ["components", 0, "hunks"]);
  });

  test("rejects an edge pointing at an unknown component", () => {
    const model = validModel();
    model.edges[0]!.to = "ghost";
    expectIssueAt(ChangeModelSchema.safeParse(model), ["edges", 0, "to"]);
  });

  test("rejects duplicate component ids", () => {
    const model = validModel();
    model.components[1]!.id = "auth-service";
    model.edges[0]!.to = "auth-service";
    expectIssueAt(ChangeModelSchema.safeParse(model), ["components", 1, "id"]);
  });

  test("accepts a key hunk with both focusStart and focusEnd numbers", () => {
    const model = validModel();
    model.keyHunks[0] = {
      hunkId: "h1",
      why: "Reviewers may miss a broken auth path.",
      rank: 1,
      focusStart: 20,
      focusEnd: 28,
    };
    expect(ChangeModelSchema.safeParse(model).success).toBe(true);
  });

  test("accepts a key hunk with both focus fields null", () => {
    const model = validModel();
    model.keyHunks[0] = {
      hunkId: "h1",
      why: "Risk of bad tokens.",
      rank: 1,
      focusStart: null,
      focusEnd: null,
    };
    expect(ChangeModelSchema.safeParse(model).success).toBe(true);
  });

  test("rejects a key hunk with focusStart number and focusEnd null", () => {
    const model = validModel();
    model.keyHunks[0] = {
      hunkId: "h1",
      why: "Risk of bad tokens.",
      rank: 1,
      focusStart: 20,
      focusEnd: null,
    };
    expectIssueAt(ChangeModelSchema.safeParse(model), ["keyHunks", 0, "focusEnd"]);
  });

  test("rejects a key hunk with focusStart null and focusEnd number", () => {
    const model = validModel();
    model.keyHunks[0] = {
      hunkId: "h1",
      why: "Risk of bad tokens.",
      rank: 1,
      focusStart: null,
      focusEnd: 28,
    };
    expectIssueAt(ChangeModelSchema.safeParse(model), ["keyHunks", 0, "focusStart"]);
  });
});

describe("KeyHunkSchema", () => {
  test("normalizes missing focus fields to null", () => {
    const parsed = KeyHunkSchema.safeParse({ hunkId: "h1", why: "Risk.", rank: 1 });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.focusStart).toBeNull();
    expect(parsed.data.focusEnd).toBeNull();
  });

  test("accepts both focus fields null", () => {
    const parsed = KeyHunkSchema.safeParse({
      hunkId: "h1",
      why: "Risk.",
      rank: 1,
      focusStart: null,
      focusEnd: null,
    });
    expect(parsed.success).toBe(true);
  });

  test("accepts both focus fields as numbers", () => {
    const parsed = KeyHunkSchema.safeParse({
      hunkId: "h1",
      why: "Risk.",
      rank: 1,
      focusStart: 20,
      focusEnd: 28,
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects mixed null and number focus", () => {
    expect(
      KeyHunkSchema.safeParse({
        hunkId: "h1",
        why: "Risk.",
        rank: 1,
        focusStart: 20,
        focusEnd: null,
      }).success,
    ).toBe(false);
  });
});

describe("focusRangeError", () => {
  const hunk = { newStart: 10, newLines: 20 };

  test("returns null when focus lies inside the new range", () => {
    expect(focusRangeError({ focusStart: 12, focusEnd: 18 }, hunk)).toBeNull();
  });

  test("rejects focusStart greater than focusEnd", () => {
    expect(focusRangeError({ focusStart: 18, focusEnd: 12 }, hunk)).toMatch(/focusStart/i);
  });

  test("rejects a bound below newStart", () => {
    expect(focusRangeError({ focusStart: 9, focusEnd: 12 }, hunk)).toMatch(/10/);
  });

  test("rejects a bound past the last new line", () => {
    expect(focusRangeError({ focusStart: 12, focusEnd: 30 }, hunk)).toMatch(/29/);
  });

  test("rejects any focus when newLines is 0", () => {
    expect(focusRangeError({ focusStart: 1, focusEnd: 1 }, { newStart: 0, newLines: 0 })).toMatch(
      /deletion|newLines/i,
    );
  });
});
