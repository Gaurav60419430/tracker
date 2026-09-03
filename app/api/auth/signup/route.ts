import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, createToken, hashPassword, newUserId, validateCredentials } from '@/lib/auth';
import { findUserByUsername, getRawLedger, insertUser, putLedgerData } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { userId, password } -> create account (free DB, isolated per-user ledger)
// New accounts start with salary 0 / expenses 0 (empty ledger {}).
export async function POST(req: NextRequest) {
  try {
    const { userId, password } = (await req.json().catch(() => ({}))) as { userId?: string; password?: string };
    const checked = validateCredentials({ userId, password });
    if ('error' in checked) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });

    const existing = await findUserByUsername(checked.username);
    if (existing) return NextResponse.json({ ok: false, error: 'User ID taken — try another or Sign in' }, { status: 409 });

    const id = newUserId();
    const passwordHash = await hashPassword(checked.password);
    await insertUser({ id, username: checked.username, displayName: checked.displayName, passwordHash, createdAt: Date.now() });

    // New account: empty ledger {} -> client shows salary 0 / expenses 0
    // If this is Gaurav's first signup and an old 'default' ledger exists, migrate it instead.
    let seedData = '{}';
    try {
      if (checked.username === 'gaurav') {
        const old = await getRawLedger('default');
        if (old?.data && old.data !== '{}') seedData = old.data;
      }
    } catch {}
    await putLedgerData(id, seedData);

    const res = NextResponse.json({ ok: true, user: checked.displayName });
    const token = createToken(id);
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set('mt_ok', '1', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    console.error('[auth signup] error', e);
    return NextResponse.json({ ok: false, error: 'Signup unavailable — try again' }, { status: 500 });
  }
}
