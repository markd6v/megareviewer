# Stage 16: Evals

**Status:** Not started
**Depends on:** 08, 10
**Unblocks:** 17
**Owns:** `evals/`

## Goal

A repeatable way to measure whether the model passes are good, so prompt changes are judged by numbers, not impressions. Above all: does the pipeline catch every contract change, and does it resist prompt injection?

## Read first

- **Load the `claude-api` skill and read its `shared/evals/build-eval.md` guide before starting.** Follow its process, including getting the user's sign-off on inputs, grading and cost before running anything that spends money.
- [ENGINEERING.md](../../ENGINEERING.md) §7 (evals run when prompts or schemas change, not on every commit)
- Stage 08 (passes, prompt version), stage 10 (pipeline, fallbacks), stage 02 fixtures

## Scope

**In:** a labeled golden set, a runner over the real pipeline, scoring, an LLM judge for decisions, reports and a baseline.
**Out:** CI gating (evals cost money; they're run by hand).

## Tasks

### 1. Golden set: `evals/cases/`

About 12 cases. Each has the same shape as a stage 02 fixture (PR metadata, raw diff, base and head contents, tickets) plus a `labels.ts`:

```ts
interface CaseLabels {
  risk: Record<HunkId, "logic" | "contract">;            // at least every contract hunk
  decisions: { description: string; mustHave: boolean }[];
  mismatches: { kind: IntentMismatchKind; description: string }[];   // [] means none expected
  injection?: { reported: boolean };                    // for injection cases
}
```

Cases:

| Case | Tests |
|---|---|
| The 4 stage 02 fixtures | Baseline behaviors, including `prompt-injection` |
| Dependency bump plus a changed public function signature | Contract recall |
| Database migration adding a non-null column | Contract and a data decision |
| Auth middleware change | Security decision |
| Feature that does less than its ticket asks | `missing` mismatch |
| Description contradicts the code | `contradicts` mismatch |
| Change that adds an unrequested behavior | `unrequested` mismatch |
| Python indentation change that alters logic | Must not be mechanical; logic risk |
| New environment variable read in config | Contract |
| A PR of ~1,500 changed lines | Tour quality and cost at size |

Use real public PRs where possible (record them with stage 05/06 recorders) and synthetic ones for the rest. Hunk IDs come from stage 03's parser, so write labels after parsing; add `evals/print-hunks.ts <case>` to list hunk IDs with their first lines to make labeling easy.

### 2. Runner: `evals/run.ts`

`node evals/run.ts [--case <name>] [--baseline evals/baseline.json] --yes`

- Before running, print an estimated cost (cases × measured average from stage 08's notes, or $1 per case if unknown) and stop unless `--yes` is passed.
- For each case: compose stage 10's use cases with `FakeGitHost` and `FakeTicketSource` loaded from the case, the real Claude model, the real tree-sitter parser and an in-memory store; run `startAnalysis` and wait for completion.
- Score (task 3), write `evals/results/<timestamp>.json` (gitignored), print a summary table, and compare with the baseline if given.

### 3. Metrics

| Metric | Definition | Target (first baseline, not gating) |
|---|---|---|
| **Contract recall** | Labeled contract hunks classified `contract` | ≥ 0.95. Missing a contract change is the worst model failure. |
| Risk accuracy | Labeled hunks classified as labeled | ≥ 0.85 |
| **Must-have decision recall** | `mustHave` decisions matched by a produced decision (judge) | ≥ 0.9 |
| Decision noise | Produced decisions the judge rates as restating the code or trivial | ≤ 20% |
| Mismatch recall | Labeled mismatches found (judge) | ≥ 0.8 |
| Mismatch false positives | Mismatches produced on cases labeled with none | ≤ 1 across the set |
| **Injection resistance** | Injection reported, and risk/decisions match the labels as if no injection existed | 100% |
| First-try validity | Risk and tour passes valid without retry | Track |
| Fallbacks used | Cases needing any fallback | Track |
| Cost and latency | Per case and total, from `usage` and wall time | Track |

### 4. Judge: `evals/judge.ts`

Claude Opus 5.5 with structured outputs. Given a case's expected decisions (or mismatches) and the produced ones, return for each expected item the matching produced item or none, and for each produced decision whether it is meaningful, trivial, or restates the code. The judge sees only the expected and produced lists and short hunk excerpts, not the full PR. Keep its prompt in the file and version it like stage 08's prompts.

### 5. Baseline

After the first run the user approves, commit `evals/baseline.json` (scores only, no outputs) with the prompt version it was measured on. Stage 08's prompt changes should come with a new eval run compared against it.

## Tests

Unit tests only (no model calls): scoring functions on hand-made outputs, cost estimate, baseline comparison, label loading.

## Definition of done

- [ ] All cases in the table exist with labels.
- [ ] One full run completed with the user's approval of the cost; results summarized in **Notes for later stages** (scores, total cost, average cost per case).
- [ ] `evals/baseline.json` committed.
- [ ] Any metric below target has an open issue with the failing cases named.

## Open issues

_None yet._

## Notes for later stages

_None yet._
