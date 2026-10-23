import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    h_ef35a3a93a2acbf9: "contract", // PAYMENTS_TIMEOUT_MS
    h_37ae4299382fa27e: "contract", // timeout on the payment provider call
    h_dec7b75148469e68: "logic", // docs
  },
  decisions: [
    {
      description:
        "Aborts refund requests after 5 seconds by default, so slow refunds that used to complete now fail",
      mustHave: true,
    },
    {
      description:
        "Doesn't validate PAYMENTS_TIMEOUT_MS: a non-numeric value gives NaN and breaks every refund",
      mustHave: false,
    },
    {
      description:
        "An aborted refund may still have been processed by the provider, and the caller sees it as failed",
      mustHave: false,
    },
  ],
  mismatches: [],
};
