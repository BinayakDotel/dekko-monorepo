import { describe, expect, test } from "vitest";
import { fixtureRevealModel } from "./fixture";
import { edgeTargetId } from "./ids";
import { buildRevealGraph } from "./layout";
import { renderRevealSvg } from "./render";

describe("renderRevealSvg", () => {
  test("low-confidence edges render with a dashed stroke in SVG", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const lowConf = model.edges.find((e) => e.confidence < 0.6)!;
    const edgeId = edgeTargetId(lowConf.from, lowConf.to, lowConf.relation);
    const { svg } = renderRevealSvg({
      model,
      layout,
      predictionScore: { hits: [], missed: [], falseAlarms: [] },
    });
    expect(svg).toContain(`data-edge-id="${edgeId}"`);
    expect(svg).toMatch(new RegExp(`data-edge-id="${edgeId}"[^>]*stroke-dasharray`));
  });

  test("returns identical SVG on repeated renders", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const score = { hits: ["ledger-service"], missed: [], falseAlarms: [] };
    const a = renderRevealSvg({ model, layout, predictionScore: score }).svg;
    const b = renderRevealSvg({ model, layout, predictionScore: score }).svg;
    expect(b).toBe(a);
  });

  test("embeds inline style with design-token fallbacks for standalone render", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const { svg } = renderRevealSvg({
      model,
      layout,
      predictionScore: { hits: [], missed: [], falseAlarms: [] },
    });
    expect(svg).toContain("<style>");
    expect(svg).toContain("var(--ok-soft,");
    expect(svg).toContain("var(--ink,");
    expect(svg).toContain("text-anchor:middle");
  });

  test("matches snapshot for the fixture model", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const { svg } = renderRevealSvg({
      model,
      layout,
      predictionScore: {
        hits: ["refunds-controller", "ledger-service"],
        missed: ["audit-log"],
        falseAlarms: ["payment-repository"],
      },
    });
    expect(svg).toMatchSnapshot();
  });
});
