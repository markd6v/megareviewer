# Evals

Measure the model passes on a labeled golden set, so a prompt change is judged by numbers. Run them by hand whenever a prompt, schema or the model changes (ENGINEERING.md §7). CI never runs them, because they cost money.

## Run

```bash
node evals/run.ts --baseline evals/baseline.json
```

That prints the estimated cost and stops. Add `--yes` to run, `--case <name>` (repeatable) for a subset, and `--write-baseline` to replace `evals/baseline.json` with this run's scores. It needs Anthropic credentials (`ANTHROPIC_API_KEY` or `ant auth login`).

Each case runs through stage 10's real pipeline with the real Claude adapter and tree-sitter parser; its PR and tickets come from fakes. A Claude Opus 5.5 judge ([judge.ts](judge.ts)) matches the produced decisions and mismatches against the labels. The full outputs go to `evals/results/<time>.json` (gitignored), and the summary compares each metric with the baseline and its target.

| Metric | Measures | Target |
|---|---|---|
| `contractRecall` | Labeled contract hunks classified contract. A miss is the worst model failure | ≥ 95% |
| `riskAccuracy` | Labeled hunks classified as labeled | ≥ 85% |
| `mustHaveRecall` | Must-have decisions the judge finds among the produced ones | ≥ 90% |
| `decisionNoise` | Produced decisions the judge rates trivial or restating the code | ≤ 20% |
| `mismatchRecall` | Labeled mismatches found | ≥ 80% |
| `mismatchFalsePositives` | Mismatches produced on cases labeled with none, in total | ≤ 1 |
| `injectionResistance` | Injection reported, with risk and must-have decisions as if it weren't there | 100% |
| `firstTryValid`, `fallbacksUsed` | Risk and tour passes valid without a retry; cases needing a fallback | tracked |

A case whose analysis fails or times out, or whose judge fails, is reported as an error and left out of the scores.

## Add a case

1. Make `cases/<name>/` with `files/base/` and `files/head/` holding the changed files, and a `case.ts` with the PR's metadata (copy one). Or import a public GitHub PR: `GITHUB_TOKEN=$(gh auth token) node evals/import-pr.ts <url> <name>`.
2. For a synthetic case, write its diff: `node evals/make-diff.ts <name>`.
3. List its hunks with `node evals/print-hunks.ts <name>` (free: it uses the fake model) and write `labels.ts`: a risk class for every contract hunk and every hunk whose class is clear, the decisions a reviewer must see, and the expected mismatches (`[]` means none).
4. Register it in [cases/index.ts](cases/index.ts). `pnpm test` checks the diff, the labels' hunk IDs and the tickets.

Changing a label, the judge prompt (bump `JUDGE_VERSION`) or the case set makes scores incomparable with the baseline: run again and write a new one.
