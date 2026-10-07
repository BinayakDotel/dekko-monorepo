---
id: T4a
title: OpenRouter provider + persist usage
status: in progress
base: main
pr: ""
depends: [T4]
---

## Goal
Add `openrouter` as a third `AI_PROVIDER` in `packages/core/src/ai/analyze.ts`, running `openai/gpt-oss-120b` pinned to one upstream provider. Groq's free tier caps each request at 8K tokens per minute and paid upgrades are paused. Persist the `usage` that `analyze` already returns, so T9 can log cost per PR from the first session.

## Files
- packages/core/src/ai/analyze.ts: `openrouter` branch in the env adapter
- packages/core/src/ai/analyze.test.ts: env resolution for `openrouter` (no network)
- packages/core/src/cost.ts (new) + cost.test.ts: price table + `costUsd(usage, priceKey)`
- packages/core/src/index.ts: re-export `costUsd`
- packages/core/package.json: OpenRouter provider dependency
- apps/web/convex/briefs.ts: `analyzePr` saves `{ provider, model, attempts, usage }`
- apps/web/convex/schema.ts: usage field on the doc `analyzePr` writes
- AGENTS.md / .env.example: `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`

## Done when
- Mocked tests pass: `AI_PROVIDER=openrouter` resolves to the OpenRouter model with the default ID; `costUsd` returns the right dollars for known token counts.
- With `AI_PROVIDER=openrouter`, `just analyze <diff>` succeeds on the PR that failed on Groq ("Requested 8652, Limit 8000").
- Running `analyzePr` in the app saves provider, model, attempts, input tokens and output tokens.

## Verify
- `just test-q` and `just check`.
- Manual: run `just analyze` on the failing PR's diff, then run one PR end to end in the app and check the usage fields in the Convex dashboard.
- On the OpenRouter activity page, check that the requests went to the pinned provider and that the charged cost matches `costUsd` to within rounding.

## Decisions
- **Provider union:** `AI_PROVIDER` = `groq` | `anthropic` | `openrouter`. The default changes to `openrouter`, because Groq free can't handle normal-sized PRs. Groq and Anthropic stay supported. As T4 decided, all provider-specific construction stays inside `ai/analyze.ts`, and `AI_MODEL` still overrides the model.
- **Package:** use `@openrouter/ai-sdk-provider` if it supports the installed `ai` v7. If it doesn't, use `@ai-sdk/openai-compatible` with `baseURL: "https://openrouter.ai/api/v1"`. Check this before writing code.
- **Model and pinning:** the default model is `openai/gpt-oss-120b`, the same as Groq, so output stays comparable. Pin one upstream provider with `provider: { order: [<slug>], allow_fallbacks: false, require_parameters: true }`. Choose the cheapest provider on the model page that supports structured output (`Output.object`) and the reasoning settings `analyze` sends. The slug is a constant in `ai/analyze.ts`. If you override `AI_MODEL`, that provider must also serve the new model.
- **Unchanged from T4:** prompt, 60k-character hunk cap, 3-attempt validation retry, return shape. This ticket makes no prompt changes.
- **Usage:** save the `usage` that `analyze` returns, which is already summed across attempts, together with `provider`, `model` and `attempts`. If the same doc is analyzed again, append a new entry rather than overwrite.
- **Cost:** store tokens only. `costUsd` uses a price table in `packages/core/src/cost.ts`, keyed by provider and model, holding the pinned provider's listed price per million tokens. If prices change, old entries can be recomputed.
- **Manual setup (owner, before Verify):**
  1. Create an OpenRouter account and buy $5 of credit (card fee is 5.5%, minimum $0.80).
  2. Create an API key with a $5 limit.
  3. Run `npx convex env set OPENROUTER_API_KEY …` and `npx convex env set AI_PROVIDER openrouter`, and add both to your local `.env`.

## Outcome