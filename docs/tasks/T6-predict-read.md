---
id: T6
title: Predict backend (decoys, scoring, sessions)
status: in progress
base: main
pr: ""
depends: [T5]
---

## Goal
Backend for Predict + Read: pure decoy and scoring logic in core, PR title and file list stored
on `changeModels`, and `startSession` / `getSession` in Convex. UI is T6b (Predict) and T6c (Read).

## Files
- docs/SPEC-F1.md
- packages/core/src/predict.ts (new: `pickDecoys`, `scorePrediction`, Zod schemas)
- packages/core/src/predict.test.ts (new)
- packages/core/src/index.ts (export predict)
- apps/web/convex/schema.ts (changeModels: optional `title`, `files`; sessions: typed `predictionScore`)
- apps/web/convex/briefs.ts (store title + files in `analyzePr`; `getBrief` returns title, files, chips; add `startSession`, `getSession`)

## Done when
`just test-q` covers `pickDecoys` and `scorePrediction`. From the Convex dashboard: re-analyze one PR
with `force`, `getBrief` returns title, files and chips, `startSession` stores a scored session,
`getSession` returns it.

## Verify
`just check`; manual run in the Convex dashboard on one PR.

## Decisions
- Split approved: T6 (this, backend), T6b (Convex provider, home URL form, Predict screen), T6c (Read screen). T7 now depends on T6c.
- **Affected** = components with status `added` / `modified` / `removed`. Everything else on the chip list (`context` components and path-made decoys) is not affected.
- `scorePrediction({ model, picked }) → { hits, missed, falseAlarms }` (arrays of chip ids), Zod-exported. It's pure set arithmetic: hits = picked ∩ affected, missed = affected − picked, falseAlarms = picked − affected. Ticking a `context` component counts as a false alarm. Pure, in `packages/core`.
- `scorePrediction` test cases (`predict.test.ts`):
  - All affected ticked, nothing else: every affected id is a hit; missed and falseAlarms are empty.
  - Nothing affected ticked: hits are empty; missed holds every affected id.
  - A ticked `context` component lands in falseAlarms.
  - A ticked path-made decoy lands in falseAlarms.
  - A mix of affected, `context` and decoy ticks: each id lands in exactly one of hits, missed or falseAlarms. hits + missed = affected, and hits + falseAlarms = picked.
  - Duplicate picks count once; output order is stable (sorted).
- **Decoys** (`pickDecoys`): pure function in core, deterministic from `changeModelId` (seeded shuffle, no `Math.random`). Use the model's `context` components first. Then fill up to 3 with labels made from file paths that no affected component cites. Never take names from a fixed generic pool.
  - The repo tree isn't fetched, so "unchanged file paths" means PR files that no affected component's hunks touch. The label is the parent folder or file stem, made kebab-case, skipping any that clash with a real component id. If fewer than 3 candidates exist, show fewer.
- Chips = affected components + decoys, in a deterministic shuffle so real ones aren't listed first. `getBrief` returns `chips: { id, label }[]` and never says which chips are decoys.
- `analyzePr` stores `title` and `files: { path, kind }[]` from the parsed diff, plus skipped files. Both fields are optional in the schema so older docs still validate; re-run old PRs with `force: true`.
- `startSession({ changeModelId, predictionText, predictedComponents })`: the mutation recomputes chips and the score on the server (it never trusts a client-sent score) and inserts with `userId: "local"`, `answers: []`, `startedAt`. It rejects an empty pick list or ids that aren't chips. The prediction is locked: there's no update mutation.
- `getSession(sessionId)` returns the session plus `changeModelId`. The score is stored now but the UI shows it only on Reveal (T8).
- `predictionScore` changes from `v.any()` to a typed `v.object` of three string arrays.
- Routes (for T6b/T6c): `/` has the URL form, which calls `analyzePr` and then goes to `/brief/[changeModelId]`. That page is Predict; locking calls `startSession` and goes to `/session/[sessionId]/read/[n]`.
- No auth: `userId` is the constant `"local"`. "Show the whole diff" is out of scope.

## Outcome
