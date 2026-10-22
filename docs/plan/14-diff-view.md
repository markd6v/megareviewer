# Stage 14: Diff view component

**Status:** Done (pushed to main without a PR; CI green on b25ba1e)
**Depends on:** 02
**Unblocks:** 15
**Owns:** `web/src/diff/`

## Goal

The component reviewers spend most of their time in: renders a chosen set of hunks (not a file tree) with syntax highlighting, intra-line changes, risk badges, and collapsed mechanical changes with their proofs. It has to be fast and calm to read.

## Read first

- [DESIGN.md](../../DESIGN.md) principles 2–3 (risk sorting, guided tour), [ARCHITECTURE.md](../../ARCHITECTURE.md) "UI"
- [ENGINEERING.md](../../ENGINEERING.md) §6 "Fail safe toward the reviewer": mechanical content is collapsed, never hidden
- Stage 02: `FileChange`, `Hunk`, `DiffLine`, `RiskAssessment`, `MechanicalProof`
- Stage 13 doc: design tokens and the `/dev/:name` playground route

## Scope

**In:** hunk rendering, syntax highlighting, intra-line diff, risk and proof labels, mechanical group, file-level rows (rename, binary, mode), focus handling, playground.
**Out:** which hunks to show and in what order (stage 15 passes them in); split (side-by-side) view, a later improvement.

## Component API

```tsx
export interface HunkItem {
  hunk: Hunk;
  file: FileChange;
  risk: RiskAssessment;
}

export function DiffView(props: {
  items: HunkItem[];                         // in display order
  highlightedHunkIds?: ReadonlySet<HunkId>;  // e.g. hunks of the selected decision
  focusedHunkId?: HunkId | null;
  onFocusHunk?: (id: HunkId) => void;
}): JSX.Element;

export function MechanicalGroup(props: {
  files: FileChange[];
  proofs: MechanicalProof[];                 // includes file-level proofs (hunkId null)
  risk: RiskAssessment[];
}): JSX.Element;

export function FileNotices(props: { files: FileChange[] }): JSX.Element;  // binary and mode-only changes
```

Export them, plus `useHighlighter`, from `web/src/diff/index.ts`.

## Tasks

### 1. Hunk card

- **Header:** file path (with `old → new` for renames), file status badge, the hunk's section heading, line ranges, and a risk badge with its reason as a tooltip and visible text on focus. Contract is the loudest style, logic is neutral, mechanical is muted.
- **Body:** a table with old line number, new line number, a `+`/`-`/space marker, and code. Markers stay visible so color isn't the only signal.
- `highlightedHunkIds` gives the card an accent border. `focusedHunkId` scrolls the card into view and gives it focus.
- Clicking or focusing a card calls `onFocusHunk`.
- Long lines scroll horizontally inside the card; the page doesn't.
- `content-visibility: auto` on cards so long tours stay fast.

### 2. Syntax highlighting: `highlight.ts`

- Shiki core with the JavaScript regex engine (no WASM in the browser), one light and one dark theme rendered through CSS variables so the theme follows `prefers-color-scheme` without re-highlighting.
- Load languages lazily with dynamic imports, mapped from `FileChange.language` or the file extension. Unknown → plain text.
- **Highlight each side as a whole**, not line by line, so multi-line strings and comments color correctly: build the old text (context + deleted lines) and new text (context + added lines) of a hunk, highlight each, and map the token lines back onto diff lines. Write this mapping as a pure function and test it.
- Render plain text first and swap in highlighted tokens when ready, with identical line heights so nothing jumps.

### 3. Intra-line diff: `intra-line.ts`

