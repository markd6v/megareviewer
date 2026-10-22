import { useId } from "react";
import type {
  Decision,
  DecisionCategory,
  DecisionId,
  Verdict,
} from "../../../../src/domain/review/index.ts";
import type { Draft, SaveStatus } from "./useVerdicts.ts";

export const CATEGORY_NAMES: Readonly<Record<DecisionCategory, string>> = {
  api: "API",
  data: "Data",
  dependency: "Dependency",
  security: "Security",
  "error-handling": "Error handling",
  performance: "Performance",
  concurrency: "Concurrency",
  configuration: "Configuration",
  behavior: "Behavior",
  other: "Other",
};

const STATUS_TEXT: Readonly<Record<SaveStatus, string>> = {
  waiting: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved",
};

/** The decisions the code makes, as a checklist the reviewer approves or rejects. */
export const DecisionList = ({
  decisions,
  draftOf,
  statusOf,
  selected,
  readOnly,
  commentRef,
  onSelect,
  onVerdict,
  onComment,
}: {
  readonly decisions: readonly Decision[];
  readonly draftOf: (id: DecisionId) => Draft;
  readonly statusOf: (id: DecisionId) => SaveStatus | null;
  readonly selected: DecisionId | null;
  /** After publishing, verdicts and comments can't change. */
  readonly readOnly: boolean;
  /** Receives the selected decision's comment field, for the `c` shortcut. */
  readonly commentRef: (field: HTMLTextAreaElement | null) => void;
  readonly onSelect: (id: DecisionId) => void;
  readonly onVerdict: (id: DecisionId, verdict: Verdict) => void;
  readonly onComment: (id: DecisionId, comment: string) => void;
}) => {
  const id = useId();
  const reviewed = decisions.filter((decision) => draftOf(decision.id).verdict !== "pending");

  return (
    <section className="decision-list" aria-labelledby={`${id}-title`}>
      <div className="panel-header">
        <h2 id={`${id}-title`}>Decisions</h2>
        <span className="muted" aria-live="polite">
          {reviewed.length} of {decisions.length} reviewed
        </span>
      </div>
      <ol>
        {decisions.map((decision) => {
          const draft = draftOf(decision.id);
          const isSelected = selected === decision.id;
          const status = statusOf(decision.id);
          const toggle = (verdict: Verdict) =>
            onVerdict(decision.id, draft.verdict === verdict ? "pending" : verdict);
          return (
            <li
              key={decision.id}
              className={`decision verdict-${draft.verdict}${isSelected ? " selected" : ""}`}
            >
              <span className="badge category">{CATEGORY_NAMES[decision.category]}</span>
              <button
                type="button"
                className="decision-title model-text"
                aria-pressed={isSelected}
                onClick={() => onSelect(decision.id)}
              >
                {decision.title}
              </button>
              <details className="why">
                <summary>Why it matters</summary>
                <p className="model-text">{decision.whyItMatters}</p>
              </details>
              <div className="verdict-buttons">
                <button
                  type="button"
                  className="button verdict approve"
                  aria-pressed={draft.verdict === "approved"}
                  aria-label={`Approve: ${decision.title}`}
                  disabled={readOnly}
                  onClick={() => toggle("approved")}
                >
                  <span aria-hidden="true">✓</span> Approve
                </button>
                <button
                  type="button"
                  className="button verdict reject"
                  aria-pressed={draft.verdict === "rejected"}
                  aria-label={`Reject: ${decision.title}`}
                  disabled={readOnly}
                  onClick={() => toggle("rejected")}
                >
                  <span aria-hidden="true">✗</span> Reject
                </button>
              </div>
              <label className="visually-hidden" htmlFor={`${id}-${decision.id}-comment`}>
                Comment on: {decision.title}
              </label>
              <textarea
                id={`${id}-${decision.id}-comment`}
                ref={isSelected ? commentRef : undefined}
                className="input comment"
                rows={2}
                placeholder={readOnly ? "" : "Comment (optional)"}
                value={draft.comment}
                readOnly={readOnly}
                onChange={(event) => onComment(decision.id, event.target.value)}
              />
              {status !== null && STATUS_TEXT[status] !== "" && (
                <span className={`save-status ${status}`} role="status">
                  {STATUS_TEXT[status]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
