---
name: build
description: Build the first in-progress ticket with TDD, review, then gt create + gt submit.
disable-model-invocation: true
---

# /build

1. Take the first `in progress` ticket. Read only the ticket and its Files.
2. If it needs more than ~5 files, split into stacked tickets (each `base` = previous branch) and stop.
3. Use the `tdd` skill. Red-green steps with `just test-q` only. Repo green after each step.
4. `just check`, then `code-review` with fixed point = ticket `base` and spec = this ticket file. Fix real findings.
5. Write `## Outcome` (what changed, why, one risk). Set status `in review`. Update the index.
6. `gt create -am "<type(scope): subject>"` then `gt submit`. Put the PR URL into the ticket `pr` field and the index. Stage ticket edits with `gt modify -a` + `gt submit` if needed.
7. Report the PR link and Outcome. No pasted diffs.

Token discipline and model table: `.cursor/rules/engineering.mdc`.
Reply ends with: `Next: /address on Auto, effort Low.` (or `/done` after human merges).