- Pair each run of deleted lines with the run of added lines right after it, line by line.
- For each pair, diff at word level (split on word boundaries and punctuation) with a small Myers or LCS implementation written here; no dependency.
- Mark changed segments with a stronger background on top of the line color.
- Skip lines over 500 characters and pairs with less than 30% in common (it's a rewrite; highlighting everything adds noise).

### 4. Mechanical group

- One collapsed row per mechanical hunk, grouped by file: `path — <proof detail> (+N −M)`, e.g. `src/b.ts — moved from src/a.ts:10–42, identical (+33 −0)`.
- Pure renames (proof with `hunkId: null`): a row `old → new — renamed, content unchanged`, nothing to expand.
- Expanding a row renders the hunk with the same card as task 1, with the proof shown in the header.
- Hunks over 500 lines show the first 500 and a "Show all N lines" button.
- A group header with the total count and an "Expand all" toggle.

### 5. File notices

Rows for binary files ("binary file changed") and mode-only changes ("mode 100644 → 100755"). These aren't mechanical: a newly executable file can matter, so they're shown with logic styling, not muted.

### 6. Playground: `web/src/diff/playground.tsx`

Shown at `/dev/diff` in dev builds. Renders every case: each file status, a 2,000-line hunk, each proof kind collapsed and expanded, contract/logic/mechanical badges, intra-line changes, an unknown language, a file with CRLF line endings, a line with a missing newline at end of file, long lines, and highlighted and focused cards.

## Tests

- Pure functions: highlight line mapping (including a multi-line string spanning context and changed lines), intra-line pairing and word diff, the 30% and 500-character cutoffs.
- Component: line numbers and markers, risk badge text, highlighted and focused states, `onFocusHunk`, mechanical rows collapsed by default and expandable, rename rows, "Show all" for long hunks, file notices, accessible names (each card is a labelled region).

## Definition of done

- [x] Every playground case renders correctly in light and dark themes.
- [x] A 2,000-line hunk renders and scrolls without visible lag (checked by hand; note the machine).
- [x] No `dangerouslySetInnerHTML`; highlighted code is rendered from tokens.

## Open issues

_None yet._

## Notes for later stages

Where the code differs from or adds to this doc.

- **API.** As specified, plus: `MechanicalGroup` and `FileNotices` render nothing when they have nothing to show. Each titles itself with an `h2` ("Mechanical changes N", "Changes without lines to show"). `HighlighterContext` is exported so tests can supply a fake `Highlighter`; without one, cards load Shiki asynchronously. Stage 15's tests can wrap renders in a provider whose `highlight` never resolves, as `DiffView.test.tsx` does. `useHighlighter(hunk, file)` returns tokens for each of the hunk's lines, or null while loading and for unknown languages.
- **Focus.** A card is focusable (`tabIndex=0`), and focus anywhere inside it, including its risk badge, calls `onFocusHunk`. When `focusedHunkId` changes, the card takes focus and scrolls to `block: "start"`, unless focus is already inside it, so clicking a card never makes the page jump. Cards have `scroll-margin-top: var(--space-4)`; stage 15 should raise it if the review page has a sticky header (the playground does this for its sticky controls).
- **Risk reason.** The badge is a button described by a `role="tooltip"` element, shown on hover and on `:focus-visible`. `content-visibility: auto` sits on the lines container (`.hunk-body`), not the card, because containment clips overflow and the tooltip overflows the header. The container's placeholder height is its line count × 20 px, so the scrollbar doesn't jump as cards render.
- **More file notices than the doc lists, to fail safe.** Besides binary files and mode changes, `FileNotices` lists empty files added or deleted and a modified file with no hunks. Without that, such files would appear nowhere. A mode change gets a notice even when the file also has hunks. A rename without hunks isn't a notice, because its rename proof puts it in `MechanicalGroup`.
- **Mechanical rows.** Several proofs on one hunk are joined with "; ". A proof whose file or hunk isn't in `files` still gets a row with its detail and nothing to expand, so no proof is silently dropped. Rows of a file come in the order of `files`, then hunks. The 500-line limit applies only to mechanical cards; `DiffView` always shows every line.
- **Line endings.** A trailing `\r` is removed from the displayed text. A line is marked "CRLF" only when its hunk mixes endings, so a CRLF file isn't noisy, but a line whose only change is its ending doesn't look unchanged.
- **Colors.** Themes are `github-light-default` and `github-dark-default`, the Primer colors the tokens already use. Two light syntax colors (comments, function names) are darkened to meet 4.5:1 on the diff backgrounds, and `highlight.test.ts` checks every theme color on the surface and both line backgrounds. Changed words drop their syntax color and use `--color-text`, because syntax colors don't all meet AA on the stronger word backgrounds. Text in a theme's default color is left unstyled, and neighboring tokens with one style merge, so a big hunk renders fewer elements.
- **Languages.** 33 Shiki grammars, picked by the tree-sitter name (`c_sharp` → `csharp`), then by extension or basename (`Dockerfile`, `Makefile`). Anything else is plain text. Lines over 1,000 characters aren't tokenized, and lines over 500 aren't word-diffed.
- **Bundle.** Shiki's core, the JavaScript regex engine, the themes and each grammar are lazy chunks; nothing loads until a card needs highlighting, and there's no WASM. A throwaway build importing `DiffView` gave a 16 KB entry chunk and 2.7 MB of lazy chunks. The C++ grammar alone is 800 KB, so once stage 15 imports the diff view, `pnpm build` will print Vite's 500 KB chunk-size warning. Raise `build.chunkSizeWarningLimit` or drop grammars from `GRAMMARS` in `highlight.ts`. Stage 12: the license notices will need `shiki` and `@shikijs/*` (MIT) once they're bundled.
- **Performance** (Apple M1 Pro, 16 GB; headless Chrome for Testing 1243 driven by Playwright, because the app's browser pane doesn't render frames while it's hidden). Scrolling through the playground's ~2,000-line hunk at 100 px per frame took 407 frames, none over 16.8 ms, with no long tasks. In dev mode, the playground's first render (all cases, about 40,000 elements) is one ~600 ms task, and highlighting is one ~135 ms task. A production build wasn't measured, because no page imports the diff view yet.
- **Playground.** `/dev/diff`. The diff is parsed and proved by the domain code; the formatting proof is hand-written, since it needs tree-sitter. The CRLF hunk in `config/app.ini` shows up both as a logic card and in the mechanical group (it has a line-endings proof), which the real pipeline wouldn't do. The playground hand-picks its cards to show the CRLF mark on both.
- **Outside this stage's paths:**
  - `.visually-hidden` is defined in `diff.css`; stage 13 may want it in `styles/base.css`.
  - `/favicon.ico` is a 404 in dev (no icon in `web/index.html`).
  - Biome failed locally when `.claude/worktrees/` held another checkout with its own `biome.json` ("nested root configuration"). `biome.json` (stage 01's) now excludes `.claude`, so `pnpm lint` works locally again.
