import type {
  CommentKey,
  HostError,
  HostKind,
  HostUser,
  Publication,
  PublicationReceipt,
  PullRequest,
  PullRequestRef,
  PullRequestSummary,
  RepoRef,
} from "../../domain/review/index.ts";
import type { Result } from "../../domain/shared/index.ts";

export interface PublishOptions {
  /** The head SHA the comments' line numbers refer to. */
  readonly headSha: string;
  /** Keys already posted by an earlier, partly failed attempt. Never posted again. */
  readonly alreadyPosted: ReadonlySet<CommentKey>;
  /** Called once per posted key, as soon as the host confirms it. */
  readonly onPosted: (key: CommentKey, hostCommentId: string) => Promise<void>;
}

export interface GitHost {
  readonly host: HostKind;
  currentUser(): Promise<Result<HostUser, HostError>>;
  getPullRequest(ref: PullRequestRef): Promise<Result<PullRequest, HostError>>;
  /** File content at a commit. ok(null) when the file doesn't exist there. */
  getFile(repo: RepoRef, sha: string, path: string): Promise<Result<string | null, HostError>>;
  /** Open PRs where the current user is a requested reviewer or the author. */
  listPullRequests(): Promise<Result<PullRequestSummary[], HostError>>;
  /**
   * Publishes the summary (key "summary") and the inline comments with the verdict.
   * Skips keys in alreadyPosted and calls onPosted for every key it posts, so the caller
   * can persist progress (Bitbucket posts comments one by one). The receipt lists the
   * comments this call posted.
   */
  publish(
    ref: PullRequestRef,
    publication: Publication,
    options: PublishOptions,
  ): Promise<Result<PublicationReceipt, HostError>>;
}
