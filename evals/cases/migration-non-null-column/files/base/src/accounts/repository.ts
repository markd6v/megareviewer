import type { Pool } from "pg";

export interface Account {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: Date;
}

interface AccountRow {
  id: string;
  name: string;
  owner_email: string;
  created_at: Date;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  ownerEmail: row.owner_email,
  createdAt: row.created_at,
});

export async function createAccount(
  db: Pool,
  input: { name: string; ownerEmail: string },
): Promise<Account> {
  const { rows } = await db.query<AccountRow>(
    "INSERT INTO accounts (name, owner_email) VALUES ($1, $2) RETURNING *",
    [input.name, input.ownerEmail],
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
