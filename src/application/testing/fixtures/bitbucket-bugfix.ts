import type { PullRequestFixture } from "./fixture.ts";

const baseFiles: Readonly<Record<string, string>> = {
  "src/refunds.ts": `import type { Order, Payment } from "./types.ts";

/** The amount that can still be refunded for an order, in cents. */
export function refundAmount(order: Order): number {
  const payment: Payment = order.originalPayment;
  const refundable = payment.capturedCents - payment.refundedCents;
  return Math.max(0, Math.min(refundable, order.totalCents));
}

export function canRefund(order: Order): boolean {
  return order.status === "paid" && refundAmount(order) > 0;
}
`,
};

const headFiles: Readonly<Record<string, string>> = {
  "src/refunds.test.ts": `import { describe, expect, it } from "vitest";
import { refundAmount } from "./refunds.ts";
import { makeOrder } from "./test-helpers.ts";

describe("refundAmount", () => {
  it("refunds what was captured and not yet refunded", () => {
    const order = makeOrder({ totalCents: 5000, capturedCents: 5000, refundedCents: 1000 });
    expect(refundAmount(order)).toBe(4000);
  });

  it("returns 0 for an order paid with store credit", () => {
    const order = makeOrder({ totalCents: 5000, originalPayment: null });
    expect(refundAmount(order)).toBe(0);
  });
});
`,
  "src/refunds.ts": `import type { Order, Payment } from "./types.ts";

/** The amount that can still be refunded for an order, in cents. */
export function refundAmount(order: Order): number {
  const payment: Payment | null = order.originalPayment;
  // Orders paid entirely with store credit have no original payment to refund to.
  if (payment === null) {
    return 0;
  }
  const refundable = payment.capturedCents - payment.refundedCents;
  return Math.max(0, Math.min(refundable, order.totalCents));
}

export function canRefund(order: Order): boolean {
  return order.status === "paid" && refundAmount(order) > 0;
}
`,
};

const diff = `diff --git a/src/refunds.test.ts b/src/refunds.test.ts
new file mode 100644
index 0000000..483e8d2
--- /dev/null
+++ b/src/refunds.test.ts
@@ -0,0 +1,15 @@
+import { describe, expect, it } from "vitest";
+import { refundAmount } from "./refunds.ts";
+import { makeOrder } from "./test-helpers.ts";
+
+describe("refundAmount", () => {
+  it("refunds what was captured and not yet refunded", () => {
+    const order = makeOrder({ totalCents: 5000, capturedCents: 5000, refundedCents: 1000 });
+    expect(refundAmount(order)).toBe(4000);
+  });
+
+  it("returns 0 for an order paid with store credit", () => {
+    const order = makeOrder({ totalCents: 5000, originalPayment: null });
+    expect(refundAmount(order)).toBe(0);
+  });
+});
diff --git a/src/refunds.ts b/src/refunds.ts
index 45af9ce..f9c3fd5 100644
--- a/src/refunds.ts
+++ b/src/refunds.ts
@@ -2,7 +2,11 @@ import type { Order, Payment } from "./types.ts";
 
 /** The amount that can still be refunded for an order, in cents. */
 export function refundAmount(order: Order): number {
-  const payment: Payment = order.originalPayment;
+  const payment: Payment | null = order.originalPayment;
+  // Orders paid entirely with store credit have no original payment to refund to.
+  if (payment === null) {
+    return 0;
+  }
   const refundable = payment.capturedCents - payment.refundedCents;
   return Math.max(0, Math.min(refundable, order.totalCents));
 }
`;

export const bitbucketBugfix: PullRequestFixture = {
  name: "bitbucket-bugfix",
  pullRequest: {
    ref: { repo: { host: "bitbucket", owner: "acme", repo: "payments" }, number: 42 },
    url: "https://bitbucket.org/acme/payments/pull-requests/42",
    title: "Fix crash when refunding store-credit orders",
    description:
      "Orders paid entirely with store credit have no original payment, and `refundAmount` crashed on them. Return 0 for those orders and cover it with a test.",
    author: { id: "{3f2a8c1e-6b1d-4e0f-9a7c-2d5b8e1f4a60}", name: "Sam Rivera" },
    sourceBranch: "PAY-42-fix-null",
    targetBranch: "main",
    baseSha: "847b1ce73ee01424aff64c6bfb87ef38efc427bb",
    headSha: "f00430e949e2f539c202313f00322f320ac00b6e",
    commits: [
      {
        sha: "923ad9f508e16f81fa730b7f9b9d292be843e871",
        message: "Return 0 refund when there is no original payment",
        author: "Sam Rivera",
      },
      {
        sha: "f00430e949e2f539c202313f00322f320ac00b6e",
        message: "Test refunds for store-credit orders",
        author: "Sam Rivera",
      },
    ],
    diff,
    createdAt: "2026-10-17T13:05:00Z",
    updatedAt: "2026-10-17T15:40:12Z",
  },
  baseFiles,
  headFiles,
  tickets: [
    {
      key: "PAY-42",
      url: "https://example.atlassian.net/browse/PAY-42",
      summary: "Refund page crashes for store-credit orders",
      description:
        "Opening the refund dialog for an order paid with store credit shows a 500. Stack trace points at refundAmount reading capturedCents of null.",
      type: "Bug",
      status: "In Progress",
    },
  ],
};
