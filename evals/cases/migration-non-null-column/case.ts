import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "migration-non-null-column",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "accounts" }, number: 77 },
    url: "https://github.com/acme/accounts/pull/77",
    title: "Record each account's data region",
    description:
      "ACC-310. Adds a `region` column to accounts. New accounts can choose a region at signup (default us-east-1), and the API returns it. Existing accounts get us-east-1, where all data lives today.",
    author: { id: "mira-holt", name: "Mira Holt" },
    sourceBranch: "ACC-310-account-region",
    targetBranch: "main",
    baseSha: "0aa0c16cc5ad310fbf343dcb510a7179a6a2d0d7",
    headSha: "1368819a812ce7bd04bb3b1a178bcd89496d9b7a",
    commits: [
      {
        sha: "1368819a812ce7bd04bb3b1a178bcd89496d9b7a",
        message: "Add region to accounts",
        author: "Mira Holt",
      },
    ],
    createdAt: "2026-10-14T10:00:00Z",
    updatedAt: "2026-10-14T10:20:00Z",
  },
  tickets: [
    {
      key: "ACC-310",
      url: "https://example.atlassian.net/browse/ACC-310",
      summary: "Record the data region of every account",
      description:
        "For data residency we need to know where each account's data lives. Store a region per account (us-east-1 or eu-west-1), let new accounts pick one at signup, and expose it in the account API.",
      type: "Story",
      status: "In Review",
    },
  ],
});
