import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Singleton — survives HMR / serverless warm starts.
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
  if (_client) return _client;

  // 1) Turso / remote libSQL (works on Cloudflare Workers via fetch + Vercel Node)
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    _client = createClient({ url: tursoUrl, authToken: tursoToken });
    return _client;
  }

  // 2) Generic libSQL URL (e.g. libsql:// or https://)
  const libUrl = process.env.DATABASE_URL?.trim();
  if (libUrl && (libUrl.startsWith('libsql://') || libUrl.startsWith('https://') || libUrl.startsWith('http://'))) {
    _client = createClient({ url: libUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
    return _client;
  }

  // 3) Local file for dev / fallback (file:./data/money-tees.db) — absolute for Workers/Vite SSR
  // On Vercel/Workers without TURSO, this is ephemeral — set TURSO_DATABASE_URL for true many-year persistence.
  // Keep file under ./data which is gitignored except .keep, survives local dev for years.
  let fileUrl = process.env.DATABASE_FILE_URL ?? 'file:./data/money-tees.db';
  if (fileUrl.startsWith('file:')) {
    try {
      let p = fileUrl.slice(5); // strip file:
      if (!p.startsWith('/')) {
        const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '/';
        p = resolve(cwd, p);
        const dir = p.slice(0, p.lastIndexOf('/'));
        if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      }
      fileUrl = `file:${p}`;
    } catch {}
  }
  _client = createClient({ url: fileUrl });
  return _client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (_db) return _db;
  const client = getClient();
  _db = drizzle(client, { schema });
  return _db;
}

// Ensure table exists (lightweight, idempotent). Called at API entry.
let _ensured = false;
export async function ensureLedgerTable() {
  if (_ensured) return;
  const client = getClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ledgers (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  _ensured = true;
}

export type Db = ReturnType<typeof getDb>;
