// Records issue fixtures: node src/adapters/jira/fixtures/record.ts <key…>
// with JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN set. Writes read.json next to this file.
//
// The site becomes example.atlassian.net, mentions become "@person-N" and email addresses
// someone@example.com. Names written as plain text can't be found automatically: read the
// output and replace them by hand before committing it.

import { writeFile } from "node:fs/promises";
import { createJiraTicketSource, parseJiraBaseUrl } from "../jira-ticket-source.ts";
import { type AdfNode, JiraErrorBody, JiraIssue } from "../schemas.ts";

/** The format of createFixtureFetch in src/application/testing, which non-test code can't import. */
interface RecordedExchange {
  request: { method: string; url: string; accept?: string; body?: unknown };
  response: { status: number; headers: Record<string, string>; body: unknown };
}

const FIXTURE_HOST = "example.atlassian.net";
const KEPT_HEADERS = /^(retry-after|content-type|x-seraph-loginreason)$/;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

const createRedactor = (host: string) => {
  const people = new Map<string, string>();
  const person = (id: string): string => {
    const name = people.get(id) ?? `person-${people.size + 1}`;
    people.set(id, name);
    return name;
  };
  const string = (value: string): string =>
    value.replaceAll(host, FIXTURE_HOST).replace(EMAIL, "someone@example.com");

  const attrs = (node: AdfNode): Record<string, unknown> | undefined => {
    if (node.attrs === undefined) return undefined;
    if (node.type === "mention") {
      const name = person(String(node.attrs.id ?? ""));
      return { ...node.attrs, id: name, text: `@${name}` };
    }
    return Object.fromEntries(
      Object.entries(node.attrs).map(([name, value]) => [
        name,
        typeof value === "string" ? string(value) : value,
      ]),
    );
  };

  const node = (value: AdfNode): AdfNode => ({
    type: value.type,
    ...(value.text === undefined ? {} : { text: string(value.text) }),
    ...(value.attrs === undefined ? {} : { attrs: attrs(value) }),
    ...(value.marks === undefined ? {} : { marks: value.marks }),
    ...(value.content === undefined ? {} : { content: value.content.map(node) }),
  });

  return { string, node };
};

const main = async (): Promise<void> => {
  const keys = process.argv.slice(2);
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  if (keys.length === 0 || !JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error(
      "usage: JIRA_BASE_URL=... JIRA_EMAIL=... JIRA_API_TOKEN=... node record.ts <key…>",
    );
  }
  const site = parseJiraBaseUrl(JIRA_BASE_URL);
  if (!site.ok) throw new Error(site.error);
  const redact = createRedactor(new URL(site.value).host);

  /** Only the fields the adapter reads, with personal data replaced. */
  const prune = (status: number, text: string): unknown => {
    if (status >= 400) {
      try {
        return JiraErrorBody.parse(JSON.parse(text));
      } catch {
        return redact.string(text);
      }
    }
    const { key, fields } = JiraIssue.parse(JSON.parse(text));
    return {
      key,
      fields: {
        summary: redact.string(fields.summary),
        description: fields.description == null ? null : redact.node(fields.description),
        issuetype: { name: fields.issuetype.name },
        status: { name: fields.status.name },
      },
    };
  };

  const exchanges: RecordedExchange[] = [];
  const recordingFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const response = await fetch(request);
    exchanges.push({
      request: {
        method: request.method,
        url: redact.string(request.url),
        accept: request.headers.get("accept") ?? "",
      },
      response: {
        status: response.status,
        headers: Object.fromEntries(
          [...response.headers].filter(([name]) => KEPT_HEADERS.test(name)),
        ),
        body: prune(response.status, await response.clone().text()),
      },
    });
    return response;
  };

  const log = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };
  const source = createJiraTicketSource({
    baseUrl: site.value,
    email: JIRA_EMAIL,
    apiToken: JIRA_API_TOKEN,
    fetch: recordingFetch,
    logger: { debug: log, info: log, warn: log, error: log },
  });
  const result = await source.getTickets(keys);
  if (!result.ok) throw new Error(result.error.message);

  const out = new URL("read.json", import.meta.url);
  await writeFile(out, `${JSON.stringify(exchanges, null, 2)}\n`);
  log(`wrote ${exchanges.length} exchanges to ${out.pathname}; check them for names by hand`);
};

await main();
