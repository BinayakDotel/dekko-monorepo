"use client";

import {
  buildRevealGraph,
  buildTeachingList,
  edgeTargetId,
  renderRevealSvg,
  type SheetEntry,
  type TeachingKind,
  type TeachingListItem,
} from "@dekko/core";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { BriefChrome } from "../../../../components/BriefChrome";
import { EvidenceSheet, type EvidenceHunk } from "../../../../components/EvidenceSheet";
import { RevealMap } from "../../../../components/RevealMap";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type RevealView = NonNullable<FunctionReturnType<typeof api.briefs.getRevealView>>;

const PRIMARY_BTN =
  "inline-flex items-center rounded-btn bg-accent text-accent-ink font-semibold text-[0.9rem] px-[1.1rem] py-[0.6rem]";

const KIND_UI: Record<TeachingKind, { glyph: string; className: string }> = {
  miss: { glyph: "!", className: "bg-bad" },
  fa: { glyph: "?", className: "bg-warn" },
  hit: { glyph: "✓", className: "bg-ok" },
};

function LoadingStatus() {
  return (
    <p className="text-muted text-[0.88rem] p-[var(--pad-screen)]" role="status">
      Loading…
    </p>
  );
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 -translate-x-1/2 bg-ink text-surface px-4 py-[0.6rem] rounded-md text-[0.88rem] max-w-[90vw] shadow-md"
    >
      {message}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-[1.1rem] gap-y-[0.6rem] text-[0.8rem] text-muted mb-[1.2rem]">
      <span className="inline-flex items-center gap-[0.35rem]">
        <i className="inline-block w-[11px] h-[11px] rounded-full bg-ok" />
        You got it
      </span>
      <span className="inline-flex items-center gap-[0.35rem]">
        <i className="inline-block w-[11px] h-[11px] rounded-full bg-bad" />
        You missed it
      </span>
      <span className="inline-flex items-center gap-[0.35rem]">
        <i className="inline-block w-[11px] h-[11px] rounded-full bg-warn" />
        You expected it, nothing changed there
      </span>
      <span className="text-[0.8rem]">Tap a box for the lines behind it</span>
    </div>
  );
}

function ListRow({ item, onOpen }: { item: TeachingListItem; onOpen: (id: string) => void }) {
  const ui = KIND_UI[item.kind];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.targetId)}
        className="w-full flex items-start gap-[0.8rem] py-[0.7rem] border-b border-line-2 text-left text-[0.92rem] bg-transparent border-x-0 border-t-0 cursor-pointer font-sans text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          className={`w-[22px] h-[22px] rounded-full flex-none inline-flex items-center justify-center text-[0.76rem] font-bold text-white mt-[0.1rem] ${ui.className}`}
        >
          {ui.glyph}
        </span>
        <span className="flex-1 min-w-0">
          <b className="block font-semibold">{item.label}</b>
          <span className="text-muted">{item.subcopy}</span>
        </span>
        <span className="text-muted self-center" aria-hidden>
          ›
        </span>
      </button>
    </li>
  );
}

