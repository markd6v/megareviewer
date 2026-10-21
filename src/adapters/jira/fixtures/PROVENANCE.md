# Jira fixtures

Each JSON file is a list of exchanges in the format of `createFixtureFetch` (`src/application/testing/`). Both are synthetic: no Jira site was available while building the adapter.

| File | Source |
|---|---|
| `read.synthetic.json` | Written from Jira Cloud's REST v3 docs for `GET /rest/api/3/issue/{key}` on a made-up `example.atlassian.net` site. `SHOP-123` and `PAY-42` match the tickets of the `small-feature` and `bitbucket-bugfix` fixtures. `SHOP-130`'s description uses every ADF node the converter handles, plus a panel and an image. `SHOP-131` has no description. `SHOP-999` and `HTTP-2` (a false-positive key) are 404s with Jira's documented body. |
| `unauthorized.synthetic.json` | A 401 for each existing key, with the plain-text body Jira Cloud sends for rejected credentials. |

## API token

An Atlassian API token without scopes, for an account that can browse the projects whose tickets PRs mention. Scoped tokens only work through `api.atlassian.com` with the site's cloud ID, which the adapter doesn't use. Jira answers 404, not 403, for issues the account can't see, so a missing permission shows up as a missing ticket.

To record real responses into `read.json`:

```bash
JIRA_BASE_URL=https://your-site.atlassian.net JIRA_EMAIL=you@example.com JIRA_API_TOKEN=... node src/adapters/jira/fixtures/record.ts SHOP-1 SHOP-2
```

The recorder keeps only the fields the adapter reads, replaces the site with `example.atlassian.net`, mentions with `@person-N` and email addresses with `someone@example.com`. Names in plain text must be replaced by hand.
