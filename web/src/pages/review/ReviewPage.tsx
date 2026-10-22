import type { AnalysisId } from "../../../../src/domain/review/index.ts";
import { StageName } from "../../../../src/domain/review/index.ts";
import { errorMessage, useAnalysisView } from "../../api/index.ts";

/** A placeholder until stage 15 builds the review page: the PR and its stages' progress. */
export const ReviewPage = ({ analysisId }: { readonly analysisId: AnalysisId }) => {
  const { view, error, loading } = useAnalysisView(analysisId);
  if (view === null) {
    return error !== null ? (
      <p role="alert">{errorMessage(error)}</p>
    ) : (
      <p className="muted">{loading ? "Loading the analysis…" : ""}</p>
    );
  }
  const { analysis } = view;
  return (
    <div className="narrow">
      <h1>{analysis.pullRequest?.title ?? "Collecting the pull request…"}</h1>
      <p className="muted">The review page is coming in stage 15. Analysis {analysis.status}.</p>
      <ul>
        {StageName.options.map((stage) => (
          <li key={stage}>
            {stage}: {analysis.stages[stage]}
          </li>
        ))}
      </ul>
      {analysis.error !== null && <p role="alert">{analysis.error.message}</p>}
    </div>
  );
};
