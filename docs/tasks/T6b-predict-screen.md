---
id: T6b
title: Convex provider, URL form, Predict screen
status: todo
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

## Done when
Manual: the URL form analyzes a PR and opens Predict. The title, file list and chips render. The lock
button stays disabled until a chip is picked, and locking stores a scored session and goes to
`/session/[id]/read/0`.

## Verify
Manual on one PR.

## Decisions
See T6 Decisions (routes, chips, userId). Uses `NEXT_PUBLIC_CONVEX_URL` only.

## Outcome
