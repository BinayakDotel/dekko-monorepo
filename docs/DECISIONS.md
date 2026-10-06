# Decisions

- 2026-10-06 Monorepo with pnpm + Turborepo; TypeScript only; no Rust until indexing is slow.
- 2026-10-06 Convex inside apps/web for iteration 1. Move to a package only if a second app needs it.
- 2026-10-06 Model provider from env. Groq open-weight for dev; a fixed strong model for evals.
- 2026-10-06 Model output is typed JSON with hunk ids + confidence. Never diagram markup.
- 2026-10-06 Node 22+ (supersedes 20+). `@dekko/core` is source-only, consumed by web via `transpilePackages`; no tsup.
- 2026-10-06 Agent guidance: AGENTS.md + `.cursor/rules/engineering.mdc` (always-on) + path-scoped rules + `docs/tasks/`. Generated Next/Turbo blocks stay as generated.
- 2026-10-06 TypeScript pinned at 5.9.x until Next supports TS 7.
- 2026-10-06 Hunk ids are h1..hn in diff order, stable per head SHA. The model holds only ids; the parser's hunk table is stored beside the model.
- 2026-10-06 confidence is a number 0–1 (UI buckets it; below 0.6 is drawn dashed). Enums are closed with `other`; component kinds include `external`.
- 2026-10-06 Question kinds are spelled `data-flow`, `failure`, `debugging`.
- 2026-10-06 Ticket lifecycle: one markdown file per ticket under `docs/tasks/`; skills `/take` `/build` `/address` `/done`. `/take` and `/done` may commit `docs/tasks/**` on main; feature work never commits on main.
- 2026-10-06 Lesson: rejection tests must assert the specific issue path, not just `success === false`. A mutation check (comment out one rule, expect one red test) catches tests that pass for the wrong reason.
