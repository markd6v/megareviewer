import { describe, expect, it } from "vitest";
import { fnv1a64 } from "./index.ts";

describe("fnv1a64", () => {
  it.each([
    ["", "cbf29ce484222325"],
    ["a", "af63dc4c8601ec8c"],
    ["foobar", "85944171f73967e8"],
    // Two UTF-8 bytes (c3 a9), not one UTF-16 code unit.
    ["é", "0ac21707b7181e01"],
  ])("matches the reference vector for %j", (input, expected) => {
    expect(fnv1a64(input)).toBe(expected);
  });
});
