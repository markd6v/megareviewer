import { useCallback, useId } from "react";
import type {
  AnalysisId,
  Intent,
  IntentMismatchKind,
  IntentSourceKind,
  Ticket,
} from "../../../../src/domain/review/index.ts";
import { parseBoolean, useStoredState } from "./storage.ts";

const SOURCE_NAMES: Readonly<Record<Exclude<IntentSourceKind, "ticket">, string>> = {
  description: "Description",
  commits: "Commits",
  branch: "Branch name",
};

const MISMATCH_NAMES: Readonly<Record<IntentMismatchKind, string>> = {
  unrequested: "Unrequested",
  missing: "Missing",
  contradicts: "Contradicts",
};

const TicketChip = ({ ticketKey, ticket }: { ticketKey: string; ticket: Ticket | undefined }) =>
  ticket === undefined ? (
    <li className="chip" title="Jira didn't return this ticket, or Jira isn't configured">
      {ticketKey} · not fetched
    </li>
  ) : (
    <li className="chip">
      <a href={ticket.url} target="_blank" rel="noreferrer" title={ticket.summary}>
        {ticket.key} · {ticket.status}
      </a>
    </li>
  );

/** What was asked, next to what the code does, and where they disagree. Comes first on the page. */
export const IntentPanel = ({
  analysisId,
  intent,
  tickets,
  missingTicketKeys,
  selectedMismatch,
  onSelectMismatch,
}: {
  readonly analysisId: AnalysisId;
  readonly intent: Intent;
  readonly tickets: readonly Ticket[];
  readonly missingTicketKeys: readonly string[];
  readonly selectedMismatch: number | null;
  readonly onSelectMismatch: (index: number) => void;
}) => {
  const id = useId();
  const [collapsed, setCollapsed] = useStoredState(
    `intent-collapsed:${analysisId}`,
    false,
    parseBoolean,
  );
  const toggle = useCallback(() => setCollapsed((previous) => !previous), [setCollapsed]);
  const { stated, inferred, mismatches } = intent;
  const ticketOf = new Map(tickets.map((ticket) => [ticket.key, ticket]));
  const statedKeys = new Set(stated?.sources.flatMap((source) => source.ref ?? []) ?? []);
  // Ticket keys found in the PR that Jira didn't return still show, so nothing goes unmentioned.
  const unfetched = missingTicketKeys.filter((key) => !statedKeys.has(key));

  return (
    <section className="intent-panel" aria-labelledby={`${id}-title`}>
      <div className="panel-header">
        <h2 id={`${id}-title`}>Intent</h2>
        {mismatches.length > 0 && (
          <span className="mismatch-count">
            {mismatches.length} {mismatches.length === 1 ? "mismatch" : "mismatches"}
          </span>
        )}
        <button
          type="button"
          className="button quiet"
          aria-expanded={!collapsed}
          aria-controls={`${id}-body`}
          onClick={toggle}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      <div id={`${id}-body`} className="intent-columns" hidden={collapsed}>
        <div className="intent-column">
          <h3>Stated</h3>
          {stated === null ? (
            <p className="muted">No stated intent: the PR has no description or linked tickets.</p>
          ) : (
            <>
              <p className="model-text">{stated.summary}</p>
              <ul className="chips" aria-label="Sources">
                {stated.sources.map((source) =>
                  source.kind === "ticket" && source.ref !== null ? (
                    <TicketChip
                      key={`ticket:${source.ref}`}
                      ticketKey={source.ref}
                      ticket={ticketOf.get(source.ref)}
                    />
                  ) : source.kind === "ticket" ? null : (
                    <li key={source.kind} className="chip">
                      {SOURCE_NAMES[source.kind]}
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
          {unfetched.length > 0 && (
            <ul className="chips" aria-label="Tickets mentioned but not fetched">
              {unfetched.map((key) => (
                <TicketChip key={key} ticketKey={key} ticket={undefined} />
              ))}
            </ul>
          )}
        </div>
        <div className="intent-column">
          <h3>Inferred from the code</h3>
          <p className="model-text">{inferred.summary}</p>
          {inferred.behaviorChanges.length > 0 && (
            <ul className="behavior-changes">
              {inferred.behaviorChanges.map((change, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders.
                <li key={index} className="model-text">
                  {change}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="intent-column">
          <h3>Mismatches</h3>
          {mismatches.length === 0 ? (
            <p className="muted">None found: the code does what was asked.</p>
          ) : (
            <ul className="mismatches">
              {mismatches.map((mismatch, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: mismatches have no ID and never reorder.
                <li key={index}>
                  <button
                    type="button"
                    className={`mismatch${selectedMismatch === index ? " selected" : ""}`}
                    aria-pressed={selectedMismatch === index}
                    onClick={() => onSelectMismatch(index)}
                  >
                    <span className={`badge mismatch-${mismatch.kind}`}>
                      {MISMATCH_NAMES[mismatch.kind]}
                    </span>
                    <span className="model-text">{mismatch.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
