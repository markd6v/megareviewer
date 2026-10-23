import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "env-var-config",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 270 },
    url: "https://github.com/acme/shop/pull/270",
    title: "Time out refund requests to the payment provider",
    description:
      "Refund requests could hang forever when the provider is slow. They now time out after PAYMENTS_TIMEOUT_MS milliseconds, 5 seconds by default. Documented in docs/configuration.md.",
    author: { id: "kit-moreno", name: "Kit Moreno" },
    sourceBranch: "payments/refund-timeout",
    targetBranch: "main",
    baseSha: "748678b6e044878dc9952fe2583f1d03db76beb0",
    headSha: "d6a48ed369f3d59b0e5f3edcc7d102ced697eae1",
    commits: [
      {
        sha: "d6a48ed369f3d59b0e5f3edcc7d102ced697eae1",
        message: "Add PAYMENTS_TIMEOUT_MS",
        author: "Kit Moreno",
      },
    ],
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-20T10:05:00Z",
  },
  tickets: [],
});
