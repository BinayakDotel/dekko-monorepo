---
name: done
description: After merge, sync, mark tickets done, update index, name the next todo.
disable-model-invocation: true
---

# /done

1. `gt sync -f`.
2. For each `in review` ticket with a `pr`, run `gh pr view <n> --json state`. If MERGED, set status `done`. Update `docs/tasks/README.md`.
3. Commit bookkeeping only: stage `docs/tasks/**`, `git commit -m "chore(tasks): mark <IDs> done"`, `git push origin main`.
4. Name the next `todo` whose `depends` are all `done`.

Token discipline and model table: `.cursor/rules/engineering.mdc`.
Reply ends with: `Next: /take on Claude Sonnet 5.5, effort Medium.`
