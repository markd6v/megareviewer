import type { Request, Response } from "express";
import { z } from "zod";
import { checkPassword, createSession } from "./sessions.ts";

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
  const session = await createSession(user.id);
  res.cookie("session", session.token, { httpOnly: true, secure: true, sameSite: "lax" });
  res.status(204).end();
}
