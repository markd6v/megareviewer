import { describe, expect, it } from "vitest";
import type { PullRequestRef } from "../../domain/review/index.ts";
import { toCommit, toHostUser, toPullRequest, toSummary } from "./map.ts";
import { BitbucketPullRequest } from "./schemas.ts";

const pullRequest = (overrides: Record<string, unknown> = {}) =>
  BitbucketPullRequest.parse({
    id: 42,
    title: "Add the checkout page",
    description: "",
    summary: { raw: "" },
    author: { uuid: "{a}", display_name: "Ada" },
    source: { branch: { name: "feature/42" }, commit: { hash: "0123456789ab" } },
    destination: {
      branch: { name: "main" },
      commit: { hash: "ba9876543210" },
      repository: { full_name: "Acme/Web-App" },
    },
    links: { html: { href: "https://bitbucket.org/Acme/Web-App/pull-requests/42" } },
    created_on: "2026-01-01T10:00:00.123456+02:00",
    updated_on: "2026-01-02T10:00:00+00:00",
    ...overrides,
  });

const toAccount = (name: string) => ({ uuid: "{u}", display_name: name });

const ref: PullRequestRef = {
  repo: { host: "bitbucket", owner: "acme", repo: "web-app" },
  number: 42,
};
const details = { baseSha: "b".repeat(40), headSha: "a".repeat(40), commits: [], diff: "" };

describe("toPullRequest", () => {
  it("converts timestamps with offsets to UTC", () => {
    expect(toPullRequest(ref, pullRequest(), details)).toMatchObject({
      createdAt: "2026-01-01T08:00:00.123Z",
      updatedAt: "2026-01-02T10:00:00.000Z",
    });
  });

  it("takes the description, else the summary, else nothing", () => {
    const descriptionOf = (overrides: Record<string, unknown>) =>
      toPullRequest(ref, pullRequest(overrides), details).description;

    expect(descriptionOf({ description: "From description" })).toBe("From description");
    expect(descriptionOf({ description: null, summary: { raw: "From summary" } })).toBe(
      "From summary",
    );
    expect(descriptionOf({ description: undefined, summary: null })).toBe("");
  });

  it("shows a deleted author as a former user", () => {
    expect(toPullRequest(ref, pullRequest({ author: null }), details).author).toEqual({
      id: "former-user",
      name: "Former user",
    });
  });
});

describe("toCommit", () => {
  const commit = (author: object) => ({ hash: "c".repeat(40), message: "m", author });

  it("takes the git author's name, without the email", () => {
    expect(toCommit(commit({ raw: "Ada Lovelace <ada@example.com>" })).author).toBe("Ada Lovelace");
  });

  it("falls back to the account's name, then to nothing", () => {
    expect(toCommit(commit({ raw: "<ada@example.com>", user: toAccount("Ada") })).author).toBe(
      "Ada",
    );
    expect(toCommit(commit({})).author).toBe("");
  });
});

describe("toSummary", () => {
  it("lowercases the ref but keeps Bitbucket's link", () => {
    expect(toSummary(pullRequest(), "reviewer")).toEqual({
      ref,
      url: "https://bitbucket.org/Acme/Web-App/pull-requests/42",
      title: "Add the checkout page",
      author: { id: "{a}", name: "Ada" },
      updatedAt: "2026-01-02T10:00:00.000Z",
      role: "reviewer",
    });
  });
});

describe("toHostUser", () => {
  it("uses the account UUID as the ID", () => {
    expect(toHostUser(toAccount("Grace"))).toEqual({ id: "{u}", name: "Grace" });
  });
});
