# Stage 07: Jira adapter

**Status:** In progress (branch stage/07-jira-adapter)
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

- [x] Contract suite passes for both implementations.
- [x] Every ADF row is tested.
- [x] Fixtures contain no real site names, tokens or personal data.

## Open issues

- **Synthetic fixtures** (see `src/adapters/jira/fixtures/PROVENANCE.md`): no Jira site was available. Recording `read.json` needs a site, an unscoped API token and a few keys; the recorder is in place. Unverified until then: the exact 401 body, and that bad credentials always get a 401 rather than being treated as anonymous (a 404 for every key). Stage 12's startup check relies on the 401.

## Notes for later stages

Where the code differs from or adds to this doc.

- **`parseJiraBaseUrl(raw): Result<string, string>`** is exported for stage 12, to report a bad `JIRA_BASE_URL` as a config problem. It requires `https://`, rejects a query, fragment or credentials, trims trailing slashes and keeps any path. `createJiraTicketSource` throws on a URL it rejects, since the composition root should have checked it.
- **Lookups.** Keys are deduplicated, and `found` and `missing` keep the order asked. A moved issue answers to its old key with its new one; the ticket keeps the key the PR mentions (the browse link redirects), so every key ends up found or missing.
- **Errors.** Any failure fails the whole call and stops sending requests (ones in flight finish), rather than dropping a ticket. `TicketError` has no forbidden or rate-limited kinds: 401 and 403 are `unauthorized` (a 403 with `x-seraph-loginreason: AUTHENTICATION_DENIED` means Jira wants a CAPTCHA, and the message says so), 429 is `unexpected` with the `retry-after` seconds in the message, other non-2xx are `unexpected`. A `fetch` that throws anything but a `TypeError` is a bug and is rethrown.
- **ADF.** The 8,000-character cap is on the text; the marker comes after it, and a surrogate pair is never split. Beyond the table: `embedCard` renders as its URL like the other cards; ordered lists number from `attrs.order`; a mention gets exactly one `@` (`@someone` without display text); a code fence is longer than any backtick run in the code. Inline nodes the table doesn't list (`status`, `date`) render through their content, so they disappear.
- **Token:** an Atlassian API token without scopes. Scoped tokens only work through `api.atlassian.com` with the site's cloud ID. Stage 17 copies this from the fixture folder's provenance note.
- **Recorder** needs Node 24 (it's run as `.ts`). It replaces the site, mentions and email addresses; names in plain text must be replaced by hand.
