import { useSyncExternalStore } from "react";
import { AnalysisId } from "../../../src/domain/review/index.ts";

export type Route =
  | { readonly page: "picker" }
  | { readonly page: "review"; readonly analysisId: AnalysisId }
  | { readonly page: "playground"; readonly name: string }
  | { readonly page: "not-found" };

const NOT_FOUND: Route = { page: "not-found" };

const segment = (pathname: string, prefix: string): string | null => {
  const match = new RegExp(`^/${prefix}/([^/]+)/?$`).exec(pathname);
  if (match?.[1] === undefined) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

/** Playgrounds exist only in dev builds. */
export const matchRoute = (pathname: string, options: { readonly dev: boolean }): Route => {
  if (pathname === "/") return { page: "picker" };
  const review = segment(pathname, "review");
  if (review !== null) {
    const analysisId = AnalysisId.safeParse(review);
    return analysisId.success ? { page: "review", analysisId: analysisId.data } : NOT_FOUND;
  }
  const playground = options.dev ? segment(pathname, "dev") : null;
  return playground === null ? NOT_FOUND : { page: "playground", name: playground };
};

export const reviewPath = (analysisId: AnalysisId): string =>
  `/review/${encodeURIComponent(analysisId)}`;

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

export const usePathname = (): string =>
  useSyncExternalStore(subscribe, () => window.location.pathname);

export const navigate = (path: string): void => {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
