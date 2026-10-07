import dagre from "@dagrejs/dagre";
import type { RevealModel } from "./toRevealModel";
import { edgeTargetId } from "./ids";

const NODE_HEIGHT = 52;
const NODE_MIN_WIDTH = 120;
const CHAR_WIDTH = 7.2;
const HORIZONTAL_PADDING = 28;

export type RevealPoint = { x: number; y: number };

export type RevealNodeLayout = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RevealEdgeLayout = {
  id: string;
  from: string;
  to: string;
  points: RevealPoint[];
};

export type RevealLayout = {
  nodes: RevealNodeLayout[];
  edges: RevealEdgeLayout[];
  width: number;
  height: number;
};

function nodeWidth(label: string): number {
  return Math.max(NODE_MIN_WIDTH, Math.ceil(label.length * CHAR_WIDTH + HORIZONTAL_PADDING));
}

export function sortedComponents(model: RevealModel) {
  return [...model.components].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortedEdges(model: RevealModel) {
  return [...model.edges].sort((a, b) => {
    const ka = `${a.from}\0${a.to}\0${a.relation}`;
    const kb = `${b.from}\0${b.to}\0${b.relation}`;
    return ka.localeCompare(kb);
  });
}

type DagreGraph = InstanceType<typeof dagre.graphlib.Graph>;
type DagreNodeBox = { x: number; y: number; width: number; height: number };
type DagreEdgeGeom = { points?: Array<{ x: number; y: number }> };
type DagreGraphSize = { width?: number; height?: number };

function populateDagreGraph(model: RevealModel): DagreGraph {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 56, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const c of sortedComponents(model)) {
    g.setNode(c.id, { width: nodeWidth(c.label), height: NODE_HEIGHT });
  }
  for (const e of sortedEdges(model)) {
    g.setEdge(e.from, e.to);
  }
  return g;
}

function layoutFromGraph(g: DagreGraph, model: RevealModel): RevealLayout {
  const nodes: RevealNodeLayout[] = sortedComponents(model).map((c) => {
    const n = g.node(c.id) as DagreNodeBox;
    return {
      id: c.id,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
    };
  });

  const edges: RevealEdgeLayout[] = sortedEdges(model).map((e) => {
    const id = edgeTargetId(e.from, e.to, e.relation);
    const edge = g.edge(e.from, e.to) as DagreEdgeGeom;
    const points: RevealPoint[] = (edge.points ?? []).map((p) => ({
      x: p.x,
      y: p.y,
    }));
    return { id, from: e.from, to: e.to, points };
  });

  const graphLabel = g.graph() as DagreGraphSize;
  return {
    nodes,
    edges,
    width: graphLabel.width ?? 0,
    height: graphLabel.height ?? 0,
  };
}

export function buildRevealGraph(model: RevealModel): RevealLayout {
  const g = populateDagreGraph(model);
  dagre.layout(g);
  return layoutFromGraph(g, model);
}
