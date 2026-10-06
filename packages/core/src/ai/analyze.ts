import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import { validateAgainstDiff, type Hunk } from "../diff";
import { ANALYZE_SYSTEM_PROMPT } from "../prompts/analyze";
import { ChangeModelSchema, type ChangeModel } from "../schema";

const HUNK_CHAR_BUDGET = 60_000;
const MAX_ATTEMPTS = 3;

const DEFAULT_MODELS = {
  groq: "openai/gpt-oss-120b",
  anthropic: "claude-sonnet-5-5",
} as const;

export type AnalyzeInput = {
  hunks: readonly Hunk[];
  title?: string;
  body?: string;
};

export type AnalyzeOptions = {
  model?: LanguageModel;
};

export type AnalyzeResult = {
  changeModel: ChangeModel;
  model: string;
  attempts: number;
  usage: LanguageModelUsage;
  truncated: boolean;
  omittedFiles: string[];
};

type PackedHunks = {
  included: Hunk[];
  truncated: boolean;
  omittedFiles: string[];
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

function resolveModel(opts?: AnalyzeOptions): { model: LanguageModel; modelId: string } {
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

function formatHunk(hunk: Hunk): string {
  return `### ${hunk.id} (${hunk.file}, ${hunk.kind})\n${hunk.text}`;
}

function buildUserPrompt(input: AnalyzeInput, packed: PackedHunks, feedback?: string): string {
  const parts: string[] = [];
  if (input.title !== undefined) parts.push("PR title (untrusted):\n" + input.title);
  if (input.body !== undefined) parts.push("PR body (untrusted):\n" + input.body);
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
      system: ANALYZE_SYSTEM_PROMPT,
      prompt,
      output: Output.object({ schema: ChangeModelSchema }),
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

export async function analyze(input: AnalyzeInput, opts?: AnalyzeOptions): Promise<AnalyzeResult> {
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

    const parsed = ChangeModelSchema.safeParse(call.output);
    if (!parsed.success) {
      feedback = formatZodError(parsed.error);
      continue;
    }

    const check = validateAgainstDiff(parsed.data, packed.included);
    if (!check.ok) {
      feedback = `unknown hunk ids: ${check.unknownHunkIds.join(", ")}`;
      continue;
    }

    return {
      changeModel: parsed.data,
      model: modelId,
      attempts: attempt,
      usage,
      truncated: packed.truncated,
      omittedFiles: packed.omittedFiles,
    };
  }

  throw new Error(`analyze failed after ${MAX_ATTEMPTS} attempts: ${feedback ?? "unknown error"}`);
}
