import { describe, expect, test } from "vitest";
import type { ChangeModel, Component } from "./schema";
import {
  buildChips,
  canLockPrediction,
  pickDecoys,
  scorePrediction,
  type PickDecoysInput,
} from "./predict";

function component(
  partial: Pick<Component, "id" | "status"> & Partial<Component>,
): Component {
  return {
    label: partial.label ?? partial.id,
    kind: partial.kind ?? "other",
    hunks: partial.hunks ?? (partial.status === "context" ? [] : ["h1"]),
    confidence: partial.confidence ?? 0.9,
    id: partial.id,
    status: partial.status,
  };
}

function model(components: Component[]): ChangeModel {
  return {
    schemaVersion: 1,
    components,
    edges: [],
    keyHunks: [{ hunkId: "h1", why: "Main edit.", rank: 1 }],
    questions: [
      { id: "q1", kind: "data-flow", text: "What flows?", expectedAnswer: "Data.", hunks: ["h1"] },
      { id: "q2", kind: "failure", text: "What fails?", expectedAnswer: "Errors.", hunks: ["h1"] },
      { id: "q3", kind: "debugging", text: "Where look?", expectedAnswer: "Logs.", hunks: ["h1"] },
    ],
    summary: ["One.", "Two.", "Three."],
    edgeCase: "Empty input.",
  };
}

describe("scorePrediction", () => {
  test("all affected ticked and nothing else yields only hits", () => {
    const m = model([
      component({ id: "auth-service", status: "modified" }),
      component({ id: "users-table", status: "added" }),
      component({ id: "cache", status: "context" }),
    ]);
    expect(scorePrediction({ model: m, picked: ["auth-service", "users-table"] })).toEqual({
      hits: ["auth-service", "users-table"],
      missed: [],
      falseAlarms: [],
    });
  });

  test("nothing affected ticked puts every affected id in missed", () => {
    const m = model([
      component({ id: "auth-service", status: "modified" }),
      component({ id: "users-table", status: "removed" }),
      component({ id: "cache", status: "context" }),
    ]);
    expect(scorePrediction({ model: m, picked: [] })).toEqual({
      hits: [],
      missed: ["auth-service", "users-table"],
      falseAlarms: [],
    });
  });

  test("a ticked context component lands in falseAlarms", () => {
    const m = model([
      component({ id: "auth-service", status: "modified" }),
      component({ id: "cache", status: "context" }),
    ]);
    expect(scorePrediction({ model: m, picked: ["cache"] })).toEqual({
      hits: [],
      missed: ["auth-service"],
      falseAlarms: ["cache"],
    });
  });

  test("a ticked path-made decoy lands in falseAlarms", () => {
    const m = model([component({ id: "auth-service", status: "modified" })]);
    expect(scorePrediction({ model: m, picked: ["utils-helper"] })).toEqual({
      hits: [],
      missed: ["auth-service"],
      falseAlarms: ["utils-helper"],
    });
  });

  test("mixed picks partition into hits missed and falseAlarms", () => {
    const m = model([
      component({ id: "auth-service", status: "modified" }),
      component({ id: "users-table", status: "added" }),
      component({ id: "cache", status: "context" }),
    ]);
    const picked = ["auth-service", "cache", "utils-helper"];
    const score = scorePrediction({ model: m, picked });
    expect(score).toEqual({
      hits: ["auth-service"],
      missed: ["users-table"],
      falseAlarms: ["cache", "utils-helper"],
    });
    const affected = ["auth-service", "users-table"];
    expect([...score.hits, ...score.missed].sort()).toEqual(affected);
    expect([...score.hits, ...score.falseAlarms].sort()).toEqual([...picked].sort());
  });

  test("duplicate picks count once and output order is sorted", () => {
    const m = model([
      component({ id: "zebra", status: "modified" }),
      component({ id: "alpha", status: "added" }),
    ]);
    expect(scorePrediction({ model: m, picked: ["zebra", "zebra", "alpha"] })).toEqual({
      hits: ["alpha", "zebra"],
      missed: [],
      falseAlarms: [],
    });
  });
});

