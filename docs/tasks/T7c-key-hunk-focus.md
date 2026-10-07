---
id: T7c
title: Key-hunk focus ranges and sharper why lines
status: in progress
base: main
pr: ""
depends: [T6d]
---

## Goal
A key hunk may point at a focus range inside the hunk so Read shows the lines that matter, not the whole hunk.
The "why" line states the consequence or risk for a reviewer, not what the code does.

## Files
- packages/core/src/schema.ts (KeyHunk: optional focusStart, focusEnd, validated inside the hunk's new range)
- packages/core/src/prompts/analyze.ts (ask for focus ranges; why = consequence or risk, one sentence)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (show focus ± 3 lines; "Show the whole hunk" link)

## Done when
On a PR that adds a 100+ line file, Read shows at most ~20 lines for that hunk with an expand link.
The why line on each key hunk names a consequence or a risk. Existing fixtures still pass; schema tests cover the range check.

## Verify
just check; manual on skills-marketplace#5 (force re-run) and on dekko-monorepo#6