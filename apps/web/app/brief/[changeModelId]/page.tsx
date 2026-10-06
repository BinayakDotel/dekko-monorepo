"use client";

import { canLockPrediction, type Chip, type PrFile } from "@dekko/core";
import { useMutation, useQuery } from "convex/react";
import { notFound, useRouter } from "next/navigation";
import { use, useState } from "react";
import { BriefChrome } from "../../../components/BriefChrome";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type PredictView = { title: string; files: PrFile[]; chips: Chip[] };

function fileMark(kind: string): { symbol: string; className: string } {
  if (kind === "added") return { symbol: "+", className: "text-ok" };
  if (kind === "removed") return { symbol: "−", className: "text-bad" };
  return { symbol: "~", className: "text-warn" };
}

function ChipPicker({
  chips,
  picked,
  onToggle,
}: {
  chips: Chip[];
  picked: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {chips.map((chip) => {
        const pressed = picked.includes(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(chip.id)}
            className={`rounded-chip border px-[0.85rem] py-[0.35rem] text-[0.88rem] ${
              pressed
                ? "bg-accent-soft border-accent text-accent-on-soft font-semibold"
                : "bg-surface border-line text-ink"
            }`}
          >
            {pressed ? "✓ " : ""}
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function FileListToggle({
  files,
  open,
  onToggle,
}: {
  files: PrFile[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <p className="text-muted text-[0.88rem] m-0 mb-[1.2rem]">
        {files.length} file{files.length === 1 ? "" : "s"} changed ·{" "}
        <button
          type="button"
          className="text-accent underline underline-offset-[3px] text-[0.9rem]"
          onClick={onToggle}
        >
          {open ? "hide the list" : "show the list"}
        </button>
      </p>
      {open ? (
        <ul className="list-none rounded-md bg-field font-mono text-[0.78rem] leading-[1.7] px-[0.9rem] py-[0.6rem] mt-[0.4rem] mb-4">
          {files.map((f) => {
            const mark = fileMark(f.kind);
            return (
              <li key={f.path}>
                <span className={mark.className}>{mark.symbol}</span> {f.path}
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}

function useLockSession(changeModelId: Id<"changeModels">) {
  const startSession = useMutation(api.briefs.startSession);
  const router = useRouter();
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lock(predictionText: string, picked: string[]) {
    if (!canLockPrediction({ predictionText, picked })) return;
    setError(null);
    setLocking(true);
    try {
      const sessionId = await startSession({
        changeModelId,
        predictionText: predictionText.trim(),
        predictedComponents: picked,
      });
      router.push(`/session/${sessionId}/read/0`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not lock prediction.");
      setLocking(false);
    }
  }

  return { lock, locking, error };
}

function PredictForm({
  changeModelId,
  view,
}: {
  changeModelId: Id<"changeModels">;
  view: PredictView;
}) {
  const { lock, locking, error } = useLockSession(changeModelId);
  const [predictionText, setPredictionText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const canLock = canLockPrediction({ predictionText, picked }) && !locking;

  function toggleChip(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <BriefChrome title={view.title} step={0} timeLabel="about 4 min">
      <p className="text-muted text-[0.84rem] m-0 mb-[0.45rem]">Before you read any code</p>
      <p className="font-display text-[var(--text-question)] font-normal leading-[1.3] m-0 mb-2">
        In one sentence, what does this change do?
      </p>
      <textarea
        rows={2}
        value={predictionText}
        onChange={(e) => setPredictionText(e.target.value)}
        placeholder="Your guess, in your own words"
        className="w-full rounded-md border border-line bg-field text-ink px-[0.95rem] py-[0.75rem] font-sans resize-y min-h-[3.2rem] mb-[1.4rem]"
      />
      <p className="font-display text-[var(--text-question)] font-normal leading-[1.3] m-0 mb-2">
        Which parts of the system does it touch?
      </p>
      <p className="text-muted text-[0.88rem] m-0 mb-[0.9rem]">
        Tap everything you expect. Some of these aren&apos;t touched.
      </p>
      <ChipPicker chips={view.chips} picked={picked} onToggle={toggleChip} />
      <FileListToggle
        files={view.files}
        open={filesOpen}
        onToggle={() => setFilesOpen((o) => !o)}
      />
      <div className="flex flex-wrap items-center gap-x-[1.2rem] gap-y-[0.8rem]">
        <button
          type="button"
          disabled={!canLock}
          onClick={() => lock(predictionText, picked)}
          className="inline-flex items-center rounded-btn bg-accent text-accent-ink font-semibold text-[0.9rem] px-[1.1rem] py-[0.6rem] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Lock my guess and read
        </button>
        <span className="text-muted text-[0.8rem]">You can&apos;t change it after this</span>
      </div>
      {error ? (
        <p className="text-bad text-[0.88rem] mt-3 mb-0" role="alert">
          {error}
        </p>
      ) : null}
    </BriefChrome>
  );
}

export default function PredictPage({
  params,
}: {
  params: Promise<{ changeModelId: string }>;
}) {
  const { changeModelId: rawId } = use(params);
  const changeModelId = rawId as Id<"changeModels">;
  const view = useQuery(api.briefs.getPredictView, { changeModelId });

  if (view === undefined) {
    return (
      <p className="text-muted text-[0.88rem] p-[var(--pad-screen)]" role="status">
        Loading…
      </p>
    );
  }
  if (view === null) notFound();
  return <PredictForm changeModelId={changeModelId} view={view} />;
}
