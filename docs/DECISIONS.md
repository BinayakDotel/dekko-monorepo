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
- 2026-10-06 Ticket lifecycle: one markdown file per ticket under `docs/tasks/`; skills `/take` `/implement` `/address` `/done`. `/take` and `/done` may commit `docs/tasks/**` on main; feature work never commits on main.
- 2026-10-06 Renamed lifecycle skill `/build` → `/implement` so it appears in Cursor’s skill picker (`build` was too generic).
- 2026-10-06 Lesson: rejection tests must assert the specific issue path, not just `success === false`. A mutation check (comment out one rule, expect one red test) catches tests that pass for the wrong reason.



# Lessons

- 2026-10-06 Groq free tier allows 8k tokens per minute on gpt-oss-120b, so only small PRs fit. Dogfood runs on Anthropic; Groq stays for small Tier-1 calls.
- 2026-10-07 `gt submit` from an agent cannot set the PR body: non-interactive mode skips the description editor, and `--cli --interactive` blocks on a prompt. With `gh` read-only, the human pastes the body (or the rules allow `gh pr edit --body-file`).
- 2026-10-07 Bookkeeping commits from /take always go to main, even when the ticket's base is another branch; stash, switch, commit, switch back. Fixed in the skill.
- 2026-10-07 All session functions (startSession, gradeAnswer, getSession…) are unauthenticated until F3 adds GitHub login and owner checks; session ids are unlisted, nothing more. Anyone with an id can spend grader tokens.
- 2026-10-07 On this fixture PR (skills-marketplace#5) a new 123-line file became a single "key hunk", and the why lines described the code instead of its consequence. Led to T7c: focus ranges inside hunks, and why = consequence or risk.

