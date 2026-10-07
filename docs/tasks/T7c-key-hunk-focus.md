---
id: T7c
title: Key-hunk focus ranges and sharper why lines
status: in review
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/13"
depends: [T6d]
---

## Goal
A key hunk may point at a focus range inside the hunk so Read shows the lines that matter, not the whole hunk.
The "why" line states the consequence or risk for a reviewer, not what the code does.

## Files
- packages/core/src/schema.ts (KeyHunk: optional focusStart, focusEnd, validated inside the hunk's new range)
- packages/core/src/schema.test.ts (optional pair, both-or-neither; range helper)
- packages/core/src/prompts/analyze.ts (ask for focus ranges; why = consequence or risk, one sentence)
- packages/core/src/diff.ts (validateAgainstDiff rejects start>end and focus outside the hunk's new range)
- packages/core/test/diff.test.ts
- packages/core/src/read.ts (toReadHunks forwards focus; model/fallback/none window)
- packages/core/src/read.test.ts
- packages/core/src/ai/analyze.ts (retry feedback for a focus-range miss)
- apps/web/app/session/[sessionId]/read/[n]/page.tsx (show focus ± 3 lines; "Show the whole hunk" link)
- Reference: apps/web/convex/briefs.ts (model is v.any(); getReadView already uses toReadHunks)

## Decisions
- One ticket despite ~9 files. Record a file-budget exception in Outcome.
- Convex schema unchanged (`model: v.any()`). `getReadView` stays a pass-through of `toReadHunks`; each hunk includes `focus: "model" | "fallback" | "none"` (not shown in the UI).
- `KeyHunk`: required-but-nullable `focusStart` / `focusEnd` (ints or null), both numbers or both null, new-side inclusive. Missing keys normalize to null (stored models). `schemaVersion` stays 1. Null focus is valid, including on long hunks.
- Invalid focus retries through `validateAgainstDiff` and analyze's existing 3-attempt loop: `focusStart > focusEnd`, either bound outside `[newStart, newStart + newLines - 1]`, or any focus when `newLines === 0`. Missing focus is valid. Fail result gets a `focus` string; do not stuff it into `unknownHunkIds`. Helper next to KeyHunkSchema, tested in schema.test.ts.
- Prompt: `why` is one sentence naming a consequence or risk for a reviewer, not what the code does. If `newLines > 14`, ask for focus of 5–14 new lines. Prompt-only; not a Zod rule.
- Read window: new-side `[start-3, end+3]`, plus delete rows between kept lines. No extra hard cap. Expand is a client toggle "Show the whole hunk" / "Show the focused lines" (not a URL). Hidden when `focus` is `"none"` or the window already covers the hunk. Header and "K lines" follow what's on screen.
- Missing model focus and `newLines > 20`: deterministic fallback of ≈14 new lines centered on the first `add` line (else the first new-side line); then apply ±3. Tag `focus: "fallback"`. Missing focus and `newLines <= 20`, or a pure deletion: `focus: "none"`, show the whole hunk. Model-supplied range: `focus: "model"`.

## Done when
On a PR that adds a 100+ line file, Read shows at most ~20 lines for that hunk with an expand link.
The why line on each key hunk names a consequence or a risk. Existing fixtures still pass; schema tests cover the range check.

## Verify
just check; manual on skills-marketplace#5 (force re-run) and on dekko-monorepo#6

## Outcome
KeyHunk gained required-but-nullable `focusStart`/`focusEnd` (both numbers or both null; missing keys normalize to null for stored models). Invalid ranges fail `validateAgainstDiff` with a `focus` string and retry in analyze. `toReadHunks` tags `model`/`fallback`/`none` and a ±3 window; Read shows that window with a client expand toggle. Prompt asks for consequence-style `why` and focus on long hunks.

**Why:** long key hunks were unreadable and why lines described code instead of risk.

**Risk:** fallback centering on the first add may miss the interesting middle of a long file until the model supplies focus.

**File-budget exception:** nine code files in one ticket (Decisions); Convex left untouched.
