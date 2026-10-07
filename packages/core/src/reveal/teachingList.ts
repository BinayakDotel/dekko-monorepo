import { z } from "zod";
import type { PredictionScore } from "../predict";
import type { Component, Edge } from "../schema";
import { edgeTargetId } from "./ids";
import type { RevealLayout } from "./layout";
import { predictionKind, type PredictionKind } from "./overlay";
import type { RevealModel } from "./toRevealModel";

export const CitedHunkRefSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  line: z.number().int().nonnegative(),
});

export const TeachingKindSchema = z.enum(["miss", "fa", "hit"]);

export const SheetEntrySchema = z.object({
  targetKind: z.enum(["node", "edge"]),
  targetId: z.string().min(1),
  sheetTitle: z.string().min(1),
  hunkIds: z.array(z.string()),
});

export const TeachingListItemSchema = SheetEntrySchema.extend({
  kind: TeachingKindSchema,
  label: z.string().min(1),
  subcopy: z.string().min(1),
});

export type CitedHunkRef = z.infer<typeof CitedHunkRefSchema>;
export type TeachingKind = z.infer<typeof TeachingKindSchema>;
export type SheetEntry = z.infer<typeof SheetEntrySchema>;
export type TeachingListItem = z.infer<typeof TeachingListItemSchema>;

export type BuildTeachingListInput = {
  model: RevealModel;
  layout: RevealLayout;
  predictionScore: PredictionScore;
  hunks: readonly CitedHunkRef[];
};

export type BuildTeachingListResult = {
  items: TeachingListItem[];
  byTargetId: Record<string, SheetEntry>;
};

function basename(file: string): string {
  const parts = file.split("/");
  return parts[parts.length - 1] ?? file;
}

function statusWord(status: Component["status"]): string {
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

function keyWhy(model: RevealModel, hunkId: string): string | undefined {
  return model.keyHunks.find((k: RevealModel["keyHunks"][number]) => k.hunkId === hunkId)?.why;
}

function hunkLine(
  hunkId: string,
  byId: Map<string, CitedHunkRef>,
): { basename: string; line: number } | null {
  const h = byId.get(hunkId);
  if (!h) return null;
  return { basename: basename(h.file), line: h.line };
}

function componentSubcopy(
  model: RevealModel,
  component: Component,
  kind: TeachingKind,
  byId: Map<string, CitedHunkRef>,
): string {
  const first = component.hunks[0];
  if (!first) {
    const statusOnly = `${statusWord(component.status)}.`;
    return kind === "fa" ? `You expected this. ${statusOnly}` : statusOnly;
  }
  const why = keyWhy(model, first);
  if (why) {
    return kind === "fa" ? `You expected this. ${why}` : why;
  }
  const loc = hunkLine(first, byId);
  const detail = loc
    ? `${statusWord(component.status)}. ${loc.basename} line ${loc.line}.`
    : `${statusWord(component.status)}.`;
  return kind === "fa" ? `You expected this. ${detail}` : detail;
}

function pathDecoySubcopy(): string {
  return "You expected this. The PR doesn't touch it.";
}

function sheetForNode(component: Component | { id: string; label: string; hunks: string[] }): SheetEntry {
  return {
    targetKind: "node",
    targetId: component.id,
    sheetTitle: component.label,
    hunkIds: [...component.hunks],
  };
}

function sheetForEdge(model: RevealModel, e: Edge): SheetEntry {
  const labels = new Map(model.components.map((c: Component) => [c.id, c.label]));
  const fromLabel = labels.get(e.from) ?? e.from;
  const toLabel = labels.get(e.to) ?? e.to;
  return {
    targetKind: "edge",
    targetId: edgeTargetId(e.from, e.to, e.relation),
    sheetTitle: `${e.relation} ${fromLabel} → ${toLabel}`,
    hunkIds: [...e.hunks],
  };
}

function listItemForComponent(
  model: RevealModel,
  c: Component,
  kind: TeachingKind,
  hunkById: Map<string, CitedHunkRef>,
): TeachingListItem {
  const sheet = sheetForNode(c);
  return {
    kind,
    targetKind: "node",
    targetId: c.id,
    label: c.label,
    subcopy: componentSubcopy(model, c, kind, hunkById),
    sheetTitle: sheet.sheetTitle,
    hunkIds: sheet.hunkIds,
  };
}

function pushByKind(
  kind: Exclude<PredictionKind, "none">,
  item: TeachingListItem,
  miss: TeachingListItem[],
  fa: TeachingListItem[],
  hit: TeachingListItem[],
): void {
  if (kind === "miss") miss.push(item);
  else if (kind === "fa") fa.push(item);
  else hit.push(item);
}

function buildListItems(
  model: RevealModel,
  onMap: Set<string>,
  predictionScore: PredictionScore,
  hunkById: Map<string, CitedHunkRef>,
): TeachingListItem[] {
  const miss: TeachingListItem[] = [];
  const fa: TeachingListItem[] = [];
  const hit: TeachingListItem[] = [];
  const byComponent = new Map(model.components.map((c: Component) => [c.id, c]));

  for (const c of model.components) {
    if (!onMap.has(c.id)) continue;
    const kind = predictionKind(c.id, predictionScore);
    if (kind === "none") continue;
    pushByKind(kind, listItemForComponent(model, c, kind, hunkById), miss, fa, hit);
  }

  for (const id of predictionScore.falseAlarms) {
    if (onMap.has(id) || byComponent.has(id)) continue;
    const sheet = sheetForNode({ id, label: id, hunks: [] });
    fa.push({
      kind: "fa",
      targetKind: "node",
      targetId: id,
      label: id,
      subcopy: pathDecoySubcopy(),
      sheetTitle: sheet.sheetTitle,
      hunkIds: sheet.hunkIds,
    });
  }

  return [...miss, ...fa, ...hit];
}

function buildSheetLookup(
  model: RevealModel,
  onMap: Set<string>,
  items: TeachingListItem[],
): Record<string, SheetEntry> {
  const byTargetId: Record<string, SheetEntry> = {};
  for (const c of model.components) {
    if (!onMap.has(c.id)) continue;
    byTargetId[c.id] = sheetForNode(c);
  }
  for (const item of items) {
    if (item.kind !== "fa" || byTargetId[item.targetId]) continue;
    byTargetId[item.targetId] = {
      targetKind: item.targetKind,
      targetId: item.targetId,
      sheetTitle: item.sheetTitle,
      hunkIds: item.hunkIds,
    };
  }
  for (const e of model.edges) {
    const entry = sheetForEdge(model, e);
    byTargetId[entry.targetId] = entry;
  }
  return byTargetId;
}

export function buildTeachingList(input: BuildTeachingListInput): BuildTeachingListResult {
  const { model, layout, predictionScore, hunks } = input;
  const onMap = new Set(layout.nodes.map((n) => n.id));
  const hunkById = new Map(hunks.map((h) => [h.id, h]));
  const items = buildListItems(model, onMap, predictionScore, hunkById);
  return { items, byTargetId: buildSheetLookup(model, onMap, items) };
}
