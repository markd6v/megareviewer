import "./diff.css";
import { useId, useMemo, useState } from "react";
import type { FileChange, MechanicalProof } from "../../../src/domain/diff/index.ts";
import type { RiskAssessment } from "../../../src/domain/review/index.ts";
import { HunkCard } from "./HunkCard.tsx";
import { mechanicalRows } from "./mechanical.ts";

/** Expanded mechanical hunks show this many lines at first. */
export const MECHANICAL_LINE_LIMIT = 500;

/**
 * Mechanical changes, one collapsed row each with its proof. Each row with a hunk expands to the
 * hunk's card: collapsed, never hidden.
 */
export const MechanicalGroup = ({
  files,
  proofs,
  risk,
}: {
  readonly files: readonly FileChange[];
  /** Includes file-level proofs (hunkId null). */
  readonly proofs: readonly MechanicalProof[];
  readonly risk: readonly RiskAssessment[];
}) => {
  const titleId = useId();
  const rows = useMemo(() => mechanicalRows(files, proofs), [files, proofs]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const expandable = rows.filter((row) => row.hunk !== null).map((row) => row.key);
  const allExpanded = expandable.length > 0 && expandable.every((key) => expanded.has(key));

  if (rows.length === 0) return null;
  const toggle = (key: string) =>
    setExpanded((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <section className="mechanical-group" aria-labelledby={titleId}>
      <div className="mechanical-header">
        <h2 id={titleId}>
          Mechanical changes <span className="mechanical-count">{rows.length}</span>
        </h2>
        {expandable.length > 0 && (
          <button
            type="button"
            className="button"
            onClick={() => setExpanded(new Set(allExpanded ? [] : expandable))}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      <ul className="mechanical-rows">
        {rows.map((row) => {
          const open = expanded.has(row.key);
          return (
            <li key={row.key} className="mechanical-row">
              {row.hunk === null || row.file === null ? (
                <span className="mechanical-summary">{row.summary}</span>
              ) : (
                <button
                  type="button"
                  className="mechanical-summary mechanical-toggle"
                  aria-expanded={open}
                  onClick={() => toggle(row.key)}
                >
                  {row.summary}
                </button>
              )}
              {open && row.hunk !== null && row.file !== null && (
                <HunkCard
                  hunk={row.hunk}
                  file={row.file}
                  risk={risk.find((assessment) => assessment.hunkId === row.hunk?.id) ?? null}
                  proofs={row.proofs}
                  lineLimit={MECHANICAL_LINE_LIMIT}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
