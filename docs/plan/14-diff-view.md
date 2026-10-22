# Stage 14: Diff view component

**Status:** In progress (branch stage/14-diff-view)
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

- [ ] Every playground case renders correctly in light and dark themes.
- [ ] A 2,000-line hunk renders and scrolls without visible lag (checked by hand; note the machine).
- [ ] No `dangerouslySetInnerHTML`; highlighted code is rendered from tokens.

## Open issues

_None yet._

## Notes for later stages

_None yet._
