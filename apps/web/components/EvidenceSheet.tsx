"use client";

import { toReadLines, type ReadLine } from "@dekko/core";
import { useEffect, useId, useRef } from "react";

export type EvidenceHunk = {
  id: string;
  file: string;
  newStart: number;
  text: string;
};

export type EvidenceSheetProps = {
  open: boolean;
  title: string;
  confidence: number | null;
  hunks: EvidenceHunk[];
  alreadyMarked: boolean;
  /** When false, hide the "This is wrong" control (e.g. See ref from answer). */
  showMarkWrong?: boolean;
  onClose: () => void;
  onMarkWrong?: () => void;
};

function lineClass(kind: ReadLine["kind"]): string {
  if (kind === "add") return "bg-ok-soft";
  if (kind === "del") return "bg-bad-soft";
  return "";
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
}

function HunkCode({ hunk, lines }: { hunk: EvidenceHunk; lines: ReadLine[] }) {
  return (
    <pre className="m-0 px-[0.9rem] py-[0.7rem] font-mono text-[0.78rem] leading-[1.6] overflow-x-auto">
      {lines.map((line, i) => (
        <span key={`${hunk.id}-${i}`} className={`block ${lineClass(line.kind)}`}>
          <span className="inline-block w-[2.2em] text-muted select-none">{line.n ?? ""}</span>
          {line.text}
        </span>
      ))}
    </pre>
  );
}

function HunkBlock({ hunk, defaultOpen }: { hunk: EvidenceHunk; defaultOpen: boolean }) {
  const lines = toReadLines(hunk);
  if (defaultOpen) {
    return (
      <div className="border border-line rounded-md overflow-hidden mb-3 bg-surface">
        <div className="flex justify-between gap-4 px-[0.9rem] py-[0.45rem] font-mono text-[0.76rem] text-muted bg-field border-b border-line-2">
          <span>{hunk.file}</span>
          <span>line {hunk.newStart}</span>
        </div>
        <HunkCode hunk={hunk} lines={lines} />
      </div>
    );
  }
  return (
    <details className="mb-3 border border-line rounded-md overflow-hidden">
      <summary className="cursor-pointer px-[0.9rem] py-[0.55rem] font-mono text-[0.76rem] text-muted bg-field">
        {hunk.file} · line {hunk.newStart}
      </summary>
      <HunkCode hunk={hunk} lines={lines} />
    </details>
  );
}

function ConfidenceRow({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2 text-[0.84rem] text-muted mb-3">
      <span>Confidence</span>
      <span className="inline-block h-1.5 w-24 rounded-sm bg-field overflow-hidden" aria-hidden>
        <span className="block h-full bg-accent" style={{ width: `${Math.round(confidence * 100)}%` }} />
      </span>
      <span>{confidenceLabel(confidence)}</span>
    </div>
  );
}

function MarkWrong({
  alreadyMarked,
  onMarkWrong,
}: {
  alreadyMarked: boolean;
  onMarkWrong?: () => void;
}) {
  if (alreadyMarked) {
    return <p className="text-muted text-[0.9rem] m-0">Already marked wrong.</p>;
  }
  return (
    <button
      type="button"
      onClick={onMarkWrong}
      className="text-accent underline underline-offset-[3px] text-[0.9rem] bg-transparent border-0 p-0 cursor-pointer font-sans"
    >
      This is wrong
    </button>
  );
}

function SheetBody({
  confidence,
  hunks,
  alreadyMarked,
  showMarkWrong,
  onMarkWrong,
}: {
  confidence: number | null;
  hunks: EvidenceHunk[];
  alreadyMarked: boolean;
  showMarkWrong: boolean;
  onMarkWrong?: () => void;
}) {
  return (
    <div className="px-[1.2rem] pt-4 pb-[1.3rem]">
      {confidence !== null ? <ConfidenceRow confidence={confidence} /> : null}
      {hunks.length === 0 ? (
        <p className="text-muted text-[0.92rem] m-0 mb-4">No cited lines in this change.</p>
      ) : (
        hunks.map((h, i) => <HunkBlock key={h.id} hunk={h} defaultOpen={i === 0} />)
      )}
      {showMarkWrong ? (
        <MarkWrong alreadyMarked={alreadyMarked} onMarkWrong={onMarkWrong} />
      ) : null}
    </div>
  );
}

export function EvidenceSheet({
  open,
  title,
  confidence,
  hunks,
  alreadyMarked,
  showMarkWrong = true,
  onClose,
  onMarkWrong,
}: EvidenceSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close evidence"
        className={`fixed inset-0 z-20 bg-[var(--overlay)] border-0 p-0 cursor-default ${open ? "block" : "hidden"}`}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed left-0 right-0 bottom-0 z-21 mx-auto max-w-[640px] max-h-[80%] overflow-auto bg-surface border border-line border-b-0 rounded-t-md shadow-md pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-y-0" : "translate-y-[105%]"
        }`}
      >
        <div className="flex justify-between items-center px-[1.2rem] py-[0.9rem] border-b border-line-2">
          <b id={titleId} className="text-[1rem] font-semibold">
            {title}
          </b>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-accent underline underline-offset-[3px] text-[0.9rem] bg-transparent border-0 p-0 cursor-pointer font-sans"
          >
            Close
          </button>
        </div>
        <SheetBody
          confidence={confidence}
          hunks={hunks}
          alreadyMarked={alreadyMarked}
          showMarkWrong={showMarkWrong}
          onMarkWrong={onMarkWrong}
        />
      </div>
    </>
  );
}
