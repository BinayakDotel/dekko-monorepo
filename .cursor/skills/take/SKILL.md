---
name: take
description: Take the next (or named) todo ticket, grill decisions, write Decisions + Files. No code.
disable-model-invocation: true
---

# /take [ID]

1. `gt sync -f`. For each `in review` ticket with a `pr`, run `gh pr view <n> --json state`. If MERGED, set status `done`. Update `docs/tasks/README.md`.
2. Pick the named ticket, else the first `todo` whose `depends` are all `done`. `gt checkout <base>`. Set status `in progress`. Update the index.
3. Commit bookkeeping only: stage `docs/tasks/**`, `git commit -m "chore(tasks): take <ID>"`, `git push origin main`.
4. Read the ticket and its Files. Use codebase search for gaps; open extra files one at a time.
5. Run the `grill-me` skill (→ `grilling`), capped at **8 questions total**, each with a recommendation. Prefer one batch.
6. Write `## Decisions` and append discovered paths to `## Files`. If the ticket would touch more than ~5 files, propose a split and stop.
7. Stop. Do not build.

Token discipline and model table: `.cursor/rules/engineering.mdc`.
Reply ends with: `Next: /build on Auto, effort Low.`
