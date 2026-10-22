import type { AnalysisView } from "../../../../contracts/index.ts";
import { pullRequestUrl } from "../../../../src/domain/review/index.ts";
import { type ApiError, errorMessage } from "../../api/index.ts";

/** Up to this many warnings show in full; more collapse to a count. */
const SHOWN_WARNINGS = 2;

/** The PR, whether the analysis is still current, and the way to publish the review. */
export const ReviewHeader = ({
  view,
  reanalyzing,
  reanalyzeError,
  onReanalyze,
  onPublish,
}: {
  readonly view: AnalysisView;
  readonly reanalyzing: boolean;
  readonly reanalyzeError: ApiError | null;
  readonly onReanalyze: () => void;
  readonly onPublish: () => void;
}) => {
  const { analysis, publication, stale } = view;
  const { pullRequest, warnings } = analysis;
  const { ref } = analysis.key;

  return (
    <header className="review-header">
      <div className="review-title">
        <h1 className="model-text">{pullRequest?.title ?? "Collecting the pull request…"}</h1>
        <p className="pr-meta">
          <a href={pullRequest?.url ?? pullRequestUrl(ref)} target="_blank" rel="noreferrer">
            {ref.repo.owner}/{ref.repo.repo} #{ref.number}
          </a>
          {pullRequest !== null && (
            <>
              <span> · {pullRequest.author.name || pullRequest.author.id}</span>
              <span>
                {" · "}
                <code>{pullRequest.sourceBranch}</code> → <code>{pullRequest.targetBranch}</code>
              </span>
            </>
          )}
        </p>
      </div>
      <div className="review-actions">
        {publication !== null ? (
          <p className="published" role="status">
            <span aria-hidden="true">✓</span>{" "}
            {publication.url === null ? (
              "Published"
            ) : (
              <a href={publication.url} target="_blank" rel="noreferrer">
                Published
              </a>
            )}
          </p>
        ) : (
          <button
            type="button"
            className="button primary"
            disabled={analysis.status !== "complete"}
            onClick={onPublish}
          >
            Publish…
          </button>
        )}
      </div>
      {stale && (
        <div className="banner warning stale-banner" role="status">
          <span>This PR has new commits since the analysis.</span>
          <button type="button" className="button" disabled={reanalyzing} onClick={onReanalyze}>
            {reanalyzing ? "Starting…" : "Re-analyze"}
          </button>
          {reanalyzeError !== null && (
            <span className="field-error" role="alert">
              {errorMessage(reanalyzeError)}
            </span>
          )}
        </div>
      )}
      {warnings.length > 0 && warnings.length <= SHOWN_WARNINGS && (
        <ul className="warnings" aria-label="Warnings">
          {warnings.map((warning) => (
            <li key={warning} className="banner warning">
              {warning}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > SHOWN_WARNINGS && (
        <details className="warnings banner warning">
          <summary>{warnings.length} warnings</summary>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </header>
  );
};
