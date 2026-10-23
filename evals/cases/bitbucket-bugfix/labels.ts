import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    h_916b942fb92913f9: "logic", // null check in refundAmount
    h_1fd5161b01e4eb07: "logic", // test
  },
  decisions: [
    {
      description:
        "Treats an order with no original payment as having nothing to refund (returns 0) rather than failing or refunding to store credit",
      mustHave: true,
    },
  ],
  mismatches: [],
};
