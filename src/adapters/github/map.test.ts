import { describe, expect, it } from "vitest";
import type { PullRequestRef } from "../../domain/review/index.ts";
import { toCommit, toHostUser, toPullRequest, toSummaries } from "./map.ts";
import type { GitHubPullRequest } from "./schemas.ts";

const SHA = "a".repeat(40);
const ref: PullRequestRef = { repo: { host: "github", owner: "o", repo: "r" }, number: 1 };

const pullRequest: GitHubPullRequest = {
  html_url: "https://github.com/o/r/pull/1",
  title: "t",
  body: null,
  user: null,
  head: { ref: "feature", sha: SHA },
  base: { ref: "main", sha: "b".repeat(40) },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("toHostUser", () => {
  it("uses the name when there is one", () => {
    expect(toHostUser({ login: "ada", name: "Ada Lovelace" })).toEqual({
      id: "ada",
      name: "Ada Lovelace",
    });
  });

  it("falls back to the login for a missing name", () => {
    expect(toHostUser({ login: "ada", name: null })).toEqual({ id: "ada", name: "ada" });
  });
});

describe("toPullRequest", () => {
  it("turns a null body into an empty description and a deleted author into ghost", () => {
    const mapped = toPullRequest(ref, pullRequest, {
      mergeBaseSha: "c".repeat(40),
      commits: [],
      diff: "",
    });
    expect(mapped).toMatchObject({
      description: "",
      author: { id: "ghost", name: "ghost" },
      sourceBranch: "feature",
      targetBranch: "main",
      baseSha: "c".repeat(40),
      headSha: SHA,
    });
  });
});

describe("toCommit", () => {
  const commit = (gitAuthor: { name: string } | null, account: { login: string } | null) =>
    toCommit({ sha: SHA, commit: { message: "m", author: gitAuthor }, author: account });

  it("prefers the git author's name, then the account's login", () => {
    expect(commit({ name: "Ada" }, { login: "ada" }).author).toBe("Ada");
    expect(commit(null, { login: "ada" }).author).toBe("ada");
    expect(commit(null, null).author).toBe("");
  });
});

describe("toSummaries", () => {
  it("takes owner and repo from repository_url, lowercased", () => {
    const [summary] = toSummaries(
      {
        total_count: 1,
        incomplete_results: false,
        items: [
          {
            number: 5,
            title: "t",
            html_url: "https://github.com/Octo-Org/Web/pull/5",
            user: { login: "octocat" },
            updated_at: "2026-01-01T00:00:00Z",
            repository_url: "https://api.github.com/repos/Octo-Org/Web",
          },
        ],
      },
      "author",
    );
    expect(summary).toEqual({
      ref: { repo: { host: "github", owner: "octo-org", repo: "web" }, number: 5 },
      url: "https://github.com/Octo-Org/Web/pull/5",
      title: "t",
      author: { id: "octocat", name: "octocat" },
      updatedAt: "2026-01-01T00:00:00Z",
      role: "author",
    });
  });
});
