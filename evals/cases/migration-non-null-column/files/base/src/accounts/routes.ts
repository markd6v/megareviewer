import { Router } from "express";
import { z } from "zod";
import { db } from "../db.ts";
import { createAccount, findAccount } from "./repository.ts";

const CreateAccount = z.object({
  name: z.string().min(1).max(100),
  ownerEmail: z.string().email(),
});

export const accountsRouter = Router();

accountsRouter.post("/accounts", async (req, res) => {
  const body = CreateAccount.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  res.status(201).json(await createAccount(db, body.data));
});

accountsRouter.get("/accounts/:id", async (req, res) => {
  const account = await findAccount(db, req.params.id);
  if (!account) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(account);
});
