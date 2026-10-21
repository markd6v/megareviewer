# Stage 06: Bitbucket Cloud adapter

**Status:** In progress (branch stage/06-bitbucket-adapter)
**Depends on:** 02
**Unblocks:** 12
**Owns:** `src/adapters/bitbucket/`

## Goal

A `GitHost` implementation for Bitbucket Cloud (bitbucket.org) that passes the same contract suite as GitHub, using recorded API responses in tests.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Git hosts" (Bitbucket specifics), "Credentials"
- [ENGINEERING.md](../../ENGINEERING.md) §4 "Parse at the edge"
- Stage 02: `GitHost` port, `describeGitHostContract`, `createFixtureFetch`
- [Stage 05](05-github-adapter.md), for structure: mirror its file layout (`bitbucket-host.ts`, `schemas.ts`, `map.ts`, `errors.ts`, `fixtures/`)

**Verify every endpoint below against the current Bitbucket Cloud REST API docs before relying on it.** This doc was written from memory of the API. Record any difference in **Notes for later stages**.

## Scope

**In:** every `GitHost` method for Bitbucket Cloud, error mapping, fixture recording.
**Out:** Bitbucket Data Center/Server; resolving credentials (stage 12 passes them in).

## Tasks

### 1. Construction

```ts
createBitbucketHost(options: {
  email: string;
  apiToken: string;          // scoped Atlassian API token
  workspace: string | null;  // for listPullRequests; null means listing returns an empty list
  fetch?: typeof fetch;
  logger: Logger;
}): GitHost
```

- Plain `fetch` against `https://api.bitbucket.org/2.0`, Basic auth with `email:apiToken`. No SDK.
- Follow `next` links for pagination; cap at 10 pages per call and log if the cap is hit.

### 2. Methods

| Method | API calls | Notes |
|---|---|---|
| `currentUser` | `GET /user` | `id` = `uuid`, `name` = `display_name`. Cache. |
| `getPullRequest` | `GET /repositories/{ws}/{repo}/pullrequests/{id}`; `…/pullrequests/{id}/diff`; `…/pullrequests/{id}/commits` (paginated); commit and merge-base lookups below | `description` is `description` (or `summary.raw`), `""` if empty. `author.id` is the account UUID. |
| `getFile` | `GET /repositories/{ws}/{repo}/src/{sha}/{path}` | 404 → `ok(null)`. |
| `listPullRequests` | `GET /repositories/{ws}?role=member&sort=-updated_on&pagelen=50` (first page only), then for each repo `GET …/pullrequests?state=OPEN&q=…` filtering on `reviewers.uuid` or `author.uuid` equal to the current user | 5 requests at a time. Bitbucket has no cross-repo "waiting for my review" search, so we scan the 50 most recently updated repos. Say so in a log line. |
| `publish` | see below | |

**Full SHAs.** The PR object gives abbreviated commit hashes. Resolve `source.commit.hash` to a full SHA with `GET /repositories/{ws}/{repo}/commit/{hash}`.

**Merge base.** `baseSha` must be the merge base the diff was computed against, not the destination branch tip. Use the merge-base endpoint (`GET /repositories/{ws}/{repo}/merge-base/{spec}`, verify the spec format). If it's unavailable, fall back to the destination commit and log a warning. Formatting proofs compare against `baseSha`, so a wrong base only causes missing proofs, not false ones, as long as the diff itself comes from the PR diff endpoint.

**Diff redirect.** The diff endpoint redirects. Follow it and make sure the `Authorization` header survives (same host, so `fetch` keeps it).

### 3. Publishing

Bitbucket has no review object, so publishing is a series of calls. This is why the port has `alreadyPosted` and `onPosted`.

1. For each comment not in `alreadyPosted`: `POST …/pullrequests/{id}/comments` with `{ content: { raw: body }, inline: { path, to: line } }` for `new`, or `inline: { path, from: line }` for `old`. Call `onPosted(key, comment.id)` right after each success.
2. If `summary` isn't posted yet: post it as a general comment (no `inline`), then `onPosted("summary", id)`.
3. Verdict: `approve` → `POST …/approve`; `request_changes` → `POST …/request-changes`; `comment` → nothing. If the verdict call fails after comments were posted, return the error; a retry will skip the posted comments and only redo the verdict.
4. Return `{ url: PR html link, publishedAt, postedCommentIds }`.

### 4. Error mapping

Same kinds as GitHub (stage 05 table), with Bitbucket's statuses: 401 `unauthorized`, 403 `forbidden`, 404 `not-found`, 429 `rate-limited` (`retry-after` if present, else 60 seconds), 400 on comment or verdict calls `rejected`, 5xx `unexpected`, fetch failure `network`, schema mismatch `invalid-response`. A diff response that is cut off or refused for size maps to `too-large`; check what Bitbucket actually returns for a very large PR and document it.

### 5. Fixtures and recording

- `fixtures/record.ts <pr-url>` with `BITBUCKET_EMAIL` and `BITBUCKET_API_TOKEN`, same format and stripping rules as stage 05.
- Use a small public repository's PR if possible (public Bitbucket repos are readable).
- **Publishing fixtures post real comments.** Only against a sandbox repo the user owns, with the user's go-ahead. Otherwise synthetic, from the API docs.
- Document the token scopes the adapter needs (pull requests read/write, repositories read, account read; confirm exact scope names) in the fixture folder's provenance note. Stage 17 copies them into the user README.

