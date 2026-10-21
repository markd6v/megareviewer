import { request } from "node:http";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { describe, expect, it } from "vitest";
import { startHttpServer } from "./index.ts";

/** Plain node:http on loopback, because tests block fetch. */
const get = (port: number, path: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
      });
      // "close" rather than "end", so a connection the server drops resolves too.
      res.on("close", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });

const app = new Hono()
  .get("/hello", (c) => c.text("hello"))
  // Never ends on its own, like an analysis's events.
  .get("/stream", (c) => streamSSE(c, () => new Promise(() => {})));

describe("startHttpServer", () => {
  it("serves the app on 127.0.0.1 at a free port", async () => {
    const server = await startHttpServer(app, { port: 0 });
    expect(server.port).toBeGreaterThan(0);
    expect(await get(server.port, "/hello")).toEqual({ status: 200, body: "hello" });
    await server.close();
  });

  it("closes with an event stream still open", async () => {
    const server = await startHttpServer(app, { port: 0 });
    const stream = get(server.port, "/stream");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await server.close();
    expect(await stream).toEqual({ status: 200, body: "" });
  });

  it("fails when the port is taken", async () => {
    const first = await startHttpServer(app, { port: 0 });
    await expect(startHttpServer(app, { port: first.port })).rejects.toThrow(/EADDRINUSE/);
    await first.close();
  });
});
