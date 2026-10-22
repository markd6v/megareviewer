import { useId } from "react";
import type { ModelPass, ModelUsage } from "../../../../src/domain/review/index.ts";

const PASS_NAMES: Readonly<Record<ModelPass, string>> = {
  intent: "Intent",
  risk: "Risk",
  decisions: "Decisions",
  tour: "Tour",
};

/** "182k" for counts in the thousands, so the totals read at a glance. */
export const formatTokens = (count: number): string =>
  count >= 1_000_000
    ? `${(count / 1_000_000).toFixed(1)}M`
    : count >= 1_000
      ? `${Math.round(count / 1_000)}k`
      : `${count}`;

export const formatCost = (usd: number): string => `$${usd.toFixed(2)}`;

/** Uncached input, which includes tokens written to the cache. */
const inputOf = (usage: ModelUsage): number => usage.inputTokens + usage.cacheWriteTokens;

/** What the analysis cost, with a breakdown by pass on hover or focus. */
export const UsageFooter = ({ usage }: { readonly usage: readonly ModelUsage[] }) => {
  const id = useId();
  if (usage.length === 0) return null;
  const sum = (pick: (entry: ModelUsage) => number) =>
    usage.reduce((total, entry) => total + pick(entry), 0);

  return (
    <footer className="usage-footer">
      <button type="button" className="usage" aria-describedby={`${id}-breakdown`}>
        Usage: {formatTokens(sum(inputOf))} tokens in ·{" "}
        {formatTokens(sum((u) => u.cacheReadTokens))} cache read ·{" "}
        {formatTokens(sum((u) => u.outputTokens))} out · {formatCost(sum((u) => u.costUsd))}
      </button>
      <table id={`${id}-breakdown`} className="usage-breakdown" role="tooltip">
        <thead>
          <tr>
            <th scope="col">Pass</th>
            <th scope="col">In</th>
            <th scope="col">Cache read</th>
            <th scope="col">Out</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {usage.map((entry) => (
            <tr key={entry.pass}>
              <th scope="row">{PASS_NAMES[entry.pass]}</th>
              <td>{formatTokens(inputOf(entry))}</td>
              <td>{formatTokens(entry.cacheReadTokens)}</td>
              <td>{formatTokens(entry.outputTokens)}</td>
              <td>{formatCost(entry.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </footer>
  );
};
