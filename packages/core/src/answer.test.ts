import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { appendAnswer, formatLineRef, scoreAnswers, type Verdict } from "./answer";
import { parseDiff } from "./diff";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");

describe("scoreAnswers", () => {
  test("counts only right verdicts", () => {
    expect(
      scoreAnswers([{ verdict: "right" }, { verdict: "partly" }, { verdict: "wrong" }]),
    ).toBe(1);
    expect(scoreAnswers([{ verdict: "right" }, { verdict: "right" }, { verdict: "right" }])).toBe(
      3,
    );
    expect(scoreAnswers([{ verdict: "partly" }, { verdict: "wrong" }])).toBe(0);
    expect(scoreAnswers([])).toBe(0);
  });
});

describe("appendAnswer", () => {
  test("appends the answer and leaves the score unset while questions remain", () => {
    const result = appendAnswer([], { questionId: "q1", verdict: "right" }, 3);
    expect(result.answers).toEqual([{ questionId: "q1", verdict: "right" }]);
    expect(result.score).toBeUndefined();
  });

  test("sets the score when the last question is answered", () => {
    const prior: { questionId: string; verdict: Verdict }[] = [
      { questionId: "q1", verdict: "right" },
      { questionId: "q2", verdict: "partly" },
    ];
    const result = appendAnswer(prior, { questionId: "q3", verdict: "right" }, 3);
    expect(result.answers).toHaveLength(3);
    expect(result.score).toBe(2);
  });

  test("rejects a second answer for the same question", () => {
    const prior: { questionId: string; verdict: Verdict }[] = [
      { questionId: "q1", verdict: "wrong" },
    ];
    expect(() => appendAnswer(prior, { questionId: "q1", verdict: "right" }, 3)).toThrow(
      /already answered/,
    );
  });
});

describe("formatLineRef", () => {
  test("renders path:Lline from the matching hunk", () => {
    const hunks = parseDiff(readFileSync(join(fixtures, "small.diff"), "utf8")).hunks;
    const hunk = hunks[0]!;
    expect(formatLineRef({ hunkId: hunk.id, line: hunk.newStart }, hunks)).toBe(
      `${hunk.file}:L${hunk.newStart}`,
    );
  });

  test("throws when the hunk id is unknown", () => {
    const hunks = parseDiff(readFileSync(join(fixtures, "small.diff"), "utf8")).hunks;
    expect(() => formatLineRef({ hunkId: "h99", line: 1 }, hunks)).toThrow(/unknown hunk id/);
  });
});
