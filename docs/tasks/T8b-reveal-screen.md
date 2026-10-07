---
id: T8b
title: Reveal + done screens (Convex + UI)
status: in progress
base: main
pr: ""
depends: [T8a]
---

## Goal
Reveal screen: load session + model via Convex, render core SVG, prediction overlay, teaching list, evidence sheet, corrections; wire T7b dispute/evidence links; Finish → done summary route.

## Files
- apps/web/convex/briefs.ts (`getRevealView`, `getDoneView`, `addCorrection`, `completeSession`)
- apps/web/app/session/[sessionId]/reveal/page.tsx (new)
- apps/web/app/session/[sessionId]/done/page.tsx (new)
- apps/web/components/EvidenceSheet.tsx (new)
- apps/web/components/RevealMap.tsx (new; client: focus, open sheet)
- apps/web/app/session/[sessionId]/answer/[n]/page.tsx (grade dispute + See ref)
- Reference: docs/design/prototype.html (`V.reveal`, `V.done`, `openSheet`, ~326–359, 435–446)
- Reference: apps/web/app/session/[sessionId]/read/[n]/page.tsx (hunk lines)

## Done when
Manual on 3 PRs: every **drawn** component and edge opens cited hunks in the sheet; path-decoy false alarms appear in the list only; corrections persist; Finish shows done screen.

## Verify
Manual on 3 PRs. `just check`.

## Decisions
- **Stacking:** Builds on T8a exports (`renderRevealSvg`, `edgeTargetId`). No duplicate layout logic in the app.
- **`getRevealView(sessionId)`:** PR title, `predictionScore`, full `ChangeModel`, cited hunk payloads (text + file + line metadata for read-style rendering), session answers (for grade targets), optional existing corrections. Include enough to render map + lists without returning `expectedAnswer`.
- **Map vs list (Q6):**
  - **Map:** All `model.components` (including `context`). Ticked **context** components use false-alarm overlay on the node.
  - **Not on map:** Path-derived decoys (false-alarm chip ids that are **not** in `model.components`) — **list only**, under false alarms, same copy pattern as prototype.
  - **List sections:** Missed, false alarms (context + path decoys), hits — order matches prototype (`miss`, then `fa`, then `hit`). One-line teaching text per row; tap opens sheet.
- **Evidence sheet (Q5):** For a node or edge, list **all cited hunk ids** in order (`component.hunks` or `edge.hunks`). **First hunk expanded** (read-style block); remaining hunks collapsed/disclosure rows that expand in place. Show label, confidence, file, line. Edge sheet title uses relation + `from → to`. No rule/downstream blocks (F1).
- **Corrections:** `addCorrection(sessionId, target, targetId, note)` with fixed note `"Marked wrong"`. Targets: `node` = component id; `edge` = `edgeTargetId(...)`; `grade` = question id. Toast on success. Sheet and answer screen both expose "This is wrong" / "This grade is wrong".
- **Answer carryover (Q7):** On answer screen after grade: "This grade is wrong" → `addCorrection(..., "grade", questionId, ...)`. "See ref" opens evidence sheet for that answer's `lineRef.hunkId` (reuse `EvidenceSheet`).
- **Finish (Q8):** Reveal primary **Finish** calls `completeSession` (sets `completedAt` only here), then navigates to **`/session/[sessionId]/done`** — not home directly.
- **Done screen (`V.done`):** `getDoneView(sessionId)` after completion: headline praise if `score >= 2` ("You understand this change."), else "You're close. One more pass."; subcopy `{score} of 3 questions right.`; **`model.edgeCase`** as the single "one thing to fix before merge" line (plain text, no extra AI). Primary button → home (`/`). No PR comment / retry links from prototype (out of F1).
- **Brief chrome:** Reveal = step 3 ("last step"); done = step 4 or post-brief summary per prototype time label pattern.

## Outcome
