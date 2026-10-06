import {
  analyze,
  ChangeModelSchema,
  parseDiff,
  parsePrUrl,
  type ChangeModel,
  type Hunk,
} from "@dekko/core";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const hunkDoc = v.object({
  hunkId: v.string(),
  file: v.string(),
  oldStart: v.number(),
  oldLines: v.number(),
  newStart: v.number(),
  newLines: v.number(),
  kind: v.union(
    v.literal("added"),
    v.literal("modified"),
    v.literal("removed"),
    v.literal("renamed"),
  ),
  text: v.string(),
});

type GitHubPrJson = {
  title?: unknown;
  body?: unknown;
  head?: { sha?: unknown };
};

type StoredHunk = {
  id: string;
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  kind: Hunk["kind"];
  text: string;
};

function githubHeaders(accept: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "dekko-monorepo",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchPrMeta(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ title: string; body: string; headSha: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: githubHeaders("application/vnd.github+json"),
  });
  if (!res.ok) {
    throw new Error(`GitHub PR fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as GitHubPrJson;
  const headSha = typeof json.head?.sha === "string" ? json.head.sha : null;
  if (!headSha) throw new Error("GitHub PR response missing head.sha");
  return {
    title: typeof json.title === "string" ? json.title : "",
    body: typeof json.body === "string" ? json.body : "",
    headSha,
  };
}

async function fetchPrDiff(owner: string, repo: string, prNumber: number): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: githubHeaders("application/vnd.github.diff"),
  });
  if (!res.ok) {
    throw new Error(`GitHub diff fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

function citedHunkIds(model: ChangeModel): string[] {
  const ids = new Set<string>();
  for (const c of model.components) for (const h of c.hunks) ids.add(h);
  for (const e of model.edges) for (const h of e.hunks) ids.add(h);
  for (const k of model.keyHunks) ids.add(k.hunkId);
  for (const q of model.questions) for (const h of q.hunks) ids.add(h);
  return [...ids];
}

function toHunkRows(hunks: readonly Hunk[]) {
  return hunks.map((h) => ({
    hunkId: h.id,
    file: h.file,
    oldStart: h.oldStart,
    oldLines: h.oldLines,
    newStart: h.newStart,
    newLines: h.newLines,
    kind: h.kind,
    text: h.text,
  }));
}

function parseStoredModel(raw: unknown): ChangeModel {
  const parsed = ChangeModelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`ChangeModel failed Zod parse: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function loadCitedHunks(
  ctx: QueryCtx,
  changeModelId: Id<"changeModels">,
  model: ChangeModel,
): Promise<StoredHunk[]> {
  const hunks: StoredHunk[] = [];
  for (const hunkId of citedHunkIds(model)) {
    const row = await ctx.db
      .query("hunks")
      .withIndex("by_changeModelId_and_hunkId", (q) =>
        q.eq("changeModelId", changeModelId).eq("hunkId", hunkId),
      )
      .unique();
    if (!row) continue;
    hunks.push({
      id: row.hunkId,
      file: row.file,
      oldStart: row.oldStart,
      oldLines: row.oldLines,
      newStart: row.newStart,
      newLines: row.newLines,
      kind: row.kind,
      text: row.text,
    });
  }
  return hunks;
}

export const findByPr = internalQuery({
  args: {
    repo: v.string(),
    prNumber: v.number(),
    headSha: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"changeModels"> | null> => {
    const doc = await ctx.db
      .query("changeModels")
      .withIndex("by_pr", (q) =>
        q.eq("repo", args.repo).eq("prNumber", args.prNumber).eq("headSha", args.headSha),
      )
      .unique();
    return doc?._id ?? null;
  },
});

export const deleteBrief = internalMutation({
  args: { changeModelId: v.id("changeModels") },
  handler: async (ctx, args) => {
    for (;;) {
      const rows = await ctx.db
        .query("hunks")
        .withIndex("by_changeModelId_and_hunkId", (q) => q.eq("changeModelId", args.changeModelId))
        .take(500);
      if (rows.length === 0) break;
      for (const row of rows) await ctx.db.delete(row._id);
    }
    await ctx.db.delete(args.changeModelId);
  },
});

export const insertBrief = internalMutation({
  args: {
    repo: v.string(),
    prNumber: v.number(),
    headSha: v.string(),
    model: v.any(),
    modelId: v.string(),
    usage: v.any(),
    skippedFiles: v.array(v.string()),
    truncated: v.boolean(),
    omittedFiles: v.array(v.string()),
    hunks: v.array(hunkDoc),
  },
  handler: async (ctx, args): Promise<Id<"changeModels">> => {
    const model = parseStoredModel(args.model);
    const changeModelId = await ctx.db.insert("changeModels", {
      repo: args.repo,
      prNumber: args.prNumber,
      headSha: args.headSha,
      model,
      modelId: args.modelId,
      usage: args.usage,
      skippedFiles: args.skippedFiles,
      truncated: args.truncated,
      omittedFiles: args.omittedFiles,
      createdAt: Date.now(),
    });
    for (const hunk of args.hunks) {
      await ctx.db.insert("hunks", { changeModelId, ...hunk });
    }
    return changeModelId;
  },
});

export const getBrief = query({
  args: { changeModelId: v.id("changeModels") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.changeModelId);
    if (!doc) return null;
    const model = parseStoredModel(doc.model);
    return {
      changeModelId: doc._id,
      repo: doc.repo,
      prNumber: doc.prNumber,
      headSha: doc.headSha,
      model,
      modelId: doc.modelId,
      usage: doc.usage,
      skippedFiles: doc.skippedFiles,
      truncated: doc.truncated,
      omittedFiles: doc.omittedFiles,
      createdAt: doc.createdAt,
      hunks: await loadCitedHunks(ctx, args.changeModelId, model),
    };
  },
});

export const analyzePr = action({
  args: {
    url: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"changeModels">> => {
    const { owner, repo, prNumber } = parsePrUrl(args.url);
    const repoFull = `${owner}/${repo}`;
    const meta = await fetchPrMeta(owner, repo, prNumber);
    const existing: Id<"changeModels"> | null = await ctx.runQuery(internal.briefs.findByPr, {
      repo: repoFull,
      prNumber,
      headSha: meta.headSha,
    });
    if (existing && !args.force) return existing;
    if (existing && args.force) {
      await ctx.runMutation(internal.briefs.deleteBrief, { changeModelId: existing });
    }

    const { hunks, skippedFiles } = parseDiff(await fetchPrDiff(owner, repo, prNumber));
    const result = await analyze({ hunks, title: meta.title, body: meta.body });
    const changeModelId: Id<"changeModels"> = await ctx.runMutation(internal.briefs.insertBrief, {
      repo: repoFull,
      prNumber,
      headSha: meta.headSha,
      model: result.changeModel,
      modelId: result.model,
      usage: result.usage,
      skippedFiles,
      truncated: result.truncated,
      omittedFiles: result.omittedFiles,
      hunks: toHunkRows(hunks),
    });
    return changeModelId;
  },
});
