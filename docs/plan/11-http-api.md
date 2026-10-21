# Stage 11: HTTP API

**Status:** In progress (branch stage/11-http-api)
**Depends on:** 10
**Unblocks:** 12
**Owns:** `src/adapters/http/`

## Goal

A Hono app that implements stage 02's API contract on top of stage 10's use cases, serves the built UI, and locks the local server down to the user's own browser tab.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Local server security"
- Stage 02: `contracts/` (routes, schemas, error codes and statuses)
- Stage 10: `createUseCases` and its error codes

## Scope

**In:** routing, validation, error mapping, SSE, session-token and Host checks, security headers, static file serving.
**Out:** choosing the port and token, starting the process (stage 12).

## Tasks

### 1. Construction

```ts
createHttpApp(options: {
  useCases: UseCases;
  events: AnalysisEvents;
  sessionToken: string;
  allowedHosts: string[];          // e.g. ["127.0.0.1:4823", "localhost:4823"]
  staticDir: string | null;        // built UI; null in tests and in dev (Vite serves it)
  logger: Logger;
}): Hono

startHttpServer(app: Hono, options: { port: number /* 0 = any free port */ }): Promise<{ port: number; close(): Promise<void> }>
```

`startHttpServer` uses `@hono/node-server` and always binds `127.0.0.1`.

### 2. Middleware, in order

1. **Request log:** method, path (without query string, which may hold the token), status, duration. Never log bodies or headers.
2. **Host check:** if the `Host` header isn't in `allowedHosts`, respond `403` with a plain-text body. This blocks DNS rebinding.
3. **Security headers on every response:**
   - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` (`unsafe-inline` styles are needed for syntax-highlighting colors set as style attributes)
   - `Referrer-Policy: no-referrer` (the first page load has the token in its URL)
   - `X-Content-Type-Options: nosniff`
4. **Session token** on `/api/*`: the `x-megareviewer-token` header must equal `sessionToken`, compared in constant time (`crypto.timingSafeEqual` on equal-length buffers). For the events route only, the `token` query parameter is accepted instead. Failure → `401 unauthorized`.

Static files and `index.html` don't need the token: the page reads it from its own URL.

### 3. Routes

Implement every route in stage 02's route table:

- Parse params and bodies with the contract's request schemas → `400 bad-request` with the Zod issues summarized in `message`.
- Call the matching use case.
- Map use-case error codes to statuses with the contract's table. Unknown exceptions → `500 internal`, logged with stack; the response message is generic.
- In tests, validate every response against the contract's response schema (a test helper, not production code).

### 4. Events (SSE)

`GET /api/analyses/:id/events?token=` with Hono's SSE streaming helper:

- 404 if the analysis doesn't exist.
- If the analysis is already `complete` or `failed`, send `done` and close.
- Otherwise subscribe to `events`; forward `updated` events as `event: updated` with JSON data, and `done` as `event: done`, then close.
- Send a comment line every 15 seconds as a heartbeat.
- Unsubscribe when the client disconnects.

### 5. Static UI

When `staticDir` is set:

- Serve files from it for `GET` requests outside `/api/`.
- Unknown paths fall back to `index.html` (client-side routes like `/review/:id`).
- `Cache-Control: no-store` for `index.html`; `public, max-age=31536000, immutable` for hashed assets under `assets/`.
- Reject path traversal (`..`, encoded or not).

## Tests

With `app.request()` in process, real use cases from stage 10, and stage 02 fakes:

- Every route: success, validation failure, and each error code it can return.
- Token: missing, wrong, right; query token accepted only on the events route.
- Host check: allowed, `localhost` variant, a foreign host → 403.
- Security headers present on API responses, static files and errors.
- SSE: events from a running fake pipeline arrive in order, `done` closes the stream, an already-complete analysis gets `done` immediately, unsubscribe on disconnect.
- Static: file served, SPA fallback, traversal rejected, cache headers.
- The request log never contains the token.

## Definition of done

- [ ] Every contract route is implemented and tested.
- [ ] Every response in tests matches its contract schema.
- [ ] All security checks above are tested.

## Open issues

_None yet._

## Notes for later stages

_None yet._
