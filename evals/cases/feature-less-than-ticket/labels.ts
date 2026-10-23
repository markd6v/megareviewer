import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    h_cf32c71b35173a7f: "contract", // new admin endpoint
  },
  decisions: [
    {
      description:
        "Exports every order in one response with no date range, limit or streaming, loading all orders into memory",
      mustHave: true,
    },
    {
      description: "Builds CSV rows by joining values with commas without quoting or escaping",
      mustHave: false,
    },
  ],
  mismatches: [
    {
      kind: "missing",
      description: "The ticket requires limiting the export to a date range; there is no filter",
    },
    {
      kind: "missing",
      description: "The ticket asks for a customer email column; the CSV has none",
    },
  ],
};
