import type { AnalysisId, StageName, StageStatus } from "../../domain/review/index.ts";

export type AnalysisEvent =
  | { readonly type: "updated"; readonly stage: StageName; readonly status: StageStatus }
  | { readonly type: "done" };

export type AnalysisEventListener = (event: AnalysisEvent) => void;

/** In-process pub/sub of analysis progress. No buffering: clients refetch the view on connect. */
export interface AnalysisEvents {
  emit(id: AnalysisId, event: AnalysisEvent): void;
  /** Returns the unsubscribe function. */
  subscribe(id: AnalysisId, listener: AnalysisEventListener): () => void;
}

export const createAnalysisEvents = (): AnalysisEvents => {
  const listeners = new Map<AnalysisId, Set<AnalysisEventListener>>();
  return {
    emit(id, event) {
      // A copy, so a listener can unsubscribe while being called.
      for (const listener of [...(listeners.get(id) ?? [])]) listener(event);
    },
    subscribe(id, listener) {
      const forId = listeners.get(id) ?? new Set();
      // Wrapped, so subscribing the same function twice gives two independent subscriptions.
      const subscription: AnalysisEventListener = (event) => listener(event);
      forId.add(subscription);
      listeners.set(id, forId);
      return () => {
        forId.delete(subscription);
        if (forId.size === 0 && listeners.get(id) === forId) listeners.delete(id);
      };
    },
  };
};
