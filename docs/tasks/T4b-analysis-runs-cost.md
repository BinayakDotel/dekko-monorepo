---
id: T4b
title: analysisRuns table + costUsd
status: in progress
base: main
pr: ""
depends: [T4a]
---

## Goal
Persist every successful `analyze` call in an append-only `analysisRuns` table so T9 can log cost per PR. Add `costUsd` in `@dekko/core` (tokens only; recompute from a price table). Do not change the brief delete-on-force lifecycle.

## Files
- packages/core/src/cost.ts (new) + cost.test.ts: price table + `costUsd(usage, priceKey)`
- packages/core/src/index.ts: re-export `costUsd`
- apps/web/convex/schema.ts: `analysisRuns` table
- apps/web/convex/briefs.ts: after successful analyze, insert one `analysisRuns` row

## Done when
- `costUsd` returns the right dollars for known token counts (mocked tests).
- `analyzePr` inserts `{ repo, prNumber, headSha, briefId, provider, upstream?, model, attempts, usage, at }` after every successful analyze; delete-on-force unchanged.
- Brief’s existing `usage: v.any()` left in place (cleanup later).

## Verify
- `just test-q` and `just check`.
- Manual: run one PR end to end; confirm an `analysisRuns` row in the Convex dashboard; charged OpenRouter cost matches `costUsd` to within rounding.

## Decisions
- **Depends on T4a** for `AnalyzeResult.provider` and `upstream`.
- **Separate table, not in-place append:** sessions hang off ChangeModel IDs in the brief. Force re-run must keep deleting/recreating the brief so old sessions stay coherent. Cost history lives elsewhere.
- **`analysisRuns`:** append-only, one row per successful analyze: `{ repo, prNumber, headSha, briefId, provider, upstream?, model, attempts, usage, at }`, indexed by `(repo, prNumber)`. Insert after every successful `analyzePr` call (including after force recreate).
- **Brief `usage`:** leave `usage: v.any()` as-is; removing it is a later cleanup.
- **Cost:** store tokens only. `costUsd(usage, priceKey)` with keys like `"openrouter:openai/gpt-oss-120b"` (provider + model). Prices = pinned upstream’s listed $/M from T4a’s Decisions. `upstream` on the run covers pin changes; old rows stay priceable. Groq/Anthropic rows optional later.
- **Known gap (note in Outcome):** a run that fails all 3 attempts throws without returning usage, so failed runs aren’t costed.

## Outcome
