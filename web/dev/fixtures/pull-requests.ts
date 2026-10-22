import type { PullRequestListResponse } from "../../../contracts/index.ts";
import type { PullRequestSummary } from "../../../src/domain/review/index.ts";

const lee = { id: "lee-park", name: "Lee Park" };

const github = (
  repo: string,
  number: number,
  summary: Omit<PullRequestSummary, "ref" | "url">,
): PullRequestSummary => ({
  ref: { repo: { host: "github", owner: "acme", repo }, number },
  url: `https://github.com/acme/${repo}/pull/${number}`,
  ...summary,
});

const bitbucket = (
  repo: string,
  number: number,
  summary: Omit<PullRequestSummary, "ref" | "url">,
): PullRequestSummary => ({
  ref: { repo: { host: "bitbucket", owner: "acme-team", repo }, number },
  url: `https://bitbucket.org/acme-team/${repo}/pull-requests/${number}`,
  ...summary,
});

/** Waiting for review first, then the reviewer's own, each newest first. */
export const fixturePullRequests: PullRequestListResponse = {
  items: [
    github("shop", 128, {
      title: "Add order receipts endpoint",
      author: { id: "sam-rivera", name: "Sam Rivera" },
      updatedAt: "2026-10-21T09:41:00Z",
      role: "reviewer",
    }),
    bitbucket("billing", 57, {
      title: "Round invoice totals half-even",
      author: { id: "{2f1e4c7a-8b3d-4e6f-9a0c-5d7b1e3f9a28}", name: "Priya Nair" },
      updatedAt: "2026-10-20T16:05:00Z",
      role: "reviewer",
    }),
    github("shop", 121, {
      title: "Migrate session storage to Redis",
      author: { id: "jo-tanaka", name: "Jo Tanaka" },
      updatedAt: "2026-10-17T11:30:00Z",
      role: "reviewer",
    }),
    github("platform", 904, {
      title: "Bump the Node base image to 24.21",
      author: lee,
      updatedAt: "2026-10-21T08:12:00Z",
      role: "author",
    }),
    bitbucket("billing", 55, {
      title: "Send invoice emails from the queue worker",
      author: lee,
      updatedAt: "2026-10-18T13:47:00Z",
      role: "author",
    }),
    github("shop", 119, {
      title: "Show delivery estimates on the cart page",
      author: lee,
      updatedAt: "2026-10-09T10:20:00Z",
      role: "author",
    }),
  ],
  errors: [],
};
