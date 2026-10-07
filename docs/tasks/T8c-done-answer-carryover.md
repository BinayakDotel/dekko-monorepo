---
id: T8c
title: Done screen + answer carryover
status: in review
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/16"
depends: [T8b]
---

## Goal
Replace the T8b done stub with `V.done`: `getDoneView`, praise/close copy, `edgeCase`, home CTA. Wire answer-screen "This grade is wrong" + "See ref" to `addCorrection` / `EvidenceSheet`. Extend BriefChrome for done step.

## Files
- apps/web/convex/briefs.ts (`getDoneView`; extend `getAnswerView`; `addCorrection` dedupe)
- apps/web/app/session/[sessionId]/done/page.tsx (replace T8b stub)
- apps/web/app/session/[sessionId]/answer/[n]/page.tsx (grade dispute + See ref)
- apps/web/components/BriefChrome.tsx (`BriefStep` includes 4; no current bar at done)
- apps/web/components/EvidenceSheet.tsx (prop to hide "This is wrong" for See ref)
- packages/core/src/… (`formatElapsed` + unit tests; path chosen at implement)
- Reference: docs/design/prototype.html (`V.done`, dispute/evidence, ~352–359, 426–427)

## Done when
Manual: Finish → full done screen; score ≥ 2 praise vs close; `edgeCase` shown; home works; after grade, "This grade is wrong" persists and "See ref" opens the cited hunk in the sheet.

## Verify
Manual on 3 PRs. `just check`.

## Decisions
- **Depends on T8b** for `addCorrection`, `EvidenceSheet`, `completeSession`, and the `/done` route.
- **`getDoneView(sessionId)`:** Requires `completedAt`; else `null` → `notFound()`. Headline if `score >= 2` ("You understand this change.") else "You're close. One more pass." (missing score → 0). Body: `{score} of {questions.length} questions right.` + `model.edgeCase` as the one-thing-to-fix line (plain text). No prototype “small” pass/fail line. No PR comment / retry links (out of F1). Primary CTA: “Back to pull requests” → `/`.
- **Elapsed time:** `getDoneView` returns `elapsedMs` (`completedAt - startedAt`). Pure `formatElapsed(ms)` in `@dekko/core` with unit tests (wall-clock, no soft cap): `<60s` → `S s`; `<60min` → `M min S s`; else → `H h M min` (so overnight is e.g. `14 h 3 min`, not a raw minute dump). If `startedAt` missing, omit the time label (no placeholder). Done page passes `formatElapsed(elapsedMs)` as `timeLabel` when present.
- **Brief chrome:** `BriefStep = 0|1|2|3|4`; done uses `step={4}`. Bar rule stays `i < step` → done, `i === step` → current (so at 4 all four bars done, none current). BriefChrome today has no “Step N of 4” text — keep it that way. If/when bars get `aria-current`, only when `i === step` and `step < STEP_COUNT` (never at step 4).
- **Answer carryover — dispute:** “This grade is wrong” → `addCorrection(..., "grade", questionId, "Marked wrong")`. `getAnswerView` returns per-answer (or per-question) `gradeDisputed` from existing corrections so the link is disabled on load. Toast on success like reveal. **`addCorrection` server dedupe:** T8b does not dedupe today (client-only); add skip-if-exists for same `sessionId` + `target` + `targetId` (covers grade and also hardens node/edge).
- **Answer carryover — See ref:** Extend `getAnswerView` with `hunkId` + cited hunk payload (reuse `loadHunksByIds`). “See ref” opens `EvidenceSheet` for that hunk. If hunkId does not resolve, hide the link (no empty sheet). **`EvidenceSheet`:** add a prop to hide “This is wrong” (See ref is not a node/edge correction). File count: five app files + core `formatElapsed` — no split.

## Outcome
Shipped `getDoneView` + done screen (praise/close by score ≥ 2, `edgeCase`, home CTA, `formatElapsed`), answer-grade dispute + See-ref sheet (`showMarkWrong={false}`), and `addCorrection` server dedupe. Pure elapsed formatting lives in `@dekko/core` with unit tests. Risk: done is unreachable until `completeSession` runs; visiting `/done` early 404s by design.

