import type { NextFunction, Request, Response } from "express";
import { verifySession } from "../sessions.ts";

/**
 * EventSource can't set headers, so the live order stream sends the session token as
 * ?access_token= instead.
 */
const tokenFromQuery = (req: Request): string | undefined => {
  if (req.method !== "GET" || !req.path.endsWith("/events")) return undefined;
  const value = req.query.access_token;
  return typeof value === "string" ? value : undefined;
};

/** Resolves the session from the Authorization header and sets req.user, or answers 401. */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : tokenFromQuery(req);
  if (!token) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const session = await verifySession(token);
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  req.user = session.user;
  next();
}
