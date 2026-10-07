import {
  analyze,
  appendAnswer,
  buildChips,
  ChangeModelSchema,
  formatLineRef,
  grade,
  parseDiff,
  parsePrUrl,
  scorePrediction,
  toReadHunks,
  toRevealModel,
  type ChangeModel,
  type Grade,
  type GradeInput,
  type Hunk,
  type HunkKind,
} from "@dekko/core";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { answerDoc } from "./schema";

const fileKind = v.union(
  v.literal("added"),
  v.literal("modified"),
  v.literal("removed"),
  v.literal("renamed"),
);

const fileDoc = v.object({
  path: v.string(),
  kind: fileKind,
});

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

type GradeContext = Omit<GradeInput, "answer">;

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

function toFileRows(hunks: readonly Hunk[], skippedFiles: readonly string[]) {
  const byPath = new Map<string, HunkKind>();
  for (const h of hunks) {
    if (!byPath.has(h.file)) byPath.set(h.file, h.kind);
  }
  for (const path of skippedFiles) {
    if (!byPath.has(path)) byPath.set(path, "modified");
  }
  return [...byPath.entries()].map(([path, kind]) => ({ path, kind }));
}

function chipInput(
  changeModelId: Id<"changeModels">,
  model: ChangeModel,
  files: { path: string; kind: HunkKind }[],
  hunks: StoredHunk[],
) {
  return {
    model,
    changeModelId,
    files,
    hunks: hunks.map((h) => ({ id: h.id, file: h.file })),
  };
}

function parseStoredModel(raw: unknown): ChangeModel {
  const parsed = ChangeModelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`ChangeModel failed Zod parse: ${parsed.error.message}`);
  }
  return parsed.data;
}

function toStoredHunk(row: {
  hunkId: string;
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  kind: Hunk["kind"];
  text: string;
}): StoredHunk {
  return {
    id: row.hunkId,
    file: row.file,
    oldStart: row.oldStart,
    oldLines: row.oldLines,
    newStart: row.newStart,
    newLines: row.newLines,
    kind: row.kind,
    text: row.text,
  };
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
    if (row) hunks.push(toStoredHunk(row));
  }
  return hunks;
}

async function loadKeyHunkRows(
  ctx: QueryCtx,
  changeModelId: Id<"changeModels">,
  keyHunks: ChangeModel["keyHunks"],
) {
  const rows: {
    hunkId: string;
    file: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    text: string;
  }[] = [];
  for (const { hunkId } of keyHunks) {
    const row = await ctx.db
      .query("hunks")
      .withIndex("by_changeModelId_and_hunkId", (q) =>
        q.eq("changeModelId", changeModelId).eq("hunkId", hunkId),
      )
      .unique();
    if (!row) continue;
    rows.push({
      hunkId: row.hunkId,
      file: row.file,
      oldStart: row.oldStart,
      oldLines: row.oldLines,
      newStart: row.newStart,
      newLines: row.newLines,
      text: row.text,
    });
  }
  return rows;
}

async function loadHunksByIds(
  ctx: QueryCtx,
  changeModelId: Id<"changeModels">,
  hunkIds: readonly string[],
): Promise<StoredHunk[]> {
  const hunks: StoredHunk[] = [];
  for (const hunkId of new Set(hunkIds)) {
    const row = await ctx.db
      .query("hunks")
      .withIndex("by_changeModelId_and_hunkId", (q) =>
        q.eq("changeModelId", changeModelId).eq("hunkId", hunkId),
      )
      .unique();
    if (row) hunks.push(toStoredHunk(row));
  }
  return hunks;
}

async function loadAllHunks(
  ctx: QueryCtx,
  changeModelId: Id<"changeModels">,
): Promise<StoredHunk[]> {
  const rows = await ctx.db
    .query("hunks")
    .withIndex("by_changeModelId_and_hunkId", (q) => q.eq("changeModelId", changeModelId))
    .collect();
  return rows.map(toStoredHunk);
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
    title: v.string(),
    files: v.array(fileDoc),
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
      title: args.title,
      files: args.files,
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

async function chipsFor(
  ctx: QueryCtx,
  changeModelId: Id<"changeModels">,
  model: ChangeModel,
  files: { path: string; kind: HunkKind }[],
) {
  const allHunks = await loadAllHunks(ctx, changeModelId);
  return buildChips(chipInput(changeModelId, model, files, allHunks));
}

/** Pre-lock view: title, files, chips only — never the model/answer key. */
export const getPredictView = query({
  args: { changeModelId: v.id("changeModels") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.changeModelId);
    if (!doc) return null;
    const model = parseStoredModel(doc.model);
    const files = doc.files ?? [];
    return {
      title: doc.title ?? "",
      files,
      chips: await chipsFor(ctx, args.changeModelId, model, files),
    };
  },
});

