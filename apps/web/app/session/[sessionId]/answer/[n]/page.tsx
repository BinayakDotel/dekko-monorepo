"use client";

import type { Verdict } from "@dekko/core";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BriefChrome } from "../../../../../components/BriefChrome";
import { EvidenceSheet, type EvidenceHunk } from "../../../../../components/EvidenceSheet";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type AnswerView = NonNullable<FunctionReturnType<typeof api.briefs.getAnswerView>>;
type StoredAnswer = AnswerView["answers"][number];

const VERDICT_UI: Record<Verdict, { label: string; className: string }> = {
  right: { label: "Correct.", className: "bg-ok-soft" },
  partly: { label: "Partly right.", className: "bg-warn-soft" },
  wrong: { label: "Not quite.", className: "bg-bad-soft" },
};

const PRIMARY_BTN =
  "inline-flex items-center rounded-btn bg-accent text-accent-ink font-semibold text-[0.9rem] px-[1.1rem] py-[0.6rem] disabled:opacity-50 disabled:cursor-not-allowed";

const LINK_BTN =
  "text-accent underline underline-offset-[3px] text-[0.9rem] bg-transparent border-0 p-0 cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline";

function clampIndex(raw: string, total: number): number | null {
  if (total <= 0) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n >= total) return total - 1;
  return n;
}

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

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);
  return { toast, setToast };
}

function SeeRefButton({
  refLabel,
  hunk,
  onSeeRef,
}: {
  refLabel: string;
  hunk: EvidenceHunk;
  onSeeRef: (hunk: EvidenceHunk) => void;
}) {
  return (
    <button type="button" onClick={() => onSeeRef(hunk)} className={LINK_BTN}>
      See {refLabel}
    </button>
  );
}

function Feedback({
  answer,
  onSeeRef,
}: {
  answer: StoredAnswer;
  onSeeRef: (hunk: EvidenceHunk) => void;
}) {
  const ui = VERDICT_UI[answer.verdict];
  const { hunk, ref: refLabel } = answer;
  return (
    <div className={`rounded-md px-4 py-[0.85rem] mb-[1.4rem] text-[0.92rem] ${ui.className}`}>
      <b className="block mb-[0.15rem]">{ui.label}</b>
      {answer.explanation}{" "}
      {hunk && refLabel ? (
        <SeeRefButton refLabel={refLabel} hunk={hunk} onSeeRef={onSeeRef} />
      ) : null}
    </div>
  );
}

function NextLink({ sessionId, index, total }: { sessionId: string; index: number; total: number }) {
  const last = index === total - 1;
  const href = last ? `/session/${sessionId}/reveal` : `/session/${sessionId}/answer/${index + 1}`;
  return (
    <Link href={href} className={PRIMARY_BTN}>
      {last ? "Show me the map" : "Next question"}
    </Link>
  );
}

function useDispute(sessionId: Id<"sessions">, questionId: string, onToast: (msg: string) => void) {
  const addCorrection = useMutation(api.briefs.addCorrection);
  const [busy, setBusy] = useState(false);
  function dispute() {
    if (busy) return;
    setBusy(true);
    void addCorrection({
      sessionId,
      target: "grade",
      targetId: questionId,
      note: "Marked wrong",
    })
      .then(() => onToast("Recorded: you disputed this grade."))
      .finally(() => setBusy(false));
  }
  return { dispute, busy };
}

function DisputeLink({
  sessionId,
  questionId,
  disputed,
  onToast,
}: {
  sessionId: Id<"sessions">;
  questionId: string;
  disputed: boolean;
  onToast: (msg: string) => void;
}) {
  const { dispute, busy } = useDispute(sessionId, questionId, onToast);
  return (
    <button type="button" disabled={disputed || busy} className={LINK_BTN} onClick={dispute}>
      This grade is wrong
    </button>
  );
}

function useGrade(sessionId: Id<"sessions">, questionId: string) {
  const gradeAnswer = useAction(api.briefs.gradeAnswer);
  const [grading, setGrading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(text: string) {
    if (!text.trim() || grading) return;
    setFailed(false);
    setGrading(true);
    try {
      await gradeAnswer({ sessionId, questionId, text });
    } catch {
      setFailed(true);
    } finally {
      setGrading(false);
    }
  }

  return { submit, grading, failed };
}

function GradeError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="text-bad text-[0.88rem] mt-3 mb-0" role="alert">
      Could not check your answer.{" "}
      <button type="button" onClick={onRetry} className="text-accent underline underline-offset-[3px]">
        Try again
      </button>
    </p>
  );
}

function GradedActions({
  sessionId,
  questionId,
  index,
  total,
  disputed,
  onToast,
}: {
  sessionId: Id<"sessions">;
  questionId: string;
  index: number;
  total: number;
  disputed: boolean;
  onToast: (msg: string) => void;
}) {
  return (
    <>
      <NextLink sessionId={sessionId} index={index} total={total} />
      <DisputeLink
        sessionId={sessionId}
        questionId={questionId}
        disputed={disputed}
        onToast={onToast}
      />
    </>
  );
}

