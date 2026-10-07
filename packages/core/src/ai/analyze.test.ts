import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import { parseDiff, type Hunk } from "../diff";
import type { ChangeModel } from "../schema";
import { analyze } from "./analyze";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../test/fixtures");

function usage(input: number, output: number) {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  };
}

function changeModelFor(hunkId: string): ChangeModel {
  return {
    schemaVersion: 1,
    components: [
      {
        id: "changed-file",
        label: "Changed file",
        kind: "other",
        status: "modified",
        hunks: [hunkId],
        confidence: 0.9,
      },
    ],
    edges: [],
    keyHunks: [{ hunkId, why: "Main edit.", rank: 1, focusStart: null, focusEnd: null }],
    questions: [
      { id: "q1", kind: "data-flow", text: "What flows?", expectedAnswer: "Data.", hunks: [hunkId] },
      { id: "q2", kind: "failure", text: "What fails?", expectedAnswer: "Errors.", hunks: [hunkId] },
      { id: "q3", kind: "debugging", text: "Where look?", expectedAnswer: "Logs.", hunks: [hunkId] },
    ],
    summary: ["One.", "Two.", "Three."],
    edgeCase: "Empty input.",
  };
}

function mockModel(responses: Array<ChangeModel | string>) {
  let i = 0;
  return new MockLanguageModelV4({
    modelId: "mock-analyze",
    doGenerate: async () => {
      const next = responses[Math.min(i, responses.length - 1)]!;
      i += 1;
      const text = typeof next === "string" ? next : JSON.stringify(next);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: usage(10, 20),
        warnings: [],
      };
    },
  });
}

function loadFixtureHunks(name: string): Hunk[] {
  const diff = readFileSync(join(fixtures, name), "utf8");
  return parseDiff(diff).hunks;
}

/** Enlarge fixture hunks by repeating their own text so packing crosses the budget. */
function enlargeFromFixture(seed: Hunk, id: string, file: string, repeats: number): Hunk {
  return { ...seed, id, file, text: seed.text.repeat(repeats) };
}

describe("analyze", () => {
  test("returns a ChangeModel from a mocked provider", async () => {
    const hunks = loadFixtureHunks("small.diff");
    expect(hunks.length).toBeGreaterThan(0);
    const hunkId = hunks[0]!.id;
    const result = await analyze(
      { hunks, title: "Add skill" },
      { model: mockModel([changeModelFor(hunkId)]) },
    );

    expect(result.changeModel.components[0]!.hunks).toEqual([hunkId]);
    expect(result.model).toBe("mock-analyze");
    expect(result.attempts).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.omittedFiles).toEqual([]);
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
  });

  test("retries when the model cites an unknown hunk id", async () => {
    const hunks = loadFixtureHunks("small.diff");
    const hunkId = hunks[0]!.id;
    const result = await analyze(
      { hunks },
      { model: mockModel([changeModelFor("h99"), changeModelFor(hunkId)]) },
    );
    expect(result.attempts).toBe(2);
    expect(result.changeModel.keyHunks[0]!.hunkId).toBe(hunkId);
    expect(result.usage.inputTokens).toBe(20);
    expect(result.usage.outputTokens).toBe(40);
  });

  test("retries when a key hunk focus lies outside the hunk new range", async () => {
    const hunks = loadFixtureHunks("small.diff");
    const hunkId = hunks[0]!.id;
    const bad = changeModelFor(hunkId);
    bad.keyHunks[0] = {
      hunkId,
      why: "Reviewers may miss a broken path.",
      rank: 1,
      focusStart: 1,
      focusEnd: 5,
    };
    const good = changeModelFor(hunkId);
    const result = await analyze({ hunks }, { model: mockModel([bad, good]) });
    expect(result.attempts).toBe(2);
    expect(result.changeModel.keyHunks[0]!.focusStart).toBeNull();
  });

  test("retries when structured output is not valid JSON", async () => {
    const hunks = loadFixtureHunks("small.diff");
    const hunkId = hunks[0]!.id;
    const result = await analyze(
      { hunks },
      { model: mockModel(["not-json", changeModelFor(hunkId)]) },
    );
    expect(result.attempts).toBe(2);
    expect(result.changeModel.keyHunks[0]!.hunkId).toBe(hunkId);
  });

  test("reports truncated and omitted files when hunks exceed the budget", async () => {
    const seed = loadFixtureHunks("small.diff")[0]!;
    const hunks = [
      enlargeFromFixture(seed, "h1", "keep.ts", 800),
      enlargeFromFixture(seed, "h2", "drop.ts", 800),
    ];
    const result = await analyze({ hunks }, { model: mockModel([changeModelFor("h1")]) });
    expect(result.truncated).toBe(true);
    expect(result.omittedFiles).toEqual(["drop.ts"]);
    expect(result.changeModel.keyHunks[0]!.hunkId).toBe("h1");
  });

  test("rejects cites of truncated-away hunk ids", async () => {
    const seed = loadFixtureHunks("small.diff")[0]!;
    const hunks = [
      enlargeFromFixture(seed, "h1", "keep.ts", 800),
      enlargeFromFixture(seed, "h2", "drop.ts", 800),
    ];
    const result = await analyze(
      { hunks },
      { model: mockModel([changeModelFor("h2"), changeModelFor("h1")]) },
    );
    expect(result.attempts).toBe(2);
    expect(result.changeModel.keyHunks[0]!.hunkId).toBe("h1");
  });
});
