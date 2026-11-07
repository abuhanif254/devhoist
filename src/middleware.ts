import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp, checkEdgeWaf, getSecurityLockdown } from '@/lib/wafEngine';

/**
 * Auth/static routes that must NEVER hit a database or WAF lookup from the edge.
 * Sessions live in the browser (Supabase localStorage), so the middleware deliberately does NOT
 * gate /dashboard or /admin: route protection is done client-side by PortalContext once
 * supabase.auth.getSession() has resolved. This prevents server/client redirect loops.
 */
const DB_FREE_PREFIXES = [
  '/_next',
  '/auth/callback',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/favicon',
];

function isDbFreePath(pathname: string): boolean {
  return DB_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DevHost-WAF', 'Active-Shield-v2.6');
  return response;
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname, searchParams } = request.nextUrl;

    // ------------------------------------------------------------------------
    // 0. EDGE WAF / EMERGENCY LOCKDOWN (skipped for static + auth pages; fail-open)
    // ------------------------------------------------------------------------
    if (!isDbFreePath(pathname) || pathname === '/register') {
      try {
        const clientIp = getClientIp(request);

        if (!isDbFreePath(pathname)) {
          const wafCheck = await checkEdgeWaf(clientIp);
          if (wafCheck.blocked && wafCheck.action === 'block_403') {
            return new NextResponse(
              JSON.stringify({
                error: 'Access Denied',
                message: '403 Forbidden — Access Denied by DevHost Cloud Edge WAF Firewall.',
                reason: wafCheck.reason || 'Malicious entity or IP detected.',
                clientIp,
                timestamp: new Date().toISOString(),
              }),
              {
                status: 403,
                headers: {
                  'Content-Type': 'application/json',
                  'X-DevHost-WAF-Block': 'true',
                  'Retry-After': '86400',
                },
              }
            );
          }
        }

        const lockdown = await getSecurityLockdown();

        if (lockdown.maintenance_mode && !pathname.startsWith('/admin') && !pathname.startsWith('/api/admin') && !isDbFreePath(pathname)) {
          return new NextResponse(
            JSON.stringify({
              status: 'Maintenance',
              message: 'DevHost Cloud is undergoing scheduled infrastructure upgrades. Please check back shortly.',
              timestamp: new Date().toISOString(),
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (lockdown.block_new_signups && (pathname === '/register' || pathname.startsWith('/api/auth/register'))) {
          return new NextResponse(
            JSON.stringify({
              error: 'Registration Paused',
              message: 'New user registrations are temporarily paused by administration.',
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (wafErr) {
        // Fail-open so unexpected Edge errors never take down normal browsing
        console.warn('[Edge Middleware WAF Warning]:', wafErr);
      }
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

      if (origin && host) {
        try {
          const originUrl = new URL(origin);
          if (
            originUrl.host !== host &&
            !originUrl.host.includes('localhost') &&
            !originUrl.host.includes('devhoist.pages.dev') &&
            !originUrl.host.includes('devhost.net')
          ) {
            return applySecurityHeaders(
              NextResponse.json({ error: 'Forbidden', message: 'CSRF Origin mismatch blocked' }, { status: 403 })
            );
          }
        } catch {
          // Invalid Origin header format - ignore
        }
      }
    }

    // ------------------------------------------------------------------------
    // 3. SECURITY HEADERS
    // ------------------------------------------------------------------------
    return applySecurityHeaders(response);
  } catch (err) {
    // Middleware must NEVER surface a 500 to the user
    console.error('[Edge Middleware Fatal - failing open]:', err);
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
