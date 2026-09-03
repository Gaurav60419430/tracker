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

  // 1) Turso / remote libSQL (FREE tier, works on Cloudflare Workers via fetch + Vercel Node)
  // Set TURSO_DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN=eyJ... for many-year cross-device persistence.
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
  // Ephemeral on Vercel/Workers without TURSO — set TURSO_* for true many-year persistence.
  let fileUrl = process.env.DATABASE_FILE_URL ?? 'file:./data/money-tees.db';
  if (fileUrl.startsWith('file:')) {
    try {
      let p = fileUrl.slice(5);
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

// In-memory fallback for Cloudflare workerd dev without TURSO (file: URLs unsupported in workerd).
// Production MUST set TURSO_* (free tier) for many-year persistence; memory is per-isolate ephemeral.
declare global {
  // eslint-disable-next-line no-var
  var __memUsers: Map<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var __memLedgers: Map<string, unknown> | undefined;
}
export const memUsers: Map<string, unknown> =
  (globalThis as { __memUsers?: Map<string, unknown> }).__memUsers ?? new Map();
export const memLedgers: Map<string, unknown> =
  (globalThis as { __memLedgers?: Map<string, unknown> }).__memLedgers ?? new Map();
(globalThis as { __memUsers?: Map<string, unknown> }).__memUsers = memUsers;
(globalThis as { __memLedgers?: Map<string, unknown> }).__memLedgers = memLedgers;

let _memory = false;
export function isMemoryMode(): boolean {
  return _memory;
}

// Ensure all tables exist (lightweight, idempotent). Called at API entry.
let _ensured = false;
export async function ensureTables() {
  if (_ensured && !_memory) return;
  if (_memory) return;
  try {
    const client = getClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ledgers (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    _ensured = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // workerd web-client has no file: support — fall back to memory for local dev
    if (msg.includes('URL_SCHEME_NOT_SUPPORTED') || msg.includes('file:')) {
      _memory = true;
      return;
    }
    throw e;
  }
}

// Back-compat alias
export const ensureLedgerTable = ensureTables;

export type Db = ReturnType<typeof getDb>;
