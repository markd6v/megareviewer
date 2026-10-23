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

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await postCharge(request);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
