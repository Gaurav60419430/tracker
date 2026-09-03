import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureLedgerTable, getDb } from '@/lib/db';
import { ledgers } from '@/lib/db/schema';

export const runtime = 'nodejs'; // keep Node, not edge, for libsql file support; works on Vercel Node & Cloudflare via Workers with nodejs_compat
export const dynamic = 'force-dynamic';

const DEFAULT_ID = 'default';

// GET /api/ledger -> { ledger: Ledger | null, updatedAt: number | null }
export async function GET() {
  try {
    await ensureLedgerTable();
    const db = getDb();
    const rows = await db.select().from(ledgers).where(eq(ledgers.id, DEFAULT_ID)).limit(1);
    if (!rows[0]) return NextResponse.json({ ledger: null, updatedAt: null });
    const parsed = JSON.parse(rows[0].data) as unknown;
    return NextResponse.json({ ledger: parsed, updatedAt: rows[0].updatedAt });
  } catch (e) {
    console.error('[ledger GET] db error', e);
    // Fallback: return null so client uses localStorage
    return NextResponse.json({ ledger: null, updatedAt: null, error: 'db_unavailable' }, { status: 200 });
  }
}

// PUT /api/ledger Body: { ledger: Ledger }
export async function PUT(req: Request) {
  try {
    await ensureLedgerTable();
    const body = (await req.json().catch(() => null)) as { ledger?: unknown } | null;
    if (!body?.ledger || typeof body.ledger !== 'object') {
      return NextResponse.json({ error: 'invalid ledger' }, { status: 400 });
    }
    // Basic size guard — prevent huge payloads wiping DB (5MB)
    const json = JSON.stringify(body.ledger);
    if (json.length > 5_000_000) return NextResponse.json({ error: 'payload too large' }, { status: 413 });

    const now = Date.now();
    const db = getDb();
    await db
      .insert(ledgers)
      .values({ id: DEFAULT_ID, data: json, updatedAt: now })
      .onConflictDoUpdate({ target: ledgers.id, set: { data: json, updatedAt: now } });

    return NextResponse.json({ ok: true, updatedAt: now });
  } catch (e) {
    console.error('[ledger PUT] db error', e);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });
  }
}
