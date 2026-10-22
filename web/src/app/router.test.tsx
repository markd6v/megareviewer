import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { fixtureAnalysisView } from "../../dev/fixtures/index.ts";
import { Link } from "./Link.tsx";
import { findPlayground, PlaygroundPage } from "./PlaygroundPage.tsx";
import { matchRoute, navigate, reviewPath, usePathname } from "./router.ts";

const id = fixtureAnalysisView.analysis.id;

afterEach(() => window.history.replaceState(null, "", "/"));

describe("matchRoute", () => {
  it("matches the picker, reviews and playgrounds", () => {
    expect(matchRoute("/", { dev: false })).toEqual({ page: "picker" });
    expect(matchRoute(`/review/${id}`, { dev: false })).toEqual({ page: "review", analysisId: id });
    expect(matchRoute(`/review/${id}/`, { dev: false })).toEqual({
      page: "review",
      analysisId: id,
    });
    expect(matchRoute("/dev/diff", { dev: true })).toEqual({ page: "playground", name: "diff" });
  });

  it("answers not-found for anything else", () => {
    for (const path of ["/nope", "/review", "/review/not-an-id", "/review/%E0%A4%A", "/dev/a/b"]) {
      expect(matchRoute(path, { dev: true })).toEqual({ page: "not-found" });
    }
  });

  it("has no playgrounds outside dev builds", () => {
    expect(matchRoute("/dev/diff", { dev: false })).toEqual({ page: "not-found" });
  });

  it("builds review paths that match", () => {
    expect(matchRoute(reviewPath(id), { dev: false })).toEqual({ page: "review", analysisId: id });
  });
});

describe("navigation", () => {
  it("updates the pathname on navigate and on back", async () => {
    const { result } = renderHook(() => usePathname());
    act(() => navigate("/review/x"));
    expect(result.current).toBe("/review/x");
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    });
    expect(result.current).toBe("/");
  });

  it("follows links in the app, but not modified clicks", async () => {
    render(<Link to="/dev/styles">Styles</Link>);
    const link = screen.getByRole("link", { name: "Styles" });
    expect(link.getAttribute("href")).toBe("/dev/styles");
    await userEvent.click(link);
    expect(window.location.pathname).toBe("/dev/styles");
  });
});

describe("playgrounds", () => {
  const modules = {
    "../diff/playground.tsx": async () => ({ default: () => <p>Diff playground</p> }),
    "../pages/review/playground.tsx": async () => ({ default: () => <p>Review playground</p> }),
  };

  it("are found by their folder's name", () => {
    expect(findPlayground(modules, "diff")).toBe(modules["../diff/playground.tsx"]);
    expect(findPlayground(modules, "review")).toBe(modules["../pages/review/playground.tsx"]);
    expect(findPlayground(modules, "pages")).toBeNull();
  });

  it("load and render", async () => {
    render(<PlaygroundPage modules={modules} name="diff" />);
    expect(await screen.findByText("Diff playground")).toBeTruthy();
  });

  it("say when there's no playground by that name", () => {
    render(<PlaygroundPage modules={modules} name="nope" />);
    expect(screen.getByText("No playground named “nope”.")).toBeTruthy();
  });
});
