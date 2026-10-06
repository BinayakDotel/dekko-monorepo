---
id: T6c
title: Read screen
status: in progress
base: main
pr: ""
depends: [T6b]
---

## Goal
Show the top key hunks (rank order, max 3) one at a time, each with its one-line why.
Extract the shared brief chrome (top bar with brand, PR title, step bar, time; centered column at
var(--measure) with var(--pad-screen)) into one component used by Predict and Read. While doing so,
make Predict match docs/design/prototype.html exactly: step label .84rem muted, question in
font-display at 1.3rem, hint .88rem muted, chips .35rem .85rem at .88rem, sentence box 2 rows. Tokens only.

## Files
- docs/design/prototype.html (Predict and Read screens)
- apps/web/components/BriefChrome.tsx (new; shared top bar + column)
- apps/web/app/brief/[changeModelId]/page.tsx (restyle, use the chrome)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (new)

## Done when
Manual: key hunks show one per screen with file path, line numbers and why. Next and Back work, and
the last screen's button reads "I've read these, ask me" and goes to Answer (T7).

## Verify
Manual on one PR session.

## Decisions
See T6 Decisions. No "Show the whole diff".

## Outcome
