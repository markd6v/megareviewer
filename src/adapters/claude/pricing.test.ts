import { describe, expect, it } from "vitest";
import { costUsd, HIGHEST_PRICE, PRICES } from "./pricing.ts";
import { MODEL } from "./request.ts";

describe("costUsd", () => {
  it("prices each kind of token per million", () => {
    const price = PRICES[MODEL];
    if (price === undefined) throw new Error(`no price for ${MODEL}`);
    const tokens = {
      inputTokens: 1_000_000,
      cacheReadTokens: 2_000_000,
      cacheWriteTokens: 1_000_000,
      outputTokens: 500_000,
    };
    // $4 input, $0.20 cache read, $5 cache write, $20 output.
    expect(costUsd(price, tokens)).toBeCloseTo(4 + 0.4 + 5 + 10, 10);
  });

  it("is zero for no tokens", () => {
    const none = { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
    expect(costUsd(HIGHEST_PRICE, none)).toBe(0);
  });
});

describe("prices", () => {
  it("cover the model the passes run on", () => {
    expect(PRICES[MODEL]).toEqual({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
  });

  it("write the cache at 1.25 times the input price", () => {
    for (const price of Object.values(PRICES)) expect(price.cacheWrite).toBe(price.input * 1.25);
  });

  it("fall back to the highest of each", () => {
    expect(HIGHEST_PRICE).toEqual({ input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 });
  });
});
