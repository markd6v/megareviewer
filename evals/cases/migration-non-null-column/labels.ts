import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    h_901f64fb4baa9ec3: "contract", // migration
    h_d0c1c2644b662381: "contract", // insert persists region
    h_6c44d4960df7be29: "contract", // API body accepts region
  },
  decisions: [
    {
      description:
        "Backfills every existing account with region us-east-1 through a NOT NULL DEFAULT, asserting all existing data is in that region",
      mustHave: true,
    },
    {
      description:
        "Builds the region index without CONCURRENTLY, which blocks writes to accounts while it builds",
      mustHave: false,
    },
    {
      description:
        "New accounts default to us-east-1 when signup sends no region, instead of requiring a choice",
      mustHave: false,
    },
  ],
  mismatches: [],
};
