import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseDiff } from "./diff";
import { hunkRangeLabel, toReadHunks, toReadLines, type ReadHunkRow } from "./read";
import type { KeyHunk } from "./schema";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");

function fixtureHunk(name: string, index: number) {
  const text = readFileSync(join(fixtures, name), "utf8");
  const hunk = parseDiff(text).hunks[index];
  if (!hunk) throw new Error(`missing hunk ${index} in ${name}`);
  return hunk;
}

function rowFromFixture(name: string, index: number, hunkId: string): ReadHunkRow {
  const hunk = fixtureHunk(name, index);
  return {
    hunkId,
    file: hunk.file,
    oldStart: hunk.oldStart,
    oldLines: hunk.oldLines,
    newStart: hunk.newStart,
    newLines: hunk.newLines,
    text: hunk.text,
  };
}

describe("toReadHunks", () => {
  test("sorts by rank and joins key hunks to rows by hunkId", () => {
    const a = rowFromFixture("small.diff", 0, "h1");
    const b = rowFromFixture("small.diff", 1, "h2");
    const keyHunks: KeyHunk[] = [
      { hunkId: "h2", why: "Second.", rank: 2 },
      { hunkId: "h1", why: "First.", rank: 1 },
    ];
    expect(toReadHunks(keyHunks, [b, a])).toEqual([
      { ...a, why: "First.", rank: 1 },
      { ...b, why: "Second.", rank: 2 },
    ]);
  });

  test("skips a key hunk with no matching row", () => {
    const a = rowFromFixture("small.diff", 0, "h1");
    const keyHunks: KeyHunk[] = [
      { hunkId: "h1", why: "Present.", rank: 1 },
      { hunkId: "h9", why: "Missing.", rank: 2 },
    ];
    expect(toReadHunks(keyHunks, [a])).toEqual([{ ...a, why: "Present.", rank: 1 }]);
  });
});

describe("toReadLines", () => {
  test("drops the @@ header from the output", () => {
    const lines = toReadLines(fixtureHunk("small.diff", 0));
    expect(lines.every((l) => !l.text.startsWith("@@"))).toBe(true);
  });

  test("numbers ctx and add lines on the new side", () => {
    const lines = toReadLines(fixtureHunk("small.diff", 0));
    expect(lines[0]).toEqual({
      n: 19,
      text: '      "repository": "https://github.com/BinayakDotel/skills-marketplace",',
      kind: "ctx",
    });
    expect(lines.find((l) => l.kind === "add")).toEqual({
      n: 22,
      text: "    },",
      kind: "add",
    });
  });

  test("gives del lines a null number", () => {
    expect(toReadLines(fixtureHunk("medium.diff", 0))[0]).toEqual({
      n: null,
      text: "---",
      kind: "del",
    });
  });

  test("ignores no-newline-at-end-of-file markers", () => {
    const hunk = fixtureHunk("medium.diff", 0);
    const lines = toReadLines({
      ...hunk,
      text: `${hunk.text}\n\\ No newline at end of file`,
    });
    expect(lines.some((l) => l.text.includes("No newline"))).toBe(false);
  });
});

describe("hunkRangeLabel", () => {
  test("labels a multi-line new range", () => {
    // small.diff hunk 0: @@ -19,6 +19,19 @@
    expect(hunkRangeLabel(rowFromFixture("small.diff", 0, "h1"))).toBe("lines 19–37");
  });

  test("labels a one-line range as line N", () => {
    expect(
      hunkRangeLabel({
        oldStart: 1,
        oldLines: 1,
        newStart: 7,
        newLines: 1,
      }),
    ).toBe("line 7");
  });

  test("uses the old range for a pure deletion", () => {
    // medium.diff hunk 0: @@ -1,13 +0,0 @@
    expect(hunkRangeLabel(rowFromFixture("medium.diff", 0, "h1"))).toBe("lines 1–13");
  });
});
