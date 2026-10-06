# Prompt sequence for Cursor (one chat per prompt)

## Before any prompt

T1 is done: the monorepo exists in this directory. Save 3 real unified diffs into
`packages/core/test/fixtures` (one small, one medium, one with a lockfile) before T3.

## Prompt 1 — plan the skeleton (Plan or Ask mode)

Read @AGENTS.md, @docs/SPEC-F1.md, @docs/TASKS.md and @NOW.md.
I'm on T1. Propose the exact files for the monorepo skeleton: root package.json scripts,
turbo.json, packages/core/package.json, tsconfig layout, a Vitest config and one trivial test.
List any question you have in one line each. Do not write files yet.

## Prompt 2 — build T1 (Agent mode, after approving the plan)

Approved. Create exactly the files from your plan. Then tell me the verify command.
Do not touch apps/web beyond adding it to the workspace.

## Prompt 3 — T2 schema (Agent mode)

Read @docs/SPEC-F1.md section "ChangeModel". I'm on T2. Create packages/core/src/schema.ts
with Zod schemas for ChangeModel and its parts, exported inferred types, and one test that
parses a minimal valid model and rejects a component with no hunks.

## Prompt 4 — T3 diff parser (Plan first, then Agent)

I'm on T3. Read @packages/core/src/schema.ts and the fixtures in @packages/core/test/fixtures.
Plan a diff parser that returns Hunk[] with stable ids, file, startLine, endLine, kind
(added|modified|removed), and drops lockfiles and generated files. Then write it with tests
against the fixtures. No network. No AI.

## Prompt 5 — T4 model call (Plan first)

I'm on T4. Read @packages/core/src/schema.ts and @AGENTS.md "Non-negotiables".
Plan packages/core/src/ai/analyze.ts: Vercel AI SDK, provider chosen by AI_PROVIDER
(groq | anthropic), structured output matching the ChangeModel schema, a system prompt
that treats the diff as untrusted data, and an input cap of 60k characters trimmed by
hunk rank. Test with a mocked model. Show me the system prompt before writing the file.

## Prompts 6–9

One ticket each, same shape: "I'm on Tn. Read @the two or three relevant files. Plan. Then build with tests."
