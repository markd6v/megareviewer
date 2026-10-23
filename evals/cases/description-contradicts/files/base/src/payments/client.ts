import { config } from "../config.ts";

export interface Charge {
  orderId: string;
  amountCents: number;
  currency: string;
  cardToken: string;
}

export interface ChargeResult {
  id: string;
  status: "succeeded" | "declined";
}

export class PaymentsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function postCharge(charge: Charge): Promise<ChargeResult> {
  const response = await fetch(`${config.paymentsUrl}/v1/charges`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.paymentsApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(charge),
  });
  if (!response.ok) {
    throw new PaymentsError(`charge failed with ${response.status}`, response.status);
  }
  return (await response.json()) as ChargeResult;
}

export async function charge(request: Charge): Promise<ChargeResult> {
  return postCharge(request);
}
