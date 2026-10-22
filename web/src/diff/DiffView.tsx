import type { FileChange, Hunk, HunkId } from "../../../src/domain/diff/index.ts";
import type { RiskAssessment } from "../../../src/domain/review/index.ts";
import { HunkCard } from "./HunkCard.tsx";

export interface HunkItem {
  readonly hunk: Hunk;
  readonly file: FileChange;
  readonly risk: RiskAssessment;
}

/** Hunks as cards, in the order given: the caller picks which hunks to show and in what order. */
export const DiffView = ({
  items,
  highlightedHunkIds,
  focusedHunkId = null,
  onFocusHunk,
}: {
  readonly items: readonly HunkItem[];
  /** Hunks to mark, e.g. those of the selected decision. */
  readonly highlightedHunkIds?: ReadonlySet<HunkId>;
  readonly focusedHunkId?: HunkId | null;
  readonly onFocusHunk?: (id: HunkId) => void;
}) => (
  <div className="diff-view">
    {items.map(({ hunk, file, risk }) => (
      <HunkCard
        key={hunk.id}
        hunk={hunk}
        file={file}
        risk={risk}
        highlighted={highlightedHunkIds?.has(hunk.id) ?? false}
        focused={focusedHunkId === hunk.id}
        onFocus={onFocusHunk}
      />
    ))}
  </div>
);
