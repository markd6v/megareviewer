import type { Logger, TicketLookup, TicketSource } from "../../application/ports/index.ts";
import type { Ticket, TicketError } from "../../domain/review/index.ts";
import { err, ok, type Result } from "../../domain/shared/index.ts";
import { adfToText } from "./adf.ts";
import { fromErrorResponse, invalidResponse, networkError } from "./errors.ts";
import { JiraIssue } from "./schemas.ts";

export interface JiraTicketSourceOptions {
  /** The site, like https://your-site.atlassian.net. Check it with parseJiraBaseUrl first. */
  readonly baseUrl: string;
  readonly email: string;
  readonly apiToken: string;
  readonly fetch?: typeof fetch;
  readonly logger: Logger;
}

/** Requests in flight at once, so a PR mentioning many keys doesn't hit Jira's rate limit. */
export const MAX_IN_FLIGHT = 5;
const FIELDS = "summary,description,issuetype,status";

/** The site's address without a trailing slash, or why it isn't one. */
export const parseJiraBaseUrl = (raw: string): Result<string, string> => {
  const example = "like https://your-site.atlassian.net";
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return err(`JIRA_BASE_URL must be a URL, ${example}`);
  }
  if (url.protocol !== "https:") return err(`JIRA_BASE_URL must start with https://, ${example}`);
  if (url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") {
    return err(`JIRA_BASE_URL must be just the site's address, ${example}`);
  }
  return ok(`${url.origin}${url.pathname}`.replace(/\/+$/, ""));
};

/**
 * A TicketSource for Jira Cloud. One request per key rather than one JQL search: a search fails
 * entirely if any key doesn't exist, and extracted keys often don't (project-like tokens).
 */
export const createJiraTicketSource = (options: JiraTicketSourceOptions): TicketSource => {
  const baseUrl = parseJiraBaseUrl(options.baseUrl);
  // The composition root checks the URL first, so a bad one here is a bug.
  if (!baseUrl.ok) throw new Error(baseUrl.error);
  const site = baseUrl.value;
  const fetchJira = options.fetch ?? globalThis.fetch;
  const authorization = `Basic ${Buffer.from(`${options.email}:${options.apiToken}`).toString("base64")}`;

  /** The ticket, or null when Jira doesn't know the key or the user can't see it. */
  const fetchTicket = async (key: string): Promise<Result<Ticket | null, TicketError>> => {
    let response: Response;
    try {
      response = await fetchJira(
        `${site}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${FIELDS}`,
        { headers: { accept: "application/json", authorization } },
      );
    } catch (error) {
      // fetch throws a TypeError when it can't connect. Anything else is a bug.
      if (error instanceof TypeError) return err(networkError(error));
      throw error;
    }
    const text = await response.text();
    if (response.status === 404) return ok(null);
    if (!response.ok) {
      return err(
        fromErrorResponse({ status: response.status, headers: response.headers, body: text }),
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return err(invalidResponse(key, "the body isn't JSON"));
    }
    const issue = JiraIssue.safeParse(data);
    if (!issue.success) return err(invalidResponse(key, issue.error));
    const { fields } = issue.data;
    // A moved issue answers to its old key with its new one. Keep the key the PR mentions, so
    // every requested key ends up found or missing; the browse link redirects either way.
    return ok({
      key,
      url: `${site}/browse/${encodeURIComponent(key)}`,
      summary: fields.summary,
      description: adfToText(fields.description),
      type: fields.issuetype.name,
      status: fields.status.name,
    });
  };

  return {
    configured: true,

    async getTickets(keys) {
      const unique = [...new Set(keys)];
      const tickets = new Map<string, Ticket | null>();
      let next = 0;
      let failed = false;

      /** Takes keys until none are left or any request fails, and returns its failure. */
      const worker = async (): Promise<TicketError | null> => {
        for (let key = unique[next]; key !== undefined && !failed; key = unique[next]) {
          next += 1;
          const ticket = await fetchTicket(key);
          if (!ticket.ok) {
            failed = true;
            return ticket.error;
          }
          tickets.set(key, ticket.value);
        }
        return null;
      };

      const workers = Array.from({ length: Math.min(MAX_IN_FLIGHT, unique.length) }, worker);
      const failure = (await Promise.all(workers)).find((error) => error !== null);
      if (failure !== undefined && failure !== null) return err(failure);

      const lookup: TicketLookup = {
        found: unique.flatMap((key) => tickets.get(key) ?? []),
        missing: unique.filter((key) => tickets.get(key) === null),
      };
      options.logger.debug("Fetched Jira tickets", {
        found: lookup.found.length,
        missing: lookup.missing,
      });
      return ok(lookup);
    },
  };
};

export const createUnconfiguredTicketSource = (): TicketSource => ({
  configured: false,
  async getTickets() {
    return err({
      kind: "not-configured",
      message: "Jira isn't configured. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.",
    });
  },
});
