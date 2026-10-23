import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { MIN_NODE, nodeVersionProblem } from "./node-version.ts";

describe("nodeVersionProblem", () => {
  it.each(["22.13.0", "22.23.4", "23.0.0", "24.21.0", "100.0.0"])("accepts Node %s", (version) => {
    expect(nodeVersionProblem(version)).toBeNull();
  });

  it.each(["22.12.0", "22.11.0", "21.99.0", "20.18.1", "", "unknown"])(
    "rejects Node %j",
    (version) => {
      expect(nodeVersionProblem(version)).toContain(
        `needs Node 22.13 or later, but this is Node ${version}. Install Node 22.13`,
      );
    },
  );

  it("matches package.json's engines", () => {
    expect(packageJson.engines.node).toBe(`>=${MIN_NODE.major}.${MIN_NODE.minor}`);
  });
});
