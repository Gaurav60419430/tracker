import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Money Tees gate — user Gaurav / 6041
const COOKIE = 'mt_session';
const EXPECTED = Buffer.from('Gaurav:6041').toString('base64'); // simple token

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login, api/auth, static assets, next internals
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
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
  if (token === EXPECTED) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|favicon.ico|og.png|images|fonts).*)'],
};
