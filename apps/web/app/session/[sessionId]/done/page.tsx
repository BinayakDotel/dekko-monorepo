"use client";

import { formatElapsed } from "@dekko/core";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import { BriefChrome } from "../../../../components/BriefChrome";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type DoneView = NonNullable<FunctionReturnType<typeof api.briefs.getDoneView>>;

const PRIMARY_BTN =
  "inline-flex items-center rounded-btn bg-accent text-accent-ink font-semibold text-[0.9rem] px-[1.1rem] py-[0.6rem]";

function LoadingStatus() {
  return (
    <p className="text-muted text-[0.88rem] p-[var(--pad-screen)]" role="status">
      Loading…
    </p>
  );
}

function DoneScreen({ view }: { view: DoneView }) {
  const passed = view.score >= 2;
  const timeLabel = view.elapsedMs !== null ? formatElapsed(view.elapsedMs) : undefined;
  return (
    <BriefChrome title={view.title} step={4} timeLabel={timeLabel}>
      <div className="text-center py-8 pb-4">
        <p className="font-display text-[var(--text-question)] font-normal leading-[1.1] m-0 mb-[0.7rem]">
          {passed ? "You understand this change." : "You're close. One more pass."}
        </p>
        <p className="m-0 mx-auto mb-2 max-w-[40ch] text-[0.95rem]">
          {view.score} of {view.questionCount} questions right. One thing to fix before merge:{" "}
          {view.edgeCase}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-[1.2rem] gap-y-[0.8rem] mt-[1.4rem]">
          <Link href="/" className={PRIMARY_BTN}>
            Back to pull requests
          </Link>
        </div>
      </div>
    </BriefChrome>
  );
}

export default function DonePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId: rawId } = use(params);
  const sessionId = rawId as Id<"sessions">;
  const view = useQuery(api.briefs.getDoneView, { sessionId });
  if (view === undefined) return <LoadingStatus />;
  if (view === null) notFound();
  return <DoneScreen view={view} />;
}
