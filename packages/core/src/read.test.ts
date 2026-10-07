import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseDiff } from "./diff";
import {
  focusWindowCoversHunk,
  hunkRangeLabel,
  sliceReadLines,
  toReadHunks,
  toReadLines,
  visibleRangeLabel,
  visibleReadLines,
  type ReadHunkRow,
} from "./read";
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
      { hunkId: "h2", why: "Second.", rank: 2, focusStart: null, focusEnd: null },
      { hunkId: "h1", why: "First.", rank: 1, focusStart: null, focusEnd: null },
    ];
    expect(toReadHunks(keyHunks, [b, a])).toEqual([
      { ...a, why: "First.", rank: 1, focus: "none" },
      { ...b, why: "Second.", rank: 2, focus: "none" },
    ]);
  });

  test("skips a key hunk with no matching row", () => {
    const a = rowFromFixture("small.diff", 0, "h1");
    const keyHunks: KeyHunk[] = [
      { hunkId: "h1", why: "Present.", rank: 1, focusStart: null, focusEnd: null },
      { hunkId: "h9", why: "Missing.", rank: 2, focusStart: null, focusEnd: null },
    ];
    expect(toReadHunks(keyHunks, [a])).toEqual([
      { ...a, why: "Present.", rank: 1, focus: "none" },
    ]);
  });

  test("tags model focus and pads the window by three new lines", () => {
    // small.diff hunk 0: @@ -19,6 +19,19 @@ → last new line 37
    const row = rowFromFixture("small.diff", 0, "h1");
    const keyHunks: KeyHunk[] = [
      {
        hunkId: "h1",
        why: "Reviewers may miss a broken path.",
        rank: 1,
        focusStart: 22,
        focusEnd: 28,
      },
    ];
    expect(toReadHunks(keyHunks, [row])).toEqual([
      {
        ...row,
        why: "Reviewers may miss a broken path.",
        rank: 1,
        focus: "model",
        windowStart: 19,
        windowEnd: 31,
      },
    ]);
  });

  test("falls back to a padded ~14-line window when a long hunk has no focus", () => {
    // small.diff hunk 3: @@ -0,0 +1,122 @@
    const row = rowFromFixture("small.diff", 3, "h4");
    const keyHunks: KeyHunk[] = [
      { hunkId: "h4", why: "Large skill file hides the risk.", rank: 1, focusStart: null, focusEnd: null },
    ];
    expect(toReadHunks(keyHunks, [row])).toEqual([
      {
        ...row,
        why: "Large skill file hides the risk.",
        rank: 1,
        focus: "fallback",
        windowStart: 1,
        windowEnd: 17,
      },
    ]);
  });

  test("tags none for a pure deletion", () => {
    const row = rowFromFixture("medium.diff", 0, "h1");
    const keyHunks: KeyHunk[] = [
      { hunkId: "h1", why: "Deleted rules still matter.", rank: 1, focusStart: null, focusEnd: null },
    ];
    expect(toReadHunks(keyHunks, [row])).toEqual([
      { ...row, why: "Deleted rules still matter.", rank: 1, focus: "none" },
    ]);
  });
});

describe("sliceReadLines", () => {
  test("keeps new-side lines in the window and deletes between them", () => {
    const lines = toReadLines(fixtureHunk("medium.diff", 0));
    // Pure deletion: all n are null — empty window of new lines yields []
    expect(sliceReadLines(lines, 1, 5)).toEqual([]);
  });

  test("includes delete rows that sit between kept new-side lines", () => {
    const lines = toReadLines(fixtureHunk("small.diff", 0));
    const sliced = sliceReadLines(lines, 22, 24);
    expect(sliced.every((l) => l.n === null || (l.n >= 22 && l.n <= 24))).toBe(true);
    expect(sliced.some((l) => l.n === 22)).toBe(true);
    expect(sliced.some((l) => l.n === 24)).toBe(true);
  });
});

describe("focusWindowCoversHunk", () => {
  test("is true when focus is none", () => {
    expect(
      focusWindowCoversHunk({
        focus: "none",
        newStart: 1,
        newLines: 50,
      }),
    ).toBe(true);
  });

  test("is true when the window spans the whole new range", () => {
    expect(
      focusWindowCoversHunk({
        focus: "model",
        newStart: 10,
        newLines: 5,
        windowStart: 10,
        windowEnd: 14,
      }),
    ).toBe(true);
  });

  test("is false when the window is a proper subset", () => {
    expect(
      focusWindowCoversHunk({
        focus: "fallback",
        newStart: 1,
        newLines: 122,
        windowStart: 1,
        windowEnd: 17,
      }),
    ).toBe(false);
  });
});

describe("visibleReadLines", () => {
  test("returns the padded fallback window until expanded", () => {
    const row = rowFromFixture("small.diff", 3, "h4");
    const [hunk] = toReadHunks(
      [{ hunkId: "h4", why: "Risk.", rank: 1, focusStart: null, focusEnd: null }],
      [row],
    );
    expect(hunk).toBeDefined();
    const focused = visibleReadLines(hunk!, false);
    expect(focused.length).toBeLessThan(toReadLines(hunk!).length);
    expect(visibleReadLines(hunk!, true)).toHaveLength(toReadLines(hunk!).length);
    expect(visibleRangeLabel(hunk!, focused, false)).toBe("lines 1–17");
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
