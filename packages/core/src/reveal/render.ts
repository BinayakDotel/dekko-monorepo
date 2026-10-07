import type { PredictionScore } from "../predict";
import type { RevealLayout } from "./layout";
import {
  buildRevealEdgeMetas,
  buildRevealNodeMetas,
  composeRevealSvg,
  renderEdgeFragments,
  renderNodeFragments,
  viewBoxFromLayout,
  type RevealEdgeMeta,
  type RevealNodeMeta,
} from "./renderParts";
import type { RevealModel } from "./toRevealModel";

export type { RevealEdgeMeta, RevealNodeMeta } from "./renderParts";

export type RenderRevealSvgInput = {
  model: RevealModel;
  layout: RevealLayout;
  predictionScore: PredictionScore;
};

export type RenderRevealSvgResult = {
  svg: string;
  viewBox: string;
  nodes: RevealNodeMeta[];
  edges: RevealEdgeMeta[];
};

export function renderRevealSvg(input: RenderRevealSvgInput): RenderRevealSvgResult {
  const { model, layout, predictionScore } = input;
  const nodes = buildRevealNodeMetas(model, layout, predictionScore);
  const edges = buildRevealEdgeMetas(model, layout);
  const viewBox = viewBoxFromLayout(layout);
  const svg = composeRevealSvg(viewBox, renderEdgeFragments(edges), renderNodeFragments(nodes));
  return { svg, viewBox, nodes, edges };
}
