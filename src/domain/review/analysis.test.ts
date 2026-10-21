import { describe, expect, it } from "vitest";
import { type AnalysisKey, analysisId } from "./index.ts";

const key: AnalysisKey = {
  ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 101 },
  headSha: "a".repeat(40),
  pipelineVersion: "1+claude-opus-5-5/p1",
};

describe("analysisId", () => {
  it("is stable for the same key", () => {
    expect(analysisId(key)).toBe(analysisId(structuredClone(key)));
    // Pinned so a change to the scheme, which orphans every cached analysis, is deliberate.
    expect(analysisId(key)).toBe("a_460f462eefd18cf8");
  });

  it.each([
    ["host", { ...key, ref: { ...key.ref, repo: { ...key.ref.repo, host: "bitbucket" } } }],
    ["owner", { ...key, ref: { ...key.ref, repo: { ...key.ref.repo, owner: "acme2" } } }],
    ["repo", { ...key, ref: { ...key.ref, repo: { ...key.ref.repo, repo: "shop2" } } }],
    ["number", { ...key, ref: { ...key.ref, number: 102 } }],
    ["head SHA", { ...key, headSha: "b".repeat(40) }],
    ["pipeline version", { ...key, pipelineVersion: "2+claude-opus-5-5/p1" }],
  ] satisfies [string, AnalysisKey][])("changes with the %s", (_, other) => {
    expect(analysisId(other)).not.toBe(analysisId(key));
  });

  it("has the AnalysisId shape", () => {
    expect(analysisId(key)).toMatch(/^a_[0-9a-f]{16}$/);
  });
});
