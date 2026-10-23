import type { PullRequestFixture } from "../../../src/application/testing/index.ts";
import { fixtureFromFiles } from "../../case-files.ts";

export const fixture: PullRequestFixture = fixtureFromFiles(new URL(".", import.meta.url), {
  name: "auth-middleware",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 230 },
    url: "https://github.com/acme/shop/pull/230",
    title: "Authenticate the live order stream",
    description:
      "SHOP-245. The order page's live updates use EventSource, which can't send an Authorization header. The auth middleware now also reads the session token from `?access_token=` on GET requests to `…/events` endpoints. Everything else still requires the header.",
    author: { id: "jo-adeyemi", name: "Jo Adeyemi" },
    sourceBranch: "feature/SHOP-245-sse-auth",
    targetBranch: "main",
    baseSha: "7c04ed664e931afd2c0b757798ef5ff01e729b87",
    headSha: "bfb278b57c30db768d9e726ecf466c26484fee7d",
    commits: [
      {
        sha: "bfb278b57c30db768d9e726ecf466c26484fee7d",
        message: "Accept access_token query parameter on event streams",
        author: "Jo Adeyemi",
      },
    ],
    createdAt: "2026-10-15T14:00:00Z",
    updatedAt: "2026-10-15T15:10:00Z",
  },
  tickets: [
    {
      key: "SHOP-245",
      url: "https://example.atlassian.net/browse/SHOP-245",
      summary: "Live order updates fail with 401",
      description:
        "GET /orders/:id/events is an SSE stream. Browsers' EventSource can't set an Authorization header, so it always gets 401. Let the stream authenticate some other way.",
      type: "Bug",
      status: "In Review",
    },
  ],
});
