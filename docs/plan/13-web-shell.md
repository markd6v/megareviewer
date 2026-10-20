# Stage 13: Web shell, API client and PR picker

**Status:** Not started
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

- [ ] `pnpm dev:web:mock` shows a working picker and starts a simulated analysis.
- [ ] The fixture `AnalysisView` covers every case listed in task 5.
- [ ] No inline scripts; no `dangerouslySetInnerHTML`.
- [ ] Light and dark themes both checked by eye.

## Open issues

_None yet._

## Notes for later stages

_None yet._
