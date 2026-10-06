import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const answer = v.object({
  questionId: v.string(),
  text: v.string(),
  verdict: v.union(v.literal("right"), v.literal("partly"), v.literal("wrong")),
  explanation: v.string(),
  lineRef: v.string(),
});

export default defineSchema({
  changeModels: defineTable({
    repo: v.string(),
    prNumber: v.number(),
    headSha: v.string(),
    model: v.any(),
    modelId: v.string(),
    usage: v.any(),
    skippedFiles: v.array(v.string()),
    truncated: v.boolean(),
    omittedFiles: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_pr", ["repo", "prNumber", "headSha"]),

  hunks: defineTable({
    changeModelId: v.id("changeModels"),
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
  }).index("by_changeModelId_and_hunkId", ["changeModelId", "hunkId"]),

  sessions: defineTable({
    changeModelId: v.id("changeModels"),
    userId: v.string(),
    predictionText: v.string(),
    predictedComponents: v.array(v.string()),
    predictionScore: v.any(),
    answers: v.array(answer),
    score: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_changeModelId", ["changeModelId"]),

  corrections: defineTable({
    sessionId: v.id("sessions"),
    target: v.union(v.literal("node"), v.literal("edge"), v.literal("grade")),
    targetId: v.string(),
    note: v.string(),
    createdAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),
});
