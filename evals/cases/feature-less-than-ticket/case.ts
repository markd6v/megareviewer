import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "feature-less-than-ticket",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 240 },
    url: "https://github.com/acme/shop/pull/240",
    title: "Export orders as CSV",
    description: "Implements SHOP-250: admins can download all orders as a CSV file.",
    author: { id: "lee-park", name: "Lee Park" },
    sourceBranch: "feature/orders-csv",
    targetBranch: "main",
    baseSha: "9c85f49ad7d9dd838fb862bc1ed54be55aa17307",
    headSha: "c90580e0683d93af7b86f7f63dfb2294cfc4f626",
    commits: [
      {
        sha: "c90580e0683d93af7b86f7f63dfb2294cfc4f626",
        message: "Add orders CSV export",
        author: "Lee Park",
      },
    ],
    createdAt: "2026-10-16T09:30:00Z",
    updatedAt: "2026-10-16T09:45:00Z",
  },
  tickets: [
    {
      key: "SHOP-250",
      url: "https://example.atlassian.net/browse/SHOP-250",
      summary: "Admins can export orders as CSV",
      description:
        "Finance needs order data in a spreadsheet. Add a CSV export to the admin area with these columns: order ID, created date, customer email, total and status. Admins must be able to limit the export to a date range (from and to dates); exporting everything at once is too slow for finance's monthly close.",
      type: "Story",
      status: "In Review",
    },
  ],
});
