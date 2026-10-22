import { useId } from "react";
import type { TourStep } from "../../../../src/domain/review/index.ts";
import { entryKey, type MainView, type TourEntry } from "./model.ts";

/** The tour's steps in the sidebar, then the mechanical changes. */
export const TourNav = ({
  steps,
  mechanicalCount,
  current,
  visited,
  onSelect,
}: {
  readonly steps: readonly TourStep[];
  readonly mechanicalCount: number;
  /** null while a decision or a mismatch is in focus. */
  readonly current: MainView | null;
  readonly visited: ReadonlySet<string>;
  readonly onSelect: (entry: TourEntry) => void;
}) => {
  const id = useId();
  const currentKey = current === null ? null : entryKey(current);
  const entries: readonly (TourEntry & { readonly label: string; readonly number: string })[] = [
    ...steps.map((step, index) => ({
      kind: "step" as const,
      stepId: step.id,
      label: step.title,
      number: `${index + 1}`,
    })),
    { kind: "mechanical" as const, label: `Mechanical changes (${mechanicalCount})`, number: "" },
  ];

  return (
    <nav className="tour-nav" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Tour</h2>
      <ol>
        {entries.map((entry) => {
          const key = entryKey(entry);
          const isCurrent = key === currentKey;
          const seen = visited.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                className={`tour-entry${isCurrent ? " current" : ""}${entry.kind === "mechanical" ? " mechanical" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(entry)}
              >
                <span className="tour-mark" aria-hidden="true">
                  {seen ? "✓" : ""}
                </span>
                {entry.number !== "" && <span className="tour-number">{entry.number}</span>}
                <span className="tour-title model-text">{entry.label}</span>
                {seen && <span className="visually-hidden">(visited)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
