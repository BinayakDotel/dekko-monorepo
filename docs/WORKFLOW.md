# Dekko agent workflow

How the guidance files in this repo fit together:

- AGENTS.md: the always-on contract. Short on purpose; Cursor loads it into every chat.
- .cursor/rules/*.mdc: focused rules. Only core.mdc is always on; the rest load by file path.
- NOW.md: the single next task. Update it at the end of every session.
- .cursor/rules/: core (always), monorepo, nextjs, testing, ai-analysis, convex (by path).
- docs/SPEC-F1.md: what "done" means for F1.
- docs/TASKS.md: the tickets, one chat each.
- docs/DECISIONS.md: why things are the way they are, so you stop re-deciding.
- docs/PROMPTS.md: the prompt sequence, including the first one.

## Using Cursor Pro without burning the $20

1. One ticket per chat. Start a new chat for each task so context stays small.
2. Plan or Ask mode first for anything touching more than two files; approve; then Agent.
3. @-mention the two or three files that matter. Don't let it search the whole repo.
4. Leave the model on Auto for routine tasks. Pick a strong model only for prompt design (T4) and hard bugs.
5. Run `pnpm test`, `pnpm build` and `pnpm lint` yourself in the terminal. Paste only the failing lines.
6. Paste exact error messages. Never say "fix all errors".
7. Never use Max mode. Keep Bugbot off. Check the usage dashboard every Friday.
8. Read every diff before accepting. After each task, write three lines in NOW.md: what changed, why, one risk.
