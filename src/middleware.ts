import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * High-performance, zero-database Cloudflare Edge Middleware.
 * Deliberately performs ZERO remote database or external fetch calls on the request path,
 * eliminating Cloudflare Error 1102 (Worker exceeded resource limits / CPU time limit).
 * 
 * Route authentication is handled client-side by PortalContext once Supabase
 * has deterministically resolved the session.
 */

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DevHost-WAF', 'Active-Shield-v2.6');
  return response;
}

function isTrustedOrigin(origin: string, host: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase();
    const originHostname = originUrl.hostname.toLowerCase();
    const targetHost = host.toLowerCase();

    if (originHost === targetHost) return true;
    if (process.env.NODE_ENV !== 'production' && (originHostname === 'localhost' || originHostname === '127.0.0.1')) {
      return true;
    }

    const allowedDomains = ['devhoist.pages.dev', 'devhoist.workers.dev', 'devhost.net', 'devhostcloud.com'];
    return allowedDomains.some(
      (domain) => originHostname === domain || originHostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  try {
    const { pathname, searchParams } = request.nextUrl;

    // Immediately pass through Next.js internal and static routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.woff2')
    ) {
      return NextResponse.next();
    }

    const response = NextResponse.next();

    // ------------------------------------------------------------------------
    // 1. 90-DAY AFFILIATE TRACKING COOKIE (?ref= & subid=)
    // ------------------------------------------------------------------------
    const refCode = searchParams.get('ref');
    const subId = searchParams.get('subid') || searchParams.get('sub_id') || 'organic';

    if (refCode && refCode.trim().length > 0) {
      const cookiePayload = JSON.stringify({
        code: refCode.trim().toLowerCase(),
        subid: subId.slice(0, 32),
        timestamp: Date.now(),
        landing: pathname,
      });

      response.cookies.set('devhost_aff_ref', cookiePayload, {
        maxAge: 60 * 60 * 24 * 90,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false, // Accessible to checkout client to attach to invoice
      });
    }

    // ------------------------------------------------------------------------
    // 2. CSRF ORIGIN GUARD FOR STATE-CHANGING API REQUESTS
    // ------------------------------------------------------------------------
    if (
      pathname.startsWith('/api/') &&
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) &&
      !pathname.startsWith('/api/payments/webhook') &&
      !pathname.startsWith('/api/webhooks/git')
    ) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');

      if (origin && host && !isTrustedOrigin(origin, host)) {
        return applySecurityHeaders(
          NextResponse.json({ error: 'Forbidden', message: 'CSRF Origin mismatch blocked' }, { status: 403 })
        );
      }
    }

    // ------------------------------------------------------------------------
    // 3. SECURITY HEADERS
    // ------------------------------------------------------------------------
    return applySecurityHeaders(response);
  } catch (err) {
    // Middleware must NEVER fail or surface a 500/1102 to the user
    console.warn('[Edge Middleware Notice - fail-open]:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
