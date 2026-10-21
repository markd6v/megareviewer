import { describe, expect, it } from "vitest";
import type { HostError } from "../../domain/review/index.ts";
import { type BitbucketErrorResponse, type CallKind, fromErrorResponse } from "./errors.ts";

const response = (
  status: number,
  body: unknown = { type: "error", error: { message: "Something" } },
  headers: Record<string, string> = {},
): BitbucketErrorResponse => ({
  status,
  headers: new Headers(headers),
  body: typeof body === "string" ? body : JSON.stringify(body),
});

describe("fromErrorResponse", () => {
  const cases: [
    name: string,
    response: BitbucketErrorResponse,
    call: CallKind,
    expected: Partial<HostError>,
  ][] = [
    ["401", response(401, ""), "read", { kind: "unauthorized" }],
    [
      "429 with retry-after",
      response(429, "Rate limit for this resource has been exceeded", {
        "retry-after": "30",
        "x-ratelimit-reset": "1150",
      }),
      "read",
      {
        kind: "rate-limited",
        message: "Bitbucket rate limit reached: Rate limit for this resource has been exceeded",
        retryAfterSeconds: 30,
      },
    ],
    [
      "429 with x-ratelimit-reset only",
      response(429, "", { "x-ratelimit-reset": "1150" }),
      "read",
      { kind: "rate-limited", retryAfterSeconds: 1150 },
    ],
    [
      "429 without a delay",
      response(429, "", { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }),
      "read",
      { kind: "rate-limited", retryAfterSeconds: 60 },
    ],
    [
      "403 for missing scopes",
      response(403, {
        type: "error",
        error: {
          message: "Your credentials lack one or more required privilege scopes.",
          detail: { required: ["read:user:bitbucket"], granted: [] },
        },
      }),
      "read",
      {
        kind: "forbidden",
        message:
          "Bitbucket refused the request: Your credentials lack one or more required privilege scopes. Needed: read:user:bitbucket.",
      },
    ],
    [
      "404 as plain text",
      response(404, "Not Found"),
      "read",
      {
        kind: "not-found",
        message:
          "Not found on Bitbucket. If the repository is private, the API token may lack access to it.",
      },
    ],
    ["555 (diff timed out)", response(555), "read", { kind: "too-large" }],
    [
      "400 on a publishing call, with a detail",
      response(400, {
        type: "error",
        error: { message: "Bad request", detail: "Line not in diff" },
      }),
      "publish",
      { kind: "rejected", message: "Bad request: Line not in diff" },
    ],
    [
      "409 on a publishing call",
      response(409, { type: "error", error: { message: "Already approved" } }),
      "publish",
      { kind: "rejected", message: "Already approved" },
    ],
    [
      "400 on a read",
      response(400),
      "read",
      { kind: "unexpected", message: "Bitbucket answered 400: Something" },
    ],
    [
      "5xx with an HTML page",
      response(502, "<html><body>Bad gateway</body></html>"),
      "read",
      { kind: "unexpected", message: "Bitbucket answered 502" },
    ],
    [
      "5xx with an empty body",
      response(500, ""),
      "publish",
      { kind: "unexpected", message: "Bitbucket answered 500" },
    ],
    [
      "400 on a publishing call, with no message",
      response(400, ""),
      "publish",
      { kind: "rejected", message: "Bitbucket rejected the request (400)" },
    ],
    [
      "403 with an empty body",
      response(403, ""),
      "read",
      { kind: "forbidden", message: "Bitbucket refused the request" },
    ],
  ];

  it.each(cases)("maps %s", (_, errorResponse, call, expected) => {
    expect(fromErrorResponse(errorResponse, call)).toMatchObject(expected);
  });

  it("sets a retry delay only for rate limits", () => {
    expect(fromErrorResponse(response(403), "read").retryAfterSeconds).toBeNull();
  });
});
