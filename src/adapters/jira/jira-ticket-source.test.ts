import { describe, expect, it } from "vitest";
import {
  bitbucketBugfix,
  createFixtureFetch,
  describeTicketSourceContract,
  type RecordedExchange,
  RecordingLogger,
  smallFeature,
} from "../../application/testing/index.ts";
import readExchanges from "./fixtures/read.synthetic.json" with { type: "json" };
import unauthorizedExchanges from "./fixtures/unauthorized.synthetic.json" with { type: "json" };
import {
  createJiraTicketSource,
  createUnconfiguredTicketSource,
  parseJiraBaseUrl,
} from "./index.ts";
import { MAX_IN_FLIGHT } from "./jira-ticket-source.ts";

const SITE = "https://example.atlassian.net";
const issueUrl = (key: string) =>
  `${SITE}/rest/api/3/issue/${key}?fields=summary,description,issuetype,status`;

const sourceWith = (fetch: typeof globalThis.fetch, logger = new RecordingLogger()) =>
  createJiraTicketSource({
    baseUrl: `${SITE}/`,
    email: "reviewer@example.com",
    apiToken: "test-token",
    fetch,
    logger,
  });

const fixtureSource = (exchanges: readonly RecordedExchange[]) =>
  sourceWith(createFixtureFetch(exchanges));

describeTicketSourceContract("jira", {
  configured: {
    source: (scenario) => fixtureSource(scenario === "ok" ? readExchanges : unauthorizedExchanges),
    existingKeys: ["SHOP-123", "PAY-42", "SHOP-130", "SHOP-131"],
    missingKeys: ["SHOP-999", "HTTP-2"],
  },
});

describeTicketSourceContract("jira (unconfigured)", {
  unconfigured: createUnconfiguredTicketSource,
});

/** Lets every pending promise callback run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** A fetch whose responses resolve only when the test says so, to observe concurrency. */
const controlledFetch = (respond: (key: string) => Response) => {
  const pending: { key: string; resolve: () => void }[] = [];
  const requested: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch: typeof globalThis.fetch = (input) => {
    const key = /\/issue\/([^?]+)/.exec(String(input))?.[1] ?? "";
    requested.push(key);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise((resolve) => {
      pending.push({
        key,
        resolve: () => {
          inFlight -= 1;
          resolve(respond(key));
        },
      });
    });
  };
  /** Answers the pending requests (for `key`, or all), then lets the source send the next ones. */
  const answer = async (key?: string) => {
    const answered = pending.filter((request) => key === undefined || request.key === key);
    for (const request of answered) {
      pending.splice(pending.indexOf(request), 1);
      request.resolve();
    }
    await settle();
  };
  return {
    fetch,
    requested,
    answer,
    get maxInFlight() {
      return maxInFlight;
    },
  };
};

const issue = (key: string) =>
  Response.json({
    key,
    fields: {
      summary: `Summary of ${key}`,
      description: null,
      issuetype: { name: "Task" },
      status: { name: "Done" },
    },
  });

