import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Context, Hono } from "hono";
import { getMimeType } from "hono/utils/mime";

const INDEX = "index.html";

/**
 * The path's segments, decoded, or null when one could step outside the UI's folder.
 * The URL parser already resolves `..` and `%2e%2e`; this catches what decoding reveals.
 */
const safeSegments = (pathname: string): string[] | null => {
  try {
    const segments = pathname
      .split("/")
      .filter((segment) => segment !== "")
      .map(decodeURIComponent);
    const unsafe = segments.some(
      (segment) =>
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        segment.includes("\0"),
    );
    return unsafe ? null : segments;
  } catch {
    return null;
  }
};

const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const serveFile = async (
  c: Context,
  path: string,
  name: string,
  cacheControl: string | null,
): Promise<Response> => {
  const headers: Record<string, string> = {
    "Content-Type": getMimeType(name) ?? "application/octet-stream",
  };
  if (cacheControl !== null) headers["Cache-Control"] = cacheControl;
  return c.body(await readFile(path), 200, headers);
};

/**
 * Serves the built UI. Unknown paths get index.html, so client-side routes like /review/:id
 * load the app. Hashed assets are cached forever; index.html never is, so updates show up.
 */
export const registerStaticFiles = (app: Hono, staticDir: string): void => {
  app.get("*", async (c) => {
    const { pathname } = new URL(c.req.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) return c.notFound();
    const segments = safeSegments(pathname);
    if (segments === null) return c.text("Not found", 404);

    const name = segments.at(-1);
    const path = join(staticDir, ...segments);
    if (name !== undefined && name !== INDEX && (await isFile(path))) {
      const immutable = segments[0] === "assets";
      return serveFile(c, path, name, immutable ? "public, max-age=31536000, immutable" : null);
    }
    const index = join(staticDir, INDEX);
    if (!(await isFile(index))) return c.text("Not found", 404);
    return serveFile(c, index, INDEX, "no-store");
  });
};
