import type {
  Commit,
  HostUser,
  PullRequest,
  PullRequestRef,
  PullRequestSummary,
} from "../../domain/review/index.ts";
import type { BitbucketAccount, BitbucketCommit, BitbucketPullRequest } from "./schemas.ts";

/** What Bitbucket's UI calls an account that no longer exists. */
const FORMER_USER: HostUser = { id: "former-user", name: "Former user" };

export const toHostUser = (account: BitbucketAccount | null | undefined): HostUser =>
  account == null ? FORMER_USER : { id: account.uuid, name: account.display_name };

/** The name of a git author written as "Name <email>". */
const gitAuthorName = (raw: string): string => raw.replace(/<[^>]*>/, "").trim();

export const toCommit = (commit: BitbucketCommit): Commit => ({
  sha: commit.hash,
  message: commit.message,
  author: gitAuthorName(commit.author.raw ?? "") || (commit.author.user?.display_name ?? ""),
});

export const toPullRequest = (
  ref: PullRequestRef,
  pullRequest: BitbucketPullRequest,
  details: {
    baseSha: string;
    headSha: string;
    commits: readonly BitbucketCommit[];
    diff: string;
  },
): PullRequest => ({
  ref,
  url: pullRequest.links.html.href,
  title: pullRequest.title,
  description: pullRequest.description || pullRequest.summary?.raw || "",
  author: toHostUser(pullRequest.author),
  sourceBranch: pullRequest.source.branch.name,
  targetBranch: pullRequest.destination.branch.name,
  baseSha: details.baseSha,
  headSha: details.headSha,
  commits: details.commits.map(toCommit),
  diff: details.diff,
  createdAt: pullRequest.created_on,
  updatedAt: pullRequest.updated_on,
});

export const toSummary = (
  pullRequest: BitbucketPullRequest,
  role: PullRequestSummary["role"],
): PullRequestSummary => {
  const [workspace = "", repo = ""] = pullRequest.destination.repository.full_name.split("/");
  return {
    // Lowercased like parsePullRequestUrl, so a picked PR and a pasted URL are one analysis.
    ref: {
      repo: { host: "bitbucket", owner: workspace.toLowerCase(), repo: repo.toLowerCase() },
      number: pullRequest.id,
    },
    url: pullRequest.links.html.href,
    title: pullRequest.title,
    author: toHostUser(pullRequest.author),
    updatedAt: pullRequest.updated_on,
    role,
  };
};

/** Newest first. ISO-8601 UTC timestamps sort as strings. */
export const byUpdatedAtDesc = (a: PullRequestSummary, b: PullRequestSummary): number =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
