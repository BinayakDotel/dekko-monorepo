import { describe, expect, test } from "vitest";
import { formatElapsed } from "./elapsed";

describe("formatElapsed", () => {
  test("formats under a minute as seconds", () => {
    expect(formatElapsed(0)).toBe("0 s");
    expect(formatElapsed(45_000)).toBe("45 s");
    expect(formatElapsed(59_999)).toBe("59 s");
  });

  test("formats under an hour as minutes and seconds", () => {
    expect(formatElapsed(60_000)).toBe("1 min 0 s");
    expect(formatElapsed(125_000)).toBe("2 min 5 s");
    expect(formatElapsed(3_599_000)).toBe("59 min 59 s");
  });

  test("formats an hour or more as hours and minutes", () => {
    expect(formatElapsed(3_600_000)).toBe("1 h 0 min");
    expect(formatElapsed(50_580_000)).toBe("14 h 3 min");
  });
});
