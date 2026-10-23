import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "python-indentation-logic",
  pullRequest: {
    ref: { repo: { host: "bitbucket", owner: "acme", repo: "billing" }, number: 88 },
    url: "https://bitbucket.org/acme/billing/pull-requests/88",
    title: "Count every line item in the order summary",
    description:
      "BILL-88: the order page's item count should match the cart, which counts inactive (out of stock) items too. Also strips trailing whitespace in tax.py.",
    author: { id: "{5d1c7e2a-3b4f-4a6e-9c8d-1f2e3a4b5c6d}", name: "Noor Haddad" },
    sourceBranch: "BILL-88-item-count",
    targetBranch: "main",
    baseSha: "c5be4341e33e09f4c8f87129257215c16c86c0a8",
    headSha: "d12ecc17b05cbbeb3166e0a6684eadfa45443eae",
    commits: [
      {
        sha: "d12ecc17b05cbbeb3166e0a6684eadfa45443eae",
        message: "Count inactive items in the summary",
        author: "Noor Haddad",
      },
    ],
    createdAt: "2026-10-19T07:15:00Z",
    updatedAt: "2026-10-19T07:30:00Z",
  },
  tickets: [
    {
      key: "BILL-88",
      url: "https://example.atlassian.net/browse/BILL-88",
      summary: "Order page item count doesn't match the cart",
      description:
        "The cart shows 5 items, the order page 4, because the order page skips the out-of-stock item. Make the order page's count match the cart.",
      type: "Bug",
      status: "In Review",
    },
  ],
});
