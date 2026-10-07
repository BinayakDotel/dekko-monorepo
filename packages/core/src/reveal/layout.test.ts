import { describe, expect, test } from "vitest";
import { fixtureRevealModel } from "./fixture";
import { buildRevealGraph } from "./layout";

describe("buildRevealGraph", () => {
  test("returns the same layout geometry on repeated runs", () => {
    const model = fixtureRevealModel();
    const a = buildRevealGraph(model);
    const b = buildRevealGraph(model);
    expect(b).toEqual(a);
  });

  test("places one box per model component", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(
      model.components.map((c) => c.id).sort(),
    );
  });

  test("sizes NotificationQueue wider than the 120px minimum so the label fits", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const queue = layout.nodes.find((n) => n.id === "notification-queue");
    expect(queue?.width).toBeGreaterThan(120);
  });
});
