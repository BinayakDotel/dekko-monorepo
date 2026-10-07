---
id: T8c
title: Done screen + answer carryover
status: in progress
base: main
pr: ""
depends: [T8b]
---

## Goal
Replace the T8b done stub with `V.done`: `getDoneView`, praise/close copy, `edgeCase`, home CTA. Wire answer-screen "This grade is wrong" + "See ref" to `addCorrection` / `EvidenceSheet`. Extend BriefChrome for done step.

## Files
- apps/web/convex/briefs.ts (`getDoneView`)
- apps/web/app/session/[sessionId]/done/page.tsx (replace T8b stub)
- apps/web/app/session/[sessionId]/answer/[n]/page.tsx (grade dispute + See ref)
- apps/web/components/BriefChrome.tsx (step 4 / all-steps-done for done)
- apps/web/components/EvidenceSheet.tsx (reuse from T8b for See ref)
- Reference: docs/design/prototype.html (`V.done`, dispute/evidence, ~352–359, 426–427)

## Done when
Manual: Finish → full done screen; score ≥ 2 praise vs close; `edgeCase` shown; home works; after grade, "This grade is wrong" persists and "See ref" opens the cited hunk in the sheet.

## Verify
Manual on 3 PRs. `just check`.

## Decisions
- **Depends on T8b** for `addCorrection`, `EvidenceSheet`, `completeSession`, and the `/done` route.
- **`getDoneView(sessionId)`:** After completion: headline if `score >= 2` ("You understand this change.") else "You're close. One more pass."; `{score} of 3 questions right.`; **`model.edgeCase`** as the one-thing-to-fix line (plain text). Primary → `/`. No PR comment / retry links (out of F1).
- **Brief chrome:** Extend beyond step 0–3 so done can show step 4 / all prior steps done; timeLabel per prototype pattern.
- **Answer carryover:** "This grade is wrong" → `addCorrection(..., "grade", questionId, "Marked wrong")`. "See ref" opens `EvidenceSheet` for that answer's `lineRef.hunkId`.

## Outcome
