---
id: T8b
title: Reveal screen (Convex + map + sheet)
status: done
base: main
pr: "https://github.com/BinayakDotel/dekko-monorepo/pull/15"
depends: [T8a]
---

## Goal
Reveal screen: load session via Convex, client-render core SVG, teaching list, evidence sheet, node/edge corrections; Finish → completeSession → stub done route. Small core SVG hit-target follow-up.

## Files
- apps/web/convex/briefs.ts (`getRevealView`, `addCorrection`, `completeSession`)
- apps/web/app/session/[sessionId]/reveal/page.tsx (new)
- apps/web/app/session/[sessionId]/done/page.tsx (new stub; T8c replaces)
- apps/web/components/EvidenceSheet.tsx (new)
- apps/web/components/RevealMap.tsx (new; client: focus, open sheet)
- packages/core/src/reveal/renderParts.ts (+ snapshot tests: wide edge hit path, label/glyph backing, badge `<title>`)
- Reference: docs/design/prototype.html (`V.reveal`, `openSheet`, ~326–349, 435–446)
- Reference: apps/web/app/session/[sessionId]/read/[n]/page.tsx (hunk lines)

## Done when
Manual on 3 PRs: every **drawn** component and edge opens the sheet (cited hunks or empty-state); path-decoy false alarms appear in the list only; node/edge corrections persist; Finish lands on `/session/[id]/done` stub.

## Verify
Manual on 3 PRs. `just check`.

## Decisions
- **Split:** T8b = reveal Convex + map + sheet + Finish + done stub + core SVG hit-target polish. T8c = real done screen, `getDoneView`, answer dispute/See ref, BriefChrome step 4.
- **Stacking:** Builds on T8a (`buildRevealGraph`, `renderRevealSvg`, `edgeTargetId`). No duplicate layout logic in the app.
- **`getRevealView(sessionId)`:** PR title, `predictionScore`, `ChangeModel` **without** `expectedAnswer` on questions, cited hunk payloads (text + file + line metadata for read-style rendering), existing corrections. Client calls `buildRevealGraph` + `renderRevealSvg`. No pre-rendered SVG from Convex.
- **Map vs list:**
  - **Map:** All `model.components` (including `context`). Ticked **context** components use false-alarm overlay on the node.
  - **Not on map:** Path-derived decoys (false-alarm chip ids **not** in `model.components`) — list only under false alarms.
  - **List order:** miss → fa → hit (prototype). Tap opens sheet.
- **List teaching subcopy:** Prefer first cited hunk. If that hunk is a **key hunk**, use its `why`. Else miss/hit: `{status or relation}. {basename} line {n}.`; fa-in-model: `You expected this.` + same; path decoys: `You expected this. The PR doesn't touch it.`
- **Evidence sheet:** Node/edge → all cited hunk ids in order. First expanded (read-style); rest collapsed/disclosure. Label, confidence, file, line. Edge title: relation + `from → to`. No rule/downstream (F1). Empty `hunks[]`: open sheet with empty-state copy ("No cited lines in this change.") + "This is wrong".
- **Corrections (T8b):** `addCorrection(sessionId, target, targetId, note)` note `"Marked wrong"`. Sheet exposes "This is wrong" for `node` / `edge` (`edgeTargetId`). Toast on success. Grade target + answer UI → T8c (mutation may accept `grade` already).
- **Finish:** Primary **Finish** → `completeSession` (sets `completedAt` only here) → `/session/[sessionId]/done`. Stub page is one file; T8c replaces it.
- **Core SVG follow-up (in this ticket):** Invisible wide hit path on edges (`data-edge-id`); clickable edge labels; surface-colored backing rect behind edge labels and badge glyphs (✓ ! ?); `<title>` on badges. Snapshot tests updated.

## Outcome
Reveal screen loads session via `getRevealView` (model stripped of `expectedAnswer`), client-renders the T8a SVG map, teaching list (miss→fa→hit, path decoys list-only), evidence sheet with cited hunks / empty state, node/edge corrections, and Finish → `completeSession` → done stub. Core adds `toRevealModel`, `buildTeachingList` (sheet lookup for every drawn node/edge), and SVG hit-target polish (wide transparent edge paths, surface backing, badge titles).

**Risk:** Manual verify on 3 PRs still required for hit targets and sheet empty-states; Convex has no automated tests yet.
