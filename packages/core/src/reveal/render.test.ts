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

  test("every drawn edge has a wider transparent hit path sharing data-edge-id", () => {
    const model = fixtureRevealModel();
    const layout = buildRevealGraph(model);
    const { svg, edges } = renderRevealSvg({
      model,
      layout,
      predictionScore: { hits: [], missed: [], falseAlarms: [] },
    });
    for (const e of edges) {
      const paths = [...svg.matchAll(new RegExp(`<path data-edge-id="${e.id}"[^>]*>`, "g"))].map(
        (m) => m[0],
      );
      expect(paths.length).toBe(2);
      const hit = paths.find((p) => /stroke="transparent"/.test(p));
      const visible = paths.find((p) => !/stroke="transparent"/.test(p));
      expect(hit).toBeDefined();
      expect(visible).toBeDefined();
      const hitWidth = Number(hit!.match(/stroke-width="([\d.]+)"/)?.[1]);
      const visWidth = Number(visible!.match(/stroke-width="([\d.]+)"/)?.[1] ?? "1.4");
      expect(hitWidth).toBeGreaterThan(visWidth);
    }
  });

  test("edge labels and badge glyphs sit on a surface-colored backing rect", () => {
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
    const labelBlocks = [...svg.matchAll(/<rect[^>]*class="reveal-label-back"[^/]*\/>\s*<text[^>]*class="reveal-edge-label"/g)];
    expect(labelBlocks.length).toBe(model.edges.length);
    for (const m of labelBlocks) {
      expect(m[0]).toMatch(/fill="var\(--surface/);
    }
    const glyphBlocks = [
      ...svg.matchAll(
        /<rect[^>]*class="reveal-glyph-back"[^/]*\/>[\s\S]*?<text[^>]*class="bt[^"]*"[^>]*>[✓!?]</g,
      ),
    ];
    expect(glyphBlocks.length).toBe(4);
    for (const m of glyphBlocks) {
      expect(m[0]).toMatch(/fill="var\(--surface/);
      expect(m[0].indexOf("reveal-glyph-back")).toBeLessThan(m[0].indexOf("<text"));
    }
  });

  test("each badge has a title matching its prediction status", () => {
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
    expect(svg).toMatch(/data-badge="b-hit"[\s\S]*?<title>You got it<\/title>/);
    expect(svg).toMatch(/data-badge="b-miss"[\s\S]*?<title>You missed it<\/title>/);
    expect(svg).toMatch(
      /data-badge="b-false"[\s\S]*?<title>You expected it, nothing changed there<\/title>/,
    );
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
