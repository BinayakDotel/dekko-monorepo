import { z } from "zod";

export const HunkIdSchema = z.string().regex(/^h[1-9]\d*$/, "hunk id must look like h1, h2, ...");
export const ComponentIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "component id must be a kebab-case slug");
const ConfidenceSchema = z.number().min(0).max(1);
const HunkIdsSchema = z.array(HunkIdSchema);

export const ComponentKindSchema = z.enum(["route", "service", "model", "queue", "ui", "other"]);
export const ComponentStatusSchema = z.enum(["added", "modified", "removed", "context"]);
export const EdgeRelationSchema = z.enum(["calls", "reads", "writes", "publishes", "imports", "other"]);
export const QuestionKindSchema = z.enum(["data-flow", "failure", "debugging"]);

export const ComponentSchema = z.object({
  id: ComponentIdSchema,
  label: z.string().min(1),
  kind: ComponentKindSchema,
  status: ComponentStatusSchema,
  hunks: HunkIdsSchema,
  confidence: ConfidenceSchema,
});

export const EdgeSchema = z.object({
  from: ComponentIdSchema,
  to: ComponentIdSchema,
  relation: EdgeRelationSchema,
  hunks: HunkIdsSchema.min(1),
  confidence: ConfidenceSchema,
});

function normalizeKeyHunkFocus(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    focusStart: o.focusStart === undefined ? null : o.focusStart,
    focusEnd: o.focusEnd === undefined ? null : o.focusEnd,
  };
}

export const KeyHunkSchema = z.preprocess(
  normalizeKeyHunkFocus,
  z
    .object({
      hunkId: HunkIdSchema,
      why: z.string().min(1),
      rank: z.number().int().min(1),
      // Required-but-nullable: Groq structured outputs reject optional keys.
      focusStart: z.number().int().nullable(),
      focusEnd: z.number().int().nullable(),
    })
    .superRefine((k, ctx) => {
      const hasStart = k.focusStart !== null;
      const hasEnd = k.focusEnd !== null;
      if (hasStart === hasEnd) return;
      ctx.addIssue({
        code: "custom",
        path: [hasStart ? "focusEnd" : "focusStart"],
        message: "focusStart and focusEnd must both be numbers or both null",
      });
    }),
);

/** Error if focus is invalid for the hunk's new-side range; otherwise null. */
export function focusRangeError(
  focus: { focusStart: number; focusEnd: number },
  hunk: { newStart: number; newLines: number },
): string | null {
  if (hunk.newLines === 0) return "focus not allowed when newLines is 0 (pure deletion)";
  if (focus.focusStart > focus.focusEnd) return "focusStart must be <= focusEnd";
  const last = hunk.newStart + hunk.newLines - 1;
  if (focus.focusStart < hunk.newStart || focus.focusEnd > last) {
    return `focus must lie within ${hunk.newStart}–${last}`;
  }
  return null;
}

export const QuestionSchema = z.object({
  id: z.string().min(1),
  kind: QuestionKindSchema,
  text: z.string().min(1),
  expectedAnswer: z.string().min(1),
  hunks: HunkIdsSchema.min(1),
});

const ChangeModelShape = z.object({
  schemaVersion: z.literal(1),
  components: z.array(ComponentSchema).min(1),
  edges: z.array(EdgeSchema),
  keyHunks: z.array(KeyHunkSchema).min(1).max(3),
  questions: z.array(QuestionSchema).length(3),
  summary: z.array(z.string().min(1)).length(3),
  edgeCase: z.string().min(1),
});

type Shape = z.infer<typeof ChangeModelShape>;
type Ctx = z.RefinementCtx;

function checkComponents({ components }: Shape, ctx: Ctx): void {
  const seen = new Set<string>();
  components.forEach((c, i) => {
    if (seen.has(c.id)) {
      ctx.addIssue({ code: "custom", path: ["components", i, "id"], message: `duplicate component id "${c.id}"` });
    }
    seen.add(c.id);
    if (c.status !== "context" && c.hunks.length === 0) {
      ctx.addIssue({ code: "custom", path: ["components", i, "hunks"], message: `${c.status} component needs at least one hunk` });
    }
  });
}

function checkEdges({ components, edges }: Shape, ctx: Ctx): void {
  const ids = new Set(components.map((c) => c.id));
  edges.forEach((e, i) => {
    for (const end of ["from", "to"] as const) {
      if (!ids.has(e[end])) {
        ctx.addIssue({ code: "custom", path: ["edges", i, end], message: `unknown component "${e[end]}"` });
      }
    }
  });
}

function checkKeyHunks({ keyHunks }: Shape, ctx: Ctx): void {
  const ranks = keyHunks.map((k) => k.rank).sort((a, b) => a - b);
  if (!ranks.every((rank, i) => rank === i + 1)) {
    ctx.addIssue({ code: "custom", path: ["keyHunks"], message: "ranks must be unique and run 1..n" });
  }
}

function checkQuestions({ questions }: Shape, ctx: Ctx): void {
  const kinds = new Set(questions.map((q) => q.kind));
  const ids = new Set(questions.map((q) => q.id));
  if (kinds.size !== questions.length) {
    ctx.addIssue({ code: "custom", path: ["questions"], message: "need exactly one question per kind" });
  }
  if (ids.size !== questions.length) {
    ctx.addIssue({ code: "custom", path: ["questions"], message: "question ids must be unique" });
  }
}

export const ChangeModelSchema = ChangeModelShape.superRefine((model, ctx) => {
  checkComponents(model, ctx);
  checkEdges(model, ctx);
  checkKeyHunks(model, ctx);
  checkQuestions(model, ctx);
});

export type ChangeModel = z.infer<typeof ChangeModelSchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type KeyHunk = z.infer<typeof KeyHunkSchema>;
export type Question = z.infer<typeof QuestionSchema>;
