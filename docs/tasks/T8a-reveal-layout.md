---
id: T8a
title: Reveal layout + SVG (core)
status: in review
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/14"
depends: [T7]
---

## Goal
Deterministic dagre layout and SVG map generation from a `ChangeModel`, plus stable edge ids and prediction-overlay styling inputs. No Convex, no UI.

## Files
- packages/core/src/reveal/layout.ts (new: dagre graph, deterministic tie-breaks)
- packages/core/src/reveal/render.ts (new: SVG string from layout + model + overlay hints)
- packages/core/src/reveal/ids.ts (new: `edgeTargetId(from, to, relation)`)
- packages/core/src/reveal/*.test.ts (layout + render snapshots on a fixed fixture model)
- packages/core/src/index.ts (exports)
- Reference: docs/design/prototype.html (`V.reveal` node/edge styling only — positions come from dagre, not hand coords)
- Reference: packages/core/src/schema.ts (`ChangeModel`, components, edges)

## Done when
`just test-q` — same fixture model → identical SVG output across runs; edges with `confidence < 0.6` use dashed stroke in SVG.

## Verify
`just test-q`

## Decisions
- **Layout engine:** `@dagrejs/dagre` inside `packages/core`. Pure functions only: input `ChangeModel`, output node boxes `(id, x, y, width, height)` and edge polylines/paths. Sort component ids and edge keys before feeding dagre so layout is stable for a given model.
- **Nodes on the map:** One node per entry in `model.components` (includes `context`). Do **not** invent nodes for path-derived predict decoys (chip ids from `pickDecoys` that are not component ids); those never appear in the SVG.
- **Node visual class:** Derive from `status` (`added` / `modified` / `removed` / `context`) for fill/stroke/subtitle copy (prototype `n-add`, `n-mod`, etc.). Prediction overlay (hit / miss / false-alarm badge, glyph, `b-hide`) is computed in core from `PredictionScore` + component id + whether the id is in `model.components`; export a small struct per node for the web layer to apply classes, or embed classes in SVG — prefer **data attributes + class names on SVG groups** so `RevealMap` stays thin.
- **Edges:** Draw all `model.edges`. Relation label on the edge: **one word** (the `relation` enum value). **`confidence < 0.6` → dashed stroke**; otherwise solid. Arrow markers match prototype (muted stroke).
- **Edge identity:** Export `edgeTargetId(from, to, relation)` = `${from}→${to}:${relation}` for corrections (used by T8b).
- **API shape:** e.g. `buildRevealGraph(model)` → layout geometry; `renderRevealSvg({ model, layout, predictionScore })` → `{ svg, viewBox, nodes, edges }` where `nodes`/`edges` include ids and hit-test metadata. No I/O, no React.
- **Out of scope for T8a:** Evidence sheet, Convex, list rows under the map, corrections, done screen.

## Outcome

Added `@dekko/core` reveal pipeline: `buildRevealGraph` (dagre, sorted nodes/edges), `renderRevealSvg` (SVG + node/edge metadata with prediction badges and dashed low-confidence edges), and `edgeTargetId` for T8b corrections. Snapshot + repeat-run tests lock layout/SVG determinism on a fixed fixture.

**Risk:** Dagre allows one routed path per `(from, to)` pair; if the model ever has multiple relations between the same components, they would share geometry until we adopt multigraph edge names.
