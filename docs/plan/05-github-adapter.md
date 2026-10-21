# Stage 05: GitHub adapter

**Status:** Done (pushed to main without a PR; CI green on 7e7ed9b)
**Depends on:** 02
**Unblocks:** 12
**Owns:** `src/adapters/github/`

## Goal

A `GitHost` implementation for github.com that passes the shared GitHost contract suite, using recorded API responses in tests.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Git hosts", "Credentials"
- [ENGINEERING.md](../../ENGINEERING.md) §4 "Parse at the edge"
- Stage 02: `GitHost` port, `describeGitHostContract`, `createFixtureFetch`, domain types and `HostError`
- [Plan README](README.md) "Credentials agents may not have"

## Scope

**In:** every `GitHost` method for github.com, error mapping, fixture recording.
**Out:** GitHub Enterprise; resolving the token (stage 12 passes it in); OAuth flows.

## Tasks

### 1. Construction: `github-host.ts`

```ts
createGitHubHost(options: { token: string; fetch?: typeof fetch; logger: Logger }): GitHost
```

- Uses `@octokit/rest` with `request: { fetch }` so tests inject a fixture fetch.
- Sets a `user-agent` of `megareviewer/<version>`. The version comes in through options if needed; the adapter doesn't read `package.json`.
- Parses every response it reads with Zod schemas of just the fields it uses (`schemas.ts`), then maps to domain types (`map.ts`). A schema failure becomes `invalid-response`.

### 2. Methods

| Method | API calls | Notes |
|---|---|---|
| `currentUser` | `GET /user` | `id` = `login`, `name` = `name ?? login`. Cache for the adapter's lifetime. |
| `getPullRequest` | `GET /repos/{o}/{r}/pulls/{n}`; the same URL with `Accept: application/vnd.github.diff`; `GET /repos/{o}/{r}/pulls/{n}/commits` (paginated); `GET /repos/{o}/{r}/compare/{base}...{head}` | Run in parallel where possible. **`baseSha` is `merge_base_commit.sha` from the compare call**, because the PR diff is against the merge base, not `base.sha`. `description` is `body ?? ""`. `author.id` is the login. The commits endpoint returns at most 250 commits; that's fine, but log it. |
| `getFile` | `GET /repos/{o}/{r}/contents/{path}?ref={sha}` with `Accept: application/vnd.github.raw` | 404 → `ok(null)`. Treat content as UTF-8. |
| `listPullRequests` | `GET /search/issues` twice: `is:pr is:open archived:false review-requested:@me` and `… author:@me`, `per_page=50` | Owner and repo come from `repository_url`. `role` is `reviewer` or `author`. Sort by `updated_at` desc. |
| `publish` | `POST /repos/{o}/{r}/pulls/{n}/reviews`, then `GET …/reviews/{id}/comments` | See below. |

### 3. Publishing

GitHub creates a review with all its comments in one call, so it's atomic.

1. Drop comments whose key is in `alreadyPosted`. If nothing is left and `summary` is already posted, return `ok` with the known IDs without calling the API.
2. `POST /reviews` with `commit_id: headSha`, `body: summary`, `event` (`approve` → `APPROVE`, `request_changes` → `REQUEST_CHANGES`, `comment` → `COMMENT`), and `comments: [{ path, line, side: "RIGHT" | "LEFT", body }]` (`new` → `RIGHT`).
3. Read the review's comments and match them back to keys by `path`, `line`, `side` and `body`. Call `onPosted` for each, and for `summary` with the review ID.
4. Return `{ url: review.html_url, publishedAt, postedCommentIds }`.

### 4. Error mapping: `errors.ts`

