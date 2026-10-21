import type { PullRequestFixture } from "./fixture.ts";

const baseFiles: Readonly<Record<string, string>> = {
  "config/app.yaml": `server:
  port: 8080
  host: 0.0.0.0
  requestTimeoutMs: 10000

database:
  url: postgres://localhost:5432/shop
  poolSize: 10
  statementTimeoutMs: 5000

rateLimit:
  enabled: true
  perMinute: 60
  burst: 20

cache:
  driver: redis
  url: redis://localhost:6379
  ttlSeconds:
    orders: 60
    products: 300

logging:
  level: info
  format: json
  redact:
    - password
    - cardNumber
    - email
    - phone
`,
  "src/routes/orders.ts": `import { Router } from "express";
import { requireUser } from "../auth.ts";
import { cancelOrder, findOrder, listOrders } from "../services/orders.ts";

export const ordersRouter = Router();

ordersRouter.use(requireUser);

ordersRouter.get("/orders", async (req, res) => {
  const orders = await listOrders(req.user.id);
  res.json(orders);
});

ordersRouter.get("/orders/:id", async (req, res) => {
  const order = await findOrder(req.user.id, req.params.id);
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(order);
});

ordersRouter.post("/orders/:id/cancel", async (req, res) => {
  const result = await cancelOrder(req.user.id, req.params.id);
  if (!result.ok) {
    res.status(409).json({ error: result.reason });
    return;
  }
  res.status(204).end();
});
`,
};

const headFiles: Readonly<Record<string, string>> = {
  "config/app.yaml": `server:
  port: 8080
  host: 0.0.0.0
  requestTimeoutMs: 10000

database:
  url: postgres://localhost:5432/shop
  poolSize: 10
  statementTimeoutMs: 5000

rateLimit:
  enabled: true
  perMinute: 600
  burst: 20

cache:
  driver: redis
  url: redis://localhost:6379
  ttlSeconds:
    orders: 60
    products: 300
    receipts: 3600

logging:
  level: info
  format: json
  redact:
    - password
    - cardNumber
    - email
    - phone

receipts:
  currency: USD
  footer: "Thank you for shopping with Acme."
`,
  "src/routes/orders.ts": `import { Router } from "express";
import { requireUser } from "../auth.ts";
import { cancelOrder, findOrder, listOrders } from "../services/orders.ts";
import { renderReceipt } from "../services/receipts.ts";

export const ordersRouter = Router();

ordersRouter.use(requireUser);

ordersRouter.get("/orders", async (req, res) => {
  const orders = await listOrders(req.user.id);
  res.json(orders);
});

ordersRouter.get("/orders/:id", async (req, res) => {
  const order = await findOrder(req.user.id, req.params.id);
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(order);
});

ordersRouter.post("/orders/:id/cancel", async (req, res) => {
  const result = await cancelOrder(req.user.id, req.params.id);
  if (!result.ok) {
    res.status(409).json({ error: result.reason });
    return;
  }
  res.status(204).end();
});

ordersRouter.get("/orders/:id/receipt", async (req, res) => {
  const order = await findOrder(req.user.id, req.params.id);
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.type("text/plain").send(renderReceipt(order));
});
`,
  "src/services/receipts.ts": `import type { Order } from "./orders.ts";

const RECEIPT_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { text: string; expiresAt: number }>();

const formatCents = (cents: number): string => (cents / 100).toFixed(2);

export function renderReceipt(order: Order, now: number = Date.now()): string {
  const cached = cache.get(order.id);
  if (cached && cached.expiresAt > now) {
    return cached.text;
  }
  const lines = order.items.map(
    (item) => \`\${item.quantity} x \${item.name}  \${formatCents(item.priceCents)}\`,
  );
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
  const text = [\`Receipt for order \${order.id}\`, ...lines, \`Total: \${formatCents(total)}\`].join("\\n");
  cache.set(order.id, { text, expiresAt: now + RECEIPT_TTL_MS });
  return text;
}
`,
};

