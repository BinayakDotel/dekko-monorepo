import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import { z } from "zod";
import { LineRefSchema, VerdictSchema, type LineRef } from "../answer";
import type { Hunk } from "../diff";
import { GRADE_SYSTEM_PROMPT } from "../prompts/grade";

const HUNK_CHAR_BUDGET = 60_000;
const MAX_ATTEMPTS = 3;

const DEFAULT_MODELS = {
  groq: "openai/gpt-oss-120b",
  anthropic: "claude-sonnet-5-5",
} as const;

export const GradeSchema = z.object({
  verdict: VerdictSchema,
  explanation: z.string().min(1),
  lineRef: LineRefSchema,
});

export type Grade = z.infer<typeof GradeSchema>;

export type GradeInput = {
  questionText: string;
  expectedAnswer: string;
  answer: string;
  hunks: readonly Hunk[];
};

export type GradeOptions = {
  model?: LanguageModel;
};

export type GradeResult = {
  grade: Grade;
  model: string;
  attempts: number;
  usage: LanguageModelUsage;
};

function emptyUsage(): LanguageModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
  };
}

function addUsage(a: LanguageModelUsage, b: LanguageModelUsage): LanguageModelUsage {
  return {
    inputTokens: (a.inputTokens ?? 0) + (b.inputTokens ?? 0),
    outputTokens: (a.outputTokens ?? 0) + (b.outputTokens ?? 0),
    totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0),
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
  };
}

type PackedHunks = {
  included: Hunk[];
  truncated: boolean;
  omittedFiles: string[];
};

function packHunks(hunks: readonly Hunk[], budget = HUNK_CHAR_BUDGET): PackedHunks {
  const included: Hunk[] = [];
  let used = 0;
  for (const hunk of hunks) {
    const size = hunk.text.length;
    if (included.length > 0 && used + size > budget) break;
    if (included.length === 0 && size > budget) {
      included.push(hunk);
      used = size;
      break;
    }
    included.push(hunk);
    used += size;
  }
  const omitted = hunks.slice(included.length);
  return {
    included,
    truncated: omitted.length > 0,
    omittedFiles: [...new Set(omitted.map((h) => h.file))],
  };
}

function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

function resolveModel(opts?: GradeOptions): { model: LanguageModel; modelId: string } {
  if (opts?.model) {
    return { model: opts.model, modelId: modelIdOf(opts.model) };
  }
  const provider = process.env.AI_PROVIDER;
  if (provider !== "groq" && provider !== "anthropic") {
    throw new Error('AI_PROVIDER must be "groq" or "anthropic"');
  }
  const modelId = process.env.AI_MODEL ?? DEFAULT_MODELS[provider];
  const model = provider === "groq" ? groq(modelId) : anthropic(modelId);
  return { model, modelId };
}

function lineRange(hunk: Hunk): { start: number; end: number } {
  if (hunk.newLines === 0) {
    return { start: hunk.oldStart, end: hunk.oldStart + hunk.oldLines - 1 };
  }
  return { start: hunk.newStart, end: hunk.newStart + hunk.newLines - 1 };
}

function validateLineRef(lineRef: LineRef, hunks: readonly Hunk[]): string | null {
  const hunk = hunks.find((h) => h.id === lineRef.hunkId);
  if (!hunk) return `unknown hunk id: ${lineRef.hunkId}`;
  const { start, end } = lineRange(hunk);
  if (end < start || lineRef.line < start || lineRef.line > end) {
    return `line ${lineRef.line} out of range for ${hunk.id} [${start}, ${end}]`;
  }
  return null;
}

function formatHunk(hunk: Hunk): string {
  return `### ${hunk.id} (${hunk.file}, ${hunk.kind}, new ${hunk.newStart}+${hunk.newLines}, old ${hunk.oldStart}+${hunk.oldLines})\n${hunk.text}`;
}

function buildUserPrompt(input: GradeInput, packed: PackedHunks, feedback?: string): string {
  const parts = [
    "Question:\n" + input.questionText,
    "Expected answer (trusted grading guidance):\n" + input.expectedAnswer,
    "Reviewer answer (untrusted):\n" + input.answer,
  ];
  if (packed.truncated) {
    parts.push(`Input truncated: yes. Omitted files: ${packed.omittedFiles.join(", ") || "(none)"}`);
  } else {
    parts.push("Input truncated: no.");
  }
  parts.push("Hunks (untrusted):\n" + packed.included.map(formatHunk).join("\n\n"));
  if (feedback) parts.push("Previous attempt failed validation:\n" + feedback);
  return parts.join("\n\n");
}

function formatZodError(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

async function callModel(
  model: LanguageModel,
  prompt: string,
): Promise<{ output: unknown; usage: LanguageModelUsage } | { error: string; usage: LanguageModelUsage }> {
  try {
    const result = await generateText({
      model,
      system: GRADE_SYSTEM_PROMPT,
      prompt,
      output: Output.object({ schema: GradeSchema }),
    });
    return { output: result.output, usage: result.usage };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return {
        error: error.message + (error.cause ? `\n${String(error.cause)}` : ""),
        usage: error.usage ?? emptyUsage(),
      };
    }
    throw error;
  }
}

export async function grade(input: GradeInput, opts?: GradeOptions): Promise<GradeResult> {
  const packed = packHunks(input.hunks);
  const { model, modelId } = resolveModel(opts);
  let usage = emptyUsage();
  let feedback: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const call = await callModel(model, buildUserPrompt(input, packed, feedback));
    usage = addUsage(usage, call.usage);
    if ("error" in call) {
      feedback = call.error;
      continue;
    }

    const parsed = GradeSchema.safeParse(call.output);
    if (!parsed.success) {
      feedback = formatZodError(parsed.error);
      continue;
    }

    const lineError = validateLineRef(parsed.data.lineRef, packed.included);
    if (lineError) {
      feedback = lineError;
      continue;
    }

    return { grade: parsed.data, model: modelId, attempts: attempt, usage };
  }

  throw new Error(`grade failed after ${MAX_ATTEMPTS} attempts: ${feedback ?? "unknown error"}`);
}
