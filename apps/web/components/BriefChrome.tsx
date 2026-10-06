import type { ReactNode } from "react";

const STEP_COUNT = 4;

export type BriefStep = 0 | 1 | 2 | 3;

type BriefChromeProps = {
  title: string;
  /** Current brief step index. Prior steps render as done. */
  step: BriefStep;
  timeLabel: string;
  children: ReactNode;
};

function stepClass(index: number, current: number): string {
  if (index < current) return "bg-ok";
  if (index === current) return "bg-accent";
  return "bg-line";
}

export function BriefChrome({ title, step, timeLabel, children }: BriefChromeProps) {
  return (
    <>
      <header className="sticky top-0 z-[4] flex items-center gap-[0.9rem] bg-surface border-b border-line-2 px-[1.2rem] py-[0.7rem]">
        <span className="font-display text-[1.35rem]">Dekko</span>
        <span className="text-muted text-[0.86rem] truncate min-w-0 whitespace-nowrap">
          {title}
        </span>
        <span className="ml-auto flex gap-[0.3rem]" aria-label="Brief steps">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              className={`inline-block w-[22px] h-1 rounded-sm ${stepClass(i, step)}`}
            />
          ))}
        </span>
        <span className="text-muted text-[0.78rem] whitespace-nowrap">{timeLabel}</span>
      </header>
      <main className="max-w-[var(--measure)] mx-auto p-[var(--pad-screen)]">{children}</main>
    </>
  );
}