/** Post-lock brief: requires a session whose prediction is already locked. */
export const getBrief = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    const doc = await ctx.db.get(session.changeModelId);
    if (!doc) return null;
    const model = parseStoredModel(doc.model);
    const files = doc.files ?? [];
    const chips = await chipsFor(ctx, session.changeModelId, model, files);
    const cited = await loadCitedHunks(ctx, session.changeModelId, model);
    return {
      sessionId: session._id,
      changeModelId: doc._id,
      repo: doc.repo,
      prNumber: doc.prNumber,
      headSha: doc.headSha,
      title: doc.title ?? "",
      files,
      chips,
      model,
      modelId: doc.modelId,
      usage: doc.usage,
      skippedFiles: doc.skippedFiles,
      truncated: doc.truncated,
      omittedFiles: doc.omittedFiles,
      createdAt: doc.createdAt,
      hunks: cited,
    };
  },
});

/** Read screen: key hunks only — never ships expectedAnswer. */
export const getReadView = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    const doc = await ctx.db.get(session.changeModelId);
    if (!doc) return null;
    const model = parseStoredModel(doc.model);
    const hunkRows = await loadKeyHunkRows(ctx, session.changeModelId, model.keyHunks);
    return {
      title: doc.title ?? "",
      hunks: toReadHunks(model.keyHunks, hunkRows),
    };
  },
});

async function loadSessionModel(ctx: QueryCtx, sessionId: Id<"sessions">) {
  const session = await ctx.db.get(sessionId);
  if (!session) return null;
  const doc = await ctx.db.get(session.changeModelId);
  if (!doc) return null;
  return { session, doc, model: parseStoredModel(doc.model) };
}

export const loadGradeInput = internalQuery({
  args: { sessionId: v.id("sessions"), questionId: v.string() },
  handler: async (ctx, args): Promise<GradeContext> => {
    const loaded = await loadSessionModel(ctx, args.sessionId);
    if (!loaded) throw new Error("session not found");
    if (loaded.session.answers.some((a) => a.questionId === args.questionId)) {
      throw new Error(`question "${args.questionId}" already answered`);
    }
    const question = loaded.model.questions.find((q) => q.id === args.questionId);
    if (!question) throw new Error(`unknown question id "${args.questionId}"`);
    return {
      questionText: question.text,
      expectedAnswer: question.expectedAnswer,
      hunks: await loadHunksByIds(ctx, loaded.session.changeModelId, question.hunks),
    };
  },
});

export const storeAnswer = internalMutation({
  args: { sessionId: v.id("sessions"), answer: answerDoc },
  handler: async (ctx, args) => {
    const loaded = await loadSessionModel(ctx, args.sessionId);
    if (!loaded) throw new Error("session not found");
    const { answers, score } = appendAnswer(
      loaded.session.answers,
      args.answer,
      loaded.model.questions.length,
    );
    await ctx.db.patch(args.sessionId, { answers, score });
  },
});

export const gradeAnswer = action({
  args: { sessionId: v.id("sessions"), questionId: v.string(), text: v.string() },
  handler: async (ctx, args): Promise<Grade> => {
    const text = args.text.trim();
    if (!text) throw new Error("answer must not be empty");
    const input: GradeContext = await ctx.runQuery(internal.briefs.loadGradeInput, {
      sessionId: args.sessionId,
      questionId: args.questionId,
    });
    const { grade: graded } = await grade({ ...input, answer: text });
    await ctx.runMutation(internal.briefs.storeAnswer, {
      sessionId: args.sessionId,
      answer: { questionId: args.questionId, text, ...graded },
    });
    return graded;
  },
});

function hunkPayload(hunk: StoredHunk | undefined) {
  if (!hunk) return null;
  return {
    id: hunk.id,
    file: hunk.file,
    newStart: hunk.newStart,
    text: hunk.text,
  };
}

