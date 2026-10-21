import { z } from "zod";
import { HunkId } from "../diff/index.ts";

/**
 * A hunk a pass must cover exactly once, but didn't: missing, listed more than once,
 * or not one it may list at all (unknown, or mechanical).
 */
export const CoverageProblem = z
  .object({
    kind: z.enum(["missing", "duplicate", "unknown"]),
    hunkId: HunkId,
  })
  .readonly();
export type CoverageProblem = z.infer<typeof CoverageProblem>;

export type TourProblem = CoverageProblem;
export type RiskProblem = CoverageProblem;

/** The referenced IDs that aren't known, each once, in first-seen order. */
export const validateHunkReferences = (
  known: ReadonlySet<HunkId>,
  referenced: readonly HunkId[],
): HunkId[] => [...new Set(referenced.filter((id) => !known.has(id)))];

const coverageProblems = (
  listed: readonly HunkId[],
  required: ReadonlySet<HunkId>,
): CoverageProblem[] => {
  const problems: CoverageProblem[] = [];
  const seen = new Set<HunkId>();
  const reported = new Set<HunkId>();
  for (const hunkId of listed) {
    if (!required.has(hunkId)) {
      if (!reported.has(hunkId)) problems.push({ kind: "unknown", hunkId });
      reported.add(hunkId);
    } else if (seen.has(hunkId)) {
      if (!reported.has(hunkId)) problems.push({ kind: "duplicate", hunkId });
      reported.add(hunkId);
    }
    seen.add(hunkId);
  }
  for (const hunkId of required) {
    if (!seen.has(hunkId)) problems.push({ kind: "missing", hunkId });
  }
  return problems;
};

/** Every required hunk must appear in exactly one step, and no other hunk may appear. */
export const validateTour = (
  tour: { readonly steps: readonly { readonly hunkIds: readonly HunkId[] }[] },
  requiredHunkIds: ReadonlySet<HunkId>,
): TourProblem[] =>
  coverageProblems(
    tour.steps.flatMap((step) => step.hunkIds),
    requiredHunkIds,
  );

/** Every required hunk must be assessed exactly once, and no other hunk may be. */
export const validateRiskCoverage = (
  assessments: readonly { readonly hunkId: HunkId }[],
  requiredHunkIds: ReadonlySet<HunkId>,
): RiskProblem[] =>
  coverageProblems(
    assessments.map((assessment) => assessment.hunkId),
    requiredHunkIds,
  );
