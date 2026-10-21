import { type FileChange, parseUnifiedDiff } from "../../domain/diff/index.ts";
import { extractTicketKeys, type PullRequest, type Ticket } from "../../domain/review/index.ts";
import { err, ok, type Result } from "../../domain/shared/index.ts";
import type { GitHost } from "../ports/index.ts";
import type { AppDeps } from "./deps.ts";
import { appError, type UseCaseError } from "./errors.ts";
import { mapLimit } from "./text.ts";

const FETCH_CONCURRENCY = 8;
/** Larger files are treated as unavailable: too big to parse or to send to the model. */
const MAX_FILE_BYTES = 1024 * 1024;

export interface Collected {
  readonly files: readonly FileChange[];
  /** The base version, so a PR can't hide code by editing it. */
  readonly gitattributes: string | null;
  /** By old path; null when the file doesn't exist at base, is too large, or wasn't fetched. */
  readonly baseContents: ReadonlyMap<string, string | null>;
  /** By path, like baseContents at head. */
  readonly headContents: ReadonlyMap<string, string | null>;
  readonly tickets: readonly Ticket[];
  readonly missingTicketKeys: readonly string[];
  readonly warnings: readonly string[];
}

export const collect = async (
  deps: AppDeps,
  host: GitHost,
  pullRequest: PullRequest,
): Promise<Result<Collected, UseCaseError>> => {
  const parsed = parseUnifiedDiff(pullRequest.diff);
  if (!parsed.ok) {
    const { line, message } = parsed.error;
    return err(
      appError("host-error", `Couldn't parse the pull request's diff: line ${line}: ${message}`),
    );
  }
  const files = parsed.value.map((file) => ({
    ...file,
    language: deps.parser.languageFor(file.path),
  }));

  const { repo } = pullRequest.ref;
  const fetchFile = async (sha: string, path: string) => {
    const result = await host.getFile(repo, sha, path);
    if (result.ok) return ok(fitsSize(result.value));
    if (result.error.kind === "too-large") return ok(null);
    return err(
      appError(
        "host-error",
        `Couldn't fetch ${path} at ${sha.slice(0, 7)}: ${result.error.message}`,
      ),
    );
  };

  const fetches = [
    { side: "attributes" as const, sha: pullRequest.baseSha, path: ".gitattributes" },
    ...files
      .filter((file) => !file.binary)
      .flatMap((file) => [
        ...(file.status === "added"
          ? []
          : [{ side: "base" as const, sha: pullRequest.baseSha, path: file.oldPath ?? file.path }]),
        ...(file.status === "deleted"
          ? []
          : [{ side: "head" as const, sha: pullRequest.headSha, path: file.path }]),
      ]),
  ];
  const fetched = await mapLimit(fetches, FETCH_CONCURRENCY, async (fetch) => ({
    ...fetch,
    content: await fetchFile(fetch.sha, fetch.path),
  }));

  let gitattributes: string | null = null;
  const baseContents = new Map<string, string | null>();
  const headContents = new Map<string, string | null>();
  for (const file of files) {
    if (file.status === "added") baseContents.set(file.path, null);
    if (file.status === "deleted") headContents.set(file.path, null);
  }
  for (const { side, path, content } of fetched) {
    if (!content.ok) return content;
    if (side === "attributes") gitattributes = content.value;
    else (side === "base" ? baseContents : headContents).set(path, content.value);
  }

  return ok({
    files,
    gitattributes,
    baseContents,
    headContents,
    ...(await collectTickets(deps, pullRequest)),
  });
};

const fitsSize = (content: string | null): string | null =>
  content !== null && new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES
    ? null
    : content;

/** Ticket problems never fail the analysis: the keys are still shown, just not fetched. */
const collectTickets = async (
  deps: AppDeps,
  pullRequest: PullRequest,
): Promise<Pick<Collected, "tickets" | "missingTicketKeys" | "warnings">> => {
  const keys = extractTicketKeys([
    pullRequest.title,
    pullRequest.description,
    pullRequest.sourceBranch,
    ...pullRequest.commits.map((commit) => commit.message),
  ]);
  if (keys.length === 0 || !deps.tickets.configured) {
    return { tickets: [], missingTicketKeys: keys, warnings: [] };
  }
  const lookup = await deps.tickets.getTickets(keys);
  if (!lookup.ok) {
    return {
      tickets: [],
      missingTicketKeys: keys,
      warnings: [`Couldn't fetch Jira tickets: ${lookup.error.message}`],
    };
  }
  return { tickets: lookup.value.found, missingTicketKeys: lookup.value.missing, warnings: [] };
};
