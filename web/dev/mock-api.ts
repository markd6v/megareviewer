import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createMockApi,
  isEventsRequest,
  MOCK_TOKEN,
  type MockRequest,
  type MockResponse,
} from "./mock-routes.ts";

const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const toMockRequest = async (request: IncomingMessage): Promise<MockRequest> => {
  const url = new URL(request.url ?? "/", "http://mock");
  const headers = Object.fromEntries(
    Object.entries(request.headers).map(([name, value]) => [
      name,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  return {
    method: request.method ?? "GET",
    path: url.pathname,
    query: url.searchParams,
    headers,
    body: await readBody(request),
  };
};

const sendJson = (response: ServerResponse, { status, body }: MockResponse) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

/** Serves the HTTP API contract from fixtures, so the UI can be built without the server. */
export const mockApi = (): Plugin => ({
  name: "megareviewer-mock-api",
  configureServer(server) {
    const api = createMockApi();
    server.httpServer?.on("close", () => api.close());
    server.httpServer?.once("listening", () => {
      const address = server.httpServer?.address();
      const port = typeof address === "object" && address !== null ? address.port : 5173;
      server.config.logger.info(`  Mock API: open http://localhost:${port}/?token=${MOCK_TOKEN}`);
    });

    server.middlewares.use((request, response, next) => {
      const path = new URL(request.url ?? "/", "http://mock").pathname;
      if (!path.startsWith("/api/")) {
        next();
        return;
      }
      void toMockRequest(request).then((mockRequest) => {
        if (!isEventsRequest(mockRequest.method, mockRequest.path)) {
          sendJson(response, api.handle(mockRequest));
          return;
        }
        const open = () => {
          if (response.headersSent) return;
          response.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          });
          response.flushHeaders();
        };
        // The first event can arrive before `events` returns.
        const subscription = api.events(mockRequest, (event) => {
          if (response.writableEnded) return;
          open();
          response.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
          if (event.event === "done") response.end();
        });
        if ("status" in subscription) {
          sendJson(response, subscription);
          return;
        }
        response.on("close", subscription.unsubscribe);
        open();
      });
    });
  },
});
