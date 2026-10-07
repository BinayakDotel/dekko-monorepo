---
id: T6d
title: Read screen
status: in progress
base: main
pr: ""
depends: [T6c]
---

## Goal
Show the top key hunks (rank order, max 3) one at a time, each with its one-line why, inside the
shared `BriefChrome` from T6c.

## Files
- docs/design/prototype.html (Read screen, `.code`, `.lead`, `.step`)
- packages/core/src/read.ts (new; `toReadLines`, `hunkRangeLabel`)
- packages/core/src/read.test.ts (new)
- packages/core/src/index.ts (export)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (replace placeholder)
- apps/web/app/session/[sessionId]/answer/[n]/page.tsx (new placeholder until T7)

## Done when
Manual: key hunks show one per screen with file path, line numbers and why. Next and Back work, and
the last screen's button reads "I've read these, ask me" and goes to the Answer placeholder.

## Verify
`just test-q` for `read.test.ts`. Manual on one PR session.

## Decisions
- See T6 Decisions. No "Show the whole diff".
- Data: `getBrief(sessionId)`. Sort `model.keyHunks` by `rank`, join to `hunks` by `hunkId`, and
  skip any without a row. No backend change.
- `toReadLines(hunk)` in core (pure, Zod-exported types): drops the `@@` header, strips the
  `+` / `-` / space prefix, returns `{ n: number | null, text, kind: "add" | "del" | "ctx" }[]`.
  `n` is the new-side line number for `add` and `ctx`, and `null` for `del`. Ignore
  `\ No newline at end of file`.
- Line styles: `add` uses `bg-ok-soft`, `del` uses `bg-bad-soft` with an empty number column,
  `ctx` is plain. Number column is muted, mono, not selectable (prototype `.ln`).
- File header range: `lines {newStart}–{newStart+newLines−1}`. For a pure deletion
  (`newLines = 0`), use the old range. One-line ranges read `line N`. Lives in core as
  `hunkRangeLabel(hunk)`.
- Step label: `Read {i+1} of {N} · {K} lines`, where K = the number of lines shown (all of
  `toReadLines`, header excluded).
- Out-of-range or non-numeric `n` redirects to the last valid hunk (negative to 0). A missing
  session or brief is `notFound()`.
- Chrome: `step={1}`, `timeLabel="about {N − i + 1} min left"`.
- Nav: Next and Back are `next/link` links; Back is hidden on the first screen. The last screen's
  primary link reads "I've read these, ask me" and goes to `/session/[sessionId]/answer/0`.
- Add an Answer placeholder page (like the old Read placeholder) so that link doesn't 404 before
  T7. T7 replaces it.
- Page is "use client" (Convex `useQuery`); the code block and why are presentational pieces with
  typed props.

## Outcome
