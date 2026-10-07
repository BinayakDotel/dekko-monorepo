import { z } from "zod";
import type { Hunk } from "./diff";
import { HunkIdSchema } from "./schema";

export const VerdictSchema = z.enum(["right", "partly", "wrong"]);

export const LineRefSchema = z.object({
  hunkId: HunkIdSchema,
  line: z.number().int().nonnegative(),
});

export type Verdict = z.infer<typeof VerdictSchema>;
export type LineRef = z.infer<typeof LineRefSchema>;

export function scoreAnswers(answers: readonly { verdict: Verdict }[]): number {
  return answers.filter((a) => a.verdict === "right").length;
}

type AnsweredQuestion = { questionId: string; verdict: Verdict };

export function appendAnswer<T extends AnsweredQuestion>(
  answers: readonly T[],
  next: T,
  questionCount: number,
): { answers: T[]; score: number | undefined } {
  if (answers.some((a) => a.questionId === next.questionId)) {
    throw new Error(`question "${next.questionId}" already answered`);
  }
  const all = [...answers, next];
  return { answers: all, score: all.length >= questionCount ? scoreAnswers(all) : undefined };
}

export function formatLineRef(lineRef: LineRef, hunks: readonly Hunk[]): string {
  const hunk = hunks.find((h) => h.id === lineRef.hunkId);
  if (!hunk) {
    throw new Error(`unknown hunk id "${lineRef.hunkId}"`);
  }
  return `${hunk.file}:L${lineRef.line}`;
}
