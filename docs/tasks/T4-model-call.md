---
id: T4
title: Model call analyze.ts
status: in progress
base: main
pr: ""
depends: [T3]
---

## Goal
Model call in `packages/core/src/ai/analyze.ts` via Vercel AI SDK (provider from env: groq | anthropic), structured output = ChangeModel.

## Files
- packages/core/src/schema.ts
- packages/core/src/diff.ts
- docs/SPEC-F1.md
- AGENTS.md (non-negotiables)

## Done when
A test with a mocked provider passes; one manual run succeeds against a real PR diff.

## Verify
just test-q

## Decisions

## Outcome
