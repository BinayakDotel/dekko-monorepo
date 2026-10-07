import { BriefChrome } from "../../../../components/BriefChrome";

/** Stub until T8c ships the real done screen. */
export default async function DonePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <BriefChrome title="Session complete" step={3} timeLabel="done">
      <p className="font-display text-[var(--text-question)] m-0 mb-4">You finished this brief.</p>
      <p className="text-muted text-[0.9rem] m-0">
        Session <span className="font-mono text-[0.82rem]">{sessionId}</span>. The full summary lands
        in the next step.
      </p>
    </BriefChrome>
  );
}