function TeachingList({
  items,
  onOpen,
}: {
  items: TeachingListItem[];
  onOpen: (targetId: string) => void;
}) {
  return (
    <ul className="list-none p-0 m-0 mb-[1.4rem] border-t border-line-2">
      {items.map((item) => (
        <ListRow key={item.targetId} item={item} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function affectedCount(model: RevealView["model"]): number {
  return model.components.filter((c) => c.status !== "context").length;
}

function resolveConfidence(view: RevealView, entry: SheetEntry): number | null {
  if (entry.targetKind === "node") {
    return view.model.components.find((c) => c.id === entry.targetId)?.confidence ?? null;
  }
  for (const e of view.model.edges) {
    if (edgeTargetId(e.from, e.to, e.relation) === entry.targetId) return e.confidence;
  }
  return null;
}

function sheetHunks(view: RevealView, entry: SheetEntry): EvidenceHunk[] {
  const byId = new Map(view.hunks.map((h) => [h.id, h]));
  return entry.hunkIds
    .map((id) => byId.get(id))
    .filter((h): h is NonNullable<typeof h> => h !== undefined)
    .map((h) => ({ id: h.id, file: h.file, newStart: h.newStart, text: h.text }));
}

function useRevealData(view: RevealView) {
  return useMemo(() => {
    const layout = buildRevealGraph(view.model);
    const { svg } = renderRevealSvg({
      model: view.model,
      layout,
      predictionScore: view.predictionScore,
    });
    const teaching = buildTeachingList({
      model: view.model,
      layout,
      predictionScore: view.predictionScore,
      hunks: view.hunks.map((h) => ({ id: h.id, file: h.file, line: h.newStart })),
    });
    return { svg, teaching };
  }, [view]);
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);
  return { toast, setToast };
}

function ActiveSheet({
  sessionId,
  view,
  entry,
  onClose,
  onToast,
}: {
  sessionId: Id<"sessions">;
  view: RevealView;
  entry: SheetEntry | undefined;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const addCorrection = useMutation(api.briefs.addCorrection);
  const corrected = new Set(view.corrections.map((c) => c.targetId));
  return (
    <EvidenceSheet
      open={entry !== undefined}
      title={entry?.sheetTitle ?? ""}
      confidence={entry ? resolveConfidence(view, entry) : null}
      hunks={entry ? sheetHunks(view, entry) : []}
      alreadyMarked={entry ? corrected.has(entry.targetId) : false}
      onClose={onClose}
      onMarkWrong={() => {
        if (!entry || corrected.has(entry.targetId)) return;
        void addCorrection({
          sessionId,
          target: entry.targetKind,
          targetId: entry.targetId,
          note: "Marked wrong",
        }).then(() => {
          onToast("Recorded: you marked this as wrong.");
          onClose();
        });
      }}
    />
  );
}

function FinishButton({ sessionId }: { sessionId: Id<"sessions"> }) {
  const router = useRouter();
  const completeSession = useMutation(api.briefs.completeSession);
  return (
    <button
      type="button"
      className={PRIMARY_BTN}
      onClick={() => {
        void completeSession({ sessionId }).then(() => router.push(`/session/${sessionId}/done`));
      }}
    >
      Finish
    </button>
  );
}

function RevealScreen({ sessionId, view }: { sessionId: Id<"sessions">; view: RevealView }) {
  const { svg, teaching } = useRevealData(view);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast, setToast } = useToast();
  const entry = activeId ? teaching.byTargetId[activeId] : undefined;

  return (
    <BriefChrome title={view.title} step={3} timeLabel="last step">
      <p className="font-display text-[var(--text-question)] font-normal m-0 mb-[0.9rem]">
        You predicted {view.predictionScore.hits.length} of {affectedCount(view.model)} parts this
        change touches.
      </p>
      <RevealMap
        svg={svg}
        onSelect={(_kind, id) => {
          if (teaching.byTargetId[id]) setActiveId(id);
        }}
      />
      <Legend />
      <TeachingList items={teaching.items} onOpen={setActiveId} />
      <div className="flex flex-wrap items-center gap-x-[1.2rem] gap-y-[0.8rem]">
        <FinishButton sessionId={sessionId} />
      </div>
      <ActiveSheet
        sessionId={sessionId}
        view={view}
        entry={entry}
        onClose={() => setActiveId(null)}
        onToast={setToast}
      />
      <Toast message={toast} />
    </BriefChrome>
  );
}

export default function RevealPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId: rawId } = use(params);
  const sessionId = rawId as Id<"sessions">;
  const view = useQuery(api.briefs.getRevealView, { sessionId });
  if (view === undefined) return <LoadingStatus />;
  if (view === null) notFound();
  return <RevealScreen sessionId={sessionId} view={view} />;
}
