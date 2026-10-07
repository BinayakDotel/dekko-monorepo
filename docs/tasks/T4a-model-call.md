---
id: T4a
title: OpenRouter provider in analyze
status: done
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/17"
depends: [T4]
---

## Goal
Add `openrouter` as a third `AI_PROVIDER` in `packages/core/src/ai/analyze.ts`, running `openai/gpt-oss-120b` pinned to one upstream provider. Groq's free tier caps each request at 8K tokens per minute and paid upgrades are paused. Return `provider` and `upstream` so T4b can persist runs. Cost persistence is T4b.

## Files
- packages/core/src/ai/analyze.ts: `openrouter` branch, default model, pin constant, return `provider` + `upstream`
- packages/core/src/ai/analyze.test.ts: env resolution for `openrouter` / unset default / unknown throws (no network)
- packages/core/package.json (+ lockfile): `@openrouter/ai-sdk-provider`
- .env.example (new): `AI_PROVIDER`, `OPENROUTER_API_KEY`, existing key names as comments

## Done when
- Mocked tests pass: unset `AI_PROVIDER` resolves to openrouter + default model + pinned `upstream`; explicit unknown value throws; `AI_PROVIDER=openrouter` returns `provider` and `upstream`.
- With `AI_PROVIDER=openrouter` (or unset), `just analyze <diff>` succeeds on the PR that failed on Groq ("Requested 8652, Limit 8000").

## Verify
- `just test-q` and `just check`.
- Manual: run `just analyze` on the failing PR's diff.
- On the OpenRouter activity page, check that the requests went to the pinned provider.

## Decisions
- **Split:** T4a = OpenRouter in `analyze` only. T4b = `costUsd` + append-only `analysisRuns` in Convex. T4b depends on T4a (needs `provider` / `upstream`). T9 depends on `[T8c, T4b]`.
- **Provider union:** `AI_PROVIDER` = `groq` | `anthropic` | `openrouter`. Missing/unset → `openrouter`. An explicit unknown value still throws (no silent fallback). Groq and Anthropic stay supported. Provider-specific construction stays inside `ai/analyze.ts`; `AI_MODEL` still overrides the model.
- **Package:** `@openrouter/ai-sdk-provider` (peers `ai@^7`; confirmed against installed `ai` 7.0.128). Pin exact version like the other providers.
- **Model and pinning:** default model `openai/gpt-oss-120b`. Pin one upstream with `provider: { order: [<slug>], allow_fallbacks: false, require_parameters: true }`. Checked 2026-10-07 on openrouter.ai/openai/gpt-oss-120b endpoints: **`coreweave`** — $0.03 / $0.17 per 1M in/out; supports `structured_outputs`, `response_format`, `reasoning`, `reasoning_effort`. Slug constant `OPENROUTER_UPSTREAM` in `ai/analyze.ts`. If `AI_MODEL` is overridden, that upstream must also serve the new model.
- **Return shape:** add `provider: "groq" | "anthropic" | "openrouter" | "injected"` and `upstream: string | undefined` (`upstream` set when provider is `openrouter`, else undefined). Prompt, 60k hunk cap, 3-attempt retry, and the rest of the T4 return shape are unchanged. No prompt changes.
- **AGENTS.md:** do not edit in this ticket; note the provider-line update in Outcome for a later chore.
- **`.env.example`:** root file. Checked `.gitignore`: only `.env*.local` / `apps/web/.env.local` — `.env.example` is not ignored (no `!.env.example` needed unless that changes). Comment in the file: Convex reads its own env via `npx convex env set`, not this file.
- **Manual setup (owner, before Verify):**
  1. Create an OpenRouter account and buy $5 of credit (card fee is 5.5%, minimum $0.80).
  2. Create an API key with a $5 limit.
  3. Set local env for `just analyze`; for the app, `npx convex env set OPENROUTER_API_KEY …` (and optionally `AI_PROVIDER` — unset already defaults).

## Outcome
Added `openrouter` as an `AI_PROVIDER` in `analyze` (default when unset), pinned to CoreWeave (`coreweave`, $0.03/$0.17 as of 2026-10-07), and return `provider` + `upstream` for T4b. Dep: `@openrouter/ai-sdk-provider@3.1.0` (official AI SDK adapter for OpenRouter routing prefs). Later chore: update AGENTS.md provider line to include `openrouter`. Risk: CoreWeave downtime fails hard (`allow_fallbacks: false`); owner still needs to set `OPENROUTER_API_KEY` and manually `just analyze` the Groq-failed PR.
