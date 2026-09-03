import { eq } from 'drizzle-orm';
import { ensureTables, getDb, isMemoryMode, memLedgers, memUsers } from './index';
import { ledgers, users, type NewLedgerRow, type NewUserRow, type UserRow } from './schema';

// Unified store: real free DB (Turso/libSQL) when available, in-memory fallback for
// Cloudflare workerd dev without TURSO (vinext dev has no filesystem for file: URLs).
// In production set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (free tier) for many-year persistence.

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  await ensureTables();
  if (isMemoryMode()) {
    for (const u of memUsers.values() as IterableIterator<UserRow>) {
      if (u.username === username) return u;
    }
    return null;
  }
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  await ensureTables();
  if (isMemoryMode()) {
    return (memUsers.get(id) as UserRow | undefined) ?? null;
  }
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertUser(row: NewUserRow): Promise<void> {
  await ensureTables();
  if (isMemoryMode()) {
    memUsers.set(row.id, { ...row } as UserRow);
    return;
  }
  const db = getDb();
  await db.insert(users).values(row);
}

export async function getLedgerData(userId: string): Promise<{ data: string; updatedAt: number } | null> {
  await ensureTables();
  if (isMemoryMode()) {
    const row = memLedgers.get(userId) as NewLedgerRow | undefined;
    if (!row) return null;
    return { data: row.data, updatedAt: row.updatedAt };
  }
  const db = getDb();
  const rows = await db.select().from(ledgers).where(eq(ledgers.id, userId)).limit(1);
  if (!rows[0]) return null;
  return { data: rows[0].data, updatedAt: rows[0].updatedAt };
}

export async function putLedgerData(userId: string, data: string): Promise<number> {
  await ensureTables();
  const now = Date.now();
  if (isMemoryMode()) {
    memLedgers.set(userId, { id: userId, data, updatedAt: now });
    return now;
  }
  const db = getDb();
  await db
    .insert(ledgers)
    .values({ id: userId, data, updatedAt: now })
    .onConflictDoUpdate({ target: ledgers.id, set: { data, updatedAt: now } });
  return now;
}

export async function getRawLedger(id: string): Promise<{ data: string } | null> {
  await ensureTables();
  if (isMemoryMode()) {
    const row = memLedgers.get(id) as NewLedgerRow | undefined;
    return row ? { data: row.data } : null;
  }
  const db = getDb();
  const rows = await db.select().from(ledgers).where(eq(ledgers.id, id)).limit(1);
  return rows[0] ? { data: rows[0].data } : null;
}
