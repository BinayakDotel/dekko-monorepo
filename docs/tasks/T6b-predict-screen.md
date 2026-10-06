---
id: T6b
title: Convex provider, URL form, Predict screen
status: in progress
base: main
pr: ""
depends: [T6]
---

## Goal
Paste a PR URL on `/`, land on `/brief/[changeModelId]`, write one sentence, tick chips, lock.

## Files
- docs/designs/prototype.html (Predict screen)
- apps/web/app/ConvexClientProvider.tsx (new, "use client")
- apps/web/app/layout.tsx (wrap in provider)
- apps/web/app/page.tsx (replace template with URL form → `analyzePr`)
- apps/web/app/brief/[changeModelId]/page.tsx (new: Predict, `getPredictView` + `startSession`)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (new: placeholder until T6c)

## Done when
Manual: the URL form analyzes a PR and opens Predict. The title, file list and chips render. The lock
button stays disabled until at least one chip is picked and the trimmed sentence is ≥10 characters;
locking stores a scored session and goes to `/session/[id]/read/0`.

## Verify
Manual on one PR.

## Decisions
- Inherits T6: routes (`/` → `/brief/[changeModelId]` → `/session/[id]/read/0`), chips, `userId: "local"`,
  `NEXT_PUBLIC_CONVEX_URL` only.
- Lock gate (stricter than prototype): require ≥1 chip **and** trimmed `predictionText.length >= 10`.
  Button disabled until both; server still only rejects empty picks.
- File list collapsed by default; “show the list” toggle (prototype).
- Home: URL + Analyze only; no force control (cache hit returns existing brief).
- Unknown `changeModelId`: `notFound()` when `getPredictView` returns null.
- Brief chrome (step bar / brand / title) inline on Predict; extract in T6c if needed.
- Client boundaries: `ConvexClientProvider` wraps the tree; home and Predict are client pages/forms
  using `useAction` / `useQuery` / `useMutation`.
- Analyze UX: disable submit while pending; inline error on failure; pending copy:
  “Reading the diff and asking the model. Usually 10–40 seconds.”
- Post-lock: navigate to `/session/[id]/read/0`. Fits in 5 code files → add a minimal placeholder
  page there (T6c replaces it with the real Read UI).

## Outcome
