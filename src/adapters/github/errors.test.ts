import { describe, expect, it } from "vitest";
import type { HostError } from "../../domain/review/index.ts";
import { fromErrorResponse, fromOctokitError, type GitHubErrorResponse } from "./errors.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const NOW_EPOCH = 1_767_225_600;

const response = (
  status: number,
  data: unknown = { message: "Something" },
  headers: Record<string, string> = {},
): GitHubErrorResponse => ({ status, headers, data });

describe("fromErrorResponse", () => {
  const cases: [name: string, response: GitHubErrorResponse, expected: Partial<HostError>][] = [
    ["401", response(401), { kind: "unauthorized" }],
    [
      "403 with x-ratelimit-remaining: 0",
      response(403, undefined, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(NOW_EPOCH + 90),
      }),
      { kind: "rate-limited", retryAfterSeconds: 90 },
    ],
    [
      "403 with a reset in the past",
      response(403, undefined, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(NOW_EPOCH - 5),
      }),
      { kind: "rate-limited", retryAfterSeconds: 0 },
    ],
    [
      "403 with retry-after (secondary rate limit)",
      response(403, undefined, { "retry-after": "60" }),
      { kind: "rate-limited", retryAfterSeconds: 60 },
    ],
    [
      "429 with retry-after",
      response(429, undefined, { "retry-after": "30", "x-ratelimit-reset": String(NOW_EPOCH) }),
      { kind: "rate-limited", retryAfterSeconds: 30 },
    ],
    ["429 without a delay", response(429), { kind: "rate-limited", retryAfterSeconds: null }],
    [
      "other 403",
      response(
        403,
        { message: "Resource not accessible by integration" },
        {
          "x-ratelimit-remaining": "4999",
        },
      ),
      {
        kind: "forbidden",
        message: "GitHub refused the request: Resource not accessible by integration",
      },
    ],
    [
      "404",
      response(404),
      {
        kind: "not-found",
        message:
          "Not found on GitHub. If the repository is private, the token may lack access to it.",
      },
    ],
    [
      "406",
      response(406, { message: "Sorry, the diff exceeded the maximum number of files" }),
      {
        kind: "too-large",
      },
    ],
    [
      "422 for a diff that's too large",
      response(422, { message: "The diff is taking too long to generate." }),
      { kind: "too-large" },
    ],
    [
      "other 422",
      response(422, {
        message: "Unprocessable Entity",
        errors: [
          "Pull request review thread line must be part of the diff",
          { message: "and another" },
          { code: "custom" },
        ],
      }),
      {
        kind: "rejected",
        message:
          "Unprocessable Entity: Pull request review thread line must be part of the diff; and another",
      },
    ],
    [
      "422 without details",
      response(422, { message: "Validation Failed" }),
      {
        kind: "rejected",
        message: "Validation Failed",
      },
    ],
    [
      "5xx",
      response(502, "<html>Bad gateway</html>"),
      {
        kind: "unexpected",
        message: "GitHub answered 502: GitHub answered 502",
      },
    ],
    [
      "other status",
      response(409, { message: "Conflict" }),
      {
        kind: "unexpected",
        message: "GitHub answered 409: Conflict",
      },
    ],
  ];

  it.each(cases)("maps %s", (_, errorResponse, expected) => {
    const error = fromErrorResponse(errorResponse, NOW);
    expect(error).toMatchObject(expected);
    if (error.kind !== "rate-limited") expect(error.retryAfterSeconds).toBeNull();
  });

  it("ignores a retry-after that isn't a number of seconds", () => {
    const error = fromErrorResponse(
      response(429, undefined, { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }),
      NOW,
    );
    expect(error.retryAfterSeconds).toBeNull();
  });
});

describe("fromOctokitError", () => {
  it("maps a request error without a response to network", () => {
    const error = Object.assign(new Error("connect ECONNREFUSED"), { status: 500 });
    expect(fromOctokitError(error, NOW)).toEqual({
      kind: "network",
      message: "Can't reach GitHub: connect ECONNREFUSED",
      retryAfterSeconds: null,
    });
  });

  it("maps a request error with a response by its status", () => {
    const error = Object.assign(new Error("Bad credentials"), {
      status: 401,
      response: { status: 401, headers: {}, data: { message: "Bad credentials" } },
    });
    expect(fromOctokitError(error, NOW).kind).toBe("unauthorized");
  });

  it("rethrows anything else, since it's a bug", () => {
    const bug = new TypeError("x is undefined");
    expect(() => fromOctokitError(bug, NOW)).toThrow(bug);
  });
});
