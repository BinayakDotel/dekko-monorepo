# Tasks for F1

Each task is one Cursor chat. Done when the "verify" command passes and the human has read the diff.

- [x] T1 Monorepo skeleton. pnpm workspaces + Turborepo; apps/web (existing Next app moved in); packages/core with Vitest. Verify: `pnpm build && pnpm test`.
- [ ] T2 ChangeModel schema in packages/core/src/schema.ts (Zod) + types. Verify: `pnpm test` with a schema parse test.
- [ ] T3 Diff parser in packages/core/src/diff.ts: split unified diff into hunks with stable ids (file + index + hash), drop lockfiles/generated files, line ranges. Verify: fixture tests on 3 real diffs.
- [ ] T4 Model call in packages/core/src/ai/analyze.ts via Vercel AI SDK (provider from env: groq | anthropic), structured output = ChangeModel. Verify: a test with a mocked provider; one manual run.
- [ ] T5 Convex: schema + analyzePr action + getBrief query. Verify: run against one PR from the Convex dashboard.
- [ ] T6 Predict + Read screens. Verify: manual, prediction locked and scored.
- [ ] T7 Answer screen + gradeAnswer action. Verify: manual, three verdicts with line refs.
- [ ] T8 Reveal screen: deterministic SVG renderer (dagre/elk) from the stored model, prediction overlay, evidence sheet, corrections. Verify: manual on 3 PRs.
- [ ] T9 Dogfood week: 10 of my own PRs through the loop; log cost per PR and every "this is wrong".
