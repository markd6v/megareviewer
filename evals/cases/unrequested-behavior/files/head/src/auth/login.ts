import type { Request, Response } from "express";
import { z } from "zod";
import { analytics } from "../analytics.ts";
import { checkPassword, createSession } from "./sessions.ts";

const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000;

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export async function login(req: Request, res: Response): Promise<void> {
  const body = LoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  const user = await checkPassword(body.data.email, body.data.password);
  if (!user) {
    res.status(401).json({ error: "wrong email or password" });
    return;
  }
  const session = await createSession(user.id, {
    expiresInMs: body.data.rememberMe ? REMEMBER_ME_MS : undefined,
  });
  res.cookie("session", session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    ...(body.data.rememberMe && { maxAge: REMEMBER_ME_MS }),
  });
  analytics.track("login", {
    userId: user.id,
    email: user.email,
    ip: req.ip,
    rememberMe: body.data.rememberMe,
  });
  res.status(204).end();
}
