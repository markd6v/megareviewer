import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "unrequested-behavior",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 262 },
    url: "https://github.com/acme/shop/pull/262",
    title: 'Add "Remember me" to the login form',
    description:
      'SHOP-260: a "Remember me" checkbox on the login form. When it\'s checked the session and its cookie last 30 days; otherwise the session ends when the browser closes, as before.',
    author: { id: "ana-souza", name: "Ana Souza" },
    sourceBranch: "feature/SHOP-260-remember-me",
    targetBranch: "main",
    baseSha: "8737da9b9df8f28e6131752f2f8d33a119d0820f",
    headSha: "edfcfbccb76fc0b89d789fb222a5edd34a547731",
    commits: [
      {
        sha: "d6e0cb7b90bf1f69491059d1db5e6b2506609979",
        message: "Remember me checkbox",
        author: "Ana Souza",
      },
      {
        sha: "edfcfbccb76fc0b89d789fb222a5edd34a547731",
        message: "Keep remembered sessions for 30 days",
        author: "Ana Souza",
      },
    ],
    createdAt: "2026-10-18T12:00:00Z",
    updatedAt: "2026-10-18T13:40:00Z",
  },
  tickets: [
    {
      key: "SHOP-260",
      url: "https://example.atlassian.net/browse/SHOP-260",
      summary: "Remember me on login",
      description:
        'Customers complain about signing in on every visit. Add a "Remember me" checkbox; when checked, keep them signed in for 30 days.',
      type: "Story",
      status: "In Review",
    },
  ],
});
