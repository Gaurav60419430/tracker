import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getLedgerData, putLedgerData } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/ledger -> { ledger, updatedAt } — ONLY the logged-in user's data.
// New accounts return {} (salary 0 / expenses 0). Unauthenticated -> 401.
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ledger: null, updatedAt: null, error: 'unauthenticated' }, { status: 401 });
    const row = await getLedgerData(user.id);
    if (!row) {
      await putLedgerData(user.id, '{}');
      return NextResponse.json({ ledger: {}, updatedAt: null });
    }
    const parsed = JSON.parse(row.data) as unknown;
    return NextResponse.json({ ledger: parsed, updatedAt: row.updatedAt });
  } catch (e) {
    console.error('[ledger GET] db error', e);
    return NextResponse.json({ ledger: null, updatedAt: null, error: 'db_unavailable' }, { status: 200 });
  }
}

// PUT /api/ledger Body: { ledger } — saves ONLY to the logged-in user's row.
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const body = (await req.json().catch(() => null)) as { ledger?: unknown } | null;
    if (!body?.ledger || typeof body.ledger !== 'object') {
      return NextResponse.json({ error: 'invalid ledger' }, { status: 400 });
    }
    const json = JSON.stringify(body.ledger);
    if (json.length > 5_000_000) return NextResponse.json({ error: 'payload too large' }, { status: 413 });

    const updatedAt = await putLedgerData(user.id, json);
    return NextResponse.json({ ok: true, updatedAt });
  } catch (e) {
    console.error('[ledger PUT] db error', e);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });
  }
}
