# Decisions

- 2026-10-06 Monorepo with pnpm + Turborepo; TypeScript only; no Rust until indexing is slow.
- 2026-10-06 Convex inside apps/web for iteration 1.
- 2026-10-06 Model provider from env. Groq open-weight for dev; a fixed strong model for evals.
- 2026-10-06 Model output is typed JSON with hunk ids + confidence. Never diagram markup.
- 2026-10-06 Node 22+ (supersedes 20+). `@dekko/core` is source-only, consumed by web via `transpilePackages`; no tsup.
- 2026-10-06 Agent guidance: AGENTS.md (always-on) + `.cursor/rules/*.mdc` (path-scoped) + NOW.md/docs. Generated Next/Turbo blocks stay as generated.
- 2026-10-06 TypeScript pinned at 5.9.x until Next supports TS 7.