/** Answer screen: questions and stored grades — never ships expectedAnswer. */
export const getAnswerView = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const loaded = await loadSessionModel(ctx, args.sessionId);
    if (!loaded) return null;
    const { session, doc, model } = loaded;
    const refHunks = await loadHunksByIds(
      ctx,
      session.changeModelId,
      session.answers.map((a) => a.lineRef.hunkId),
    );
    const corrections = await ctx.db
      .query("corrections")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const disputedGrades = new Set(
      corrections.filter((c) => c.target === "grade").map((c) => c.targetId),
    );
    return {
      title: doc.title ?? "",
      questions: model.questions.map((q) => ({ id: q.id, kind: q.kind, text: q.text })),
      answers: session.answers.map((a) => {
        const hunk = refHunks.find((h) => h.id === a.lineRef.hunkId);
        return {
          questionId: a.questionId,
          text: a.text,
          verdict: a.verdict,
          explanation: a.explanation,
          ref: hunk ? formatLineRef(a.lineRef, [hunk]) : null,
          hunkId: a.lineRef.hunkId,
          hunk: hunkPayload(hunk),
          gradeDisputed: disputedGrades.has(a.questionId),
        };
      }),
    };
  },
});

export const startSession = mutation({
  args: {
    changeModelId: v.id("changeModels"),
    predictionText: v.string(),
    predictedComponents: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"sessions">> => {
    const picked = [...new Set(args.predictedComponents)];
    if (picked.length === 0) throw new Error("predictedComponents must not be empty");

    const doc = await ctx.db.get(args.changeModelId);
    if (!doc) throw new Error("change model not found");
    const model = parseStoredModel(doc.model);
    const allHunks = await loadAllHunks(ctx, args.changeModelId);
    const files = doc.files ?? [];
    const chips = buildChips(chipInput(args.changeModelId, model, files, allHunks));
    const chipIds = new Set(chips.map((c) => c.id));
    for (const id of picked) {
      if (!chipIds.has(id)) throw new Error(`unknown chip id "${id}"`);
    }

    return await ctx.db.insert("sessions", {
      changeModelId: args.changeModelId,
      userId: "local",
      predictionText: args.predictionText,
      predictedComponents: picked,
      predictionScore: scorePrediction({ model, picked }),
      answers: [],
      startedAt: Date.now(),
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    return {
      sessionId: session._id,
      changeModelId: session.changeModelId,
      userId: session.userId,
      predictionText: session.predictionText,
      predictedComponents: session.predictedComponents,
      predictionScore: session.predictionScore,
      answers: session.answers,
      score: session.score,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  },
});

/** Reveal screen: model without expectedAnswer + cited hunks + corrections. */
export const getRevealView = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const loaded = await loadSessionModel(ctx, args.sessionId);
    if (!loaded) return null;
    const { session, doc, model } = loaded;
    const cited = await loadCitedHunks(ctx, session.changeModelId, model);
    const corrections = await ctx.db
      .query("corrections")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return {
      title: doc.title ?? "",
      predictionScore: session.predictionScore,
      model: toRevealModel(model),
      hunks: cited.map((h) => ({
        id: h.id,
        file: h.file,
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        kind: h.kind,
        text: h.text,
      })),
      corrections: corrections.map((c) => ({
        target: c.target,
        targetId: c.targetId,
        note: c.note,
        createdAt: c.createdAt,
      })),
    };
  },
});

export const addCorrection = mutation({
  args: {
    sessionId: v.id("sessions"),
    target: v.union(v.literal("node"), v.literal("edge"), v.literal("grade")),
    targetId: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("session not found");
    const existing = await ctx.db
      .query("corrections")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    if (existing.some((c) => c.target === args.target && c.targetId === args.targetId)) {
      return;
    }
    await ctx.db.insert("corrections", {
      sessionId: args.sessionId,
      target: args.target,
      targetId: args.targetId,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

export const completeSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("session not found");
    if (session.completedAt !== undefined) return;
    await ctx.db.patch(args.sessionId, { completedAt: Date.now() });
  },
});

/** Done screen: requires completedAt; never ships expectedAnswer. */
export const getDoneView = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const loaded = await loadSessionModel(ctx, args.sessionId);
    if (!loaded) return null;
    const { session, doc, model } = loaded;
    if (session.completedAt === undefined) return null;
    return {
      title: doc.title ?? "",
      score: session.score ?? 0,
      questionCount: model.questions.length,
      edgeCase: model.edgeCase,
      elapsedMs:
        session.startedAt !== undefined
          ? session.completedAt - session.startedAt
          : null,
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
      title: meta.title,
      files: toFileRows(hunks, skippedFiles),
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
