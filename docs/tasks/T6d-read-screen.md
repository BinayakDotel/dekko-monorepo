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
- packages/core/src/read.ts (new; `toReadHunks`, `toReadLines`, `hunkRangeLabel`)
- apps/web/convex/briefs.ts (add `getReadView`)
- packages/core/src/read.test.ts (new)
- packages/core/src/index.ts (export)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (replace placeholder)
- apps/web/app/session/[sessionId]/answer/[n]/page.tsx (new placeholder until T7)

## Done when
Manual: key hunks show one per screen with file path, line numbers and why. Next and Back work, and
the last screen's button reads "I've read these, ask me" and goes to the Answer placeholder. A
session with no readable hunks lands on the Answer placeholder with the no-code notice. The network
response for the Read page has no `expectedAnswer`.

## Verify
`just test-q` for `read.test.ts`. Manual on one PR session.

## Decisions
- See T6 Decisions. No "Show the whole diff".
- Data: new Convex query `getReadView(sessionId)` in `briefs.ts`, not `getBrief` (that one ships
  `expectedAnswer` to the browser). It returns `{ title, hunks }` and nothing else from the model.
  `hunks` holds the key hunks in rank order, each `{ hunkId, file, oldStart, oldLines, newStart,
  newLines, text, why, rank }`. It loads hunk rows only for the key hunk ids (via
  `by_changeModelId_and_hunkId`), not every cited hunk. Missing session or change model returns `null`.
- The sort and join is pure, so it goes in core as `toReadHunks(keyHunks, hunkRows)`: sort by `rank`,
  join by `hunkId`, skip any key hunk without a row. `getReadView` calls it. It is tested in
  `read.test.ts`.
- No readable hunks (empty `hunks`): the Read page redirects to
  `/session/[sessionId]/answer/0?noRead=1`. The Answer placeholder shows the one-line notice
  "No code to read for this change; go straight to the questions." when `noRead=1`. T7 keeps
  that notice.
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
- Out-of-range or non-numeric `n` redirects to the last valid hunk (negative to 0). A `null`
  read view is `notFound()`. While loading, show the same "Loading…" status line as Predict.
- Chrome: `step={1}`, `timeLabel="about {N − i + 1} min left"`.
- Nav: Next and Back are `next/link` links; Back is hidden on the first screen. The last screen's
  primary link reads "I've read these, ask me" and goes to `/session/[sessionId]/answer/0`.
- Add an Answer placeholder page (like the old Read placeholder) so that link doesn't 404 before
  T7. T7 replaces it.
- Page is "use client" (Convex `useQuery`); the code block and why are presentational pieces with
  typed props.

## Outcome
