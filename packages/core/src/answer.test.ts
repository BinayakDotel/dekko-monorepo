import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { formatLineRef, scoreAnswers } from "./answer";
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
