import type { FileChange, Hunk, HunkId } from "../../../../src/domain/diff/index.ts";
import {
  type Analysis,
  type DecisionId,
  type RiskAssessment,
  type TourStep,
  TourStepId,
} from "../../../../src/domain/review/index.ts";
import type { HunkItem } from "../../diff/index.ts";

/** What the main area shows. */
export type MainView =
  | { readonly kind: "step"; readonly stepId: TourStepId }
  | { readonly kind: "mechanical" }
  /** Before the tour exists: every hunk in path order, so reading can start early. */
  | { readonly kind: "files" };

/** A decision or a mismatch shown on its own, on top of the tour. */
export type Focus =
  | { readonly kind: "decision"; readonly decisionId: DecisionId }
  | { readonly kind: "mismatch"; readonly index: number };

/** The tour's entries in the sidebar, in order: its steps, then the mechanical changes. */
export type TourEntry = MainView & { readonly kind: "step" | "mechanical" };

const byPath = (a: FileChange, b: FileChange): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

const UNCLASSIFIED = "Not classified yet.";

/**
 * Hunks and their files by ID, with each hunk's risk. A hunk without an assessment yet (the risk
 * pass hasn't run) reads as logic: shown in full, never collapsed.
 */
export const hunkIndex = (analysis: Analysis) => {
  const hunks = new Map<HunkId, { readonly hunk: Hunk; readonly file: FileChange }>();
  for (const file of analysis.files)
    for (const hunk of file.hunks) hunks.set(hunk.id, { hunk, file });
  const risk = new Map(analysis.risk.map((assessment) => [assessment.hunkId, assessment]));
  const mechanical = new Set(
    analysis.proofs.flatMap((proof) => (proof.hunkId === null ? [] : [proof.hunkId])),
  );
  const riskOf = (hunkId: HunkId): RiskAssessment =>
    risk.get(hunkId) ?? { hunkId, riskClass: "logic", reason: UNCLASSIFIED, source: "fallback" };
  const items = (ids: readonly HunkId[]): HunkItem[] =>
    ids.flatMap((id) => {
      const found = hunks.get(id);
      return found === undefined ? [] : [{ ...found, risk: riskOf(id) }];
    });
  return { hunks, mechanical, items };
};

export type HunkIndex = ReturnType<typeof hunkIndex>;

/** Non-mechanical hunks in path order, then file order: the reading order before a tour exists. */
export const hunksInPathOrder = (analysis: Analysis, index: HunkIndex): HunkId[] =>
  [...analysis.files]
    .sort(byPath)
    .flatMap((file) => file.hunks.map((hunk) => hunk.id))
    .filter((id) => !index.mechanical.has(id));

/**
 * The tour's steps, plus a step for non-mechanical hunks the tour misses. The server checks the
 * tour covers each one, but a hunk left out of every step would be invisible, so show it anyway.
 */
export const tourSteps = (analysis: Analysis, index: HunkIndex): readonly TourStep[] => {
  const steps = analysis.tour?.steps ?? [];
  const covered = new Set(steps.flatMap((step) => step.hunkIds));
  const missed = hunksInPathOrder(analysis, index).filter((id) => !covered.has(id));
  if (missed.length === 0) return steps;
  return [
    ...steps,
    {
      id: TourStepId.parse(`s${steps.length + 1}`),
      title: "Changes the tour left out",
      explanation: "The tour didn't include these changes, so they're shown here in file order.",
      hunkIds: missed,
    },
  ];
};

/** Every hunk in tour order, then the rest in file order: the order a decision's hunks show in. */
export const readingOrder = (
  analysis: Analysis,
  steps: readonly TourStep[],
): ReadonlyMap<HunkId, number> => {
  const ids = new Set([
    ...steps.flatMap((step) => step.hunkIds),
    ...analysis.files.flatMap((file) => file.hunks.map((hunk) => hunk.id)),
  ]);
  return new Map([...ids].map((id, rank) => [id, rank]));
};

export const inReadingOrder = (
  ids: readonly HunkId[],
  order: ReadonlyMap<HunkId, number>,
): HunkId[] =>
  [...new Set(ids)].sort(
    (a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
  );

/** One row per mechanical hunk, plus one per file-level proof, as the mechanical group shows. */
export const mechanicalCount = (analysis: Analysis): number => {
  const hunks = new Set<HunkId>();
  let fileLevel = 0;
  for (const proof of analysis.proofs) {
    if (proof.hunkId === null) fileLevel += 1;
    else hunks.add(proof.hunkId);
  }
  return hunks.size + fileLevel;
};

export const entryKey = (entry: MainView): string =>
  entry.kind === "step" ? entry.stepId : entry.kind;

export const sameView = (a: MainView, b: MainView): boolean => entryKey(a) === entryKey(b);