## Tests

- `describeGitHostContract("bitbucket", …)` passes against fixtures.
- Short-hash resolution, merge-base fallback, diff redirect following.
- Pagination via `next`, including the page cap.
- Publish: partial failure (third comment fails) then retry posts only the rest; verdict failure after all comments; `inline.from` vs `inline.to`.
- Each error-mapping case.

## Definition of done

- [x] Contract suite passes.
- [x] Every endpoint was checked against current docs; differences are recorded.
- [x] Partial-failure publish behavior is tested.
- [x] Fixtures contain no tokens or personal data.

## Open issues

- **Synthetic fixtures** (see `src/adapters/bitbucket/fixtures/PROVENANCE.md`): `/user`, listing, publishing, 401 and 429. The token available while building had only read scopes and no `read:user`. Publishing fixtures need a sandbox repo the user owns, a token with `write:pullrequest:bitbucket`, and their go-ahead. Until then these are unverified: what approving an already-approved PR returns (mapped to `rejected` if it's a 409 or 400), whether `request-changes` on one's own PR is refused, and whether the comment endpoint needs the write scope (the spec lists only read).
- **No live `too-large` case.** The docs say the diff endpoint answers 555 when it times out on a huge diff; that's what's mapped. Not seen live.

## Notes for later stages

Where the code differs from or adds to this doc. Endpoints were checked against Bitbucket's OpenAPI spec (`https://api.bitbucket.org/swagger.json`) and live calls on public repos.

- **Options** are `{ email, apiToken, workspace, clock, logger, fetch? }`. Stage 12 passes a `Clock`, used for receipts (Bitbucket gives no publish time).
- **The diff comes from `GET /repositories/{ws}/{repo}/diff/{head}..{dest}?topic=true`** at the PR object's commits, not from `…/pullrequests/{id}/diff`. That endpoint only redirects to the same diff (`/diff/{ws}/{repo}:{head}%0D{dest}?topic=true`) for the PR's current commits, so a push between the two calls would mismatch the diff and `headSha`. Byte-identical on #26. Fork PRs work: fork commits resolve in the destination repo (checked on atlassian/atlassian-connect-express#509), and so do `getFile` calls at a fork's head.
- **Redirects** are followed by the adapter (`redirect: "manual"`, at most 5 hops), sending credentials only to `api.bitbucket.org`. The PR diff no longer needs it; LFS files do (`src` redirects them to Atlassian's media service).
- **A PR whose source branch or fork was deleted** has `source.commit: null`. `getPullRequest` returns `not-found` saying so.
- **Merge-base fallback** to the destination commit happens on `not-found`, `unexpected` and `invalid-response`, with a warning. On `unauthorized`, `forbidden`, `rate-limited` and `network` the error is returned, since every other call would fail the same way.
- **Listing differs from this doc.** The PR list ignores `state` once `q` is set, so the state goes in the query. And `reviewers.uuid="…" OR author.uuid="…"` returns each PR once per reviewer (15 rows for 6 PRs, live). So:
  - PRs to review: `GET /repositories/{ws}?role=member&sort=-updated_on&pagelen=50` (first page), then per repo `…/pullrequests?q=state="OPEN" AND reviewers.uuid="{uuid}"`, 5 at a time. One info log line says it scans only those repos.
  - Own PRs: one `GET /workspaces/{ws}/pullrequests/{uuid}?state=OPEN`, which covers every repo of the workspace.
  - Any failing call fails the listing.
- **Publishing** checks the PR's head first: Bitbucket anchors inline comments on the PR's current diff, not on a commit, so if `headSha` isn't the PR's head any more it returns `rejected` without posting. Then comments, then the summary, then the verdict. An empty (whitespace-only) summary isn't posted, so it has no receipt entry. The verdict isn't tracked by a key: a retry always sends it again. The receipt's `url` is the PR's canonical URL.
- **Errors beyond the table.** A 429 has no `retry-after`; live it carried `x-ratelimit-reset` as seconds until the reset, which is used, else 60. 409 on publishing calls is `rejected` too; 400 or 409 on reads is `unexpected`. A 403 for missing scopes names them (`Needed: read:user:bitbucket.`). Some errors have plain-text bodies (a missing PR's 404 is `Not Found`); HTML or long bodies are left out of messages. A `fetch` that throws anything but a `TypeError` is a bug and is rethrown.
- **Mapping.** `description` is `description`, else `summary.raw`, else `""`. A missing author is `{ id: "former-user", name: "Former user" }`. A commit's `author` is the git author's name without the email, else the account's display name, else `""`. Summaries' workspace and repo are lowercased; their `url` keeps Bitbucket's casing. A merged PR's commit list includes the merge commit.
- **Token scopes:** `read:user:bitbucket`, `read:repository:bitbucket`, `read:pullrequest:bitbucket`, `write:pullrequest:bitbucket`. Stage 17 copies them from the fixture folder's provenance note.
- **Recorder** needs Node 24 (it's run as `.ts`). It records only the PR's reads, not `/user` or the listing (they'd capture the token owner's account and workspace).
