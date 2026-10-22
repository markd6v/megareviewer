import type { ReactNode } from "react";
import type { AnalysisId } from "../../../src/domain/review/index.ts";
import { mockFetch } from "../../dev/mock-fetch.ts";
import { createMockApi, MOCK_TOKEN, type MockApi } from "../../dev/mock-routes.ts";
import { type AnalysisStreamEvent, type Api, ApiContext, createApiClient } from "../api/index.ts";

/** An `Api` over the mock API, whose event streams tests drive with `emit`. */
export const testApi = (
  options: { readonly fetch?: typeof fetch; readonly mock?: MockApi } = {},
) => {
  const mock = options.mock ?? createMockApi();
  const listeners = new Map<AnalysisId, Set<(event: AnalysisStreamEvent) => void>>();
  const api: Api = {
    client: createApiClient({
      fetch: options.fetch ?? mockFetch(mock),
      token: MOCK_TOKEN,
      onUnauthorized: () => {},
    }),
    subscribe: (id, onEvent) => {
      const forId = listeners.get(id) ?? new Set();
      forId.add(onEvent);
      listeners.set(id, forId);
      return () => forId.delete(onEvent);
    },
  };
  const emit = (id: AnalysisId, event: AnalysisStreamEvent) => {
    for (const listener of listeners.get(id) ?? []) listener(event);
  };
  const subscribers = (id: AnalysisId) => listeners.get(id)?.size ?? 0;
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
  );
  return { api, mock, emit, subscribers, wrapper };
};
