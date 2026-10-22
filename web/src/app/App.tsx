import { useMemo, useState } from "react";
import {
  type Api,
  ApiContext,
  createApiClient,
  type EventStream,
  subscribeToAnalysis,
  useStatus,
} from "../api/index.ts";
import { PickerPage } from "../pages/picker/index.ts";
import { ReviewPage } from "../pages/review/index.ts";
import { Header } from "./Header.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";
import { type PlaygroundModules, PlaygroundPage } from "./PlaygroundPage.tsx";
import { matchRoute, usePathname } from "./router.ts";
import { TokenScreen } from "./TokenScreen.tsx";
import type { SessionToken } from "./token.ts";

export interface AppProps {
  readonly token: SessionToken;
  readonly fetch: typeof fetch;
  readonly openEventStream?: (url: string) => EventStream;
  /** Dev builds only; see PlaygroundPage. */
  readonly playgrounds: PlaygroundModules | null;
}

export const App = ({ token, fetch, openEventStream, playgrounds }: AppProps) => {
  const [ended, setEnded] = useState(false);
  const value = token.value;
  const api = useMemo((): Api | null => {
    if (value === null) return null;
    const client = createApiClient({
      fetch,
      token: value,
      onUnauthorized: () => {
        token.clear();
        setEnded(true);
      },
    });
    return {
      client,
      subscribe: (id, onEvent) => subscribeToAnalysis(id, value, onEvent, openEventStream),
    };
  }, [fetch, openEventStream, token, value]);

  if (ended) return <TokenScreen reason="ended" />;
  if (api === null) return <TokenScreen reason="missing" />;
  return (
    <ApiContext.Provider value={api}>
      <Shell playgrounds={playgrounds} />
    </ApiContext.Provider>
  );
};

const Shell = ({ playgrounds }: { readonly playgrounds: PlaygroundModules | null }) => {
  const route = matchRoute(usePathname(), { dev: playgrounds !== null });
  const status = useStatus();
  return (
    <>
      <Header status={status.status} error={status.error} />
      <main className="page">
        {route.page === "picker" ? (
          <PickerPage status={status.status} />
        ) : route.page === "review" ? (
          <ReviewPage analysisId={route.analysisId} />
        ) : route.page === "playground" && playgrounds !== null ? (
          <PlaygroundPage modules={playgrounds} name={route.name} />
        ) : (
          <NotFoundPage />
        )}
      </main>
    </>
  );
};
