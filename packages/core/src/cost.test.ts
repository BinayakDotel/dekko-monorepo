import { describe, expect, test } from "vitest";
import { costUsd, priceKey } from "./cost";

describe("priceKey", () => {
  test("joins provider, upstream, and model when upstream is set", () => {
    expect(
      priceKey({
        provider: "openrouter",
        upstream: "coreweave",
        model: "openai/gpt-oss-120b",
      }),
    ).toBe("openrouter:coreweave:openai/gpt-oss-120b");
  });

  test("drops the upstream segment when upstream is absent", () => {
    expect(priceKey({ provider: "groq", model: "openai/gpt-oss-120b" })).toBe(
      "groq:openai/gpt-oss-120b",
    );
    expect(
      priceKey({ provider: "anthropic", upstream: undefined, model: "claude-sonnet-5-5" }),
    ).toBe("anthropic:claude-sonnet-5-5");
  });

  test("keeps colons inside the model id", () => {
    expect(
      priceKey({
        provider: "openrouter",
        upstream: "coreweave",
        model: "openai/gpt-oss-120b:free",
      }),
    ).toBe("openrouter:coreweave:openai/gpt-oss-120b:free");
  });
});

describe("costUsd", () => {
  test("prices the OpenRouter CoreWeave pin from input and output tokens", () => {
    // $0.03 / $0.17 per 1M → 1M in + 1M out = $0.20
    expect(
      costUsd({
        provider: "openrouter",
        upstream: "coreweave",
        model: "openai/gpt-oss-120b",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(0.2);

    // 10k in + 2k out = 10k*0.03/1e6 + 2k*0.17/1e6 = 0.0003 + 0.00034
    expect(
      costUsd({
        provider: "openrouter",
        upstream: "coreweave",
        model: "openai/gpt-oss-120b",
        inputTokens: 10_000,
        outputTokens: 2_000,
      }),
    ).toBeCloseTo(0.00064, 10);
  });

  test("treats zero tokens as zero dollars", () => {
    expect(
      costUsd({
        provider: "openrouter",
        upstream: "coreweave",
        model: "openai/gpt-oss-120b",
        inputTokens: 0,
        outputTokens: 0,
      }),
    ).toBe(0);
  });

  test("throws on an unknown price key", () => {
    expect(() =>
      costUsd({
        provider: "groq",
        model: "openai/gpt-oss-120b",
        inputTokens: 100,
        outputTokens: 50,
      }),
    ).toThrow(/unknown price key/i);
  });
});
