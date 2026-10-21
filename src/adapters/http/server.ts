import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export interface HttpServer {
  readonly port: number;
  /** Stops listening and drops open connections, event streams included. */
  close(): Promise<void>;
}

/** Listens on 127.0.0.1 only. Port 0 picks any free port. */
export const startHttpServer = (
  app: Hono,
  options: { readonly port: number },
): Promise<HttpServer> =>
  new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port: options.port, hostname: "127.0.0.1" }, (info) =>
      resolve({
        port: info.port,
        close: () =>
          new Promise((closed, failed) => {
            server.close((error) => (error === undefined ? closed() : failed(error)));
            if ("closeAllConnections" in server) server.closeAllConnections();
          }),
      }),
    );
    server.once("error", reject);
  });
