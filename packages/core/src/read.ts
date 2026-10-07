import { z } from "zod";
import { HunkIdSchema, type KeyHunk } from "./schema";

const FALLBACK_FOCUS_LINES = 14;
const WINDOW_PAD = 3;
const FALLBACK_WHEN_LONGER_THAN = 20;

export const ReadHunkRowSchema = z.object({
  hunkId: HunkIdSchema,
  file: z.string().min(1),
  oldStart: z.number().int().nonnegative(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  newLines: z.number().int().nonnegative(),
  text: z.string().min(1),
});

export const FocusSourceSchema = z.enum(["model", "fallback", "none"]);

export const ReadHunkSchema = ReadHunkRowSchema.extend({
  why: z.string().min(1),
  rank: z.number().int().min(1),
  focus: FocusSourceSchema,
  windowStart: z.number().int().optional(),
  windowEnd: z.number().int().optional(),
});

export const ReadLineSchema = z.object({
  n: z.number().int().positive().nullable(),
  text: z.string(),
  kind: z.enum(["add", "del", "ctx"]),
});

export type ReadHunkRow = z.infer<typeof ReadHunkRowSchema>;
export type ReadHunk = z.infer<typeof ReadHunkSchema>;
export type ReadLine = z.infer<typeof ReadLineSchema>;
export type FocusSource = z.infer<typeof FocusSourceSchema>;

function clampWindow(
  start: number,
  end: number,
  newStart: number,
  newLines: number,
): { windowStart: number; windowEnd: number } {
  const last = newStart + newLines - 1;
  return {
    windowStart: Math.max(newStart, start),
    windowEnd: Math.min(last, end),
  };
}

function padWindow(
  start: number,
  end: number,
  newStart: number,
  newLines: number,
): { windowStart: number; windowEnd: number } {
  return clampWindow(start - WINDOW_PAD, end + WINDOW_PAD, newStart, newLines);
}

function firstLineOfKind(lines: readonly ReadLine[], kind: ReadLine["kind"]): number | null {
  for (const line of lines) {
    if (line.kind === kind && line.n !== null) return line.n;
  }
  return null;
}

function firstNewSideLine(lines: readonly ReadLine[]): number | null {
  for (const line of lines) {
    if (line.n !== null) return line.n;
  }
  return null;
}

function fallbackFocusRange(row: ReadHunkRow): { start: number; end: number } {
  const lines = toReadLines(row);
  const center =
    firstLineOfKind(lines, "add") ?? firstNewSideLine(lines) ?? row.newStart;
  const last = row.newStart + row.newLines - 1;
  let start = Math.max(row.newStart, center - Math.floor((FALLBACK_FOCUS_LINES - 1) / 2));
  let end = start + FALLBACK_FOCUS_LINES - 1;
  if (end > last) {
    end = last;
    start = Math.max(row.newStart, end - FALLBACK_FOCUS_LINES + 1);
  }
  return { start, end };
}

function resolveFocus(
  key: KeyHunk,
  row: ReadHunkRow,
): Pick<ReadHunk, "focus" | "windowStart" | "windowEnd"> {
  if (row.newLines === 0) return { focus: "none" };

  if (key.focusStart != null && key.focusEnd != null) {
    return {
      focus: "model",
      ...padWindow(key.focusStart, key.focusEnd, row.newStart, row.newLines),
    };
  }

  if (row.newLines <= FALLBACK_WHEN_LONGER_THAN) return { focus: "none" };

  const { start, end } = fallbackFocusRange(row);
  return {
    focus: "fallback",
    ...padWindow(start, end, row.newStart, row.newLines),
  };
}

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
    out.push({ ...row, why: key.why, rank: key.rank, ...resolveFocus(key, row) });
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

/** New-side lines in [windowStart, windowEnd], plus delete rows between them. */
export function sliceReadLines(
  lines: readonly ReadLine[],
  windowStart: number,
  windowEnd: number,
): ReadLine[] {
  const inWindow = (line: ReadLine) =>
    line.n !== null && line.n >= windowStart && line.n <= windowEnd;
  let first = -1;
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!inWindow(lines[i]!)) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0) return [];
  return lines.slice(first, last + 1);
}

export function focusWindowCoversHunk(
  hunk: Pick<ReadHunk, "focus" | "newStart" | "newLines" | "windowStart" | "windowEnd">,
): boolean {
  if (hunk.focus === "none") return true;
  if (hunk.windowStart === undefined || hunk.windowEnd === undefined) return true;
  if (hunk.newLines === 0) return true;
  const last = hunk.newStart + hunk.newLines - 1;
  return hunk.windowStart <= hunk.newStart && hunk.windowEnd >= last;
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

function useFullHunk(hunk: ReadHunk, expanded: boolean): boolean {
  return (
    expanded ||
    focusWindowCoversHunk(hunk) ||
    hunk.windowStart === undefined ||
    hunk.windowEnd === undefined
  );
}

/** Lines shown on Read for the current expand state. */
export function visibleReadLines(hunk: ReadHunk, expanded: boolean): ReadLine[] {
  const all = toReadLines(hunk);
  if (useFullHunk(hunk, expanded)) return all;
  return sliceReadLines(all, hunk.windowStart!, hunk.windowEnd!);
}

/** Range label for the lines currently on screen. */
export function visibleRangeLabel(hunk: ReadHunk, lines: ReadLine[], expanded: boolean): string {
  if (useFullHunk(hunk, expanded)) return hunkRangeLabel(hunk);
  const numbered = lines.filter((l) => l.n !== null);
  if (numbered.length === 0) return hunkRangeLabel(hunk);
  const start = numbered[0]!.n!;
  const end = numbered[numbered.length - 1]!.n!;
  return hunkRangeLabel({
    oldStart: hunk.oldStart,
    oldLines: hunk.oldLines,
    newStart: start,
    newLines: end - start + 1,
  });
}
