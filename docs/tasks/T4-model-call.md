---
id: T4
title: Model call analyze.ts
status: in review
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/5"
depends: [T3]
---

## Goal
Model call in `packages/core/src/ai/analyze.ts` via Vercel AI SDK (provider from env: groq | anthropic), structured output = ChangeModel.

## Files
- packages/core/src/schema.ts
- packages/core/src/diff.ts
- docs/SPEC-F1.md
- AGENTS.md (non-negotiables)
- packages/core/src/ai/analyze.ts
- packages/core/src/prompts/analyze.ts
- packages/core/src/ai/analyze.test.ts
- packages/core/src/index.ts
- packages/core/package.json
- justfile
- pnpm-workspace.yaml

## Done when
A test with a mocked provider passes; one manual run succeeds against a real PR diff.

## Verify
just test-q

## Decisions
- Signature: `analyze({ hunks, title?, body? }, opts?)`. Caller parses the diff; analyze only prompts + calls the model.
- Provider: `AI_PROVIDER` = `groq` | `anthropic`. Defaults: Groq `openai/gpt-oss-120b`, Anthropic `claude-sonnet-5-5`. Both overridable by `AI_MODEL` (one env line). Provider-specific construction lives only inside `ai/analyze.ts` (no separate provider module).
- Injection: `opts.model?: LanguageModel` overrides env resolution. Tests pass a mock; no network, no real keys.
- Structured output: `generateText` + `Output.object({ schema: ChangeModelSchema })`. After each attempt, also run `validateAgainstDiff(changeModel, packed.included)`. On schema or hunk failure (including `NoObjectGeneratedError`), retry with the validation errors in the next user message. Max **3 attempts** total.
- Return: `{ changeModel, model, attempts, usage, truncated, omittedFiles }` where `model` is the resolved model id string, `attempts` is how many calls were made, `usage` is the summed `generateText` usage across attempts, `truncated` is whether the 60k cap dropped hunks, and `omittedFiles` is the unique file paths of dropped hunks (also listed in the prompt).
- Prompt budget: pack hunks in id order `h1…hn` until ≤60k characters of hunk payload; drop from the end. Title/body included when present, treated as untrusted. Never send lockfiles/generated (already stripped by `parseDiff`).
- Layout: system prompt in `packages/core/src/prompts/analyze.ts`; logic + env adapter in `packages/core/src/ai/analyze.ts`; test beside it. Re-export `analyze` (+ result types) from `@dekko/core`.
- Deps (why): add `ai`, `@ai-sdk/groq`, `@ai-sdk/anthropic` to `@dekko/core` — required to call the Vercel AI SDK with the two providers from this package. `tsx` for `just analyze`. `allowBuilds.esbuild` so vitest/tsx postinstall runs.
- Manual: `just analyze <path-to-diff>` is a documented one-liner (tsx/node against the library + env); not a polished script surface. Human runs it once on a fixture after `/implement`.
- System prompt: draft approved in `/take` (2026-10-06); `/implement` writes `packages/core/src/prompts/analyze.ts` as shown.

## Outcome
Added `analyze` in `@dekko/core` so callers get a validated ChangeModel from Groq or Anthropic (or an injected mock), with 60k hunk packing, up to 3 validation retries, and summed usage. Risk: Anthropic default id `claude-sonnet-5-5` may need a dated API id when the first real call runs.
