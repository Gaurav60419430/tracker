import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE,
  createToken,
  getSessionUser,
  newUserId,
  validateCredentials,
  verifyPassword,
  hashPassword,
} from '@/lib/auth';
import { findUserByUsername, getRawLedger, insertUser, putLedgerData } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function setCookies(res: NextResponse, token: string) {
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
}

// POST { userId, password } -> login (multi-user, free Turso DB)
export async function POST(req: NextRequest) {
  try {
    const { userId, password } = (await req.json().catch(() => ({}))) as { userId?: string; password?: string };
    const checked = validateCredentials({ userId, password });
    if ('error' in checked) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });

    const row = await findUserByUsername(checked.username);

    // Back-compat: first-ever Gaurav/6041 login auto-creates account + migrates old 'default' ledger
    if (!row && checked.username === 'gaurav' && checked.password === '6041') {
      const id = newUserId();
      const passwordHash = await hashPassword(checked.password);
      await insertUser({ id, username: 'gaurav', displayName: checked.displayName, passwordHash, createdAt: Date.now() });
      try {
        const old = await getRawLedger('default');
        await putLedgerData(id, old?.data && old.data !== '{}' ? old.data : '{}');
      } catch {
        await putLedgerData(id, '{}');
      }
      const res = NextResponse.json({ ok: true, user: checked.displayName });
      setCookies(res, createToken(id));
      return res;
    }

    if (!row) return NextResponse.json({ ok: false, error: 'Account not found — please Sign up' }, { status: 401 });
    const ok = await verifyPassword(checked.password, row.passwordHash);
    if (!ok) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });

    const res = NextResponse.json({ ok: true, user: row.displayName });
    setCookies(res, createToken(row.id));
    return res;
  } catch (e) {
    console.error('[auth login] error', e);
    return NextResponse.json({ ok: false, error: 'Login unavailable — try again' }, { status: 500 });
  }
}

// DELETE -> logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set('mt_ok', '', { httpOnly: false, path: '/', maxAge: 0 });
  return res;
}

// GET -> check session, returns per-user identity (only their data is ever returned by /api/ledger)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, user: user.displayName, username: user.username });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
