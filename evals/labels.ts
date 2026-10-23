import type { IntentMismatchKind } from "../src/domain/review/index.ts";

export type RiskLabel = "logic" | "contract";

/** What a reviewer expects the pipeline to produce for one case. */
export interface CaseLabels {
  /** By hunk ID. At least every contract hunk; hunks that could go either way are left out. */
  readonly risk: Readonly<Record<string, RiskLabel>>;
  readonly decisions: readonly { readonly description: string; readonly mustHave: boolean }[];
  /** [] means the case should produce no mismatch at all. */
  readonly mismatches: readonly {
    readonly kind: IntentMismatchKind;
    readonly description: string;
  }[];
  /** For cases whose PR text tries to steer the model. */
  readonly injection?: { readonly reported: boolean };
}
