import type { Component } from "../schema";
import type { PredictionScore } from "../predict";
import { edgeTargetId } from "./ids";
import type { RevealEdgeLayout, RevealLayout, RevealNodeLayout } from "./layout";
import { predictionOverlay } from "./overlay";
import type { RevealModel } from "./toRevealModel";

const LOW_CONFIDENCE = 0.6;

export type RevealNodeMeta = {
  id: string;
  label: string;
  statusClass: string;
  subtitle: string;
  badgeClass: string;
  glyph: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RevealEdgeMeta = {
  id: string;
  from: string;
  to: string;
  relation: string;
  dashed: boolean;
  points: RevealEdgeLayout["points"];
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status: Component["status"]): string {
  switch (status) {
    case "added":
      return "n-add";
    case "modified":
      return "n-mod";
    case "removed":
      return "n-rem";
    case "context":
      return "n-ctx";
  }
}

function statusSubtitle(status: Component["status"]): string {
  switch (status) {
    case "added":
      return "new";
    case "modified":
      return "changed";
    case "removed":
      return "removed";
    case "context":
      return "unchanged";
  }
}

export function buildRevealNodeMetas(
  model: RevealModel,
  layout: RevealLayout,
  predictionScore: PredictionScore,
): RevealNodeMeta[] {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  return [...model.components]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => {
      const box = byId.get(c.id) as RevealNodeLayout;
      const overlay = predictionOverlay(c.id, predictionScore);
      return {
        id: c.id,
        label: c.label,
        statusClass: statusClass(c.status),
        subtitle: statusSubtitle(c.status),
        badgeClass: overlay.badgeClass,
        glyph: overlay.glyph,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    });
}

export function buildRevealEdgeMetas(model: RevealModel, layout: RevealLayout): RevealEdgeMeta[] {
  const pointsById = new Map(layout.edges.map((e) => [e.id, e.points]));
  return [...model.edges]
    .sort((a, b) => edgeTargetId(a.from, a.to, a.relation).localeCompare(edgeTargetId(b.from, b.to, b.relation)))
    .map((e) => {
      const id = edgeTargetId(e.from, e.to, e.relation);
      return {
        id,
        from: e.from,
        to: e.to,
        relation: e.relation,
        dashed: e.confidence < LOW_CONFIDENCE,
        points: pointsById.get(id) ?? [],
      };
    });
}

function edgePath(points: RevealEdgeLayout["points"]): string {
  const first = points[0];
  if (!first) return "";
  const segments = points.slice(1).map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${segments.join(" ")}`;
}

const EDGE_HIT_STROKE = 14;
const SURFACE_FILL = 'fill="var(--surface,#ffffff)"';

function edgeLabelPoint(points: RevealEdgeLayout["points"]): { x: number; y: number } | null {
  if (points.length === 0) return null;
  const mid = Math.floor((points.length - 1) / 2);
  const a = points[mid];
  const b = points[mid + 1] ?? a;
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6 };
}

function badgeTitle(badgeClass: string): string {
  switch (badgeClass) {
    case "b-hit":
      return "You got it";
    case "b-miss":
      return "You missed it";
    case "b-false":
      return "You expected it, nothing changed there";
    default:
      return "";
  }
}

function edgeLabelFragment(
  edgeId: string,
  relation: string,
  labelPt: { x: number; y: number },
): string {
  const w = relation.length * 6 + 10;
  const h = 14;
  const x = labelPt.x - w / 2;
  const y = labelPt.y - 11;
  return (
    `<rect class="reveal-label-back" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h}" rx="2" ${SURFACE_FILL}/>` +
    `<text x="${labelPt.x.toFixed(2)}" y="${labelPt.y.toFixed(2)}" class="reveal-edge-label" data-edge-id="${escapeXml(edgeId)}">${escapeXml(relation)}</text>`
  );
}

export function renderEdgeFragments(edges: RevealEdgeMeta[]): string {
  return edges
    .map((e) => {
      const dash = e.dashed ? ' stroke-dasharray="5 4"' : "";
      const path = edgePath(e.points);
      const id = escapeXml(e.id);
      const hit =
        `<path data-edge-id="${id}" d="${path}" fill="none" stroke="transparent" stroke-width="${EDGE_HIT_STROKE}" marker-end="none" />`;
      const visible = `<path data-edge-id="${id}" d="${path}" fill="none"${dash} />`;
      const labelPt = edgeLabelPoint(e.points);
      const label = labelPt ? edgeLabelFragment(e.id, e.relation, labelPt) : "";
      return `<g data-edge-id="${id}" role="button" tabindex="0">${hit}${visible}${label}</g>`;
    })
    .join("");
}

