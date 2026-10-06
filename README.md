# Dekko (archsync)

GitHub-centric tool: prove you understand a PR before merging — Predict → Read → Answer → Reveal.

## Working on this repo

**Skills (one per chat):**

| Skill | What it does |
|---|---|
| `/take` | Pick a `todo` ticket, grill decisions (max 8), write Decisions + Files. No code. |
| `/implement` | TDD the `in progress` ticket, review, open a PR via Graphite. |
| `/address` | Fix PR review comments on the same branch. |
| `/done` | After you merge: mark tickets done, name the next one. |

**You (human):** answer `/take` questions, merge PRs on GitHub, run `/done`, save fixtures with `just fixture` when a ticket needs them.

**Tickets:** [`docs/tasks/README.md`](docs/tasks/README.md). Spec: [`docs/SPEC-F1.md`](docs/SPEC-F1.md).

## Commands

```bash
just              # list recipes
just install      # pnpm install
just run          # Next dev server
just run-all      # Convex + Next together
just test-q       # quiet vitest (agents)
just check        # lint + typecheck + test-q
just typecheck
just fixture <pr-url> <name>   # save diff under packages/core/test/fixtures/
```

Requires Node 22+, pnpm, [just](https://github.com/casey/just), Graphite (`gt`), and `gh`.
