import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    h_fbaf18305007c20a: "contract", // rate limit 60 → 600
    h_2e2332fa455a2146: "contract", // cache.ttlSeconds.receipts
    h_3822ea0f7192c70e: "contract", // receipts config section
    h_88747b653fc82f6d: "logic", // import
    h_5c94b39812b2e8f8: "contract", // GET /orders/:id/receipt
  },
  decisions: [
    {
      description: "Raises the API rate limit tenfold, from 60 to 600 requests per minute",
      mustHave: true,
    },
    {
      description:
        "Caches rendered receipts in an in-process Map with no eviction or size limit (memory grows, not shared between instances)",
      mustHave: true,
    },
    {
      description:
        "Hard-codes the receipt cache lifetime to one hour instead of reading the cache.ttlSeconds.receipts setting it adds",
      mustHave: true,
    },
    {
      description: "Adds a public GET /orders/:id/receipt endpoint returning plain text",
      mustHave: false,
    },
    {
      description:
        "Serves a cached receipt even if the order changed since (refunds, cancellations) for up to an hour",
      mustHave: false,
    },
  ],
  mismatches: [
    { kind: "unrequested", description: "The rate limit is raised from 60 to 600 per minute" },
    {
      kind: "missing",
      description:
        "The ticket asks for a configurable cache lifetime, but the code uses a hard-coded hour",
    },
  ],
};
