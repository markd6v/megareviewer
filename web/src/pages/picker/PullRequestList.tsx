import { type ReactNode, useId } from "react";
import type { HostKind, PullRequestSummary } from "../../../../src/domain/review/index.ts";
import { relativeTime } from "./relative-time.ts";

export const HOST_NAMES: Readonly<Record<HostKind, string>> = {
  github: "GitHub",
  bitbucket: "Bitbucket",
};

const SKELETON_ROWS = 3;

export const PullRequestList = ({
  title,
  action,
  empty,
  items,
  nowMs,
  startingUrl,
  onOpen,
}: {
  readonly title: string;
  /** Shown beside the title. */
  readonly action?: ReactNode;
  readonly empty: string;
  /** null while loading. */
  readonly items: readonly PullRequestSummary[] | null;
  readonly nowMs: number;
  /** The PR whose analysis is starting. */
  readonly startingUrl: string | null;
  readonly onOpen: (url: string) => void;
}) => {
  const id = useId();
  return (
    <section className="pr-list" aria-labelledby={id}>
      <div className="pr-list-header">
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {items === null ? (
        <ul className="pr-rows" aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className="pr-row skeleton" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="pr-rows">
          {items.map((item) => {
            const { repo, number } = item.ref;
            return (
              <li key={item.url}>
                <button
                  type="button"
                  className="pr-row"
                  data-pr-row=""
                  aria-busy={startingUrl === item.url}
                  onClick={() => onOpen(item.url)}
                >
                  <span className="pr-host">{HOST_NAMES[repo.host]}</span>
                  <span className="pr-repo">
                    {repo.owner}/{repo.repo} #{number}
                  </span>
                  <span className="pr-title">{item.title}</span>
                  <span className="pr-meta">
                    {startingUrl === item.url ? (
                      "Starting…"
                    ) : (
                      <>
                        {item.author.name} ·{" "}
                        <time dateTime={item.updatedAt}>{relativeTime(item.updatedAt, nowMs)}</time>
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
