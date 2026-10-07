---
id: T7b
title: gradeAnswer action + Answer screen
status: in review
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/12"
depends: [T7a]
---

## Goal
Convex `gradeAnswer` action, `getAnswerView` query, and the Answer screen replacing the T6d placeholder.

## Files
- apps/web/convex/schema.ts (answer.lineRef → `{ hunkId, line }`)
- apps/web/convex/briefs.ts (gradeAnswer action, internal load/store, getAnswerView)
- apps/web/app/session/[sessionId]/answer/[n]/page.tsx (replace placeholder)
- Reference: packages/core/src/ai/grade.ts (`grade()`), packages/core/src/answer.ts (`scoreAnswers`, `formatLineRef`)
- Reference: docs/design/prototype.html (V.answer, ~line 314), apps/web/app/session/[sessionId]/read/[n]/page.tsx, docs/SPEC-F1.md

## Done when
Manual: three verdicts (right / partly / wrong), each with a `path:L42` line ref.

## Verify
Manual on one PR session. `just check`.

## Decisions
- `gradeAnswer(sessionId, questionId, text)` action: an internal query loads the question and its hunks, calls core `grade()`, then an internal mutation stores the answer. Returns `{ verdict, explanation, lineRef }`.
- Stored answer: `{ questionId, text, verdict, explanation, lineRef: { hunkId, line } }`. The schema changes from `lineRef: string`. No existing sessions have answers, so no migration is needed.
- One grade per question. The mutation rejects a second answer for the same questionId. After grading, the textarea is read-only.
- When the third answer is stored, the mutation sets `score = scoreAnswers(answers)` (count of right, 0–3). `completedAt` is set by T8 at Finish, not here.
- `getAnswerView(sessionId)` returns title, questions `{ id, kind, text }`, stored answers, and the hunk `file` for each answer's lineRef. It never returns expectedAnswer. The `path:L42` text comes from core `formatLineRef`, not hand-built in the page.
- UI matches prototype V.answer: one question per screen, textarea "Answer without looking at the code", primary "Check my answer" (disabled until trimmed text is non-empty), then feedback using ok / warn / bad colors for right / partly / wrong, explanation, and the line ref as mono `path:L42` text. Next: "Next question", or "Show me the map" on the last question (links to the T8 reveal route).
- Grader failure: show an inline error with a retry button. The answer text is kept.
- Deferred to T8: the "This grade is wrong" link (addCorrection), the "See <ref>" evidence sheet, and completedAt.
- The `?noRead=1` note from the placeholder stays.

## Outcome
- Core `appendAnswer(answers, next, questionCount)` rejects a second answer for a question and returns `score` once every question is answered; unit-tested.
- Schema `answer.lineRef` is `{ hunkId, line }`; the answer validator is exported from `schema.ts` and reused by `storeAnswer`.
- `gradeAnswer` action: `loadGradeInput` (internal query, rejects already-answered or unknown questions before the model call) → core `grade()` → `storeAnswer` (internal mutation via `appendAnswer`). `getAnswerView` returns title, questions, and answers with `ref` from `formatLineRef`; no expectedAnswer.
- Answer page matches V.answer: read-only after grading, ok/warn/bad feedback ("Correct." / "Partly right." / "Not quite."), mono `path:L42`, "Next question" / "Show me the map" (→ `/session/<id>/reveal`), inline retry on grader failure, `?noRead=1` note kept.
- Follow-ups: no Convex tests (convex-test not installed); `clampIndex`/`LoadingStatus`/redirect hook are duplicated from the Read page (extract in a separate refactor).
- Risk: `gradeAnswer` is public and does not check session ownership (same as existing functions), so anyone with a session id can spend grader tokens.
