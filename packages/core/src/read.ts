import { z } from "zod";
import { HunkIdSchema, type KeyHunk } from "./schema";

export const ReadHunkRowSchema = z.object({
  hunkId: HunkIdSchema,
  file: z.string().min(1),
  oldStart: z.number().int().nonnegative(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  newLines: z.number().int().nonnegative(),
  text: z.string().min(1),
});

export const ReadHunkSchema = ReadHunkRowSchema.extend({
  why: z.string().min(1),
  rank: z.number().int().min(1),
});

export const ReadLineSchema = z.object({
  n: z.number().int().positive().nullable(),
  text: z.string(),
  kind: z.enum(["add", "del", "ctx"]),
});

export type ReadHunkRow = z.infer<typeof ReadHunkRowSchema>;
export type ReadHunk = z.infer<typeof ReadHunkSchema>;
export type ReadLine = z.infer<typeof ReadLineSchema>;

export function toReadHunks(
  keyHunks: readonly KeyHunk[],
  hunkRows: readonly ReadHunkRow[],
): ReadHunk[] {
  const byId = new Map(hunkRows.map((r) => [r.hunkId, r]));
  const sorted = [...keyHunks].sort((a, b) => a.rank - b.rank);
  const out: ReadHunk[] = [];
  for (const key of sorted) {
    const row = byId.get(key.hunkId);
    if (!row) continue;
    out.push({ ...row, why: key.why, rank: key.rank });
  }
  return out;
}

export function toReadLines(hunk: Pick<ReadHunkRow, "text" | "newStart">): ReadLine[] {
  const lines: ReadLine[] = [];
  let newLine = hunk.newStart;
  for (const raw of hunk.text.split(/\r?\n/)) {
    if (raw.startsWith("@@ ") || raw.startsWith("\\ No newline")) continue;
    if (raw.startsWith("+")) {
      lines.push({ n: newLine, text: raw.slice(1), kind: "add" });
      newLine += 1;
      continue;
    }
    if (raw.startsWith("-")) {
      lines.push({ n: null, text: raw.slice(1), kind: "del" });
      continue;
    }
    const text = raw.startsWith(" ") ? raw.slice(1) : raw;
    lines.push({ n: newLine, text, kind: "ctx" });
    newLine += 1;
  }
  return lines;
}

function rangeLabel(start: number, count: number): string {
  if (count <= 1) return `line ${start}`;
  return `lines ${start}–${start + count - 1}`;
}

export function hunkRangeLabel(
  hunk: Pick<ReadHunkRow, "oldStart" | "oldLines" | "newStart" | "newLines">,
): string {
  if (hunk.newLines === 0) return rangeLabel(hunk.oldStart, hunk.oldLines);
  return rangeLabel(hunk.newStart, hunk.newLines);
}
