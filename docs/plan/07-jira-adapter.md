# Stage 07: Jira adapter

**Status:** Not started
**Depends on:** 02
**Unblocks:** 12
**Owns:** `src/adapters/jira/`

## Goal

A `TicketSource` for Jira Cloud that fetches tickets by key and turns their descriptions into plain text the model can read.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Credentials", "1. Collect"
- Stage 02: `TicketSource` port, `describeTicketSourceContract`, `Ticket`, `TicketError`, `createFixtureFetch`

## Scope

**In:** fetching tickets, ADF-to-text conversion, a not-configured implementation, error mapping.
**Out:** extracting keys from text (stage 02's `extractTicketKeys`); Jira Data Center.

## Tasks

### 1. Construction

```ts
createJiraTicketSource(options: { baseUrl: string; email: string; apiToken: string; fetch?: typeof fetch; logger: Logger }): TicketSource
createUnconfiguredTicketSource(): TicketSource   // configured: false; getTickets returns err({ kind: "not-configured" })
```

Normalize `baseUrl` (trim trailing `/`, require `https://`).

### 2. Fetching

- Fetch each key with `GET /rest/api/3/issue/{key}?fields=summary,description,issuetype,status`, at most 5 at a time.
- Use one request per key rather than a JQL `key in (…)` search: a JQL search fails entirely if any key doesn't exist, and `extractTicketKeys` will produce keys that don't exist (false positives like project-like tokens).
- 404 → the key goes to `missing`. 401 → `unauthorized` for the whole call. Network failure → `network`.
- `url` is `{baseUrl}/browse/{key}`.

### 3. ADF to text: `adf.ts`

Jira Cloud v3 returns descriptions in Atlassian Document Format. Convert to readable plain text with light Markdown:

| ADF node | Output |
|---|---|
| `paragraph` | text + blank line |
| `text` | text (ignore marks except `code` → backticks) |
| `hardBreak` | newline |
| `heading` | `#` × level + text |
| `bulletList` / `orderedList` / `listItem` | `- ` / `1. ` with nesting indentation |
| `codeBlock` | fenced block |
| `blockquote` | `> ` prefix |
| `mention` | `@` + display text |
| `inlineCard` / `blockCard` | the URL |
| `emoji` | its shortName |
| `table` | one line per row, cells separated by ` \| ` |
| `rule` | `---` |
| anything else | recurse into `content`; ignore if none |

Cap the result at 8,000 characters. If cut, end with `\n[description truncated at 8,000 characters]` so the cut is visible (ENGINEERING.md §6, never silently truncate).

### 4. Fixtures

- `fixtures/record.ts <key…>` with `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`: records issue responses, stripping auth and replacing the site host with `example.atlassian.net`. Replace personal names and emails in recorded descriptions.
- Hand-written ADF samples covering every row of the table.

## Tests

- `describeTicketSourceContract("jira", …)` and for the unconfigured source.
- ADF conversion for each node type, nested lists, and the truncation marker.
- Mixed found/missing keys, concurrency limit (no more than 5 requests in flight), 401 handling.

## Definition of done

- [ ] Contract suite passes for both implementations.
- [ ] Every ADF row is tested.
- [ ] Fixtures contain no real site names, tokens or personal data.

## Open issues

_None yet._

## Notes for later stages

_None yet._
