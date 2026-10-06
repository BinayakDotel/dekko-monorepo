/** Placeholder until T6c ships the Read UI. */
export default async function ReadPlaceholderPage({
  params,
}: {
  params: Promise<{ sessionId: string; n: string }>;
}) {
  const { sessionId, n } = await params;
  return (
    <main className="max-w-[var(--measure)] mx-auto p-[var(--pad-screen)]">
      <p className="font-display text-[var(--text-question)] font-normal m-0 mb-2">Read</p>
      <p className="text-muted text-[0.88rem] m-0">
        Session {sessionId}, hunk {n}. The Read screen lands in T6c.
      </p>
    </main>
  );
}
