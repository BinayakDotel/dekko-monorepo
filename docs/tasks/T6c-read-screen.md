---
id: T6c
title: Read screen
status: todo
base: main
pr: ""
depends: [T6b]
---

## Goal
Show the top key hunks (rank order, max 3) one at a time, each with its one-line why.

## Files
- docs/designs/prototype.html (Read screen)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (new)

## Done when
Manual: key hunks show one per screen with file path, line numbers and why. Next and Back work, and
the last screen's button reads "I've read these, ask me" and goes to Answer (T7).

## Verify
Manual on one PR session.

## Decisions
See T6 Decisions. No "Show the whole diff".

## Outcome
