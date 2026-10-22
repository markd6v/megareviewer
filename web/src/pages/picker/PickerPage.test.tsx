import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { PullRequestListResponse } from "../../../../contracts/index.ts";
import {
  fixtureAnalysisView,
  fixturePullRequests,
  fixtureStatus,
} from "../../../dev/fixtures/index.ts";
import { mockFetch } from "../../../dev/mock-fetch.ts";
import { createMockApi } from "../../../dev/mock-routes.ts";
import { testApi } from "../../testing/api.tsx";
import { fakeFetch, jsonResponse } from "../../testing/fetch.ts";
import { PickerPage } from "./PickerPage.tsx";

const NOW = Date.parse("2026-10-21T10:00:00Z");
const reviewPath = `/review/${fixtureAnalysisView.analysis.id}`;

const renderPicker = (fetch?: typeof globalThis.fetch) => {
  const { wrapper } = testApi(fetch === undefined ? {} : { fetch });
  return render(<PickerPage status={fixtureStatus} now={() => NOW} />, { wrapper });
};

/** The mock API, but with the given pull request list. */
const withList = (list: PullRequestListResponse) => {
  const mock = mockFetch(createMockApi());
  return fakeFetch((request) =>
    request.url === "/api/pull-requests"
      ? jsonResponse(200, list)
      : mock(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body),
        }),
  );
};

const urlField = () => screen.getByLabelText<HTMLInputElement>("Pull request URL");

afterEach(() => window.history.replaceState(null, "", "/"));

describe("PickerPage", () => {
  it("shows the setup status", () => {
    renderPicker();
    const setup = screen.getByRole("region", { name: "Setup" });
    expect(within(setup).getByText("Lee Park")).toBeTruthy();
    expect(
      within(setup).getByText("Not configured: set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN"),
    ).toBeTruthy();
  });

  it("lists PRs waiting for review and the reviewer's own", async () => {
    renderPicker();
    const waiting = screen.getByRole("region", { name: "Waiting for your review" });
    expect(within(waiting).getByLabelText("Loading waiting for your review")).toBeTruthy();
    const row = await within(waiting).findByRole("button", { name: /Add order receipts endpoint/ });
    expect(row.textContent).toBe(
      "GitHubacme/shop #128Add order receipts endpointSam Rivera · 19 minutes ago",
    );
    expect(within(waiting).getAllByRole("button")).toHaveLength(4);
    const own = screen.getByRole("region", { name: "Your pull requests" });
    expect(within(own).getAllByRole("button")).toHaveLength(3);
  });

  it("validates the URL as it's typed", async () => {
    renderPicker();
    const analyze = screen.getByRole("button", { name: "Analyze" });
    expect(analyze.hasAttribute("disabled")).toBe(true);
    await userEvent.type(urlField(), "https://gitlab.com/a/b/-/merge_requests/1");
    expect(
      screen.getByText("Only github.com and bitbucket.org pull request links are supported."),
    ).toBeTruthy();
    expect(urlField().getAttribute("aria-invalid")).toBe("true");
    expect(analyze.hasAttribute("disabled")).toBe(true);

    await userEvent.clear(urlField());
    await userEvent.type(urlField(), "https://github.com/acme/shop/pull/128");
    expect(urlField().getAttribute("aria-invalid")).toBe("false");
    expect(analyze.hasAttribute("disabled")).toBe(false);
  });

  it("starts an analysis from the URL and opens it", async () => {
    renderPicker();
    await userEvent.type(urlField(), "https://github.com/acme/shop/pull/128{Enter}");
    await screen.findByRole("button", { name: "Analyze" });
    expect(window.location.pathname).toBe(reviewPath);
  });

  it("shows why an analysis couldn't start, until the URL changes", async () => {
    renderPicker();
    await userEvent.type(urlField(), "https://bitbucket.org/acme-team/billing/pull-requests/57");
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(
      await screen.findByText(
        "Bitbucket isn't configured. Run npx megareviewer doctor to see how to set it up.",
      ),
    ).toBeTruthy();
    expect(window.location.pathname).toBe("/");
    await userEvent.type(urlField(), "8");
    expect(screen.queryByText(/Bitbucket isn't configured/)).toBeNull();
  });

  it("starts an analysis from a row", async () => {
    renderPicker();
    await userEvent.click(
      await screen.findByRole("button", { name: /Add order receipts endpoint/ }),
    );
    expect(window.location.pathname).toBe(reviewPath);
  });

  it("shows a row's failure above the lists", async () => {
    renderPicker();
    await userEvent.click(await screen.findByRole("button", { name: /Round invoice totals/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/^Couldn't start the analysis. Bitbucket isn't configured/);
  });

  it("shows a host's listing error and the other host's PRs", async () => {
    const { fetch } = withList({
      items: fixturePullRequests.items.filter((item) => item.ref.repo.host === "github"),
      errors: [{ host: "bitbucket", message: "Bitbucket returned 503" }],
    });
    renderPicker(fetch);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't list Bitbucket pull requests: Bitbucket returned 503",
    );
    expect(screen.getByRole("button", { name: /Add order receipts endpoint/ })).toBeTruthy();
  });

  it("shows empty states", async () => {
    const { fetch } = withList({ items: [], errors: [] });
    renderPicker(fetch);
    expect(await screen.findByText("Nothing is waiting for your review.")).toBeTruthy();
    expect(screen.getByText("You have no open pull requests.")).toBeTruthy();
  });

  it("shows when the lists can't load", async () => {
    const { fetch } = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    renderPicker(fetch);
    expect((await screen.findByRole("alert")).textContent).toMatch(/^Couldn't list pull requests/);
  });

  it("refreshes the lists", async () => {
    const { fetch, requests } = withList(fixturePullRequests);
    renderPicker(fetch);
    const refresh = await screen.findByRole("button", { name: "Refresh" });
    await userEvent.click(refresh);
    await screen.findByRole("button", { name: "Refresh" });
    expect(requests.filter((request) => request.url === "/api/pull-requests")).toHaveLength(2);
  });

  it("focuses the URL field on /, but not while typing elsewhere", async () => {
    renderPicker();
    await userEvent.keyboard("/");
    expect(document.activeElement).toBe(urlField());
    expect(urlField().value).toBe("");
    await userEvent.keyboard("/");
    expect(urlField().value).toBe("/");
  });

  it("moves through rows with the arrow keys and opens one with Enter", async () => {
    renderPicker();
    const first = await screen.findByRole("button", { name: /Add order receipts endpoint/ });
    first.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(document.activeElement?.textContent).toMatch(/Bump the Node base image/);
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{Enter}");
    await screen.findByRole("button", { name: "Analyze" });
    expect(window.location.pathname).toBe(reviewPath);
  });
});
