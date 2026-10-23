import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "dependency-bump-signature",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop-core" }, number: 201 },
    url: "https://github.com/acme/shop-core/pull/201",
    title: "Upgrade date-fns to v4 and format prices in the order's currency",
    description:
      "Upgrades date-fns from 2.30 to 4.1, which accepts ISO strings directly, so the parseISO call goes.\n\nFor SHOP-210, prices are now formatted in the order's own currency with Intl.NumberFormat.",
    author: { id: "rory-chen", name: "Rory Chen" },
    sourceBranch: "chore/date-fns-4",
    targetBranch: "main",
    baseSha: "7465210498ec9f99963c50a6c22205e5016c9e58",
    headSha: "d80038caf86a6ddddfaa7b832f8f4301b3c78e5c",
    commits: [
      {
        sha: "de6edf3bcd681f803fa79839e4ebce778327a2d3",
        message: "Upgrade date-fns to 4.1.0",
        author: "Rory Chen",
      },
      {
        sha: "d80038caf86a6ddddfaa7b832f8f4301b3c78e5c",
        message: "Format prices in the order's currency",
        author: "Rory Chen",
      },
    ],
    createdAt: "2026-10-12T09:00:00Z",
    updatedAt: "2026-10-12T11:30:00Z",
  },
  tickets: [
    {
      key: "SHOP-210",
      url: "https://example.atlassian.net/browse/SHOP-210",
      summary: "Show prices in the order's currency",
      description:
        "Order summaries always show dollars, even for orders placed in EUR or GBP. Show amounts in the currency the order was placed in.",
      type: "Story",
      status: "In Review",
    },
  ],
});
