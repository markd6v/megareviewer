import { z } from "zod";
import type { TicketError, TicketErrorKind } from "../../domain/review/index.ts";
import { JiraErrorBody } from "./schemas.ts";

export interface JiraErrorResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: string;
}

const ticketError = (kind: TicketErrorKind, message: string): TicketError => ({ kind, message });

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Jira's own messages, or null when it gave none. */
const jiraMessage = (response: JiraErrorResponse): string | null => {
  const body = JiraErrorBody.safeParse(parseJson(response.body));
  if (!body.success) {
    // Anything long or HTML is a proxy's or a login page.
    const text = response.body.trim();
    return text === "" || text.length > 200 || text.startsWith("<") ? null : text;
  }
  const messages = [
    ...(body.data.errorMessages ?? []),
    ...Object.values(body.data.errors ?? {}),
  ].filter((message) => message !== "");
  return messages.length === 0 ? null : messages.join(" ");
};

const withMessage = (prefix: string, message: string | null): string =>
  message === null ? prefix : `${prefix}: ${message}`;

/**
 * Maps an error response other than 404 (a missing ticket, not an error) to a TicketError.
 * TicketError has no forbidden or rate-limited kinds: a 403 means the credentials can't read
 * Jira, and a rate limit fails the lookup with a message saying when to retry.
 */
export const fromErrorResponse = (response: JiraErrorResponse): TicketError => {
  const { status, headers } = response;
  const message = jiraMessage(response);

  if (status === 401) {
    return ticketError(
      "unauthorized",
      "Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN.",
    );
  }
  if (status === 403) {
    // Atlassian asks for a CAPTCHA after repeated failed logins and says so in this header.
    if (headers.get("x-seraph-loginreason")?.includes("AUTHENTICATION_DENIED")) {
      return ticketError(
        "unauthorized",
        "Jira wants a CAPTCHA after failed logins. Sign in to Jira in a browser once, then retry.",
      );
    }
    return ticketError("unauthorized", withMessage("Jira refused the request", message));
  }
  if (status === 429) {
    const retryAfter = headers.get("retry-after");
    const prefix =
      retryAfter !== null && /^\d+$/.test(retryAfter.trim())
        ? `Jira rate limit reached; retry in ${retryAfter.trim()} seconds`
        : "Jira rate limit reached";
    return ticketError("unexpected", withMessage(prefix, message));
  }
  return ticketError("unexpected", withMessage(`Jira answered ${status}`, message));
};

/** What `fetch` throws when it can't reach the host: a TypeError, usually with a cause. */
export const networkError = (error: TypeError): TicketError => {
  const cause = error.cause instanceof Error ? error.cause.message : error.message;
  return ticketError("network", `Can't reach Jira: ${cause}`);
};

export const invalidResponse = (key: string, error: z.ZodError | string): TicketError =>
  ticketError(
    "invalid-response",
    `Unexpected response from Jira for ${key}: ${
      typeof error === "string" ? error : z.prettifyError(error)
    }`,
  );
