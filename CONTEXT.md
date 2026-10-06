# CONTEXT.md — shared vocabulary

- change model: the typed JSON the pipeline produces for one PR head commit.
- hunk: one addressable piece of a diff, with a stable id, file and line range.
- key hunks: the few hunks that matter most, ranked, each with a one-line "why".
- component: a part of the system the PR touches (route, service, model, queue, UI).
- context node: a component that didn't change but is connected to one that did.
- edge: a relationship between components (calls, reads, writes, publishes, imports).
- brief: the four-step session a developer completes on a PR.
- predict / read / answer / reveal: the four steps of the brief.
- prediction score: ticked components vs affected components; missed and false alarms.
- grade: a verdict on one answer (right / partly / wrong) with a line reference.
- correction: a developer marking a node, edge or grade as wrong.
- gate: the GitHub check that requires a brief on protected paths (not in F1).