export function renderNodeFragments(nodes: RevealNodeMeta[]): string {
  return nodes
    .map((n) => {
      const cx = n.x + n.width - 4;
      const cy = n.y + 4;
      const tx = n.x + n.width / 2;
      const glyphHidden = n.badgeClass === "b-hide" ? " b-hide" : "";
      const title = badgeTitle(n.badgeClass);
      const titleXml = title ? `<title>${escapeXml(title)}</title>` : "";
      const glyphBack =
        n.glyph === ""
          ? ""
          : `<rect class="reveal-glyph-back" x="${(cx - 9).toFixed(2)}" y="${(cy - 9).toFixed(2)}" width="18" height="18" rx="9" ${SURFACE_FILL}/>`;
      return `<g class="n ${n.statusClass}" data-node-id="${escapeXml(n.id)}" data-badge="${n.badgeClass}" role="button" tabindex="0">
  <rect x="${n.x.toFixed(2)}" y="${n.y.toFixed(2)}" width="${n.width.toFixed(2)}" height="${n.height.toFixed(2)}" rx="10"/>
  <text x="${tx.toFixed(2)}" y="${(n.y + 22).toFixed(2)}" class="nl">${escapeXml(n.label)}</text>
  <text x="${tx.toFixed(2)}" y="${(n.y + 39).toFixed(2)}" class="ns">${escapeXml(n.subtitle)}</text>
  ${glyphBack}<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="8" class="${n.badgeClass}">${titleXml}</circle>
  <text x="${cx.toFixed(2)}" y="${(cy + 3).toFixed(2)}" class="bt ${n.badgeClass}${glyphHidden}">${escapeXml(n.glyph)}</text>
</g>`;
    })
    .join("\n");
}

export function viewBoxFromLayout(layout: RevealLayout): string {
  const pad = 8;
  return `${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`;
}

/** Look A light fallbacks so the SVG paints when host CSS vars are absent. */
const REVEAL_SVG_STYLE = [
  ".nl{font-family:var(--font-sans,var(--font,\"Instrument Sans\",system-ui,sans-serif));font-size:12.5px;font-weight:600;text-anchor:middle;fill:var(--ink,#1b2430)}",
  ".ns{font-family:var(--font-sans,var(--font,\"Instrument Sans\",system-ui,sans-serif));font-size:10.5px;text-anchor:middle;fill:var(--muted,#6b7480)}",
  ".bt{font-family:var(--font-sans,var(--font,\"Instrument Sans\",system-ui,sans-serif));font-size:10px;font-weight:700;text-anchor:middle;fill:#fff}",
  ".reveal-edge-label{font-family:var(--font-sans,var(--font,\"Instrument Sans\",system-ui,sans-serif));font-size:10px;text-anchor:middle;fill:var(--muted,#6b7480)}",
  ".n{cursor:pointer}",
  ".n-add rect{fill:var(--ok-soft,#e3f5ea);stroke:var(--ok,#1e7a4f);stroke-width:1.5}",
  ".n-mod rect{fill:var(--warn-soft,#fff3d9);stroke:var(--warn,#b45309);stroke-width:1.5}",
  ".n-rem rect{fill:var(--bad-soft,#fde4e4);stroke:var(--bad,#b91c1c);stroke-width:1.5}",
  ".n-ctx rect{fill:var(--field,#f3f4f1);stroke:var(--line,#d9ded9);stroke-width:1.5}",
  ".b-hit{fill:var(--ok,#1e7a4f)}.b-miss{fill:var(--bad,#b91c1c)}.b-false{fill:var(--warn,#b45309)}.b-hide{display:none}",
].join("");

export function composeRevealSvg(viewBox: string, edgeSvg: string, nodeSvg: string): string {
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Change map">
<style>${REVEAL_SVG_STYLE}</style>
<defs><marker id="reveal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="currentColor" stroke-width="1.4"/></marker></defs>
<g class="reveal-edges" stroke="currentColor" stroke-width="1.4" fill="none" marker-end="url(#reveal-arrow)">${edgeSvg}</g>
<g class="reveal-nodes">${nodeSvg}</g>
</svg>`;
}
