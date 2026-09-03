import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Money Tees multi-user gate — any signed mt_session token passes middleware;
// real per-user auth is enforced in /api/ledger + /api/auth via lib/auth verifyToken + DB.
const COOKIE = 'mt_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login, all APIs (each enforces per-user auth + returns 401 JSON), static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon-') ||
    pathname.startsWith('/apple-') ||
    pathname.startsWith('/og.png') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/site.webmanifest'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE)?.value;
  if (token && token.length > 10) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|favicon.ico|og.png|images|fonts).*)'],
};