const diff = `diff --git a/config/app.yaml b/config/app.yaml
index ab8739e..b08a563 100644
--- a/config/app.yaml
+++ b/config/app.yaml
@@ -10,7 +10,7 @@ database:
 
 rateLimit:
   enabled: true
-  perMinute: 60
+  perMinute: 600
   burst: 20
 
 cache:
@@ -19,6 +19,7 @@ cache:
   ttlSeconds:
     orders: 60
     products: 300
+    receipts: 3600
 
 logging:
   level: info
@@ -28,3 +29,7 @@ logging:
     - cardNumber
     - email
     - phone
+
+receipts:
+  currency: USD
+  footer: "Thank you for shopping with Acme."
diff --git a/src/routes/orders.ts b/src/routes/orders.ts
index 6197da4..7fc6c84 100644
--- a/src/routes/orders.ts
+++ b/src/routes/orders.ts
@@ -1,6 +1,7 @@
 import { Router } from "express";
 import { requireUser } from "../auth.ts";
 import { cancelOrder, findOrder, listOrders } from "../services/orders.ts";
+import { renderReceipt } from "../services/receipts.ts";
 
 export const ordersRouter = Router();
 
@@ -28,3 +29,12 @@ ordersRouter.post("/orders/:id/cancel", async (req, res) => {
   }
   res.status(204).end();
 });
+
+ordersRouter.get("/orders/:id/receipt", async (req, res) => {
+  const order = await findOrder(req.user.id, req.params.id);
+  if (!order) {
+    res.status(404).json({ error: "not found" });
+    return;
+  }
+  res.type("text/plain").send(renderReceipt(order));
+});
diff --git a/src/services/receipts.ts b/src/services/receipts.ts
new file mode 100644
index 0000000..289de22
--- /dev/null
+++ b/src/services/receipts.ts
@@ -0,0 +1,20 @@
+import type { Order } from "./orders.ts";
+
+const RECEIPT_TTL_MS = 60 * 60 * 1000;
+const cache = new Map<string, { text: string; expiresAt: number }>();
+
+const formatCents = (cents: number): string => (cents / 100).toFixed(2);
+
+export function renderReceipt(order: Order, now: number = Date.now()): string {
+  const cached = cache.get(order.id);
+  if (cached && cached.expiresAt > now) {
+    return cached.text;
+  }
+  const lines = order.items.map(
+    (item) => \`\${item.quantity} x \${item.name}  \${formatCents(item.priceCents)}\`,
+  );
+  const total = order.items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
+  const text = [\`Receipt for order \${order.id}\`, ...lines, \`Total: \${formatCents(total)}\`].join("\\n");
+  cache.set(order.id, { text, expiresAt: now + RECEIPT_TTL_MS });
+  return text;
+}
`;

export const smallFeature: PullRequestFixture = {
  name: "small-feature",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 101 },
    url: "https://github.com/acme/shop/pull/101",
    title: "Add receipt download endpoint",
    description:
      "Customers want to download a receipt for an order (SHOP-123).\n\nAdds `GET /orders/:id/receipt`, which renders a plain-text receipt for one of the user's orders. Receipts are cached for an hour, configurable in `config/app.yaml`.",
    author: { id: "dana-kim", name: "Dana Kim" },
    sourceBranch: "feature/receipts",
    targetBranch: "main",
    baseSha: "307ac3d26d595d8183b57c1e0f368e17ec42d7bc",
    headSha: "ec7f8e0489e3011a207691eeef6ad1840f4a9259",
    commits: [
      {
        sha: "be10d932a62c305d4bcbcf43be6d33a0d19f2097",
        message: "Add receipt rendering service",
        author: "Dana Kim",
      },
      {
        sha: "13fa1b41650d3dc4e2fd7f7d928af0a02fdd25cf",
        message: "Expose GET /orders/:id/receipt",
        author: "Dana Kim",
      },
      {
        sha: "ec7f8e0489e3011a207691eeef6ad1840f4a9259",
        message: "Add receipt settings to config",
        author: "Dana Kim",
      },
    ],
    diff,
    createdAt: "2026-10-19T08:12:00Z",
    updatedAt: "2026-10-20T16:45:30Z",
  },
  baseFiles,
  headFiles,
  tickets: [
    {
      key: "SHOP-123",
      url: "https://example.atlassian.net/browse/SHOP-123",
      summary: "Let customers download order receipts",
      description:
        "Customers ask support for receipts several times a day. Add a way to download a plain-text receipt for any order from the order page. Receipts should be cached so repeated downloads are cheap; the cache lifetime must be configurable.",
      type: "Story",
      status: "In Review",
    },
  ],
};
