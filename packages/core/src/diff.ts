import { z } from "zod";
import { focusRangeError, HunkIdSchema, type ChangeModel } from "./schema";

export const HunkKindSchema = z.enum(["added", "modified", "removed", "renamed"]);

export const HunkSchema = z.object({
  id: HunkIdSchema,
  file: z.string().min(1),
  oldStart: z.number().int().nonnegative(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  newLines: z.number().int().nonnegative(),
  kind: HunkKindSchema,
  text: z.string().min(1),
});

export const ParseDiffResultSchema = z.object({
  hunks: z.array(HunkSchema),
  skippedFiles: z.array(z.string()),
});

export type Hunk = z.infer<typeof HunkSchema>;
export type HunkKind = z.infer<typeof HunkKindSchema>;
export type ParseDiffResult = z.infer<typeof ParseDiffResultSchema>;

const DIFF_GIT = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "go.sum",
]);

const GENERATED_DIR_SEGMENTS = new Set(["dist", "build", ".next"]);

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

function shouldSkipPath(path: string): boolean {
  const name = basename(path);
  if (LOCKFILE_NAMES.has(name) || name.endsWith(".lock")) return true;
  if (name.endsWith(".min.js") || name.endsWith(".min.css") || name.endsWith(".map") || name.endsWith(".snap")) {
    return true;
  }
  return path.split("/").some((seg) => GENERATED_DIR_SEGMENTS.has(seg));
}

function pushSkipped(skippedFiles: string[], file: string): void {
  if (!skippedFiles.includes(file)) skippedFiles.push(file);
}

function pathFromGitHeader(line: string): { oldPath: string; newPath: string } | null {
  const m = DIFF_GIT.exec(line);
  const oldPath = m?.[1];
  const newPath = m?.[2];
  if (!oldPath || !newPath) return null;
  return { oldPath, newPath };
}

function detectKind(headerLines: string[]): HunkKind {
  for (const line of headerLines) {
    if (line.startsWith("new file mode")) return "added";
    if (line.startsWith("deleted file mode")) return "removed";
    if (line.startsWith("rename from")) return "renamed";
  }
  return "modified";
}

function displayPath(kind: HunkKind, oldPath: string, newPath: string): string {
  return kind === "removed" ? oldPath : newPath;
}

function parseHunkHeader(line: string): Omit<Hunk, "id" | "file" | "kind" | "text"> | null {
  const m = HUNK_HEADER.exec(line);
  if (!m) return null;
  return {
    oldStart: Number(m[1]),
    oldLines: m[2] === undefined ? 1 : Number(m[2]),
    newStart: Number(m[3]),
    newLines: m[4] === undefined ? 1 : Number(m[4]),
  };
}

function skipToNextFile(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && !lines[i]?.startsWith("diff --git ")) i += 1;
  return i;
}

type FileMeta = { kind: HunkKind; file: string; binary: boolean; next: number };

function readFileMeta(
  lines: string[],
  start: number,
  paths: { oldPath: string; newPath: string },
): FileMeta {
  const headerLines: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("diff --git ") || line.startsWith("@@ ")) break;
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      const kind = detectKind(headerLines);
      return {
        kind,
        file: displayPath(kind, paths.oldPath, paths.newPath),
        binary: true,
        next: skipToNextFile(lines, i + 1),
      };
    }
    headerLines.push(line);
    i += 1;
  }
  const kind = detectKind(headerLines);
  return { kind, file: displayPath(kind, paths.oldPath, paths.newPath), binary: false, next: i };
}

function readOneHunk(
  lines: string[],
  start: number,
  meta: { file: string; kind: HunkKind },
  id: string,
): { hunk: Hunk; next: number } | null {
  const header = lines[start] ?? "";
  const ranges = parseHunkHeader(header);
  if (!ranges) return null;
  const body: string[] = [header];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("diff --git ") || line.startsWith("@@ ")) break;
    body.push(line);
    i += 1;
  }
  return { hunk: { id, file: meta.file, kind: meta.kind, text: body.join("\n"), ...ranges }, next: i };
}

export function parseDiff(text: string): ParseDiffResult {
  const lines = text.split(/\r?\n/);
  const hunks: Hunk[] = [];
  const skippedFiles: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const paths = pathFromGitHeader(lines[i] ?? "");
    if (!paths) {
      i += 1;
      continue;
    }
    const meta = readFileMeta(lines, i + 1, paths);
    i = meta.next;
    if (meta.binary || shouldSkipPath(meta.file)) {
      pushSkipped(skippedFiles, meta.file);
      if (!meta.binary) i = skipToNextFile(lines, i);
      continue;
    }
    while (i < lines.length && (lines[i] ?? "").startsWith("@@ ")) {
      const parsed = readOneHunk(lines, i, meta, `h${hunks.length + 1}`);
      if (!parsed) {
        i += 1;
        continue;
      }
      hunks.push(parsed.hunk);
      i = parsed.next;
    }
  }
  return { hunks, skippedFiles };
}

export type ValidateAgainstDiffResult =
  | { ok: true }
  | { ok: false; unknownHunkIds: string[]; focus?: string };

function citedHunkIds(model: ChangeModel): string[] {
  const ids: string[] = [];
  for (const c of model.components) ids.push(...c.hunks);
  for (const e of model.edges) ids.push(...e.hunks);
  for (const k of model.keyHunks) ids.push(k.hunkId);
  for (const q of model.questions) ids.push(...q.hunks);
  return ids;
}

function focusErrors(model: ChangeModel, hunks: readonly Hunk[]): string[] {
  const byId = new Map(hunks.map((h) => [h.id, h]));
  const messages: string[] = [];
  for (const key of model.keyHunks) {
    if (key.focusStart == null || key.focusEnd == null) continue;
    const hunk = byId.get(key.hunkId);
    if (!hunk) continue;
    const err = focusRangeError(
      { focusStart: key.focusStart, focusEnd: key.focusEnd },
      hunk,
    );
    if (err) messages.push(`${key.hunkId}: ${err}`);
  }
  return messages;
}

export function validateAgainstDiff(
  model: ChangeModel,
  hunks: readonly Hunk[],
): ValidateAgainstDiffResult {
  const known = new Set(hunks.map((h) => h.id));
  const unknownHunkIds: string[] = [];
  const seen = new Set<string>();
  for (const id of citedHunkIds(model)) {
    if (known.has(id) || seen.has(id)) continue;
    seen.add(id);
    unknownHunkIds.push(id);
  }
  const focusMsgs = focusErrors(model, hunks);
  if (unknownHunkIds.length === 0 && focusMsgs.length === 0) return { ok: true };
  const result: { ok: false; unknownHunkIds: string[]; focus?: string } = {
    ok: false,
    unknownHunkIds,
  };
  if (focusMsgs.length > 0) result.focus = focusMsgs.join("; ");
  return result;
}
