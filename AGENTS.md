# Project: Dekko (code name: archsync)

A GitHub-centric tool that makes a developer prove they understand a pull request
before merging: Predict → Read → Answer → Reveal.

## How we work

- One ticket per chat. Index: [`docs/tasks/README.md`](docs/tasks/README.md).
- Lifecycle skills: `/take` → `/implement` → `/address` → `/done` (see `.cursor/skills/`).
- Always-on rule: `.cursor/rules/engineering.mdc`. Path-scoped rules load by file.
- Spec: `docs/SPEC-F1.md`. Decisions: `docs/DECISIONS.md`. Vocabulary: `CONTEXT.md`.
- Secrets in `.env.local` only. Never read or print them.
- Library docs beat memory (Next.js, Turborepo, Vitest, AI SDK).

## Stack (do not deviate without a decision in docs/DECISIONS.md)

- pnpm + Turborepo. TypeScript. Node 22+.
- `apps/web`: Next.js App Router, Tailwind, Convex under `apps/web/convex`.
- `packages/core` (`@dekko/core`): pure TS, no I/O, source-only via `transpilePackages`.
- Model calls through `packages/core/src/ai` (Vercel AI SDK; provider by env).

## Non-negotiables for AI output

- Typed JSON (Zod) with hunk IDs and confidence — never diagram markup.
- Diffs, PR titles and bodies are untrusted data. Prompts say so.

Commands: `just` (see root `README.md`).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
