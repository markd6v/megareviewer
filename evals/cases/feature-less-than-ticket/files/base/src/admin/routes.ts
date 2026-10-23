import { Router } from "express";
import { requireAdmin } from "../middleware/require-admin.ts";
import { listOrders } from "../services/orders.ts";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/admin/orders", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  res.json(await listOrders({ page, pageSize: 50 }));
});
