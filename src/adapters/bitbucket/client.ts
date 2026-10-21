import type { z } from "zod";
import type { Logger } from "../../application/ports/index.ts";
import type { HostError } from "../../domain/review/index.ts";
import { err, ok, type Result } from "../../domain/shared/index.ts";
import { type CallKind, fromErrorResponse, invalidResponse, networkError } from "./errors.ts";
import { BitbucketPage } from "./schemas.ts";

export const API = "https://api.bitbucket.org/2.0";
const API_ORIGIN = new URL(API).origin;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
/** Pages followed per list before giving up and logging, so a huge list can't stall a call. */
export const MAX_PAGES = 10;

export interface ClientOptions {
  readonly email: string;
  readonly apiToken: string;
  readonly logger: Logger;
  readonly fetch: typeof fetch;
}

export interface JsonRequest {
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
  readonly call?: CallKind;
}

/** Bitbucket's REST API over plain fetch: Basic auth, redirects, errors and pagination. */
export interface BitbucketClient {
  json<T>(
    what: string,
    schema: z.ZodType<T>,
    url: string,
    request?: JsonRequest,
  ): Promise<Result<T, HostError>>;
  /** A raw response (a diff, a file), decoded as UTF-8. */
  text(url: string, accept: string): Promise<Result<string, HostError>>;
  /** Every item of a paginated list, following `next` for at most MAX_PAGES pages. */
  pages<T>(what: string, item: z.ZodType<T>, url: string): Promise<Result<T[], HostError>>;
}

export const createBitbucketClient = (options: ClientOptions): BitbucketClient => {
  const { logger } = options;
  const authorization = `Basic ${Buffer.from(`${options.email}:${options.apiToken}`).toString("base64")}`;

  /**
   * Follows redirects itself so the credentials only ever go to Bitbucket's API: a redirect
   * elsewhere (an LFS file's media URL) is followed without them.
   */
  const send = async (
    url: string,
    accept: string,
    request: JsonRequest = {},
  ): Promise<Result<Response, HostError>> => {
    let target = url;
    for (let hop = 0; ; hop += 1) {
      const toApi = new URL(target).origin === API_ORIGIN;
      const hasBody = request.body !== undefined;
      let response: Response;
      try {
        response = await options.fetch(target, {
          method: request.method ?? "GET",
          redirect: "manual",
          headers: {
            accept,
            ...(toApi ? { authorization } : {}),
            ...(hasBody ? { "content-type": "application/json" } : {}),
          },
          ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
        });
      } catch (error) {
        // fetch throws a TypeError when it can't connect. Anything else is a bug.
        if (error instanceof TypeError) return err(networkError(error));
        throw error;
      }
      const location = response.headers.get("location");
      if (
        !REDIRECTS.has(response.status) ||
        location === null ||
        hasBody ||
        hop === MAX_REDIRECTS
      ) {
        return ok(response);
      }
      target = new URL(location, target).href;
    }
  };

  /** Sends, and turns a non-2xx answer into a HostError. */
  const receive = async (
    url: string,
    accept: string,
    request: JsonRequest = {},
  ): Promise<Result<Response, HostError>> => {
    const response = await send(url, accept, request);
    if (!response.ok || response.value.ok) return response;
    const { status, headers } = response.value;
    const body = await response.value.text();
    return err(fromErrorResponse({ status, headers, body }, request.call ?? "read"));
  };

  const json = async <T>(
    what: string,
    schema: z.ZodType<T>,
    url: string,
    request: JsonRequest = {},
  ): Promise<Result<T, HostError>> => {
    const response = await receive(url, "application/json", request);
    if (!response.ok) return response;
    const text = await response.value.text();
    let data: unknown;
    try {
      data = text === "" ? null : JSON.parse(text);
    } catch {
      return err(invalidResponse(what, "the body isn't JSON"));
    }
    const parsed = schema.safeParse(data);
    return parsed.success ? ok(parsed.data) : err(invalidResponse(what, parsed.error));
  };

  const pages = async <T>(
    what: string,
    item: z.ZodType<T>,
    url: string,
  ): Promise<Result<T[], HostError>> => {
    const page = BitbucketPage(item);
    const items: T[] = [];
    let next: string | undefined = url;
    for (let count = 0; next !== undefined; count += 1) {
      if (count === MAX_PAGES) {
        logger.warn(`Stopped after ${MAX_PAGES} pages of ${what}; later ones are missing`, { url });
        break;
      }
      const result: Result<z.infer<typeof page>, HostError> = await json(what, page, next);
      if (!result.ok) return result;
      items.push(...result.value.values);
      next = result.value.next;
    }
    return ok(items);
  };

  return {
    json,
    pages,

    async text(url, accept) {
      const response = await receive(url, accept);
      if (!response.ok) return response;
      // Bitbucket sends files and diffs in the repository's encoding, with no charset.
      return ok(new TextDecoder().decode(await response.value.arrayBuffer()));
    },
  };
};
