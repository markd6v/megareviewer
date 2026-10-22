import { Hono } from "hono";
import { type HttpServer, startHttpServer } from "../adapters/http/index.ts";

/**
 * Listens on `port` (0: any free port) and serves the app made for the port it got. The app's
 * Host check needs the port, which with port 0 is only known once the server listens.
 */
export const serve = async (appFor: (port: number) => Hono, port: number): Promise<HttpServer> => {
  let app: Hono | null = null;
  const root = new Hono().all("*", (c) =>
    app === null ? c.text("Starting", 503) : app.fetch(c.req.raw, c.env),
  );
  const server = await startHttpServer(root, { port });
  app = appFor(server.port);
  return server;
};
