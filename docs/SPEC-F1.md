# F1 — The comprehension loop

## Goal

Given a GitHub PR URL, produce a four-step brief: Predict, Read, Answer, Reveal.
Store what the developer predicted, answered and scored. The diagram is shown last.

## Users

Me, on my own PRs, for the first two weeks. Then five friendly developers.

## Flow

1. Predict: show title + file list only. Developer writes one sentence and ticks
   components from a list (real ones from the change model plus 2–3 decoys).
   Lock the prediction. Score = ticked ∩ affected, missed, false alarms.
2. Read: show the top 3 key hunks one at a time, each with a one-line "why".
3. Answer: 3 questions (data flow, failure behavior, debugging). Each answer is
   graded: right / partly / wrong, a two-sentence explanation, and one line reference.
4. Reveal: the map with the prediction overlaid; list of missed and false-alarm
   components with one line each. "This is wrong" on any node, edge or grade.

## Data (Convex)

- changeModels: { repo, prNumber, headSha, model: ChangeModel, createdAt }
- sessions: { changeModelId, userId, predictionText, predictedComponents[],
  predictionScore, answers[{questionId, text, verdict, explanation, lineRef}],
  score, startedAt, completedAt }
- corrections: { sessionId, target: node|edge|grade, targetId, note, createdAt }

## ChangeModel (packages/core, Zod)

components[]: id, label, kind, status(added|modified|removed|context), hunks[], confidence
edges[]: from, to, relation, hunks[], confidence
keyHunks[]: hunkId, why, rank (1..3)
questions[]: id, kind, text, expectedAnswer, hunks[]
summary: string[3]; edgeCase: string

## Diff parsing (packages/core)

`parseDiff(text)` → `{ hunks, skippedFiles }`. Hunk ids are h1..hn in diff order
(stable per head SHA). Each hunk: id, file, oldStart, oldLines, newStart, newLines,
kind(added|modified|removed|renamed from file header), text (full hunk incl. @@).
Lockfiles, generated paths and binary diffs are omitted and listed in skippedFiles.
`validateAgainstDiff(model, hunks)` → `{ ok: true } | { ok: false; unknownHunkIds }`.

## API (Convex functions unless noted)

- action analyzePr(url) → changeModelId (fetch diff, parse, call model, store)
- mutation startSession(changeModelId, predictionText, predictedComponents) → sessionId
- action gradeAnswer(sessionId, questionId, text) → { verdict, explanation, lineRef }
- mutation addCorrection(sessionId, target, targetId, note)
- query getBrief(sessionId) → everything the four screens need

## Done when

- I can run the brief end to end on 3 of my own PRs.
- Every component and edge in the reveal opens its cited hunk.
- Sessions are stored and reloadable after a refresh.
- `pnpm test` passes; the diff parser has fixture tests.

## Out of scope (parked)

GitHub App, webhooks, gate, team view, rules, indexer, CLI. See the concept doc.
