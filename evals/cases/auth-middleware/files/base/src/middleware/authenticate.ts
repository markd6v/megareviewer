import type { NextFunction, Request, Response } from "express";
import { verifySession } from "../sessions.ts";

/** Resolves the session from the Authorization header and sets req.user, or answers 401. */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
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