type AnswerFormProps = {
  sessionId: Id<"sessions">;
  question: { id: string; text: string };
  stored: StoredAnswer | undefined;
  index: number;
  total: number;
  onSeeRef: (hunk: EvidenceHunk) => void;
  onToast: (msg: string) => void;
};

function AnswerForm({
  sessionId,
  question,
  stored,
  index,
  total,
  onSeeRef,
  onToast,
}: AnswerFormProps) {
  const { submit, grading, failed } = useGrade(sessionId, question.id);
  const [text, setText] = useState("");
  return (
    <>
      <textarea
        rows={3}
        value={stored ? stored.text : text}
        readOnly={stored !== undefined}
        onChange={(e) => setText(e.target.value)}
        placeholder="Answer without looking at the code"
        className="w-full rounded-md border border-line bg-field text-ink px-[0.95rem] py-[0.75rem] font-sans resize-y min-h-[3.2rem] mb-[1.4rem]"
      />
      {stored ? <Feedback answer={stored} onSeeRef={onSeeRef} /> : null}
      <div className="flex flex-wrap items-center gap-x-[1.2rem] gap-y-[0.8rem]">
        {stored ? (
          <GradedActions
            sessionId={sessionId}
            questionId={question.id}
            index={index}
            total={total}
            disputed={stored.gradeDisputed}
            onToast={onToast}
          />
        ) : (
          <button
            type="button"
            disabled={!text.trim() || grading}
            onClick={() => submit(text)}
            className={PRIMARY_BTN}
          >
            Check my answer
          </button>
        )}
      </div>
      {failed && !stored ? <GradeError onRetry={() => submit(text)} /> : null}
    </>
  );
}

function RefSheet({
  hunk,
  onClose,
}: {
  hunk: EvidenceHunk | null;
  onClose: () => void;
}) {
  return (
    <EvidenceSheet
      open={hunk !== null}
      title={hunk?.file ?? ""}
      confidence={null}
      hunks={hunk ? [hunk] : []}
      alreadyMarked={false}
      showMarkWrong={false}
      onClose={onClose}
    />
  );
}

function AnswerScreen({
  sessionId,
  view,
  index,
  noRead,
}: {
  sessionId: Id<"sessions">;
  view: AnswerView;
  index: number;
  noRead: boolean;
}) {
  const question = view.questions[index]!;
  const total = view.questions.length;
  const stored = view.answers.find((a) => a.questionId === question.id);
  const { toast, setToast } = useToast();
  const [sheetHunk, setSheetHunk] = useState<EvidenceHunk | null>(null);

  return (
    <BriefChrome title={view.title} step={2} timeLabel={`about ${2 - Math.floor(index / 2)} min left`}>
      {noRead ? (
        <p className="text-muted text-[0.88rem] m-0 mb-2">
          No code to read for this change; go straight to the questions.
        </p>
      ) : null}
      <p className="text-muted text-[0.84rem] m-0 mb-[0.45rem]">
        Question {index + 1} of {total}
      </p>
      <p className="font-display text-[var(--text-question)] font-normal leading-[1.3] m-0 mb-2">
        {question.text}
      </p>
      <AnswerForm
        key={question.id}
        sessionId={sessionId}
        question={question}
        stored={stored}
        index={index}
        total={total}
        onSeeRef={setSheetHunk}
        onToast={setToast}
      />
      <RefSheet hunk={sheetHunk} onClose={() => setSheetHunk(null)} />
      <Toast message={toast} />
    </BriefChrome>
  );
}

function useAnswerRedirect(sessionId: string, rawN: string, total: number | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (total === undefined) return;
    const clamped = clampIndex(rawN, total);
    if (clamped !== null && String(clamped) !== rawN) {
      router.replace(`/session/${sessionId}/answer/${clamped}`);
    }
  }, [total, rawN, router, sessionId]);
}

export default function AnswerPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string; n: string }>;
  searchParams: Promise<{ noRead?: string }>;
}) {
  const { sessionId: rawId, n: rawN } = use(params);
  const { noRead } = use(searchParams);
  const sessionId = rawId as Id<"sessions">;
  const view = useQuery(api.briefs.getAnswerView, { sessionId });
  useAnswerRedirect(sessionId, rawN, view?.questions.length);

  if (view === undefined) return <LoadingStatus />;
  if (view === null) notFound();
  const index = clampIndex(rawN, view.questions.length);
  if (index === null || String(index) !== rawN) return <LoadingStatus />;
  return <AnswerScreen sessionId={sessionId} view={view} index={index} noRead={noRead === "1"} />;
}
