"use client";

import {
  hunkRangeLabel,
  toReadLines,
  type ReadHunk,
  type ReadLine,
} from "@dekko/core";
import { useQuery } from "convex/react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { BriefChrome } from "../../../../../components/BriefChrome";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

function lineClass(kind: ReadLine["kind"]): string {
  if (kind === "add") return "bg-ok-soft";
  if (kind === "del") return "bg-bad-soft";
  return "";
}

function WhyLead({ why }: { why: string }) {
  return <p className="text-[1.02rem] m-0 mb-[0.9rem]">{why}</p>;
}

function CodeBlock({ hunk }: { hunk: ReadHunk }) {
  const lines = toReadLines(hunk);
  return (
    <div className="border border-line rounded-md overflow-hidden mb-[1.2rem] bg-surface">
      <div className="flex justify-between gap-4 px-[0.9rem] py-[0.45rem] font-mono text-[0.76rem] text-muted bg-field border-b border-line-2">
        <span>{hunk.file}</span>
        <span>{hunkRangeLabel(hunk)}</span>
      </div>
      <pre className="m-0 px-[0.9rem] py-[0.7rem] font-mono text-[0.78rem] leading-[1.6] overflow-x-auto">
        {lines.map((line, i) => (
          <span key={i} className={`block ${lineClass(line.kind)}`}>
            <span className="inline-block w-[2.2em] text-muted select-none">
              {line.n ?? ""}
            </span>
            {line.text}
          </span>
        ))}
      </pre>
    </div>
  );
}

function ReadNav({
  sessionId,
  index,
  total,
}: {
  sessionId: string;
  index: number;
  total: number;
}) {
  const last = index === total - 1;
  const nextHref = last
    ? `/session/${sessionId}/answer/0`
    : `/session/${sessionId}/read/${index + 1}`;
  return (
    <div className="flex flex-wrap items-center gap-x-[1.2rem] gap-y-[0.8rem]">
      <Link
        href={nextHref}
        className="inline-flex items-center rounded-btn bg-accent text-accent-ink font-semibold text-[0.9rem] px-[1.1rem] py-[0.6rem]"
      >
        {last ? "I've read these, ask me" : "Next"}
      </Link>
      {index > 0 ? (
        <Link
          href={`/session/${sessionId}/read/${index - 1}`}
          className="text-accent underline underline-offset-[3px] text-[0.9rem]"
        >
          Back
        </Link>
      ) : null}
    </div>
  );
}

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

function useReadRedirects(
  sessionId: Id<"sessions">,
  rawN: string,
  view: { hunks: ReadHunk[] } | null | undefined,
) {
  const router = useRouter();
  useEffect(() => {
    if (view === undefined || view === null) return;
    if (view.hunks.length === 0) {
      router.replace(`/session/${sessionId}/answer/0?noRead=1`);
      return;
    }
    const clamped = clampIndex(rawN, view.hunks.length);
    if (clamped !== null && String(clamped) !== rawN) {
      router.replace(`/session/${sessionId}/read/${clamped}`);
    }
  }, [view, rawN, router, sessionId]);
}

function ReadScreen({
  sessionId,
  title,
  hunks,
  index,
}: {
  sessionId: string;
  title: string;
  hunks: ReadHunk[];
  index: number;
}) {
  const hunk = hunks[index]!;
  const lines = toReadLines(hunk);
  const mins = hunks.length - index + 1;
  return (
    <BriefChrome title={title} step={1} timeLabel={`about ${mins} min left`}>
      <p className="text-muted text-[0.84rem] m-0 mb-[0.45rem]">
        Read {index + 1} of {hunks.length} · {lines.length} lines
      </p>
      <WhyLead why={hunk.why} />
      <CodeBlock hunk={hunk} />
      <ReadNav sessionId={sessionId} index={index} total={hunks.length} />
    </BriefChrome>
  );
}

export default function ReadPage({
  params,
}: {
  params: Promise<{ sessionId: string; n: string }>;
}) {
  const { sessionId: rawId, n: rawN } = use(params);
  const sessionId = rawId as Id<"sessions">;
  const view = useQuery(api.briefs.getReadView, { sessionId });
  useReadRedirects(sessionId, rawN, view);

  if (view === undefined) return <LoadingStatus />;
  if (view === null) notFound();
  const index = clampIndex(rawN, view.hunks.length);
  if (index === null || String(index) !== rawN) return <LoadingStatus />;
  return (
    <ReadScreen
      sessionId={sessionId}
      title={view.title}
      hunks={view.hunks}
      index={index}
    />
  );
}
