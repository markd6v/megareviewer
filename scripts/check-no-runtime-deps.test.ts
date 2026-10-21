import { describe, expect, it } from "vitest";
import { findRuntimeDependencies } from "./check-no-runtime-deps.ts";

describe("findRuntimeDependencies", () => {
  it("lists runtime dependencies", () => {
    const packageJson = JSON.stringify({
      dependencies: { zod: "4.0.0", hono: "4.0.0" },
      devDependencies: { vitest: "5.0.0" },
    });
    expect(findRuntimeDependencies(packageJson)).toEqual(["zod", "hono"]);
  });

  it("accepts a package with only devDependencies", () => {
    const packageJson = JSON.stringify({ devDependencies: { vitest: "5.0.0" } });
    expect(findRuntimeDependencies(packageJson)).toEqual([]);
  });
});
