import type { Pool } from "pg";

export type Region = "us-east-1" | "eu-west-1";

export interface Account {
  id: string;
  name: string;
  ownerEmail: string;
  region: Region;
  createdAt: Date;
}

interface AccountRow {
  id: string;
  name: string;
  owner_email: string;
  region: Region;
  created_at: Date;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  ownerEmail: row.owner_email,
  region: row.region,
  createdAt: row.created_at,
});

export async function createAccount(
  db: Pool,
  input: { name: string; ownerEmail: string; region: Region },
): Promise<Account> {
  const { rows } = await db.query<AccountRow>(
    "INSERT INTO accounts (name, owner_email, region) VALUES ($1, $2, $3) RETURNING *",
    [input.name, input.ownerEmail, input.region],
  );
  const [row] = rows;
  if (!row) throw new Error("insert returned no row");
  return toAccount(row);
}

export async function findAccount(db: Pool, id: string): Promise<Account | null> {
  const { rows } = await db.query<AccountRow>("SELECT * FROM accounts WHERE id = $1", [id]);
  const [row] = rows;
  return row ? toAccount(row) : null;
}
