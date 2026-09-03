import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE = 'mt_session';
const USER = 'Gaurav';
const PASS = '6041';
const TOKEN = Buffer.from(`${USER}:${PASS}`).toString('base64');

// POST { userId, password } -> set cookie if ok
export async function POST(req: NextRequest) {
  try {
    const { userId, password } = (await req.json().catch(() => ({}))) as { userId?: string; password?: string };
    if (userId === USER && password === PASS) {
      const res = NextResponse.json({ ok: true, user: USER });
      res.cookies.set(COOKIE, TOKEN, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days — many-year use, re-login monthly
      });
      // also set readable flag for client guard (vinext dev fallback)
      res.cookies.set('mt_ok', '1', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }
}

// DELETE -> logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set('mt_ok', '', { httpOnly: false, path: '/', maxAge: 0 });
  return res;
}

// GET -> check (uses NextRequest cookies which correctly handle base64 padding)
export async function GET(req: NextRequest) {
  const val = req.cookies.get(COOKIE)?.value;
  // also support raw header fallback with proper decode
  const raw = val ?? req.headers.get('cookie')?.split(';').find((c) => c.trim().startsWith(`${COOKIE}=`))?.split(`${COOKIE}=`)[1]?.trim();
  const decoded = raw ? decodeURIComponent(raw) : undefined;
  if (decoded === TOKEN || val === TOKEN) return NextResponse.json({ authenticated: true, user: USER });
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
