import { Router } from "express";
import { requireAdmin } from "../middleware/require-admin.ts";
import { allOrders, listOrders } from "../services/orders.ts";
import { ordersCsv } from "./orders-csv.ts";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/admin/orders", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  res.json(await listOrders({ page, pageSize: 50 }));
});

adminRouter.get("/admin/orders/export.csv", async (_req, res) => {
  const orders = await allOrders();
  res
    .type("text/csv")
    .attachment("orders.csv")
    .send(ordersCsv(orders));
});
