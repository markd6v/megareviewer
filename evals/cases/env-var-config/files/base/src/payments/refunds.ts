import { config } from "../config.ts";

export async function refund(chargeId: string, amountCents: number): Promise<void> {
  const response = await fetch(`${config.paymentsUrl}/v1/refunds`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.paymentsApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ charge: chargeId, amount: amountCents }),
  });
  if (!response.ok) throw new Error(`refund failed with ${response.status}`);
}
