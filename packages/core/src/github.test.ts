import { expect, test } from "vitest";
import { parsePrUrl } from "./github";

test("parses an https github pull request url", () => {
  expect(parsePrUrl("https://github.com/acme/widgets/pull/42")).toEqual({
    owner: "acme",
    repo: "widgets",
    prNumber: 42,
  });
});

test("parses a url with a trailing slash and query", () => {
  expect(parsePrUrl("https://github.com/acme/widgets/pull/7/?tab=files")).toEqual({
    owner: "acme",
    repo: "widgets",
    prNumber: 7,
  });
});

test("rejects a non-pull-request github url", () => {
  expect(() => parsePrUrl("https://github.com/acme/widgets")).toThrow(/pull request url/i);
});
