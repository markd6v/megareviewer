import type { MockApi } from "./mock-routes.ts";

/** A `fetch` answered by the mock API, so UI tests can run the real client against it. */
export const mockFetch =
  (api: MockApi): typeof fetch =>
  async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://mock");
    const text = typeof init?.body === "string" ? init.body : undefined;
    const { status, body } = api.handle({
      method: init?.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: text === undefined ? undefined : JSON.parse(text),
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
