import { describe, expect, it } from "vitest";
import type { TicketError } from "../../domain/review/index.ts";
import { fromErrorResponse, type JiraErrorResponse, networkError } from "./errors.ts";

const response = (
  status: number,
  body: unknown = { errorMessages: ["Something"], errors: {} },
  headers: Record<string, string> = {},
): JiraErrorResponse => ({
  status,
  headers: new Headers(headers),
  body: typeof body === "string" ? body : JSON.stringify(body),
});

describe("fromErrorResponse", () => {
  const cases: [name: string, response: JiraErrorResponse, expected: TicketError][] = [
    [
      "401",
      response(401, "Client must be authenticated to access this resource."),
      {
        kind: "unauthorized",
        message: "Jira rejected the credentials. Check JIRA_EMAIL and JIRA_API_TOKEN.",
      },
    ],
    [
      "403 asking for a CAPTCHA",
      response(403, "", { "x-seraph-loginreason": "AUTHENTICATION_DENIED" }),
      {
        kind: "unauthorized",
        message:
          "Jira wants a CAPTCHA after failed logins. Sign in to Jira in a browser once, then retry.",
      },
    ],
    [
      "403 with Jira's messages",
      response(403, { errorMessages: ["You don't have access to Jira."], errors: {} }),
      { kind: "unauthorized", message: "Jira refused the request: You don't have access to Jira." },
    ],
    [
      "429 with retry-after",
      response(429, "", { "retry-after": "12" }),
      { kind: "unexpected", message: "Jira rate limit reached; retry in 12 seconds" },
    ],
    [
      "429 with a date in retry-after",
      response(
        429,
        { errorMessages: ["Rate limit exceeded."] },
        {
          "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT",
        },
      ),
      { kind: "unexpected", message: "Jira rate limit reached: Rate limit exceeded." },
    ],
    [
      "500 with field errors",
      response(500, { errorMessages: [""], errors: { fields: "Field 'x' is broken." } }),
      { kind: "unexpected", message: "Jira answered 500: Field 'x' is broken." },
    ],
    [
      "502 with an HTML page",
      response(502, "<html><body>Bad gateway</body></html>"),
      { kind: "unexpected", message: "Jira answered 502" },
    ],
    [
      "503 with a long text body",
      response(503, "x".repeat(201)),
      { kind: "unexpected", message: "Jira answered 503" },
    ],
    [
      "500 with an empty JSON body",
      response(500, { errorMessages: [], errors: {} }),
      { kind: "unexpected", message: "Jira answered 500" },
    ],
  ];

  it.each(cases)("maps %s", (_, input, expected) => {
    expect(fromErrorResponse(input)).toEqual(expected);
  });
});

describe("networkError", () => {
  it("names the cause", () => {
    const error = new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND") });
    expect(networkError(error)).toEqual({
      kind: "network",
      message: "Can't reach Jira: getaddrinfo ENOTFOUND",
    });
  });

  it("falls back to the error's own message", () => {
    expect(networkError(new TypeError("fetch failed")).message).toBe(
      "Can't reach Jira: fetch failed",
    );
  });
});
