import { z } from "zod";
import { HttpUrl, Sha, Timestamp } from "./primitives.ts";

export const HostKind = z.enum(["github", "bitbucket"]);
export type HostKind = z.infer<typeof HostKind>;

export const RepoRef = z
  .object({
    host: HostKind,
    /** The GitHub owner or the Bitbucket workspace. */
    owner: z.string().min(1),
    repo: z.string().min(1),
  })
  .readonly();
export type RepoRef = z.infer<typeof RepoRef>;

export const PullRequestRef = z
  .object({
    repo: RepoRef,
    number: z.number().int().positive(),
  })
  .readonly();
export type PullRequestRef = z.infer<typeof PullRequestRef>;

export const HostUser = z
  .object({
    /** GitHub login or Bitbucket account UUID. */
    id: z.string().min(1),
    name: z.string(),
  })
  .readonly();
export type HostUser = z.infer<typeof HostUser>;

export const Commit = z
  .object({
    sha: Sha,
    message: z.string(),
    author: z.string(),
  })
  .readonly();
export type Commit = z.infer<typeof Commit>;

export const PullRequest = z
  .object({
    ref: PullRequestRef,
    url: HttpUrl,
    title: z.string(),
    description: z.string(),
    author: HostUser,
    sourceBranch: z.string().min(1),
    targetBranch: z.string().min(1),
    /** The merge base the diff is computed from, not the target branch tip. */
    baseSha: Sha,
    headSha: Sha,
    commits: z.array(Commit).readonly(),
    /** The raw unified diff, as the host returns it. */
    diff: z.string(),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  })
  .readonly();
export type PullRequest = z.infer<typeof PullRequest>;

export const PullRequestSummary = z
  .object({
    ref: PullRequestRef,
    url: HttpUrl,
    title: z.string(),
    author: HostUser,
    updatedAt: Timestamp,
    role: z.enum(["reviewer", "author"]),
  })
  .readonly();
export type PullRequestSummary = z.infer<typeof PullRequestSummary>;
