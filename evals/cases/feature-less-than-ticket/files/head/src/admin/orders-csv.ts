import type { Order } from "../services/orders.ts";

const HEADER = ["id", "created", "total", "status"];

/** One line per order, totals in currency units. */
export function ordersCsv(orders: readonly Order[]): string {
  const rows = orders.map((order) =>
    [
      order.id,
      order.createdAt.toISOString().slice(0, 10),
      (order.totalCents / 100).toFixed(2),
      order.status,
    ].join(","),
  );
  return [HEADER.join(","), ...rows].join("\n");
}
