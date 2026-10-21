import { describe, expect, it } from "vitest";
import { createFixtureFetch, type RecordedExchange } from "./index.ts";

const exchange = (
  request: RecordedExchange["request"],
  response: Partial<RecordedExchange["response"]> = {},
): RecordedExchange => ({
  request,
  response: { status: 200, headers: { "content-type": "application/json" }, body: {}, ...response },
});

describe("createFixtureFetch", () => {
  it("answers a matching request with the recorded JSON response", async () => {
    const fetch = createFixtureFetch([
      exchange(
        { method: "GET", url: "https://api.example.com/pulls/1?per_page=100" },
        { status: 201, headers: { "x-id": "7" }, body: { number: 1 } },
      ),
    ]);
    const response = await fetch("https://api.example.com/pulls/1?per_page=100");

    expect(response.status).toBe(201);
    expect(response.headers.get("x-id")).toBe("7");
    expect(await response.json()).toEqual({ number: 1 });
  });

  it("sends a string body as is", async () => {
    const diff = "diff --git a/x b/x\n";
    const fetch = createFixtureFetch([
      exchange({ method: "get", url: "https://api.example.com/diff" }, { body: diff }),
    ]);
    expect(await (await fetch(new URL("https://api.example.com/diff"))).text()).toBe(diff);
  });

  it("sends no body for 204", async () => {
    const fetch = createFixtureFetch([
      exchange({ method: "DELETE", url: "https://api.example.com/x" }, { status: 204 }),
    ]);
    const response = await fetch("https://api.example.com/x", { method: "DELETE" });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("matches Accept and the JSON body when recorded, ignoring key order", async () => {
    const fetch = createFixtureFetch([
      exchange(
        {
          method: "POST",
          url: "https://api.example.com/reviews",
          accept: "application/vnd.github+json",
          body: { event: "COMMENT", body: "hi" },
        },
        { body: { id: 9 } },
      ),
    ]);
    const response = await fetch("https://api.example.com/reviews", {
      method: "POST",
      headers: { accept: "application/vnd.github+json" },
      body: JSON.stringify({ body: "hi", event: "COMMENT" }),
    });
    expect(await response.json()).toEqual({ id: 9 });

    await expect(
      fetch("https://api.example.com/reviews", {
        method: "POST",
        headers: { accept: "application/vnd.github.diff" },
        body: JSON.stringify({ body: "hi", event: "COMMENT" }),
      }),
    ).rejects.toThrow(/No recorded exchange/);
    await expect(
      fetch("https://api.example.com/reviews", {
        method: "POST",
        headers: { accept: "application/vnd.github+json" },
        body: JSON.stringify({ body: "bye", event: "COMMENT" }),
      }),
    ).rejects.toThrow(/"bye"/);
  });

  it("answers repeated requests in order, then keeps the last answer", async () => {
    const url = "https://api.example.com/status";
    const fetch = createFixtureFetch([
      exchange({ method: "GET", url }, { body: { n: 1 } }),
      exchange({ method: "GET", url }, { body: { n: 2 } }),
    ]);
    const bodies = [];
    for (let i = 0; i < 3; i++) bodies.push(await (await fetch(url)).json());
    expect(bodies).toEqual([{ n: 1 }, { n: 2 }, { n: 2 }]);
  });

  it("throws on an unmatched method, URL or query, naming the request", async () => {
    const fetch = createFixtureFetch([
      exchange({ method: "GET", url: "https://api.example.com/a?page=1" }),
    ]);
    await expect(fetch("https://api.example.com/a?page=2")).rejects.toThrow(
      "No recorded exchange for GET https://api.example.com/a?page=2",
    );
    await expect(fetch("https://api.example.com/a?page=1", { method: "PUT" })).rejects.toThrow(
      /PUT/,
    );
  });
});
