# Stage 17: End-to-end tests, dogfooding and release

**Status:** In progress (on main; dogfooding, the eval run and publishing wait for the user)
**Depends on:** 12, 15, 16
**Unblocks:** —
**Owns:** `e2e/`, `README.md`, `LICENSE`, release workflow, `package.json` (`private`, `version`, publish fields)

## Goal

Prove the whole product works from a user's point of view, use it on real PRs, fix what that turns up, and ship version 0.1.0 to npm.

## Read first

- Every stage's **Open issues** and **Notes for later stages**: this stage collects them.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Local server security", "Credentials"
- Stage 12: fake mode, build, package checks

## Tasks

### 1. End-to-end tests: `e2e/`

Playwright against the built UI served by stage 12's fake mode (`node src/cli/dev/fake-main.ts --port 4999 --token e2e-token --static dist/web`), using its `/__fake/` control routes to inspect publications, fail a publish, and change a PR's head.

| Test | Checks |
|---|---|
| Token bootstrap | Opening `/?token=e2e-token` loads the picker and removes the token from the URL; opening `/` without it shows the instructions screen; API calls without the token get 401. |
| Analyze from URL | Paste a fixture PR URL, see stage progress, land on a complete review. |
| Analyze from list | Click a PR in "Waiting for your review". |
| Tour | Keyboard `n`/`p`/`j`/`k`, visited checks, mechanical group collapsed then expanded. |
| Decisions | Approve one, reject one with a comment, reload: both persisted. |
| Publish | Preview shows the expected verdict and comments; publish; `/__fake/publications` has exactly them; publishing again posts nothing new. |
| Partial publish failure | Fake host fails the second comment; retry posts only the rest. |
| Failed analysis | A fixture scripted to fail at intent shows the error; retry succeeds. |
| Stale | Fake host's head SHA changes; banner appears; publish asks for confirmation. |

Run in CI after `pnpm build`.

### 2. Cross-platform smoke test

CI matrix on Ubuntu, macOS and Windows: `pnpm build`, `scripts/check-package.ts`, `node dist/cli.js --version`, and `node dist/cli.js doctor` with no credentials (must exit 1 with readable output, not crash).

### 3. Security review

Check by hand and record the results in this doc:

- [x] Server listens on `127.0.0.1` only (`lsof`/`netstat`).
- [x] Wrong `Host` header → 403; no token → 401; token never appears in logs.
- [x] CSP and other headers present; the UI works under them.
- [x] No credential reaches the browser (inspect every API response and the page source).
- [x] Model output is rendered as text everywhere (search for `dangerouslySetInnerHTML` and Markdown renderers).
- [x] `~/.megareviewer` is `0700` and `db.sqlite` is `0600`.
- [ ] No network calls besides GitHub, Bitbucket, Jira and Anthropic (watch with a proxy or `lsof` during a session).
- [x] The published tarball has no install scripts and no dependencies.

Results, 2026-10-23, `dist/cli.js` 0.1.0 on macOS with a GitHub token from `gh` and nothing else configured:

- `lsof` shows one listening socket, `127.0.0.1:4911`.
- `/api/status` without a token, or with a wrong one: 401. The SSE endpoint without `?token=`: 401. A `Host` of another name, on the API or the page: 403. The session token appears only in the startup line that prints the link to open.
- Every response carries `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`. The built UI (fake mode, same HTTP app) runs a review with no console errors, highlighting included, and the end-to-end tests run under these headers.
- Neither the GitHub token nor the session token appears in the page, `dist/web`, `/api/status` or `/api/pull-requests`. Status shows the user's login only.
- `web/src` has no `dangerouslySetInnerHTML`, `innerHTML` or Markdown renderer, and Biome forbids the first. The UI loads no images, so `img-src https:` is unused.
- `MEGAREVIEWER_HOME` was created `drwx------`; `db.sqlite` and its `-wal` and `-shm` files are `-rw-------`.
- Listing PRs opened connections to one address, 20.233.83.146, which is `api.github.com`. Anthropic, Bitbucket and Jira couldn't be watched without their credentials, which is why that item stays open. The only other URLs in `dist/cli.js` are documentation links in error messages.
- `scripts/check-package.ts` and `npm publish --dry-run` agree: `LICENSE`, `README.md`, `package.json` and `dist/` only, no dependencies, no lifecycle scripts, 1.9 MB.

### 4. Dogfooding

**Needs the user:** real credentials and real PRs. Ask before posting anything to a real PR.

- Review at least 5 real PRs on GitHub and 5 on Bitbucket, of varied size, ideally including PRs to megareviewer itself (ENGINEERING.md §1).
- For each, record in `e2e/dogfood-log.md`: PR size, time to complete analysis, cost, and notes on quality (wrong risk classes, useless decisions, bad tour order, UI friction).
- Replace ARCHITECTURE.md's cost estimate ("on the order of $1") with the measured range.
- Turn each problem into a fix in this stage if small, or a new entry in the relevant stage doc's **Open issues** if not.

