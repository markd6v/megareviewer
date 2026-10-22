# Stage 13: Web shell, API client and PR picker

**Status:** Done (pushed to main without a PR; CI green on c6e2cb7)
**Depends on:** 02
**Unblocks:** 15
**Owns:** `web/` except `web/src/diff/` (stage 14) and `web/src/pages/review/` (stage 15; this stage creates only a placeholder there)

## Goal

The UI's foundation: Vite setup, session-token bootstrap, a typed API client with live updates, a mock API so UI work doesn't wait for the server, design tokens, and the first real page, the PR picker.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "UI", "Local server security"
- [DESIGN.md](../../DESIGN.md) principles: the UI exists to save reviewer attention
- Stage 02: `contracts/` (route table, schemas, error codes), `parsePullRequestUrl`

## Scope

**In:** Vite config, app shell and routing, token handling, API client and hooks, mock API with fixtures, design tokens and base styles, picker page, error and empty states.
**Out:** the diff view (14), the review page (15).

## Tasks

### 1. Vite: `web/vite.config.ts`

- `root: "web"`, build to `dist/web` (`emptyOutDir: true`), hashed assets under `assets/`.
- React plugin.
- Dev server proxies `/api` to `http://127.0.0.1:${MEGAREVIEWER_DEV_PORT ?? 4999}` with `changeOrigin: true`, so the `Host` header matches what the server allows.
- With `VITE_MOCK_API=1`, the mock API plugin (task 5) serves `/api` instead of the proxy.
- No inline scripts in `index.html` (the server's CSP forbids them).
- Scripts: `dev:web` (proxy to `pnpm dev:fake` or `dev:server`) and `dev:web:mock`.

### 2. App shell: `web/src/app/`

- `main.tsx` mounts `App` with an error boundary that shows the error and a reload button.
- **Router** (`router.ts`), about 50 lines on the History API, no library:
  - `/` → `PickerPage`
  - `/review/:analysisId` → `ReviewPage` from `web/src/pages/review/index.ts`. Create that file with a placeholder component; stage 15 replaces it.
  - `/dev/:name` (dev builds only) → loads `web/src/**/playground.tsx` matching `name` through `import.meta.glob`, so stage 14 can add a playground without touching the router. Missing → "No playground named …".
  - Anything else → not-found page with a link home.
- Header: product name (links home) and a status indicator (from `/api/status`).

### 3. Session token: `web/src/app/token.ts`

- On load, read `token` from the URL query, save it in `sessionStorage` (per tab), and remove it from the URL with `history.replaceState`.
- If there's no token in the URL or storage, show a screen saying to open megareviewer from the link printed in the terminal. Don't call the API.
- Wrap `sessionStorage` access in try/catch; fall back to keeping the token in memory.

### 4. API client: `web/src/api/`

- `client.ts`: one typed function per route in the contract's route table. Adds `x-megareviewer-token`. Parses every response with the contract's response schema; a mismatch is an `ApiError` with code `internal` and a message saying the server and UI versions differ.
- `ApiError` carries `code` and `message`. A `401` switches the app to the token screen.
- `events.ts`: `subscribeToAnalysis(id, onEvent): () => void` with `EventSource` on `/api/analyses/:id/events?token=…`. Close on `done`. Let `EventSource` reconnect on errors; refetch when it reconnects.
- Hooks in `hooks.ts`, plain React (no data library):
  - `useStatus()`, `usePullRequests()` with `refresh()`.
  - `useAnalysisView(id)`: fetches the view, subscribes to events, refetches on each event (debounced 100 ms), stops on `done`. Returns `{ view, error, loading, refetch }`.
  - `useMutation(fn)` helper with `pending` and `error` for the picker and stage 15.
- `messages.ts`: user-facing text for each `ErrorCode`, e.g. `unsupported-url` → "Only github.com and bitbucket.org pull request links are supported."

### 5. Mock API: `web/dev/`

A Vite plugin (`mock-api.ts`) that implements every contract route in memory, for UI work before the server exists:

- Fixtures in `web/dev/fixtures/`: a status with GitHub configured and Bitbucket not; a list of 6 PRs across both hosts and roles; and **one realistic complete `AnalysisView`**: about 10 hunks over 5 files, including a moved function, a lockfile, a formatting-only file and a pure rename; risk on every hunk with at least two `contract`; an intent with stated and inferred parts and one mismatch; 5 decisions across categories; a 4-step tour; two warnings; usage numbers.
- `POST /api/analyses` returns the fixture's ID and simulates progress: each stage moves to `done` about 600 ms apart, with SSE `updated` events, so loading states can be built.
- Verdict and publication routes keep state in memory; publication preview uses `buildPublication` if stage 10 has merged, otherwise a simple stand-in.
- A test validates every fixture against the contract schemas, so the mock can't drift from the real API.

After stage 10 merges, consider regenerating the fixture `AnalysisView` by running the real pipeline with fakes. Note it in **Notes for later stages** if you don't.

### 6. Design tokens and base styles: `web/src/styles/`

Plain CSS with custom properties, no CSS framework:

- `tokens.css`: colors for surface, text, muted text, border, accent, and diff colors (added, deleted, intra-line added, intra-line deleted), risk colors (contract stands out most, logic neutral, mechanical muted), each defined for light and dark (`prefers-color-scheme`). All text meets WCAG AA contrast.
- Spacing scale, radius, a system UI font, a monospace font for code, type scale.
- Visible focus rings on everything focusable.
- Layout works down to a 1024 px wide window; below that, the picker still works and the review page may scroll horizontally.

### 7. Picker page: `web/src/pages/picker/`

- **Setup status:** for each host, configured as `<user name>` or "not configured" with the fix (`set GITHUB_TOKEN or run gh auth login`; `set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN`). Same for Jira and the model.
- **Paste a PR URL:** input plus "Analyze" button. Validate with `parsePullRequestUrl` as the user types; show the error under the field. Submit → `POST /api/analyses` → navigate to `/review/:id`. Show the API error message on failure.
- **Lists:** "Waiting for your review" and "Your pull requests". Each row: host label, `owner/repo #number`, title, author, relative update time. Clicking a row starts the analysis like the URL form.
- Per-host errors from the list call show as a banner over the lists; the other host's PRs still show.
- Loading skeletons, empty states ("Nothing is waiting for your review"), and a refresh button.
- Keyboard: `/` focuses the URL field; arrow keys move through rows; `Enter` opens.

## Tests

- Token bootstrap: from URL, removed from URL, from storage, missing → token screen, storage throwing.
- Client: header sent, schema mismatch → `ApiError`, 401 → token screen, error codes → messages.
- `useAnalysisView`: refetch on events, stop on `done`, refetch on reconnect.
- Router: each route, unknown path, playground loading.
- Picker: validation messages, submit and navigate, row click, host error banner, empty states, keyboard navigation.
- Mock fixtures validate against contracts.

## Definition of done

- [x] `pnpm dev:web:mock` shows a working picker and starts a simulated analysis.
- [x] The fixture `AnalysisView` covers every case listed in task 5.
- [x] No inline scripts; no `dangerouslySetInnerHTML`.
- [x] Light and dark themes both checked by eye.

## Open issues

_None yet._

## Notes for later stages

Where the code differs from or adds to this doc.

- **Running it.** Mock: `pnpm dev:web:mock`, then open `http://localhost:5173/?token=mock`; the mock prints this link. It's `vite --mode mock` rather than `VITE_MOCK_API=1`, which works on every shell. Against the server: `pnpm dev:fake --port 4999 --token dev`, then `pnpm dev:web` and open `http://localhost:5173/?token=dev`. Checked by hand: the mock, the proxy to fake mode, and `pnpm build` served by fake mode with `--static dist/web` under the server's CSP, with no console errors.
- **The client returns results.** Each function returns `Result<T, ApiError>` instead of throwing, as ENGINEERING.md §6 asks for expected failures. `ApiError.code` is the contract's `ErrorCode` plus `unreachable`: no answer, or a 5xx that isn't one of ours (the Vite proxy with no server behind it). Any other response that doesn't match the contract is `internal` with a message about mismatched versions. `errorMessage(error)` in `messages.ts` gives the text to show; for codes like `host-error` it keeps the server's detail.
- **Hooks** get the client from `ApiContext`, whose value is `Api { client, subscribe }`. `useStatus()` returns `{ status, error, loading, refresh }` and `usePullRequests()` `{ pullRequests, … }`; a failed refresh keeps the last data. `useMutation(fn)` returns `{ run, pending, error, reset }`, where `run` resolves to the `Result`. The shell fetches the status once and passes it to the header and the picker.
- **Events.** `subscribeToAnalysis(id, token, onEvent, open?)` reports `changed` (an `updated` event, or a reconnect after an error), `done`, and `closed` (the server refused the stream, so EventSource won't reconnect). Payloads aren't parsed, since every event only triggers a refetch. `useAnalysisView` refetches 100 ms after the last `changed`, and right away on `done` or `closed`. On `done` it skips the refetch when the view it has already isn't running, so opening a complete analysis costs one view request, not two. A refused stream gets one refetch and no polling.
- **Routes.** `matchRoute` parses the analysis ID, so `/review/<invalid>` is the not-found page without an API call. `reviewPath(id)` builds the path. `ReviewPage` gets a parsed `AnalysisId`. The placeholder lists stage statuses with `useAnalysisView`; stage 15 replaces `ReviewPage.tsx`.
- **Playgrounds** are `web/src/<folder>/playground.tsx` with a component as the default export, served at `/dev/<folder>`. `/dev/styles` shows every color token, control and banner, for checking both themes. In production builds the glob is skipped and no playground is bundled.
- **The fixture is TypeScript, not JSON.** `web/dev/fixtures/analysis.ts` runs a hand-written diff through `parseUnifiedDiff`, `findMechanicalProofs` and `findFormattingProofs` (with tokens as syntax nodes, as `FakeCodeParser` does), so hunk IDs and proofs are what the server computes; the model's parts are hand-written. It has 11 hunks over 7 files, a little more than the doc's "about 10 over 5", to fit a story with two contract hunks besides all four mechanical kinds. `fixtureHunks` names the hunks for tests. It isn't generated by the real pipeline because `web/dev` may not import `src/application`.
- **Mock API.** `createMockApi()` in `mock-routes.ts` is the browser-safe core; `mock-api.ts` is the Vite plugin; `mockFetch(api)` turns the core into a `fetch` for tests. `web/dev/index.ts` exports only the plugin, since it imports Node types; tests import the other files directly. Starting an analysis for any GitHub PR URL replays the fixture from the start and clears its verdicts and publication. A Bitbucket URL gets `host-not-configured`, as the status fixture says. `analysisInProgress(analysis, stagesDone)` builds the running views. There is no failing scenario: retry always answers `bad-request`. Stage 15 can add one in `web/dev/` for its failed state.
- **Test helpers.** `web/src/testing/api.tsx` has `testApi()`: an `Api` over the mock, a `wrapper` for `render` and `renderHook`, and `emit(id, event)` to drive event streams. `web/src/testing/fetch.ts` has `fakeFetch` and `jsonResponse`. `web/src/testing/setup.ts` runs Testing Library's cleanup, which doesn't happen by itself without Vitest's globals.
- **Tokens.** Names are in `tokens.css`: `--color-*`, `--diff-{added,deleted}[-word]-bg`, `--risk-{contract,logic,mechanical}-{bg,text}`, `--space-1…7`, `--radius-1…3`, `--font-ui`, `--font-mono`, `--text-xs…2xl`, `--line-height-code`, `--focus-ring`. `tokens.test.ts` checks every text pair in both themes for 4.5:1 and control borders for 3:1. Add new pairs there. It caught four pairs on `--color-surface-sunken` that failed AA.
- **Picker.** An unconfigured host is shown as optional, not as a problem, while the other host is configured. A row's start error shows as a banner above the lists; the URL form's shows under the field until the URL changes. Below 1024 px, rows wrap onto two lines.
- **Outside this stage's paths:** `vitest.config.ts` (stage 01's): the web project also runs `web/dev/**/*.test.ts`, loads the Testing Library setup file, and processes `tokens.css` so the contrast test can read it (Vitest empties CSS imports, `?raw` ones too). `package.json`: `typecheck` also checks the new `web/tsconfig.node.json` (Vite config and `web/dev`, with Node types), and there's a `dev:web:mock` script. `web/tsconfig.json` uses `vite/client` types and no longer includes `web/dev`. `web/src/index.ts` from stage 01 is gone; `app/main.tsx` is the entry.
- **Stage 12:** `pnpm build` now produces `dist/web/`, closing that open issue. `THIRD_PARTY_LICENSES.txt` lists react, react-dom, scheduler and zod for the UI, but zod appears twice: Vite's module IDs are absolute paths and esbuild's are relative, so `scripts/build.ts` doesn't dedupe package roots across the two.
