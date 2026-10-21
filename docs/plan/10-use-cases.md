# Stage 10: Use cases and pipeline

**Status:** Done (pushed to main without a PR; CI green on 0d4b6a1)
**Depends on:** 02, 03 (uses fakes for every port, so adapters don't need to be done)
**Unblocks:** 11, 16
**Owns:** `src/application/use-cases/`, `src/application/events/`, `src/domain/review/publication.ts`

## Goal

The application layer: the analysis pipeline that turns a PR URL into a complete `Analysis`, and the use cases the HTTP API calls (verdicts, publication, listing, status). Everything is tested against stage 02's fakes.

This stage owns the fail-safe rules: what happens when the model returns something invalid, when a pass fails, or when the PR is too big.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Analysis pipeline", "UI" (publish)
- [ENGINEERING.md](../../ENGINEERING.md) §3 (use cases depend only on ports), §6 "Fail safe toward the reviewer"
- Stage 02: ports, fakes, fixtures, validation functions, `fallbackTour`, API error codes
- Stage 03: `parseUnifiedDiff`, `findMechanicalProofs`, `lockfileWarnings`
- Stage 04 doc: `findFormattingProofs`, `buildCallGraphHints` (if stage 04 isn't merged yet, code against its documented signatures and wire them when it lands)

## Dependencies object

```ts
interface AppDeps {
  hosts: Partial<Record<HostKind, GitHost>>;   // only configured hosts
  tickets: TicketSource;
  model: AnalysisModel;
  modelConfigured: boolean;
  store: AnalysisStore;
  parser: CodeParser;
  events: AnalysisEvents;
  clock: Clock;
  logger: Logger;
}
```

`createUseCases(deps)` returns an object with one function per use case below. Stage 11 calls these and nothing else.

Use-case errors are typed results whose `code` is an `ErrorCode` from stage 02's API contract, so stage 11 maps them to HTTP without a translation table of its own.

## Tasks

### 1. Analysis events: `src/application/events/analysis-events.ts`

In-process pub/sub:

```ts
interface AnalysisEvents {
  emit(id: AnalysisId, event: { type: "updated"; stage: StageName; status: StageStatus } | { type: "done" }): void;
  subscribe(id: AnalysisId, listener: (event) => void): () => void;   // returns unsubscribe
}
createAnalysisEvents(): AnalysisEvents
```

No buffering: clients refetch the view when they connect.

### 2. `startAnalysis(url)`

1. `parsePullRequestUrl` → `unsupported-url` on failure.
2. Pick the host → `host-not-configured` if missing.
3. `getPullRequest` → map `HostError` to `not-found` or `host-error`.
4. Build the key with `pipelineVersion = "${PIPELINE_VERSION}+${model.version}"`; `PIPELINE_VERSION` is a constant in this folder, bumped whenever pipeline logic changes what an analysis contains.
5. `findByKey`:
   - `complete` → return its ID.
   - `running` and in flight in this process → return its ID.
   - `failed`, or `running` but not in flight (interrupted) → start a new run with the same ID.
   - none → create it with every stage `pending` and start a run.
6. Return `{ analysisId }` immediately. The run continues in the background; keep its promise in an in-flight map so concurrent requests join it.

### 3. The pipeline run

Save the analysis and emit `updated` after every stage status change. Every stage records its status as `running`, then `done` or `failed`.

**collect**

- `parseUnifiedDiff(pr.diff)`. A parse error fails the analysis (code `host-error`, message says the diff couldn't be parsed).
- Set each file's `language` with `parser.languageFor(path)`.
- Fetch `.gitattributes` at `baseSha`.
- Fetch base and head contents of every non-binary changed file (base skipped for added files, head for deleted), 8 at a time. Treat contents over 1 MB as `null`.
- Tickets: `extractTicketKeys([title, description, sourceBranch, ...commit messages])`, then `tickets.getTickets` if configured. A ticket error adds a warning (`Couldn't fetch Jira tickets: …`) and continues.

**prep**

- `findMechanicalProofs` with the base `.gitattributes` and contents.
- For modified or renamed files with a known language where some hunk has no proof yet: `parser.syntaxNodes` on base and head, then `findFormattingProofs`. Parser errors mean no proof, silently.
- Merge proofs: at most one per hunk. Stage 03 proofs win over formatting proofs.
- `parser.symbols` on head contents of files with a language, then `buildCallGraphHints`.
- `warnings.push(...lockfileWarnings(files))`.
- Required hunks = every hunk without a proof.

**Build `AnalysisInput` and check size**

- Non-mechanical hunks in full; mechanical hunks as summaries; `headContent` for files with at least one non-mechanical hunk.
- `model.checkSize(input)`. If `too-large`, drop `headContent` from files largest-first and re-check, adding one warning (`Full file contents omitted for N files to fit the model's limit`). If still too large with no `headContent` left, fail the analysis: stage `prep`, code `model-error`, message with the token count and limit. Never drop hunks (ENGINEERING.md §6).

**intent**

- `model.intent(input)`. Any `ModelError` fails the analysis (intent feeds every later pass).

**risk and decisions, in parallel**

- Risk: `validateRiskCoverage(assessments, required)`. If there are problems, call again once with `feedback` listing them. After the second attempt: keep the first assessment per hunk, drop unknown IDs, and give every missing hunk `{ riskClass: "logic", reason: "Not classified by the model", source: "fallback" }`, adding a warning. Missing classifications show the hunk as ordinary logic: visible, never collapsed.
- Decisions: `validateHunkReferences` on every decision. Same single retry with feedback; afterwards drop unknown IDs and add a warning. Assign IDs `d1`, `d2`, … in the model's order.
- Final `risk` = one `RiskAssessment` per proof (`riskClass: "mechanical"`, `reason: proof.detail`, `source: "proof"`) plus the model's.
- A `ModelError` in either pass fails that stage and the analysis; keep whatever finished.

**tour**

- `model.tour(...)`, then `validateTour(tour, required)`. Retry once with feedback. If still invalid, use `fallbackTour` and add a warning. Assign step IDs `s1`, `s2`, ….
- A `ModelError` here doesn't fail the analysis: use `fallbackTour` and add a warning. The reviewer can still review.

**done**: status `complete`, emit `done`.

Record each pass's `ModelUsage` in `usage`, including retries.

### 4. `recoverInterruptedAnalyses()`

Called once at startup. Every stored analysis with status `running` is set to `failed` with error `{ stage: <the running stage>, code: "interrupted", message: "megareviewer stopped during the analysis" }`. Uses `listRecent` (a limit of 200 is plenty).

### 5. `retryAnalysis(id)`

Only for `failed` analyses; anything else returns `bad-request`. Re-fetches the PR. If the head SHA changed, starts an analysis for the new key instead and returns that ID.

### 6. `getAnalysisView(id)`

Returns `{ analysis, verdicts, publication, isAuthor, stale }`:

- `isAuthor`: the host's `currentUser().id === pullRequest.author.id`; `false` if `currentUser` fails.
- `stale`: for complete analyses, whether the PR's current head SHA differs from the analysis's. Checking costs an API call, and the UI refetches on every event, so cache the answer per analysis for 60 seconds.

### 7. Verdicts: `recordVerdict(id, decisionId, verdict, comment)`

The analysis must be complete (`analysis-not-complete`) and the decision must exist (`not-found`). Saves with `updatedAt = clock.now()`.

### 8. Publication: `src/domain/review/publication.ts`

Pure function, so the UI could reuse it and it gets domain-level coverage:

```ts
buildPublication(input: {
  analysis: Analysis; verdicts: DecisionVerdict[]; summary: string; isAuthor: boolean;
}): Publication
```

- **Verdict:** any decision rejected → `request_changes`; at least one decision and all approved → `approve`; otherwise `comment`. If `isAuthor`, always `comment` (hosts don't let authors approve their own PRs).
- **Inline comments:** one per decision that is rejected or has a non-empty comment. Key `decision:<id>`. Anchor on the decision's first hunk in tour order: its first added line (`side: "new"`, `line: newLine`), else its first deleted line (`side: "old"`, `line: oldLine`). A decision with no hunks goes into the summary instead.
  - Body: `**Rejected: <title>**` or `**Comment: <title>**`, blank line, the reviewer's comment.
- **Summary:**
  ```
  <reviewer's summary, if any>

  **Decisions**
  - ✅ <title>
  - ❌ <title> — <comment>
  - ⏳ Not reviewed: <title>

  _Reviewed with megareviewer_
  ```

### 9. `previewPublication(id, summary)` and `publishReview(id, summary, allowStale)`

- Both require a complete analysis.
- Preview returns `buildPublication(...)`: exactly what publish will send.
- Publish:
  1. If a publication receipt exists, return it (one publication per analysis in this slice).
  2. Fetch the PR fresh. If the head SHA changed and `!allowStale` → `stale-analysis`.
  3. Build the publication.
  4. `host.publish(ref, publication, { headSha: analysis.key.headSha, alreadyPosted: keys from store, onPosted: store.recordPostedComment })`.
  5. On success, `recordPublication` and return the receipt. On failure, return `host-error`; posted comments are already recorded, so a retry continues where it stopped.

### 10. `listPullRequests()` and `getStatus()`

- List: call every configured host in parallel; merge, sort by `updatedAt` desc; a host failure becomes an entry in `errors`, not a failed call.
- Status: per host, `configured` and `currentUser` (or its error message); Jira `configured`; model `configured` from `deps.modelConfigured`; the app version passed into `createUseCases`.

## Tests

All with stage 02 fakes and fixtures:

- Full pipeline on each fixture: stage order, events emitted, saved after each stage, final analysis shape.
- `refactor-move`: every hunk proved, model passes still called but with zero required hunks (the tour is empty and valid).
- Risk retry: invalid first answer, valid second; invalid both times → fallbacks and warning.
- Decisions with unknown hunk IDs → retry → dropped IDs and warning.
- Tour invalid twice → `fallbackTour`; tour `ModelError` → fallback, analysis still complete.
- Intent `ModelError` → analysis failed, partial results kept.
- Size: too large with `headContent` → dropped and warned; too large without → failed, no hunks dropped.
- Ticket error → warning, analysis completes.
- Concurrency: two `startAnalysis` calls for the same PR run one pipeline.
- Recovery of interrupted analyses; retry with a changed head SHA.
- `buildPublication`: each verdict rule, author downgrade, anchors (add-only, delete-only, no hunks), summary format.
- Publish: idempotent second call; partial failure then retry posts only the rest (scripted `FakeGitHost`); stale detection and `allowStale`.
- Status and listing with one host failing.

## Definition of done

- [x] Every use case above exists and is exported from `createUseCases`.
- [x] Every fail-safe rule in task 3 has a test.
- [x] Coverage thresholds pass (application and domain).

## Open issues

_None yet._

## Notes for later stages

Where the code differs from or adds to this doc.

- **Shape.** `createUseCases(deps, { version })` returns `startAnalysis`, `retryAnalysis`, `recoverInterruptedAnalyses`, `getAnalysisView`, `recordVerdict`, `previewPublication`, `publishReview`, `listPullRequests` and `getStatus`. Each returns `Result<T, UseCaseError>`, except listing and status, which never fail, and recovery, which returns how many analyses it failed. Stage 12 calls recovery before serving.
- **`ErrorCode` is repeated in the application layer,** because dependency rules keep `contracts/` out of it. Stage 11: assert at compile time that it equals the contract's `ErrorCode`, and that `AnalysisView`, `Status` and `PullRequestList` fit the contract's response types.
- **Host errors.** `not-found` stays `not-found`; every other kind, `unauthorized` included, is `host-error`, because the API's `unauthorized` (401) means a bad session token.
- **Collect.** A `getFile` failure fails the analysis with `host-error` naming the file, except `too-large`, which counts as unavailable like a file over 1 MB. With Jira unconfigured or failing, every ticket key goes into `missingTicketKeys`, so the UI still shows them.
- **Retries go beyond the doc.** An unparseable answer (`invalid-output`) is retried once with the error message as feedback, in every pass, as stage 08 suggested. When the retry of an answer with problems fails outright, the first answer is repaired instead of failing. Intent mismatches' hunk IDs are validated like decisions': retry, then drop unknown IDs with a warning. Feedback lines name the hunk and what to fix, e.g. `h_… is in no step. Put every hunk sent in full in exactly one step.`
- **Size.** Dropping `headContent` finds the fewest largest files to drop by binary search, so a check costs about log₂(files) + 2 `checkSize` calls instead of one per file. The model is told nothing about the dropped contents beyond the warning.
- **Failures.** Analysis error codes are `host-error`, `model-error`, `internal` (a bug: the pipeline caught an exception, logged it, and failed the running stage) and `interrupted`. When risk or decisions fails, the other pass still finishes and keeps its result.
- **Publishing.** Concurrent `publishReview` calls for one analysis share one attempt. The stored receipt's `postedCommentIds` include comments an earlier, partly failed attempt posted. `isAuthor` asks the host for the current user on every view and preview (not cached); `stale` is cached for 60 seconds per analysis, and a failed check counts as not stale (publishing checks again).
- **`buildPublication`.** A rejection without a comment gets just the bold heading. A decision whose hunks have no changed lines, or are all unknown, goes into the summary. The summary repeats a rejection's comment, and shows other comments only when they have no inline anchor; multi-line comments are joined into one line there. Without a tour, hunks are in file order.
- **`FakeCodeParser`** was added to `src/application/testing/` for these tests (see stage 02's change log).
