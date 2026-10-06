---
id: T5
title: Convex schema + analyzePr + getBrief
status: done
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/6"
depends: [T4]
---

## Goal
Convex schema plus `analyzePr` action and `getBrief` query.

## Files
- apps/web/convex/
- packages/core/src/ai/analyze.ts
- docs/SPEC-F1.md
- apps/web/convex/schema.ts (new)
- apps/web/convex/briefs.ts (new: analyzePr action, internal insert mutation, getBrief query)
- packages/core/src/github.ts + github.test.ts (new: parsePrUrl)
- packages/core/src/index.ts (export parsePrUrl)
- apps/web/package.json (add `convex`)

## Done when
Runnable against one PR from the Convex dashboard.

## Verify
Manual: analyze one PR URL in the Convex dashboard; `getBrief` returns the stored model.

## Decisions
- Schema defines all of `changeModels`, `sessions`, `corrections`, `hunks` now (spec fields). Only `changeModels` and `hunks` are written in T5.
- `getBrief(changeModelId)` returns the parsed model, run metadata and the cited hunks only. T6 adds `startSession` and `getSession(sessionId)` beside it; no rename.
- `changeModels`: repo, prNumber, headSha, model, modelId, usage, skippedFiles, truncated, omittedFiles, createdAt. Index `by_pr` on (repo, prNumber, headSha).
- `hunks` table: changeModelId, hunkId, plus parser fields (file, starts/lines, kind, text). Index on (changeModelId, hunkId). Keeps docs under 1MB and lets hunk text be purged later while the model stays.
- `analyzePr({ url, force? })`: on a `by_pr` hit, return the existing id without calling the model, unless `force: true`.
- GitHub: plain `fetch` to the REST API: one call for title/body/head SHA, one call with `Accept: application/vnd.github.diff`. Optional `GITHUB_TOKEN` from the Convex env. No Octokit.
- `model` field is `v.any()`. Zod-parse with `ChangeModelSchema` before insert and after read, so TS types stay `ChangeModel`. Revisit `zodToConvex` once the schema settles.
- Pure `parsePrUrl(url) → { owner, repo, prNumber }` lives in `packages/core` with Vitest tests. Convex functions are verified manually. `convex-test` waits for T13.
- Default Convex runtime. Use `"use node"` only if the AI SDK or `@dekko/core` bundling fails.
- Dependency: `convex` in apps/web, because it is the backend chosen in DECISIONS. The human runs `npx convex dev` (login and deployment) and sets `AI_PROVIDER`, the provider key and `GITHUB_TOKEN` in the Convex dashboard.
- No auth or tenant scoping yet (single user). Lookups go by id.

## Outcome
Convex schema (`changeModels`, `hunks`, `sessions`, `corrections`) plus `analyzePr` / `getBrief` under `apps/web/convex`, with `parsePrUrl` in `@dekko/core`. Needed so a PR URL can be analyzed from the Convex dashboard and the stored brief (model + cited hunks + run metadata) can be read back. Risk: default Convex runtime must keep bundling the AI SDK/`@dekko/core` path; if it fails in the dashboard, split the action into a `"use node"` file.
