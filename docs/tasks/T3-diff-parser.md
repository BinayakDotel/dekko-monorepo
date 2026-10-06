---
id: T3
title: Diff parser and validateAgainstDiff
status: in progress
base: main
pr: ""
depends: [T2]
---

## Goal
Turn a unified diff into addressable hunks, and check a ChangeModel only cites hunks that exist.
Hunk ids are h1..hn in diff order, stable per head SHA (DECISIONS 2026-10-06).
Each Hunk also carries its text. `parseDiff` returns `{ hunks, skippedFiles }`.

## Files
- packages/core/src/schema.ts
- packages/core/src/index.ts
- docs/SPEC-F1.md
- docs/DECISIONS.md
- packages/core/test/fixtures/ (3 real diffs: small, medium, one with a lockfile; create with `just fixture`)

## Done when
`parseDiff(text)` returns `{ hunks, skippedFiles }` where each hunk is
`{ id, file, startLine, endLine, kind, text }` with lockfiles and generated files listed in
`skippedFiles`, and `validateAgainstDiff(model, hunks)` reports every unknown hunk id,
both covered by fixture tests on 3 real diffs.

## Verify
just test-q && just typecheck

## Decisions
- Hunk ranges: store `oldStart`, `oldLines`, `newStart`, `newLines` from the `@@` header. No special case; UI defaults to the new side.
- `kind` from the file header, not line composition: `added` (new file mode), `removed` (deleted file mode), `renamed` (rename from), else `modified`.
- `text`: full hunk including the `@@` header.
- `skippedFiles`: `string[]` of paths.
- Skip: lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `go.sum`, `*.lock`), generated (`*.min.js`, `*.min.css`, `dist/`, `build/`, `.next/`, `*.map`, `*.snap`), and binary diffs — binaries listed in `skippedFiles`.
- `validateAgainstDiff` → `{ ok: true } | { ok: false; unknownHunkIds: string[] }`, checking ids on components, edges, keyHunks, questions.
- Export Zod schemas + inferred types for `Hunk` / parse result from `diff.ts`, re-export via `index.ts`.
- Fixtures: human creates 3 real diffs with `just fixture` before `/build`.

## Outcome

