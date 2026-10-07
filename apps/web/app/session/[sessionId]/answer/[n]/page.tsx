/** Placeholder until T7 ships the Answer UI. */
export default async function AnswerPlaceholderPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string; n: string }>;
  searchParams: Promise<{ noRead?: string }>;
}) {
  const { sessionId, n } = await params;
  const { noRead } = await searchParams;

  return (
    <main className="max-w-[var(--measure)] mx-auto p-[var(--pad-screen)]">
      <p className="font-display text-[var(--text-question)] font-normal m-0 mb-2">Answer</p>
      {noRead === "1" ? (
        <p className="text-muted text-[0.88rem] m-0 mb-2">
          No code to read for this change; go straight to the questions.
        </p>
      ) : null}
      <p className="text-muted text-[0.88rem] m-0">
        Session {sessionId}, question {n}. The Answer screen lands in T7.
      </p>
    </main>
  );
}
