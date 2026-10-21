/** One HTTP request and its response, as recorded from a real API or written from its docs. */
export interface RecordedExchange {
  readonly request: {
    readonly method: string;
    /** Absolute URL, including the query. */
    readonly url: string;
    /** Matched only when recorded. */
    readonly accept?: string;
    /** JSON body, matched only when recorded. */
    readonly body?: unknown;
  };
  readonly response: {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    /** JSON, or a string sent as is (e.g. a diff). */
    readonly body: unknown;
  };
}

/** JSON with sorted keys, so bodies compare equal regardless of key order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );

const parseBody = (text: string): unknown => {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

const toResponse = ({ status, headers, body }: RecordedExchange["response"]): Response => {
  const text =
    NO_BODY_STATUSES.has(status) || body === undefined || body === null
      ? null
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return new Response(text, { status, headers: { ...headers } });
};

/**
 * A `fetch` that answers from recorded exchanges and throws on anything else, so a missing
 * fixture fails the test instead of reaching the network. When several exchanges match, they
 * answer in order, and the last one keeps answering.
 */
export const createFixtureFetch = (exchanges: readonly RecordedExchange[]): typeof fetch => {
  const used = new Set<RecordedExchange>();
  return async (input, init) => {
    const request = new Request(input, init);
    const accept = request.headers.get("accept");
    const body = parseBody(await request.text());
    const matches = exchanges.filter(
      ({ request: recorded }) =>
        recorded.method.toUpperCase() === request.method &&
        new URL(recorded.url).href === request.url &&
        (recorded.accept === undefined || recorded.accept === accept) &&
        (recorded.body === undefined || canonical(recorded.body) === canonical(body)),
    );
    const exchange = matches.find((candidate) => !used.has(candidate)) ?? matches.at(-1);
    if (exchange === undefined) {
      throw new Error(
        `No recorded exchange for ${request.method} ${request.url}\n` +
          `accept: ${accept}\nbody: ${JSON.stringify(body)}`,
      );
    }
    used.add(exchange);
    return toResponse(exchange.response);
  };
};
