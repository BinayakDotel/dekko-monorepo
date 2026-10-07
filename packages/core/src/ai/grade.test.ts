import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import type { LineRef, Verdict } from "../answer";
import { parseDiff, type Hunk } from "../diff";
import { grade, type Grade } from "./grade";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../test/fixtures");

function usage(input: number, output: number) {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  };
}

function gradeFor(verdict: Verdict, lineRef: LineRef, explanation = "Detail."): Grade {
  return { verdict, explanation, lineRef };
}

function mockModel(responses: Array<Grade | string>) {
  let i = 0;
  return new MockLanguageModelV4({
    modelId: "mock-grade",
    doGenerate: async () => {
      const next = responses[Math.min(i, responses.length - 1)]!;
      i += 1;
      const text = typeof next === "string" ? next : JSON.stringify(next);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: usage(5, 8),
        warnings: [],
      };
    },
  });
}

function loadFixtureHunks(name: string): Hunk[] {
  return parseDiff(readFileSync(join(fixtures, name), "utf8")).hunks;
}

/** Enlarge fixture hunks by repeating their own text so packing crosses the budget. */
function enlargeFromFixture(seed: Hunk, id: string, file: string, repeats: number): Hunk {
  return { ...seed, id, file, text: seed.text.repeat(repeats) };
}

function baseInput(hunks: readonly Hunk[]) {
  return {
    questionText: "What changed?",
    expectedAnswer: "A new skill entry was added.",
    answer: "They added a skill.",
    hunks,
  };
}

describe("grade", () => {
  test("returns a right verdict from a mocked provider", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const lineRef = { hunkId: hunk.id, line: hunk.newStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel([gradeFor("right", lineRef)]),
    });
    expect(result.grade.verdict).toBe("right");
    expect(result.grade.lineRef).toEqual(lineRef);
    expect(result.attempts).toBe(1);
    expect(result.model).toBe("mock-grade");
  });

  test("returns a partly verdict from a mocked provider", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const lineRef = { hunkId: hunk.id, line: hunk.newStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel([gradeFor("partly", lineRef)]),
    });
    expect(result.grade.verdict).toBe("partly");
  });

  test("returns a wrong verdict from a mocked provider", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const lineRef = { hunkId: hunk.id, line: hunk.newStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel([gradeFor("wrong", lineRef)]),
    });
    expect(result.grade.verdict).toBe("wrong");
  });

  test("retries when the line ref is outside the hunk range", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const bad = { hunkId: hunk.id, line: hunk.newStart + hunk.newLines + 50 };
    const good = { hunkId: hunk.id, line: hunk.newStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel([gradeFor("right", bad), gradeFor("right", good)]),
    });
    expect(result.attempts).toBe(2);
    expect(result.grade.lineRef).toEqual(good);
  });

  test("retries when the line ref cites an unknown hunk id", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const good = { hunkId: hunk.id, line: hunk.newStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel([gradeFor("wrong", { hunkId: "h99", line: 1 }), gradeFor("wrong", good)]),
    });
    expect(result.attempts).toBe(2);
    expect(result.grade.lineRef.hunkId).toBe(hunk.id);
  });

  test("retries when structured output is not valid JSON", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const good = { hunkId: hunk.id, line: hunk.newStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel(["not-json", gradeFor("right", good)]),
    });
    expect(result.attempts).toBe(2);
    expect(result.grade.verdict).toBe("right");
  });

  test("throws after three failed attempts", async () => {
    const hunk = loadFixtureHunks("small.diff")[0]!;
    const bad = { hunkId: hunk.id, line: 999_999 };
    await expect(
      grade(baseInput([hunk]), {
        model: mockModel([
          gradeFor("right", bad),
          gradeFor("right", bad),
          gradeFor("right", bad),
        ]),
      }),
    ).rejects.toThrow(/grade failed after 3 attempts/);
  });

  test("accepts old-file line refs for removed-only hunks", async () => {
    const removed = loadFixtureHunks("medium.diff").find((h) => h.newLines === 0);
    expect(removed).toBeDefined();
    const hunk = removed!;
    const lineRef = { hunkId: hunk.id, line: hunk.oldStart };
    const result = await grade(baseInput([hunk]), {
      model: mockModel([gradeFor("partly", lineRef, "Missing why it was deleted.")]),
    });
    expect(result.grade.lineRef).toEqual(lineRef);
  });

  test("rejects cites of truncated-away hunk ids", async () => {
    const seed = loadFixtureHunks("small.diff")[0]!;
    const hunks = [
      enlargeFromFixture(seed, "h1", "keep.ts", 800),
      enlargeFromFixture(seed, "h2", "drop.ts", 800),
    ];
    const result = await grade(baseInput(hunks), {
      model: mockModel([
        gradeFor("right", { hunkId: "h2", line: seed.newStart }),
        gradeFor("right", { hunkId: "h1", line: seed.newStart }),
      ]),
    });
    expect(result.attempts).toBe(2);
    expect(result.grade.lineRef.hunkId).toBe("h1");
  });
});
