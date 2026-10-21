import {
  type Analysis,
  type AnalysisId,
  buildPublication,
  type DecisionId,
  type DecisionVerdict,
  type Publication,
  type PublicationReceipt,
  type Verdict,
} from "../../domain/review/index.ts";
import { err, ok, type Result } from "../../domain/shared/index.ts";
import type { GitHost } from "../ports/index.ts";
import { hostFor } from "./analyses.ts";
import type { AppDeps } from "./deps.ts";
import { appError, fromHostError, type UseCaseError } from "./errors.ts";

/** Checking costs an API call and the UI refetches the view on every event. */
const STALE_CHECK_TTL_MS = 60_000;

export interface AnalysisView {
  readonly analysis: Analysis;
  readonly verdicts: readonly DecisionVerdict[];
  readonly publication: PublicationReceipt | null;
  /** The current user opened the PR, so the review can only comment, not approve. */
  readonly isAuthor: boolean;
  /** The PR has new commits since this complete analysis. */
  readonly stale: boolean;
}

/** False when unsure: the host decides anyway, and a wrong "true" would hide the verdict. */
const isAuthorOf = async (host: GitHost | undefined, analysis: Analysis): Promise<boolean> => {
  if (host === undefined || analysis.pullRequest === null) return false;
  const user = await host.currentUser();
  return user.ok && user.value.id === analysis.pullRequest.author.id;
};

/** Reading the analysis, recording verdicts, and publishing the review. */
export const createReviewUseCases = (deps: AppDeps) => {
  const staleChecks = new Map<AnalysisId, { checkedAt: number; stale: boolean }>();
  /** One publish per analysis at a time, so a double click can't post twice. */
  const publishing = new Map<AnalysisId, Promise<Result<PublicationReceipt, UseCaseError>>>();

  const getAnalysis = async (id: AnalysisId): Promise<Result<Analysis, UseCaseError>> => {
    const analysis = await deps.store.getAnalysis(id);
    return analysis === null ? err(appError("not-found", `No analysis ${id}`)) : ok(analysis);
  };

  const getComplete = async (id: AnalysisId): Promise<Result<Analysis, UseCaseError>> => {
    const analysis = await getAnalysis(id);
    if (analysis.ok && analysis.value.status !== "complete") {
      return err(appError("analysis-not-complete", "The analysis isn't complete"));
    }
    return analysis;
  };

  const isStale = async (analysis: Analysis): Promise<boolean> => {
    const host = deps.hosts[analysis.key.ref.repo.host];
    if (analysis.status !== "complete" || host === undefined) return false;
    const now = Date.parse(deps.clock.now());
    const cached = staleChecks.get(analysis.id);
    if (cached !== undefined && now - cached.checkedAt < STALE_CHECK_TTL_MS) return cached.stale;
    const current = await host.getPullRequest(analysis.key.ref);
    // Unknown counts as fresh: publishing checks again and refuses a stale analysis.
    if (!current.ok) return false;
    const stale = current.value.headSha !== analysis.key.headSha;
    staleChecks.set(analysis.id, { checkedAt: now, stale });
    return stale;
  };

  const publicationFor = async (analysis: Analysis, summary: string): Promise<Publication> =>
    buildPublication({
      analysis,
      verdicts: await deps.store.getVerdicts(analysis.id),
      summary,
      isAuthor: await isAuthorOf(deps.hosts[analysis.key.ref.repo.host], analysis),
    });

  const publish = async (
    analysis: Analysis,
    summary: string,
    allowStale: boolean,
  ): Promise<Result<PublicationReceipt, UseCaseError>> => {
    const { id, key } = analysis;
    // One publication per analysis.
    const existing = await deps.store.getPublication(id);
    if (existing !== null) return ok(existing);

    const host = hostFor(deps, key.ref.repo.host);
    if (!host.ok) return host;
    const current = await host.value.getPullRequest(key.ref);
    if (!current.ok) return err(fromHostError(current.error));
    if (current.value.headSha !== key.headSha && !allowStale) {
      return err(
        appError("stale-analysis", "The pull request has new commits since this analysis"),
      );
    }

    const publication = await publicationFor(analysis, summary);
    const alreadyPosted = await deps.store.getPostedComments(id);
    const published = await host.value.publish(key.ref, publication, {
      headSha: key.headSha,
      alreadyPosted: new Set(alreadyPosted.keys()),
      onPosted: (commentKey, hostCommentId) =>
        deps.store.recordPostedComment(id, commentKey, hostCommentId),
    });
    // Posted comments are already recorded, so a retry continues where this stopped.
    if (!published.ok) return err(appError("host-error", published.error.message));
    const receipt: PublicationReceipt = {
      ...published.value,
      // Include what an earlier, partly failed attempt posted: the receipt covers the review.
      postedCommentIds: {
        ...Object.fromEntries(alreadyPosted),
        ...published.value.postedCommentIds,
      },
    };
    await deps.store.recordPublication(id, receipt);
    return ok(receipt);
  };

  return {
    async getAnalysisView(id: AnalysisId): Promise<Result<AnalysisView, UseCaseError>> {
      const analysis = await getAnalysis(id);
      if (!analysis.ok) return analysis;
      const host = deps.hosts[analysis.value.key.ref.repo.host];
      const [verdicts, publication, isAuthor, stale] = await Promise.all([
        deps.store.getVerdicts(id),
        deps.store.getPublication(id),
        isAuthorOf(host, analysis.value),
        isStale(analysis.value),
      ]);
      return ok({ analysis: analysis.value, verdicts, publication, isAuthor, stale });
    },

    async recordVerdict(
      id: AnalysisId,
      decisionId: DecisionId,
      verdict: Verdict,
      comment: string,
    ): Promise<Result<DecisionVerdict, UseCaseError>> {
      const analysis = await getComplete(id);
      if (!analysis.ok) return analysis;
      if (!analysis.value.decisions.some((decision) => decision.id === decisionId)) {
        return err(appError("not-found", `No decision ${decisionId} in analysis ${id}`));
      }
      const saved: DecisionVerdict = { decisionId, verdict, comment, updatedAt: deps.clock.now() };
      await deps.store.saveVerdict(id, saved);
      return ok(saved);
    },

    /** Exactly what publishReview would send. */
    async previewPublication(
      id: AnalysisId,
      summary: string,
    ): Promise<Result<Publication, UseCaseError>> {
      const analysis = await getComplete(id);
      return analysis.ok ? ok(await publicationFor(analysis.value, summary)) : analysis;
    },

    async publishReview(
      id: AnalysisId,
      summary: string,
      allowStale: boolean,
    ): Promise<Result<PublicationReceipt, UseCaseError>> {
      const analysis = await getComplete(id);
      if (!analysis.ok) return analysis;
      const running = publishing.get(id);
      if (running !== undefined) return running;
      const attempt = publish(analysis.value, summary, allowStale).finally(() =>
        publishing.delete(id),
      );
      publishing.set(id, attempt);
      return attempt;
    },
  };
};
