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

- [ ] Contract suite passes.
- [ ] Every endpoint was checked against current docs; differences are recorded.
- [ ] Partial-failure publish behavior is tested.
- [ ] Fixtures contain no tokens or personal data.

## Open issues

_None yet._

## Notes for later stages

_None yet._
