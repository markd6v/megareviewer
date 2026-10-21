import { describe, expect, it } from "vitest";
import { count, mapLimit } from "./text.ts";

describe("count", () => {
  it("pluralizes", () => {
    expect([count(0, "file"), count(1, "file"), count(2, "file")]).toEqual([
      "0 files",
      "1 file",
      "2 files",
    ]);
  });
});

describe("mapLimit", () => {
  it("keeps the order with at most `limit` calls in flight", async () => {
    let inFlight = 0;
    let most = 0;
    const results = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      // Longer for larger n, so calls finish out of order.
      for (let tick = 0; tick < n; tick++) await Promise.resolve();
      inFlight -= 1;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(most).toBe(2);
  });

  it("handles no items", async () => {
    expect(await mapLimit([], 8, async () => 1)).toEqual([]);
  });
});