describe("pickDecoys", () => {
  test("uses context components before path-made labels", () => {
    const m = model([
      component({ id: "auth-service", status: "modified", hunks: ["h1"] }),
      component({ id: "cache", status: "context", label: "Cache" }),
      component({ id: "logger", status: "context", label: "Logger" }),
    ]);
    const decoys = pickDecoys({
      model: m,
      changeModelId: "cm_seed_a",
      files: [
        { path: "src/auth/service.ts", kind: "modified" },
        { path: "src/utils/helper.ts", kind: "modified" },
      ],
      hunks: [{ id: "h1", file: "src/auth/service.ts" }],
    });
    expect(decoys.map((d) => d.id)).toContain("cache");
    expect(decoys.map((d) => d.id)).toContain("logger");
    expect(decoys).toHaveLength(3);
    expect(decoys.every((d) => d.label.length > 0)).toBe(true);
  });

  test("fills from untouched file paths when context is scarce", () => {
    const m = model([component({ id: "auth-service", status: "modified", hunks: ["h1"] })]);
    const decoys = pickDecoys({
      model: m,
      changeModelId: "cm_seed_b",
      files: [
        { path: "src/auth/service.ts", kind: "modified" },
        { path: "src/utils/helper.ts", kind: "modified" },
        { path: "apps/web/page.tsx", kind: "added" },
      ],
      hunks: [{ id: "h1", file: "src/auth/service.ts" }],
    });
    expect(decoys.length).toBeGreaterThan(0);
    expect(decoys.every((d) => d.id !== "auth-service")).toBe(true);
    expect(decoys.map((d) => d.id)).not.toContain("auth");
    expect(new Set(decoys.map((d) => d.id)).size).toBe(decoys.length);
  });

  test("skips path labels that clash with a real component id", () => {
    const m = model([
      component({ id: "utils", status: "modified", hunks: ["h1"] }),
      component({ id: "helper", status: "context", label: "Helper" }),
    ]);
    const decoys = pickDecoys({
      model: m,
      changeModelId: "cm_seed_c",
      files: [
        { path: "src/utils/helper.ts", kind: "modified" },
        { path: "src/billing/invoice.ts", kind: "modified" },
      ],
      hunks: [{ id: "h1", file: "src/utils/helper.ts" }],
    });
    expect(decoys.map((d) => d.id)).toContain("helper");
    expect(decoys.map((d) => d.id)).toContain("billing");
    expect(decoys.map((d) => d.id)).not.toContain("utils");
  });

  test("returns fewer than three when candidates run out", () => {
    const m = model([component({ id: "auth-service", status: "modified", hunks: ["h1"] })]);
    const decoys = pickDecoys({
      model: m,
      changeModelId: "cm_seed_d",
      files: [{ path: "src/auth/service.ts", kind: "modified" }],
      hunks: [{ id: "h1", file: "src/auth/service.ts" }],
    });
    expect(decoys).toEqual([]);
  });

  test("is deterministic for the same changeModelId", () => {
    const m = model([
      component({ id: "auth-service", status: "modified", hunks: ["h1"] }),
      component({ id: "cache", status: "context", label: "Cache" }),
      component({ id: "logger", status: "context", label: "Logger" }),
    ]);
    const input: PickDecoysInput = {
      model: m,
      changeModelId: "cm_seed_e",
      files: [
        { path: "src/auth/service.ts", kind: "modified" },
        { path: "src/utils/helper.ts", kind: "modified" },
        { path: "apps/web/page.tsx", kind: "added" },
      ],
      hunks: [{ id: "h1", file: "src/auth/service.ts" }],
    };
    expect(pickDecoys(input)).toEqual(pickDecoys(input));
  });
});

describe("buildChips", () => {
  const chipInput: PickDecoysInput = {
    model: model([
      component({ id: "auth-service", status: "modified", hunks: ["h1"], label: "Auth" }),
      component({ id: "cache", status: "context", label: "Cache" }),
    ]),
    changeModelId: "cm_seed_f",
    files: [
      { path: "src/auth/service.ts", kind: "modified" },
      { path: "src/utils/helper.ts", kind: "modified" },
    ],
    hunks: [{ id: "h1", file: "src/auth/service.ts" }],
  };

  test("returns affected plus decoys without marking which are decoys", () => {
    const chips = buildChips(chipInput);
    expect(chips.map((c) => c.id)).toContain("auth-service");
    expect(chips.map((c) => c.id)).toContain("cache");
    expect(chips.every((c) => "id" in c && "label" in c && Object.keys(c).length === 2)).toBe(true);
  });

  test("shuffles deterministically and varies order by changeModelId", () => {
    const chips = buildChips(chipInput);
    expect(buildChips(chipInput)).toEqual(chips);
    const orders = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) =>
      buildChips({
        model: chipInput.model,
        files: chipInput.files,
        hunks: chipInput.hunks,
        changeModelId: id,
      })
        .map((c) => c.id)
        .join(","),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });
});

describe("canLockPrediction", () => {
  test("is false with no chips even when text is long enough", () => {
    expect(
      canLockPrediction({ predictionText: "twelve chars", picked: [] }),
    ).toBe(false);
  });

  test("is false when trimmed text is under 10 characters", () => {
    expect(
      canLockPrediction({ predictionText: "  short  ", picked: ["auth"] }),
    ).toBe(false);
  });

  test("is true with at least one chip and trimmed text of 10+ characters", () => {
    expect(
      canLockPrediction({ predictionText: "  ten chars.  ", picked: ["auth"] }),
    ).toBe(true);
  });
});
