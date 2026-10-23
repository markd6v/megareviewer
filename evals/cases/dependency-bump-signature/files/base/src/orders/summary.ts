import { formatPrice } from "../money/format.ts";

export interface Order {
  id: string;
  currency: string;
  lines: { name: string; quantity: number; unitCents: number }[];
}

export function orderSummary(order: Order): string[] {
  const lines = order.lines.map(
    (line) => `${line.quantity} × ${line.name}: ${formatPrice(line.quantity * line.unitCents)}`,
  );
  const total = order.lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
  return [...lines, `Total: ${formatPrice(total)}`];
}
