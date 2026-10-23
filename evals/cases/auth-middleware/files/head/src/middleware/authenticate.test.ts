import { describe, expect, it, vi } from "vitest";
import { authenticate } from "./authenticate.ts";
import { fakeRequest, fakeResponse, validToken } from "../testing.ts";

describe("authenticate", () => {
  it("accepts a token in the query string on the events stream", async () => {
    const next = vi.fn();
    const req = fakeRequest({ method: "GET", path: "/orders/42/events", query: { access_token: validToken } });
    await authenticate(req, fakeResponse(), next);
    expect(next).toHaveBeenCalled();
  });

  it("ignores a query token on other routes", async () => {
    const res = fakeResponse();
    const req = fakeRequest({ method: "GET", path: "/orders/42", query: { access_token: validToken } });
    await authenticate(req, res, vi.fn());
    expect(res.statusCode).toBe(401);
  });
});
