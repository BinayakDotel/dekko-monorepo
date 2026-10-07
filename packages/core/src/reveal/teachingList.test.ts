import { describe, expect, test } from "vitest";
import { scorePrediction } from "../predict";
import { edgeTargetId } from "./ids";
import { fixtureRevealModel } from "./fixture";
import { buildRevealGraph } from "./layout";
import { buildTeachingList, type CitedHunkRef } from "./teachingList";

const HUNKS: CitedHunkRef[] = [
  { id: "h1", file: "src/payments/RefundsController.ts", line: 12 },
  { id: "h2", file: "src/payments/AuditLog.ts", line: 40 },
  { id: "h3", file: "src/notifications/Queue.ts", line: 88 },
];

function scoreForFixture() {
  return scorePrediction({
    model: fixtureRevealModel(),
    picked: ["refunds-controller", "ledger-service", "payment-repository", "stripe-client"],
  });
}

describe("buildTeachingList", () => {
  test("orders miss then fa then hit, model order within each group, no edges", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const predictionScore = scoreForFixture();
    const { items } = buildTeachingList({ model, layout, predictionScore, hunks: HUNKS });

    expect(items.map((i) => i.targetId)).toEqual([
      // miss — model order among missed affected
      "audit-log",
      "notification-queue",
      // fa — in-model context first (model order), then path decoys
      "payment-repository",
      "stripe-client",
      // hit — model order
      "refunds-controller",
      "ledger-service",
    ]);
    expect(items.every((i) => i.targetKind === "node")).toBe(true);
    expect(items.map((i) => i.kind)).toEqual(["miss", "miss", "fa", "fa", "hit", "hit"]);
  });

  test("prefers key-hunk why for the first cited hunk", () => {
    const model = fixtureRevealModel();
    const { items } = buildTeachingList({
      model,
      layout: buildRevealGraph(model),
      predictionScore: scoreForFixture(),
      hunks: HUNKS,
    });
    expect(items.find((i) => i.targetId === "audit-log")?.subcopy).toBe("Audit trail.");
    expect(items.find((i) => i.targetId === "refunds-controller")?.subcopy).toBe(
      "Refund entry point.",
    );
  });

  test("miss or hit with no cited hunks uses status only", () => {
    const model = fixtureRevealModel();
    model.components = model.components.map((c) =>
      c.id === "notification-queue" ? { ...c, hunks: [] } : c,
    );
    // notification-queue is modified; empty hunks invalid in Zod but unit seam uses plain object
    const { items } = buildTeachingList({
      model,
      layout: buildRevealGraph(model),
      predictionScore: scoreForFixture(),
      hunks: HUNKS,
    });
    expect(items.find((i) => i.targetId === "notification-queue")?.subcopy).toBe("changed.");
  });

  test("fa in model prefixes You expected this; path decoy uses fixed copy", () => {
    const model = fixtureRevealModel();
    const { items } = buildTeachingList({
      model,
      layout: buildRevealGraph(model),
      predictionScore: scoreForFixture(),
      hunks: HUNKS,
    });
    expect(items.find((i) => i.targetId === "payment-repository")?.subcopy).toBe(
      "You expected this. unchanged.",
    );
    expect(items.find((i) => i.targetId === "stripe-client")?.subcopy).toBe(
      "You expected this. The PR doesn't touch it.",
    );
  });

  test("non-key first hunk uses status basename and line", () => {
    const model = fixtureRevealModel();
    model.keyHunks = model.keyHunks.filter((k) => k.hunkId !== "h2");
    model.components = model.components.map((c) =>
      c.id === "audit-log" ? { ...c, hunks: ["h2"] } : c,
    );
    const { items } = buildTeachingList({
      model,
      layout: buildRevealGraph(model),
      predictionScore: scoreForFixture(),
      hunks: HUNKS,
    });
    expect(items.find((i) => i.targetId === "audit-log")?.subcopy).toBe(
      "changed. AuditLog.ts line 40.",
    );
  });

  test("every drawn component and edge has a sheet entry; list and map share it", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const { items, byTargetId } = buildTeachingList({
      model,
      layout,
      predictionScore: scoreForFixture(),
      hunks: HUNKS,
    });

    for (const n of layout.nodes) {
      expect(byTargetId[n.id]).toBeDefined();
      expect(byTargetId[n.id]?.targetKind).toBe("node");
    }
    for (const e of model.edges) {
      const id = edgeTargetId(e.from, e.to, e.relation);
      expect(byTargetId[id]).toBeDefined();
      expect(byTargetId[id]?.targetKind).toBe("edge");
      expect(byTargetId[id]?.hunkIds).toEqual(e.hunks);
      expect(byTargetId[id]?.sheetTitle).toContain(e.relation);
      expect(byTargetId[id]?.sheetTitle).toContain("→");
    }
    for (const item of items) {
      expect(byTargetId[item.targetId]).toEqual({
        targetKind: item.targetKind,
        targetId: item.targetId,
        sheetTitle: item.sheetTitle,
        hunkIds: item.hunkIds,
      });
    }
    expect(byTargetId["stripe-client"]?.hunkIds).toEqual([]);
  });
});
