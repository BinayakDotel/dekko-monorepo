import { describe, expect, test } from "vitest";
import { ChangeModelSchema, type ChangeModel } from "./schema";

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
    keyHunks: [{ hunkId: "h1", why: "Changes token validation.", rank: 1 }],
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
});
