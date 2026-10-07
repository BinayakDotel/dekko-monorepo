/** Dollars per 1M tokens: [input, output]. */
const PRICE_TABLE: Readonly<Record<string, readonly [number, number]>> = {
  // CoreWeave via OpenRouter — checked 2026-10-07 on openrouter.ai/openai/gpt-oss-120b
  "openrouter:coreweave:openai/gpt-oss-120b": [0.03, 0.17],
};

export type PriceKeyInput = {
  provider: string;
  upstream?: string | undefined;
  model: string;
};

export type CostUsdInput = PriceKeyInput & {
  inputTokens: number;
  outputTokens: number;
};

/** Only way to build price keys. Never split a key back into parts. */
export function priceKey({ provider, upstream, model }: PriceKeyInput): string {
  return upstream === undefined || upstream === ""
    ? `${provider}:${model}`
    : `${provider}:${upstream}:${model}`;
}

/** Recompute dollars from tokens + the price table. Throws on unknown key. */
export function costUsd(input: CostUsdInput): number {
  const key = priceKey(input);
  const rates = PRICE_TABLE[key];
  if (rates === undefined) {
    throw new Error(`Unknown price key: ${key}`);
  }
  const [inputPerM, outputPerM] = rates;
  return (input.inputTokens * inputPerM + input.outputTokens * outputPerM) / 1_000_000;
}
