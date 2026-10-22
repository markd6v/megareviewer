import { analysisEventsRoute, routePath, TOKEN_QUERY_PARAM } from "../../../contracts/index.ts";
import type { AnalysisId } from "../../../src/domain/review/index.ts";

export type AnalysisStreamEvent =
  /** A stage changed, or the stream reconnected after possibly missing events. */
  | { readonly type: "changed" }
  /** The analysis is complete or failed. The stream is closed. */
  | { readonly type: "done" }
  /** The server refused the stream, e.g. for a wrong token, so it won't reconnect. */
  | { readonly type: "closed" };

/** The part of EventSource this uses, so tests can drive it. */
export interface EventStream {
  readonly readyState: number;
  addEventListener(type: string, listener: () => void): void;
  close(): void;
}

const CLOSED = 2;

/**
 * Listens to an analysis's server-sent events until `done`. EventSource reconnects by itself
 * after an error; the reconnect is reported as a change, since events may have been missed.
 */
export const subscribeToAnalysis = (
  id: AnalysisId,
  token: string,
  onEvent: (event: AnalysisStreamEvent) => void,
  open: (url: string) => EventStream = (url) => new EventSource(url),
): (() => void) => {
  const query = new URLSearchParams({ [TOKEN_QUERY_PARAM]: token });
  const source = open(`${routePath(analysisEventsRoute.path, { id })}?${query}`);
  let interrupted = false;
  let closed = false;
  const close = () => {
    closed = true;
    source.close();
  };

  source.addEventListener("open", () => {
    if (!interrupted) return;
    interrupted = false;
    onEvent({ type: "changed" });
  });
  source.addEventListener("error", () => {
    interrupted = true;
    if (closed || source.readyState !== CLOSED) return;
    closed = true;
    onEvent({ type: "closed" });
  });
  source.addEventListener("updated", () => onEvent({ type: "changed" }));
  source.addEventListener("done", () => {
    close();
    onEvent({ type: "done" });
  });

  return () => {
    if (!closed) close();
  };
};
