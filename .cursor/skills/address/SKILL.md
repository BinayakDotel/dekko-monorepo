---
name: address
description: Address PR review comments on the in-review ticket; gt modify + gt submit.
disable-model-invocation: true
---

# /address [PR]

1. Take the first `in review` ticket, or the one named. Read `gh pr view <n> --comments`.
2. `gh pr view <n> --json headRefName` → `gt checkout` that branch.
3. Fix each comment (behavior change → failing test first via `tdd`). `just test-q` then `just typecheck`.
4. `gt modify -a` then `gt submit`.
5. Report one line per comment: what changed, or why not.

Token discipline and model table: `.cursor/rules/engineering.mdc`.
Reply ends with: `Next: /done on Auto, effort Low.` (after human merges).
