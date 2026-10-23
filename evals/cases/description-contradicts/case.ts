import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "description-contradicts",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 251 },
    url: "https://github.com/acme/shop/pull/251",
    title: "Retry failed charges with exponential backoff",
    description:
      "During the provider's outage last week every failed charge was lost. This retries failed charges with exponential backoff: 200 ms, doubling each time, at most 5 attempts, so we recover from blips without hammering the provider while it's down.",
    author: { id: "kit-moreno", name: "Kit Moreno" },
    sourceBranch: "payments/retry-backoff",
    targetBranch: "main",
    baseSha: "546c07e507a086b4616ddca897782b6b3ac42665",
    headSha: "5d2524cf62335594b0fe41e4363cb45821cd15fc",
    commits: [
      {
        sha: "5d2524cf62335594b0fe41e4363cb45821cd15fc",
        message: "Retry failed charges",
        author: "Kit Moreno",
      },
    ],
    createdAt: "2026-10-17T08:00:00Z",
    updatedAt: "2026-10-17T08:25:00Z",
  },
  tickets: [],
});
