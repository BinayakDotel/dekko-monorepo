---
id: T2
title: ChangeModel Zod schema
status: done
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/1"
depends: [T1]
---

## Goal
ChangeModel Zod schema with cross-field checks (unique ids, edge endpoints, ranks 1..n, one question per kind).

## Files
- packages/core/src/schema.ts
- packages/core/src/schema.test.ts
- docs/SPEC-F1.md

## Done when
Schema parse tests pass; invalid models are rejected at the specific issue path.

## Verify
just test-q

## Decisions
- confidence is a number 0–1 (UI buckets it; below 0.6 is drawn dashed).
- Enums are closed with `other`; component kinds include `external`.
- Question kinds are spelled `data-flow`, `failure`, `debugging`.
- Cardinalities are strict (exactly 3 questions, 1–3 key hunks); the AI layer retries on failure.

## Outcome
Typed contract every later ticket reads and writes. Risk: strict cardinalities force AI retry rather than loosened schema.
