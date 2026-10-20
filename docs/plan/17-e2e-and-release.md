# Stage 17: End-to-end tests, dogfooding and release

**Status:** Not started
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

- [ ] Server listens on `127.0.0.1` only (`lsof`/`netstat`).
- [ ] Wrong `Host` header → 403; no token → 401; token never appears in logs.
- [ ] CSP and other headers present; the UI works under them.
- [ ] No credential reaches the browser (inspect every API response and the page source).
- [ ] Model output is rendered as text everywhere (search for `dangerouslySetInnerHTML` and Markdown renderers).
- [ ] `~/.megareviewer` is `0700` and `db.sqlite` is `0600`.
- [ ] No network calls besides GitHub, Bitbucket, Jira and Anthropic (watch with a proxy or `lsof` during a session).
- [ ] The published tarball has no install scripts and no dependencies.

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

- [ ] Every end-to-end test passes in CI; cross-platform smoke test is green.
- [ ] Security review checklist complete.
- [ ] Dogfood log has at least 10 PRs; cost estimate in ARCHITECTURE.md updated.
- [ ] README written.
- [ ] 0.1.0 published by the user, smoke-tested.

## Open issues

_None yet._

## Notes for later stages

_None yet._
