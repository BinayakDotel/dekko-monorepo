---
id: T4b
title: analysisRuns table + costUsd
status: done
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/18"
depends: [T4a]
---

## Goal
Persist every successful `analyze` call in an append-only `analysisRuns` table so T9 can log cost per PR. Add `costUsd` in `@dekko/core` (tokens only; recompute from a price table). Do not change the brief delete-on-force lifecycle.

## Files
- packages/core/src/cost.ts (new) + cost.test.ts: `priceKey`, price table, `costUsd`
- packages/core/src/index.ts: re-export `priceKey`, `costUsd`
- apps/web/convex/schema.ts: `analysisRuns` table
- apps/web/convex/briefs.ts: insert run row in the same mutation as the brief

## Done when
- `priceKey` and `costUsd` return the right strings/dollars for known inputs (mocked tests); unknown key throws.
- Successful `analyzePr` persists one `analysisRuns` row (same mutation as brief insert); delete-on-force unchanged and never deletes runs.
- Brief’s existing `usage: v.any()` left in place (cleanup later).

## Verify
- `just test-q` and `just check`.
- Manual: run one PR end to end; confirm an `analysisRuns` row in the Convex dashboard; compare `costUsd` to OpenRouter’s activity-page charge (catches undercount if reasoning/undefined tokens aren’t in `outputTokens`/`inputTokens`). Billing every input token at the uncached price may slightly overstate when cache hits occur — acceptable (errs high).

## Decisions
- **Depends on T4a** for `AnalyzeResult.provider` and `upstream`.
- **Separate table, not in-place append:** sessions hang off ChangeModel IDs in the brief. Force re-run keeps deleting/recreating the brief; cost history lives in `analysisRuns`.
- **`analysisRuns`:** append-only, one row per successful analyze: `{ repo, prNumber, headSha, briefId, provider, upstream?, model, attempts, usage, at }`. `briefId: v.id("changeModels")`, `at: Date.now()`, `usage` = required `v.number()` fields `{ inputTokens, outputTokens, totalTokens }`. Index: single `by_pr` on `[repo, prNumber]`. `headSha` stays on the row so T9 can tell force re-runs on the same commit from runs on new commits after the brief is deleted.
- **One mutation:** insert the run inside the same internal mutation that inserts the brief (extend `insertBrief` or one combined mutation). Separate action→mutation calls could leave a brief with no cost row. `deleteBrief` never touches `analysisRuns`. After force re-run, old rows may point at a deleted `briefId`; Convex allows that — T9 treats `db.get(briefId) === null` as normal.
- **Brief `usage`:** leave `usage: v.any()` as-is; removing it is a later cleanup.
- **`priceKey({ provider, upstream, model })`:** only way to build keys. Shape `provider:upstream:model` when `upstream` is set; drop the upstream segment when absent (Groq/Anthropic). Never split a key back into parts — OpenRouter model IDs can contain colons (e.g. `openai/gpt-oss-120b:free`).
- **Price table:** OpenRouter pin only for T4b — `openrouter:coreweave:openai/gpt-oss-120b` at CoreWeave’s $0.03 / $0.17 per 1M in/out (T4a). Groq/Anthropic later. `costUsd` throws on unknown key.
- **Billing tokens:** `inputTokens` + `outputTokens` only (`outputTokens` should already include reasoning in AI SDK; Verify catches undercount). Undefined token counts become 0 in analyze’s sum — same silent undercount; Verify catches it. Uncached input price on all input tokens may slightly overstate with cache hits — fine (errs high).
- **Recompute on read:** store tokens only; never persist dollars. `costUsd` in `@dekko/core` for tests and later T9 — not called from `analyzePr`. Editing a price-table row reprices historical runs; acceptable for dogfood. Add `effectiveFrom` only if a pin’s listed price actually changes.
- **Known gap (note in Outcome):** a run that fails all 3 attempts throws without returning usage, so failed runs aren’t costed.

## Outcome
Added `priceKey` / `costUsd` in `@dekko/core` (OpenRouter CoreWeave pin only) and an append-only `analysisRuns` table written in the same `insertBrief` mutation as the brief. Force re-run still deletes only the brief/hunks; historical runs stay for T9.

Why: T9 needs per-PR cost history that survives brief recreate; dollars stay recomputed from tokens so price-table edits reprice history.

Risk: runs that fail all 3 analyze attempts throw with no usage, so they are not costed (known gap). Manual Verify still needed against OpenRouter’s activity page for reasoning/undefined token undercount.
