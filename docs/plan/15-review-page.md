# Stage 15: Review page and publishing

**Status:** Done (pushed to main without a PR; CI green on 6fd6394)
**Depends on:** 13, 14
**Unblocks:** 17
**Owns:** `web/src/pages/review/`

## Goal

The product's main screen: intent first, then a guided tour of the changes, a decision checklist the reviewer works through, and publishing the review back to the host. Built against stage 13's mock API, so it doesn't wait for the server.

## Read first

- [DESIGN.md](../../DESIGN.md) principles 1–4 and 9; [ARCHITECTURE.md](../../ARCHITECTURE.md) "UI"
- Stage 02: `AnalysisView` and the publication routes in `contracts/`
- Stage 10 doc, task 8: how verdicts become a publication (what the preview will show)
- Stage 13: hooks, API client, error messages, tokens, mock API
- Stage 14: `DiffView`, `MechanicalGroup`, `FileNotices`

## Scope

**In:** layout, running/failed/complete states, intent panel, tour navigation, decision checklist with verdicts and comments, keyboard shortcuts, publish flow, stale-analysis handling, usage display.
**Out:** split diff view, comments on arbitrary lines (decisions only in this slice), editing after publishing.

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ PR header: title · owner/repo #n · author · branches · host link     │
│            [stale banner] [warnings]                     [Publish]   │
├──────────────────────────────────────────────────────────────────────┤
│ Intent: stated  │  inferred  │  mismatches                          │
├───────────────┬──────────────────────────────────────────────────────┤
│ Tour          │ Step 2 of 4: <title>                                 │
│  ✓ 1 …        │ <explanation>                                        │
│  ▸ 2 …        │                                                      │
│    3 …        │ DiffView (this step's hunks)                          │
│  Mechanical(7)│                                                      │
│               │                                  [← Prev] [Next →]   │
│ Decisions 2/5 │                                                      │
│  [✓][✗] …     │                                                      │
├───────────────┴──────────────────────────────────────────────────────┤
│ Usage: 182k tokens in · 9k out · $0.94                               │
└──────────────────────────────────────────────────────────────────────┘
```

## Tasks

### 1. Data and states: `ReviewPage.tsx`

Replace stage 13's placeholder. Use `useAnalysisView(analysisId)`.

| State | Shows |
|---|---|
| Loading | Skeleton |
| Running | A stage progress strip (collect, prep, intent, risk, decisions, tour). Each section appears as soon as its data exists: the intent panel after intent; once `prep` is done, files and hunks in path order so the reviewer can start reading before the tour exists. |
| Failed | The failed stage and message, whatever partial results exist, and a **Retry** button (`POST …/retry`, then navigate to the returned ID). |
| Complete | Everything below. |
| Not found | Message and a link to the picker. |

### 2. Header

- Title, `owner/repo #number` linking to the PR on its host, author, `source → target`.
- **Stale banner** when `view.stale`: "This PR has new commits since the analysis." with **Re-analyze** (`POST /api/analyses` with the PR URL, navigate to the result).
- **Warnings** from `analysis.warnings`, collapsed to a count if more than two.
- **Publish** button, enabled when complete and not yet published. After publishing: "Published" with a link to the review on the host.

### 3. Intent panel: `IntentPanel.tsx`

- **Stated:** summary, with source chips (description, commits, branch, and each ticket as `KEY · status` linking to Jira). If `stated` is null: "No stated intent: the PR has no description or linked tickets."
- **Inferred:** summary and behavior changes as a list.
- **Mismatches:** each with a kind badge (unrequested, missing, contradicts) and description. Clicking one shows its hunks in the main area (same as selecting a decision, task 5).
- Collapsible; remembers its state per analysis in `localStorage` (wrapped in try/catch).

### 4. Tour: `TourNav.tsx` and the main area

- The sidebar lists steps with number and title; the current step is highlighted; visited steps get a check. Visited state persists per analysis in `localStorage`.
- The last entry is **Mechanical changes (N)**, which shows `MechanicalGroup`, followed by `FileNotices` if any.
- The main area shows the step's title, explanation, and `DiffView` with the step's hunks in tour order, plus Prev/Next buttons.
- If `tour.fallback` is true, show a note: "The model's tour wasn't usable, so changes are grouped by file."

### 5. Decisions: `DecisionList.tsx`

- Header with progress: `2 of 5 reviewed`.
- Each decision: category badge, title, "why it matters" (expandable), approve and reject toggles (clicking the active one returns to pending), and a comment field.
- Selecting a decision switches the main area to **decision focus**: its hunks, from whichever steps, with `highlightedHunkIds`, and a "Back to tour" control.
- Verdict changes save immediately (`PUT …/verdicts/:decisionId`) and update the UI optimistically; on error, roll back and show the message.
- Comments autosave 500 ms after typing stops, with a small "Saved" indicator.
- After publishing, verdicts and comments are read-only.

### 6. Keyboard shortcuts: `shortcuts.ts`

| Key | Action |
|---|---|
| `j` / `k` | Next / previous hunk in the main area |
| `n` / `p` | Next / previous tour step |
| `a` / `r` | Approve / reject the selected decision |
| `c` | Focus the selected decision's comment |
| `Esc` | Leave decision focus, close dialogs |
| `?` | Show the shortcut list |

Ignore shortcuts while focus is in a text field.

### 7. Publish flow: `PublishDialog.tsx`

1. The dialog has a summary text field.
2. A preview (`POST …/publication/preview`, refreshed 400 ms after the summary changes) shows exactly what will be posted: the verdict (Approve, Request changes, Comment), a note when it's Comment because the reviewer is the author, each inline comment with `file:line` and body, and the summary text.
3. **Publish** → `POST …/publication` with `allowStale: false`.
   - `stale-analysis` → ask "This PR changed since the analysis. Publish anyway?" → retry with `allowStale: true`.
   - Other errors → show the message and a **Retry** button. Retrying is safe: comments already posted are skipped.
   - Success → close, refetch the view, show the link.
4. Pending decisions are allowed; the preview makes clear they'll be listed as not reviewed.

### 8. Usage footer

Total input, cache-read and output tokens and total cost from `analysis.usage`, with a per-pass breakdown on hover or focus.

### 9. Rendering model output

Model text (intent, reasons, decisions, tour explanations) is rendered as plain text. React escapes it; never use `dangerouslySetInnerHTML` or a Markdown renderer for it.

## Tests

With stage 13's mock fixtures:

- Each state: loading, running with partial sections appearing, failed with retry, complete, not found.
- Intent: null stated intent, mismatch click switches to its hunks.
- Tour: step navigation, visited persistence, mechanical entry, fallback note.
- Decisions: optimistic verdict and rollback on error, toggling back to pending, comment autosave, decision focus and back, read-only after publish.
- Shortcuts, including being ignored in text fields.
- Publish: preview updates, author note, stale confirmation path, error and retry, success state.
- Stale banner and re-analyze.

## Definition of done

- [x] The whole flow works against the mock API: open an analysis, follow the tour, give verdicts, publish.
- [x] Every keyboard shortcut works.
- [x] Light and dark themes checked by eye.

## Open issues

_None yet._

## Notes for later stages

Where the code differs from or adds to this doc.

- **Running it.** `pnpm dev:web:mock`, open a PR from the picker. In the mock, PR number 500 (e.g. `https://github.com/acme/shop/pull/500`) fails at the risk stage, and its retry succeeds. Checked by hand at 1400 px in light and dark: the mock flow from a running analysis to publishing, the failed state and retry, and `pnpm build` served by fake mode with `--static dist/web` under the server's CSP, publishing to the fake host, with no console errors. The browser pane's key tool can't send `?`, so that one was checked with a dispatched `keydown`; every other shortcut was pressed for real.
- **Files.** `ReviewPage.tsx` holds the states and the navigation; `model.ts` has the pure parts (hunk lookup, reading order, tour entries); `useVerdicts.ts` the optimistic saves. The other components are named as in this doc, plus `ReviewHeader`, `MainArea`, `ProgressStrip`, `UsageFooter`, `Dialog` and `ShortcutsDialog`.
- **A retry can return the same ID.** The server keeps the ID when the head SHA hasn't changed, and `useAnalysisView` stops listening after `done`. So when a retry or a re-analysis returns the current ID, the page remounts and subscribes afresh instead of refetching once.
- **Verdicts wait for a complete analysis.** The API answers `analysis-not-complete` while the tour still runs, so decisions show read-only until then, with a line saying so.
- **Fail safe.** A hunk the risk pass hasn't classified yet shows as logic ("Not classified yet."). Non-mechanical hunks the tour leaves out get an extra step, "Changes the tour left out". Ticket keys Jira didn't return show as `KEY · not fetched`. Before the tour exists, and when the analysis failed without one, every non-mechanical hunk shows in path order, followed by the mechanical group and file notices.
- **Mechanical entry.** Always the last tour entry. Its count is mechanical hunks plus file-level proofs, which is what `MechanicalGroup` lists.
- **Shortcuts.** The selected decision is the one in focus. `a` and `r` toggle like the buttons: pressing again returns to pending. `n` and `p` leave a focus and move through the tour. Shortcuts are off while a dialog is open; dialogs close on `Esc` themselves.
- **Scrolling.** Choosing a step, a decision or a mismatch scrolls the main area to its top; the tour arriving on its own doesn't move the page. The sidebar is sticky and scrolls by itself, so cards keep stage 14's `scroll-margin-top`.
- **Publishing.** Opening the dialog first saves comments still waiting for their pause, so the preview includes them. **Publish** stays disabled until a preview has loaded, and reads **Retry** after a failure.
- **Usage.** "Tokens in" counts uncached input including cache writes; cache reads are listed apart.
- **Outside this stage's paths:** the failing scenario in `web/dev/` (`mock-routes.ts`, `progress.ts`, and their test), as stage 13's notes invited.
- **Stage 17:** `pnpm build` now prints Vite's 500 KB warning, for the lazy C++ grammar chunk only (797 KB), as stage 14 predicted. `web/vite.config.ts` (stage 13's) needs `build.chunkSizeWarningLimit` raised or the grammar dropped from `GRAMMARS` in `highlight.ts`. The license notices already list `shiki` and `@shikijs/*`.