| Response | `HostError.kind` |
|---|---|
| 401 | `unauthorized` |
| 403 with `x-ratelimit-remaining: 0`, or 403/429 with `retry-after` | `rate-limited`, `retryAfterSeconds` from `retry-after` or `x-ratelimit-reset` |
| other 403 | `forbidden` |
| 404 | `not-found`; message mentions the token may lack access to a private repo |
| 406, or 422 whose message mentions the diff being too large | `too-large` |
| other 422 (line not in diff, can't approve own PR) | `rejected`, with GitHub's message |
| 5xx | `unexpected` |
| fetch throws | `network` |
| schema mismatch | `invalid-response` |

### 5. Fixtures and recording

- `fixtures/record.ts`: run with `node src/adapters/github/fixtures/record.ts <pr-url>` and `GITHUB_TOKEN` set. It calls every read method against the PR and writes request/response pairs in the format of stage 02's `createFixtureFetch`. It strips `Authorization` and any cookies, and keeps only the response headers we read (`x-ratelimit-*`, `retry-after`, `link`, `content-type`).
- Use a small, stable public PR (state which one in the fixture folder's provenance note).
- **Publishing fixtures post a real review.** Record them only against a sandbox repo the user owns, and only after the user agrees. Otherwise hand-write publish fixtures from GitHub's API docs and mark them `synthetic`.
- Hand-written fixtures for `unauthorized` (401) and `rate-limited` (403 with `x-ratelimit-remaining: 0`).

## Tests

- `describeGitHostContract("github", …)` passes against fixtures.
- Unit tests for `map.ts` (null body, missing name, search result parsing) and `errors.ts` (each row of the table).
- Pagination of commits across two pages (`link` header).
- Publish: `alreadyPosted` filtering, key matching when two comments share a line, `side` mapping.

## Definition of done

- [x] Contract suite passes.
- [x] Every error-mapping row is tested.
- [x] Fixtures contain no tokens or personal data beyond public GitHub usernames.
- [x] Recorder works, or the open issue says which fixtures are synthetic.

## Open issues

- **Synthetic fixtures** (see `src/adapters/github/fixtures/PROVENANCE.md`): search, publish, 401 and rate-limited. Publishing fixtures need a sandbox repo the user owns and their go-ahead. Until then it's unverified whether `GET …/reviews/{id}/comments` returns `line` and `side` (optional in GitHub's schema); matching works either way.

## Notes for later stages

Where the code differs from or adds to this doc:

- **Options** are `{ token, version, clock, logger, fetch? }`. Stage 12 passes the app version (for `megareviewer/<version>`) and a `Clock`, used for `x-ratelimit-reset` delays and for receipts GitHub gives no time for.
- **The diff comes from `GET /compare/{base.sha}...{head.sha}`** with the diff media type, not from the PR URL, so the diff, `baseSha` and `headSha` describe the same commits even when someone pushes while the PR loads. It's the same three-dot diff (byte-identical on sindresorhus/is#210). A compare too large to diff fails with 422 "The diff is taking too long to generate", mapped to `too-large`. The commits list isn't pinned: a push mid-load can add newer commits.
- **Publishing.** The verdict travels with the summary in one review, so when `summary` is already posted, the remaining comments go out as a `COMMENT` review with no body. Comments are matched back by path and body, plus line and side when GitHub returns them (CRLF normalized, trimmed). A comment that can't be matched, or every comment when reading them back fails, is recorded under the review's ID with a warning, so a retry doesn't post it twice. With nothing left to post, the receipt has `url: null`.
- **Errors beyond the table:** 429 is always `rate-limited`; `retry-after` counts only as whole seconds; other statuses (400, 409, …) are `unexpected`. `getFile` returns `ok(null)` for any 404, including a repo the token can't see, because GitHub doesn't tell them apart.
- **Mapping.** Summaries' owner and repo are lowercased like `parsePullRequestUrl`; their `url` keeps GitHub's casing. A deleted account is `ghost`. A commit's `author` is the git author name, else the account login, else `""`.
- **Logging.** Octokit's request log, including failed requests, goes to `debug`: failures come back as `HostError`s for the caller to report. The adapter warns when GitHub's 250-commit cap may have cut the list, when a search returned only some PRs, and for unmatched comments.
- **Recorder** needs Node 24 (it's run as `.ts`). It records only the PR's reads and `/user`, not the search (it would capture the token owner's own PRs). It keeps only the fields the schemas read and replaces names with logins.
