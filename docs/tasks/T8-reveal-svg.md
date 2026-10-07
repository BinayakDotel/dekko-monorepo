---
id: T8
title: Reveal screen SVG
status: in progress
base: main
pr: ""
depends: [T7]
---

## Goal
Reveal screen: deterministic SVG renderer (dagre/elk) from the stored model, prediction overlay, evidence sheet, corrections.

## Files
- apps/web/
- packages/core/
- docs/SPEC-F1.md
- apps/web/app/session/[sessionId]/reveal/page.tsx (new)
- apps/web/components/EvidenceSheet.tsx (new; shared scrim/sheet from prototype)
- apps/web/components/RevealMap.tsx (new; client SVG + node/edge focus)
- apps/web/convex/briefs.ts (`getRevealView`, `addCorrection`, `completeSession`)
- packages/core/src/reveal/ (layout + SVG render; export from index)
- packages/core/src/reveal/*.test.ts
- Reference: docs/design/prototype.html (`V.reveal`, `openSheet`, ~326–447)
- Reference: apps/web/app/session/[sessionId]/read/[n]/page.tsx (hunk code presentation)
- Reference: apps/web/app/session/[sessionId]/answer/[n]/page.tsx (dispute deferred from T7b)

## Done when
Manual on 3 PRs: every component and edge opens its cited hunk; corrections store.

## Verify
Manual on 3 PRs.

## Decisions
- **Split (recommended):** This ticket touches ~9 paths. Stack **T8a** = `@dekko/core` dagre layout + deterministic SVG builder + Vitest snapshots; **T8b** = Convex views/mutations + reveal page + evidence sheet + wire T7b dispute. Implement T8a first unless you want one large PR.
- **Layout engine:** **dagre** in `packages/core` (pure, seeded rank/order for tie-breaks). ELK only if dagre fails on real briefs.
- **Map content:** All `ChangeModel.components` and `edges`; node styling from `status` (added/modified/removed/context); prediction badges from stored `predictionScore` (hits / missed / falseAlarms); hide badge on unaffected nodes that were neither picked nor missed (prototype `b-hide`).
- **Evidence sheet:** Tap node, edge, or list row → bottom sheet with label, confidence, primary cited hunk (file + line + read-style diff snippet). Skip prototype-only rule/downstream tags for F1. Edge sheet uses edge `hunks[0]` and shows `from → to` relation.
- **Corrections:** `addCorrection(sessionId, target, targetId, note)` — `note` required (empty string ok). Targets: `node` = component id; `edge` = stable id `${from}→${to}:${relation}`; `grade` = question id. Toast on success; no inline note field in v1 (record with fixed note e.g. "Marked wrong" unless Q says otherwise).
- **Answer screen carryover:** Add "This grade is wrong" → `addCorrection(..., "grade", questionId, ...)`. Optional "See ref" opens same sheet for that hunk (T7b deferred).
- **Finish:** Primary "Finish" sets `completedAt` via `completeSession`; navigate to `/` (no `V.done` summary screen — out of F1 done-when).
- **`getRevealView(sessionId)`:** Title, `predictionScore`, components/edges (ids, labels, kinds, status, confidence, hunks), layout-ready graph, hunk payloads for all cited hunk ids, answers (for grade dispute), existing corrections optional for reload.

## Outcome
