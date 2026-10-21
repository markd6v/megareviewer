# Stage 09: SQLite store

**Status:** In progress (branch stage/09-sqlite-store)
**Depends on:** 02
**Unblocks:** 12
**Owns:** `src/adapters/sqlite/`

## Goal

An `AnalysisStore` on Node's built-in `node:sqlite` that passes the shared contract suite, with migrations and safe file permissions.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Storage", "Why TypeScript everywhere" (no native modules)
- Stage 02: `AnalysisStore` port, `describeAnalysisStoreContract`, domain schemas

## Scope

**In:** schema, migrations, every `AnalysisStore` method, parsing rows at the edge.
**Out:** choosing the file location (stage 12 passes the path); suppressing Node's experimental warning (stage 12).

## Tasks

### 1. Construction

```ts
openSqliteAnalysisStore(options: { path: string /* or ":memory:" */; logger: Logger }): AnalysisStore & { close(): void }
```

- `DatabaseSync` from `node:sqlite`.
- On open: `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON`, then run migrations.
- For a file path, set the file's mode to `0600` after creating it (it holds review content of private code).

### 2. Schema: `migrations.ts`

Migrations are an ordered array of SQL strings. `PRAGMA user_version` records the last applied one. Each runs in a transaction.

```sql
-- 1
CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL, owner TEXT NOT NULL, repo TEXT NOT NULL, number INTEGER NOT NULL,
  head_sha TEXT NOT NULL, pipeline_version TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,          -- the full Analysis as JSON
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (host, owner, repo, number, head_sha, pipeline_version)
);
CREATE INDEX analyses_updated_at ON analyses (updated_at DESC);

CREATE TABLE decision_reviews (
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  decision_id TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('pending', 'approved', 'rejected')),
  comment TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (analysis_id, decision_id)
);

CREATE TABLE published_comments (
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  comment_key TEXT NOT NULL,
  host_comment_id TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  PRIMARY KEY (analysis_id, comment_key)
);

CREATE TABLE publications (
  analysis_id TEXT PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
  url TEXT,
  published_at TEXT NOT NULL,
  receipt TEXT NOT NULL           -- PublicationReceipt as JSON
);
```

The table names match ARCHITECTURE.md "Storage".

### 3. Methods

- Use prepared statements, created once.
- `saveAnalysis` upserts by `id` and writes the key columns from `analysis.key`.
- **Parse at the edge:** every JSON payload read is parsed with the domain schema. If parsing fails (an old payload from an earlier schema), log a warning and treat the row as absent. A cache miss is safe; a malformed analysis in the UI isn't.
- `listRecent` orders by `updated_at DESC`.
- `getPostedComments` returns a `Map` keyed by `CommentKey`.

## Tests

- `describeAnalysisStoreContract("sqlite-memory", …)` and `("sqlite-file", …)` with a temp directory.
- Migrations: fresh database reaches the latest version; re-opening doesn't re-run them; a database at version 1 migrates forward once later migrations exist (add a test helper now so the next migration has a pattern to follow).
- A corrupt or old-schema payload is treated as absent and logged.
- The file is created with mode `0600` (skip on Windows).
- Deleting an analysis row cascades (via a test-only delete).

## Definition of done

- [ ] Contract suite passes for in-memory and file databases.
- [ ] Migration tests pass.
- [ ] No native modules added.

## Open issues

_None yet._

## Notes for later stages

_None yet._
