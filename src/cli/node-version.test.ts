import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { MIN_NODE_MAJOR, nodeVersionProblem } from "./node-version.ts";

describe("nodeVersionProblem", () => {
  it.each(["24.0.0", "24.21.0", "25.1.0", "100.0.0"])("accepts Node %s", (version) => {
    expect(nodeVersionProblem(version)).toBeNull();
  });

  it.each(["22.11.0", "23.9.0", "20.18.1", "", "unknown"])("rejects Node %j", (version) => {
    expect(nodeVersionProblem(version)).toContain(
      `needs Node 24 or later, but this is Node ${version}.`,
    );
  });

  it("matches package.json's engines", () => {
    expect(packageJson.engines.node).toBe(`>=${MIN_NODE_MAJOR}`);
  });
});