describe("createJiraTicketSource", () => {
  it("maps issues to the same tickets as the shared fixtures", async () => {
    const result = await fixtureSource(readExchanges).getTickets(["SHOP-123", "PAY-42"]);
    expect(result).toEqual({
      ok: true,
      value: { found: [...smallFeature.tickets, ...bitbucketBugfix.tickets], missing: [] },
    });
  });

  it("turns a rich description into text", async () => {
    const result = await fixtureSource(readExchanges).getTickets(["SHOP-130"]);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.found[0]?.description).toBe(
      [
        "## Receipt format",
        "",
        "Serve receipts from `GET /orders/:id/receipt` as plain text.",
        "Ask @Alex Reviewer before changing the layout :white_check_mark:",
        "",
        "- Header with the order number",
        "- One line per item:",
        "  1. name",
        "  2. quantity",
        "  3. price",
        "- Totals",
        "",
        "```text",
        "Order #1042",
        "Widget x2  $10.00",
        "```",
        "",
        "> Receipts are for customers, not accountants.",
        "",
        "Follows https://example.atlassian.net/browse/SHOP-123",
        "",
        "https://example.com/docs/receipts",
        "",
        "Field | Source",
        "Total | `order.totalCents`",
        "",
        "---",
        "",
        "Cache lifetime comes from RECEIPT_CACHE_TTL.",
      ].join("\n"),
    );
  });

  it("gives an issue without a description an empty one", async () => {
    const result = await fixtureSource(readExchanges).getTickets(["SHOP-131"]);
    expect(result.ok && result.value.found[0]).toEqual({
      key: "SHOP-131",
      url: `${SITE}/browse/SHOP-131`,
      summary: "Add a receipt link to order emails",
      description: "",
      type: "Task",
      status: "To Do",
    });
  });

  it("returns found and missing keys in the order asked, once each", async () => {
    const logger = new RecordingLogger();
    const source = sourceWith(createFixtureFetch(readExchanges), logger);
    const result = await source.getTickets(["SHOP-999", "PAY-42", "SHOP-123", "PAY-42", "HTTP-2"]);
    if (!result.ok) throw new Error(result.error.message);

    expect(result.value.found.map((ticket) => ticket.key)).toEqual(["PAY-42", "SHOP-123"]);
    expect(result.value.missing).toEqual(["SHOP-999", "HTTP-2"]);
    expect(logger.entries).toEqual([
      {
        level: "debug",
        message: "Fetched Jira tickets",
        fields: { found: 2, missing: ["SHOP-999", "HTTP-2"] },
      },
    ]);
  });

  it("keeps the key the PR mentions when Jira answers with a moved issue's new key", async () => {
    const source = sourceWith(async () => issue("NEW-7"));
    const result = await source.getTickets(["OLD-3"]);
    expect(result.ok && result.value.found.map(({ key, url }) => ({ key, url }))).toEqual([
      { key: "OLD-3", url: `${SITE}/browse/OLD-3` },
    ]);
  });

  it("sends Basic auth and asks only for the fields it reads", async () => {
    const requests: Request[] = [];
    const source = sourceWith(async (input, init) => {
      requests.push(new Request(input, init));
      return issue("SHOP-1");
    });
    await source.getTickets(["SHOP-1"]);

    expect(requests.map((request) => request.url)).toEqual([issueUrl("SHOP-1")]);
    expect(requests[0]?.headers.get("authorization")).toBe(
      `Basic ${Buffer.from("reviewer@example.com:test-token").toString("base64")}`,
    );
  });

  it(`has at most ${MAX_IN_FLIGHT} requests in flight`, async () => {
    const keys = Array.from({ length: 12 }, (_, index) => `SHOP-${index + 1}`);
    const jira = controlledFetch(issue);
    const result = sourceWith(jira.fetch).getTickets(keys);

    await settle();
    expect(jira.requested).toHaveLength(MAX_IN_FLIGHT);
    while (jira.requested.length < keys.length) await jira.answer();
    await jira.answer();

    expect(jira.maxInFlight).toBe(MAX_IN_FLIGHT);
    expect([...jira.requested].sort()).toEqual([...keys].sort());
    const tickets = await result;
    expect(tickets.ok && tickets.value.found.map((ticket) => ticket.key)).toEqual(keys);
  });

  it("stops sending requests once Jira rejects the credentials", async () => {
    const keys = Array.from({ length: 12 }, (_, index) => `SHOP-${index + 1}`);
    const jira = controlledFetch((key) =>
      key === "SHOP-2" ? new Response("", { status: 401 }) : issue(key),
    );
    const result = sourceWith(jira.fetch).getTickets(keys);
    await settle();
    await jira.answer("SHOP-2");
    await jira.answer();

    expect(jira.requested).toEqual(["SHOP-1", "SHOP-2", "SHOP-3", "SHOP-4", "SHOP-5"]);
    const tickets = await result;
    expect(!tickets.ok && tickets.error.kind).toBe("unauthorized");
  });

  it("fails the whole lookup on an unexpected answer, rather than dropping the ticket", async () => {
    const source = sourceWith(async (input) =>
      String(input).includes("SHOP-2") ? new Response("", { status: 500 }) : issue("SHOP-1"),
    );
    expect(await source.getTickets(["SHOP-1", "SHOP-2"])).toEqual({
      ok: false,
      error: { kind: "unexpected", message: "Jira answered 500" },
    });
  });

  it("returns network when Jira can't be reached", async () => {
    const source = sourceWith(async () => {
      throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") });
    });
    expect(await source.getTickets(["SHOP-1"])).toEqual({
      ok: false,
      error: { kind: "network", message: "Can't reach Jira: connect ECONNREFUSED" },
    });
  });

  it("rethrows anything fetch throws that isn't a network failure", async () => {
    const source = sourceWith(async () => {
      throw new RangeError("a bug");
    });
    await expect(source.getTickets(["SHOP-1"])).rejects.toThrow("a bug");
  });

  it("returns invalid-response for a body that isn't JSON", async () => {
    const source = sourceWith(async () => new Response("<html>login</html>", { status: 200 }));
    expect(await source.getTickets(["SHOP-1"])).toEqual({
      ok: false,
      error: {
        kind: "invalid-response",
        message: "Unexpected response from Jira for SHOP-1: the body isn't JSON",
      },
    });
  });

  it("returns invalid-response for an issue missing fields", async () => {
    const source = sourceWith(async () => Response.json({ key: "SHOP-1", fields: {} }));
    const result = await source.getTickets(["SHOP-1"]);
    expect(!result.ok && result.error.kind).toBe("invalid-response");
    expect(!result.ok && result.error.message).toContain("summary");
  });

  it("refuses a base URL the composition root should have rejected", () => {
    expect(() =>
      createJiraTicketSource({
        baseUrl: "http://example.atlassian.net",
        email: "reviewer@example.com",
        apiToken: "test-token",
        logger: new RecordingLogger(),
      }),
    ).toThrow("JIRA_BASE_URL must start with https://");
  });
});

describe("parseJiraBaseUrl", () => {
  it.each([
    ["https://example.atlassian.net", "https://example.atlassian.net"],
    [" https://example.atlassian.net// ", "https://example.atlassian.net"],
    ["https://jira.example.com/jira/", "https://jira.example.com/jira"],
  ])("normalizes %j", (raw, expected) => {
    expect(parseJiraBaseUrl(raw)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["example.atlassian.net", "JIRA_BASE_URL must be a URL"],
    ["http://example.atlassian.net", "JIRA_BASE_URL must start with https://"],
    ["https://example.atlassian.net/?a=1", "JIRA_BASE_URL must be just the site's address"],
    ["https://user:pass@example.atlassian.net", "JIRA_BASE_URL must be just the site's address"],
  ])("rejects %j", (raw, message) => {
    const result = parseJiraBaseUrl(raw);
    expect(!result.ok && result.error).toContain(message);
  });
});

describe("createUnconfiguredTicketSource", () => {
  it("says which variables to set", async () => {
    const result = await createUnconfiguredTicketSource().getTickets(["SHOP-1"]);
    expect(!result.ok && result.error.message).toBe(
      "Jira isn't configured. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.",
    );
  });
});
