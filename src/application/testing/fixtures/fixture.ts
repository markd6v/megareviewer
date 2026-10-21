import type { HostUser, PullRequest, Ticket } from "../../../domain/review/index.ts";

/** A PR as a git host and a ticket source would return it. */
export interface PullRequestFixture {
  readonly name: string;
  readonly pullRequest: PullRequest;
  /** Contents at baseSha of the files the PR changes, by path. Files it adds are absent. */
  readonly baseFiles: Readonly<Record<string, string>>;
  /** Contents at headSha of the files the PR changes, by path. Files it deletes are absent. */
  readonly headFiles: Readonly<Record<string, string>>;
  /** The tickets the PR mentions, as the ticket source returns them. */
  readonly tickets: readonly Ticket[];
}

/** The reviewer the fixtures are seen by: requested as reviewer on every fixture PR. */
export const fixtureReviewers = {
  github: { id: "lee-park", name: "Lee Park" },
  bitbucket: { id: "{9b6f3c2e-1a4d-4c8b-8e2f-7d5a0c9b3e14}", name: "Lee Park" },
} as const satisfies Record<string, HostUser>;
