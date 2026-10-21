import { expect, it } from "vitest";

it("global fetch throws", () => {
  expect(() => fetch("https://api.github.com")).toThrow("network access in tests");
});
