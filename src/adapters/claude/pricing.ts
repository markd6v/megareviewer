/** US dollars per million tokens. */
export interface ModelPrice {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  /** Writes with the default 5-minute lifetime: 1.25× input. */
  readonly cacheWrite: number;
}

/**
 * First-party API prices from the claude-api skill's table (cached 2026-10-06). Check them
 * whenever the model, or the models fallbacks can answer on, change. The fallback models are
 * here because a refused request is answered and billed on one of them.
 */
export const PRICES: Readonly<Record<string, ModelPrice>> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

/** For a model missing from the table: the highest known prices, so cost is never understated. */
export const HIGHEST_PRICE: ModelPrice = {
  input: Math.max(...Object.values(PRICES).map((price) => price.input)),
  output: Math.max(...Object.values(PRICES).map((price) => price.output)),
  cacheRead: Math.max(...Object.values(PRICES).map((price) => price.cacheRead)),
  cacheWrite: Math.max(...Object.values(PRICES).map((price) => price.cacheWrite)),
};

export interface TokenCounts {
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
}

export const costUsd = (price: ModelPrice, tokens: TokenCounts): number =>
  (tokens.inputTokens * price.input +
    tokens.cacheReadTokens * price.cacheRead +
    tokens.cacheWriteTokens * price.cacheWrite +
    tokens.outputTokens * price.output) /
  1_000_000;
