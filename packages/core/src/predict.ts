import { z } from "zod";
import { HunkKindSchema } from "./diff";
import { ChangeModelSchema, ComponentIdSchema, type ChangeModel } from "./schema";

const AFFECTED = new Set(["added", "modified", "removed"]);
const MAX_DECOYS = 3;

export const PredictionScoreSchema = z.object({
  hits: z.array(ComponentIdSchema),
  missed: z.array(ComponentIdSchema),
  falseAlarms: z.array(ComponentIdSchema),
});

export const ChipSchema = z.object({
  id: ComponentIdSchema,
  label: z.string().min(1),
});

export const PrFileSchema = z.object({
  path: z.string().min(1),
  kind: HunkKindSchema,
});

export const HunkRefSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
});

export const ScorePredictionInputSchema = z.object({
  model: ChangeModelSchema,
  picked: z.array(z.string()),
});

export const PickDecoysInputSchema = z.object({
  model: ChangeModelSchema,
  changeModelId: z.string().min(1),
  files: z.array(PrFileSchema),
  hunks: z.array(HunkRefSchema),
});

export const BuildChipsInputSchema = PickDecoysInputSchema;

export type PredictionScore = z.infer<typeof PredictionScoreSchema>;
export type Chip = z.infer<typeof ChipSchema>;
export type PrFile = z.infer<typeof PrFileSchema>;
export type HunkRef = z.infer<typeof HunkRefSchema>;
export type ScorePredictionInput = z.infer<typeof ScorePredictionInputSchema>;
export type PickDecoysInput = z.infer<typeof PickDecoysInputSchema>;
export type BuildChipsInput = z.infer<typeof BuildChipsInputSchema>;

function sortedUnique(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

function affectedComponents(model: ChangeModel) {
  return model.components.filter((c) => AFFECTED.has(c.status));
}

function affectedIds(model: ChangeModel): string[] {
  return affectedComponents(model).map((c) => c.id);
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[], seedText: string): T[] {
  const out = [...items];
  const rand = mulberry32(hashSeed(seedText));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function toKebab(raw: string): string | null {
  const slug = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

function pathDecoyId(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  const file = parts[parts.length - 1] ?? "";
  const stem = file.replace(/\.[^.]+$/, "");
  const parent = parts.length >= 2 ? parts[parts.length - 2]! : "";
  return toKebab(parent && parent !== "." ? parent : stem);
}

function filesTouchedByAffected(model: ChangeModel, hunks: readonly HunkRef[]): Set<string> {
  const hunkFile = new Map(hunks.map((h) => [h.id, h.file]));
  const touched = new Set<string>();
  for (const c of affectedComponents(model)) {
    for (const hunkId of c.hunks) {
      const file = hunkFile.get(hunkId);
      if (file) touched.add(file);
    }
  }
  return touched;
}

export function scorePrediction(input: ScorePredictionInput): PredictionScore {
  const affected = new Set(affectedIds(input.model));
  const picked = new Set(input.picked);
  const hits = sortedUnique([...picked].filter((id) => affected.has(id)));
  const missed = sortedUnique([...affected].filter((id) => !picked.has(id)));
  const falseAlarms = sortedUnique([...picked].filter((id) => !affected.has(id)));
  return { hits, missed, falseAlarms };
}

export function pickDecoys(input: PickDecoysInput): Chip[] {
  const taken = new Set(input.model.components.map((c) => c.id));
  const decoys: Chip[] = [];

  const context = seededShuffle(
    input.model.components.filter((c) => c.status === "context"),
    `${input.changeModelId}:context`,
  );
  for (const c of context) {
    if (decoys.length >= MAX_DECOYS) break;
    decoys.push({ id: c.id, label: c.label });
    taken.add(c.id);
  }

  const touched = filesTouchedByAffected(input.model, input.hunks);
  const pathCandidates = seededShuffle(
    input.files.filter((f) => !touched.has(f.path)),
    `${input.changeModelId}:paths`,
  );
  for (const file of pathCandidates) {
    if (decoys.length >= MAX_DECOYS) break;
    const id = pathDecoyId(file.path);
    if (!id || taken.has(id)) continue;
    decoys.push({ id, label: id });
    taken.add(id);
  }

  return decoys;
}

export function buildChips(input: BuildChipsInput): Chip[] {
  const affected = affectedComponents(input.model).map((c) => ({ id: c.id, label: c.label }));
  const decoys = pickDecoys(input);
  return seededShuffle([...affected, ...decoys], `${input.changeModelId}:chips`);
}
