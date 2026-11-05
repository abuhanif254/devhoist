import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const response = NextResponse.next();

  // ----------------------------------------------------------------------------
  // 1. 90-DAY AUTOMATED AFFILIATE TRACKING COOKIE (?ref= & subid=)
  // ----------------------------------------------------------------------------
  const refCode = searchParams.get('ref');
  const subId = searchParams.get('subid') || searchParams.get('sub_id') || 'organic';

  if (refCode && refCode.trim().length > 0) {
    const cleanRef = refCode.trim().toLowerCase();
    const cookiePayload = JSON.stringify({
      code: cleanRef,
      subid: subId.slice(0, 32),
      timestamp: Date.now(),
      landing: pathname,
    });

    // 90 Days = 7,776,000 seconds
    const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;

    response.cookies.set('devhost_aff_ref', cookiePayload, {
      maxAge: NINETY_DAYS_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // Accessible to checkout client to attach to invoice
    });
  }

  // ----------------------------------------------------------------------------
  // 2. CSRF ORIGIN GUARD FOR API MUTATION ENDPOINTS (POST, PUT, DELETE)
  // ----------------------------------------------------------------------------
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) &&
    !pathname.startsWith('/api/payments/webhook') // Webhooks from bKash/Nagad are external
  ) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host && !originUrl.host.includes('localhost') && !originUrl.host.includes('devhoist.pages.dev') && !originUrl.host.includes('devhost.net')) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'CSRF Origin mismatch blocked' },
            { status: 403 }
          );
        }
      } catch {
        // Invalid URL format
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 3. SECURITY HEADERS INJECTION
  // ----------------------------------------------------------------------------
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