### 5. User README: `README.md`

Follow the user's rule for READMEs: only useful information, nothing said twice. Link to the docs instead of repeating them.

- One paragraph: what megareviewer does.
- Requirements: Node 24+.
- Run: `npx megareviewer`.
- Credentials: one table per host, Jira and Anthropic, with the token scopes from stages 05 and 06's notes.
- `megareviewer doctor`.
- Privacy: code is sent only to Anthropic's API for analysis; nothing to us; no telemetry.
- Links to MISSION, DESIGN, ARCHITECTURE and ENGINEERING for contributors.

### 6. Release

**Decisions for the user, asked before this step:**

- License (e.g. MIT, or proprietary). Add `LICENSE` accordingly.
- npm package name: check `npm view megareviewer`; if taken, the user picks another.
- Whether to publish from CI with npm provenance (recommended: users can verify the package was built from this repo) or by hand.

Then:

1. Set `"private": false`, `"version": "0.1.0"`, `description`, `repository`, `license`, `engines`, `keywords`.
2. `pnpm publish --dry-run`; check the file list matches `scripts/check-package.ts`.
3. If publishing from CI: add `.github/workflows/release.yml`, triggered by a `v*` tag, which builds, runs `pnpm check` and the package checks, and publishes with provenance. The user sets up npm trusted publishing or the `NPM_TOKEN` secret.
4. The user publishes (or pushes the tag). Agents never publish to npm themselves.
5. Smoke test: `npx megareviewer@0.1.0 --version` on a clean machine or container.

## Definition of done

- [x] Every end-to-end test passes in CI; cross-platform smoke test is green.
- [ ] Security review checklist complete.
- [ ] Dogfood log has at least 10 PRs; cost estimate in ARCHITECTURE.md updated.
- [x] README written.
- [ ] 0.1.0 published by the user, smoke-tested.

## Open issues

- **Dogfooding not done.** It needs Anthropic credentials, which this machine doesn't have, and real PRs on both hosts. `e2e/dogfood-log.md` and ARCHITECTURE.md's measured cost range wait for it, as does the network check for Anthropic, Bitbucket and Jira above.
- **0.1.0 not published.** Before pushing the `v0.1.0` tag, the user sets up npm: a trusted publisher for `markd6v/megareviewer`, workflow `release.yml`, environment `npm` (or an `NPM_TOKEN` secret in that environment, which GitHub creates on the first release run). Then smoke-test with `npx megareviewer@0.1.0 --version` on a clean machine.
- **Carried from other stages,** none blocking a release: unverified fixtures that need real accounts (stages 05, 06, 07: publishing on both hosts, Jira's 401), the live Claude check and the eval run (stages 08 and 16), `standardwebhooks`' license (stage 12), and stage 03's three proof edge cases (moves within one file, indentation inside multi-line strings, nested `.gitattributes`). Each is described in its stage's **Open issues**. Dogfooding should exercise the first two.

## Notes for later stages

Where the code differs from or adds to this doc.

- **End-to-end tests** (`e2e/review.spec.ts`, `pnpm e2e` after `pnpm build`) start a fake-mode server per test on a free port (`e2e/fake-server.ts`), instead of one on port 4999, so tests run in parallel without sharing the in-memory store. The config lives in `e2e/playwright.config.ts`. `PLAYWRIGHT_CHANNEL=chrome` runs them with the installed Chrome when Playwright's own browser isn't downloaded.
- **Test details.** "Analyze from URL" can't watch stages advance, because the fake model answers at once; the failed-analysis test checks the progress strip instead (collect done, intent failed). The partial-failure test fails post 3, the second inline comment, since post 1 is the summary. The stale test starts the analysis through the API and moves the PR's head while it runs, because the view caches staleness for 60 seconds once an analysis is complete.
- **CI.** The `check` job also installs Chromium and runs the end-to-end tests, uploading the report when they fail. A `smoke` job builds and checks the package on Ubuntu, macOS and Windows, runs `--version`, and requires `doctor` without credentials to exit 1 naming the missing git host and Anthropic credentials. `ci.yml` is callable, so `release.yml` runs it before publishing with `npm publish --provenance` after checking the tag against `package.json`.
- **Windows.** `scripts/check-package.ts` (stage 12's) starts `pnpm` through the shell on Windows, where it's a `.cmd` shim, and unpacks the tarball by a relative path, because Git Bash's GNU tar reads `C:\…` as a host. The smoke job is green on all three systems since 37cfbe1.
- **Stage 15's chunk warning:** `web/vite.config.ts` (stage 13's) raises `chunkSizeWarningLimit` to 1,000 KB for the lazily loaded C++ grammar.
- **README.** GitHub's token permissions weren't in stage 05's notes; the README lists what the adapter calls need: fine-grained Pull requests read and write, Contents read, Metadata read, or classic `repo`.
