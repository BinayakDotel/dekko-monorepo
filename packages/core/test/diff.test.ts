import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseDiff, validateAgainstDiff } from "../src/diff";
import type { ChangeModel } from "../src/schema";

function modelCiting(...hunkIds: string[]): ChangeModel {
  const primary = hunkIds[0] ?? "h1";
  return {
    schemaVersion: 1,
    components: [
      {
        id: "auth-service",
        label: "Auth service",
        kind: "service",
        status: "modified",
        hunks: hunkIds,
        confidence: 0.9,
      },
    ],
    edges: [
      {
        from: "auth-service",
        to: "auth-service",
        relation: "calls",
        hunks: [primary],
        confidence: 0.8,
      },
    ],
    keyHunks: [{ hunkId: primary, why: "Main change.", rank: 1 }],
    questions: [
      { id: "q1", kind: "data-flow", text: "a?", expectedAnswer: "a", hunks: [primary] },
      { id: "q2", kind: "failure", text: "b?", expectedAnswer: "b", hunks: [primary] },
      { id: "q3", kind: "debugging", text: "c?", expectedAnswer: "c", hunks: [primary] },
    ],
    summary: ["One.", "Two.", "Three."],
    edgeCase: "None.",
  };
}

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function load(name: string): string {
  return readFileSync(join(fixtures, `${name}.diff`), "utf8");
}

describe("parseDiff", () => {
  test("assigns h1..hn in diff order on the small fixture", () => {
    const { hunks, skippedFiles } = parseDiff(load("small"));
    expect(skippedFiles).toEqual([]);
    expect(hunks.map((h) => h.id)).toEqual(["h1", "h2", "h3", "h4"]);
  });

  test("stores @@ ranges on each hunk", () => {
    const { hunks } = parseDiff(load("small"));
    expect(hunks[0]).toMatchObject({
      file: ".claude-plugin/marketplace.json",
      oldStart: 19,
      oldLines: 6,
      newStart: 19,
      newLines: 19,
    });
  });

  test("includes the @@ header in hunk text", () => {
    const { hunks } = parseDiff(load("small"));
    expect(hunks[0]?.text.startsWith("@@ -19,6 +19,19 @@")).toBe(true);
  });

  test("marks new files as added", () => {
    const { hunks } = parseDiff(load("small"));
    expect(hunks[2]).toMatchObject({
      file: "skills/conventional-commits/CHANGELOG.md",
      kind: "added",
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 10,
    });
  });

  test("marks deleted files as removed on the medium fixture", () => {
    const { hunks } = parseDiff(load("medium"));
    expect(hunks[0]).toMatchObject({
      file: ".cursor/rules/core.mdc",
      kind: "removed",
    });
  });

  test("drops lockfiles and binaries into skippedFiles", () => {
    const { hunks, skippedFiles } = parseDiff(load("lockfile"));
    expect(skippedFiles).toEqual([".pnpm-store/v11/index.db", "pnpm-lock.yaml"]);
    expect(hunks.map((h) => h.file)).toEqual([
      "packages/core/package.json",
      "packages/core/src/index.ts",
      "packages/core/src/schema.test.ts",
      "packages/core/src/schema.ts",
    ]);
    expect(hunks.map((h) => h.id)).toEqual(["h1", "h2", "h3", "h4"]);
  });
});

describe("validateAgainstDiff", () => {
  test("accepts a model that only cites parsed hunk ids", () => {
    const { hunks } = parseDiff(load("small"));
    expect(validateAgainstDiff(modelCiting("h1", "h3"), hunks)).toEqual({ ok: true });
  });

  test("returns unknownHunkIds for citations missing from the diff", () => {
    const { hunks } = parseDiff(load("small"));
    const model = modelCiting("h1");
    const edge = model.edges[0];
    const key = model.keyHunks[0];
    expect(edge).toBeDefined();
    expect(key).toBeDefined();
    if (!edge || !key) throw new Error("expected edge and keyHunk");
    edge.hunks = ["h1", "h99"];
    key.hunkId = "h42";
    expect(validateAgainstDiff(model, hunks)).toEqual({
      ok: false,
      unknownHunkIds: ["h99", "h42"],
    });
  });
});
