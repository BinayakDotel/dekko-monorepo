---
id: T6c
title: Brief chrome + Predict matches prototype
status: done
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/9"
depends: [T6b]
---

## Goal
Extract the shared brief chrome (top bar with brand, PR title, step bar, time; centered column at
var(--measure) with var(--pad-screen)) into one component, and move Predict onto it.
While doing so, make Predict match docs/design/prototype.html exactly: step label .84rem muted,
question in font-display at 1.3rem, hint .88rem muted, chips .35rem .85rem at .88rem, sentence box
2 rows. Tokens only. Refactor only; the Read screen is T6d.

## Files
- docs/design/prototype.html (Predict screen, `briefTop`, `.steps`)
- apps/web/components/BriefChrome.tsx (new; shared top bar + column)
- apps/web/app/brief/[changeModelId]/page.tsx (use the chrome, restyle)

## Done when
Manual: Predict looks the same as the prototype's Predict screen, and locking still goes to
`/session/[sessionId]/read/0`.

## Verify
`just check`. Manual on one PR.

## Decisions
- Split from the original T6c: this ticket is the refactor (chrome + Predict restyle). The Read
  screen moved to T6d, stacked on this one. T7 now depends on T6d.
- `BriefChrome` props: `title`, `step` (0–3, the current step index) and `timeLabel` (string).
  The step bar marks steps before `step` as done (`bg-ok`), the current one `bg-accent`, the rest
  `bg-line`, matching the prototype's `.steps i.done` / `.on`.
- `BriefChrome` renders the top bar and the centered `<main>` column, taking the screen body as
  `children`. It's presentational: no data fetching, no "use client" of its own.
- Predict passes `step={0}` and `timeLabel="about 4 min"`. No behavior change.
- Predict's current values already mostly match; fix only what differs from the prototype CSS.
  Tokens only, no hex.

## Outcome
Extracted presentational `BriefChrome` (title, step 0–3, timeLabel, children column) and moved Predict onto it. Aligned Predict spacing/type with `docs/design/prototype.html` (brand 1.35rem, question line-height 1.3, textarea/chip/file gaps). Moved prototype path `docs/designs/` → `docs/design/`. Lock still routes to `/session/[sessionId]/read/0`. Risk: visual match is manual-only until T6d reuses the chrome.
