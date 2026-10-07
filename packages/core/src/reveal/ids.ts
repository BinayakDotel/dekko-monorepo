import type { Edge } from "../schema";

export function edgeTargetId(from: string, to: string, relation: Edge["relation"]): string {
  return `${from}→${to}:${relation}`;
}
