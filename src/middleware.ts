import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp, checkEdgeWaf, getSecurityLockdown } from '@/lib/wafEngine';

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const clientIp = getClientIp(request);

  // ----------------------------------------------------------------------------
  // 0. REAL-TIME EDGE WAF IP BLACKLIST & EMERGENCY LOCKDOWN ENFORCEMENT
  // ----------------------------------------------------------------------------
  try {
    // 0A. Evaluate client IP against active edge WAF blacklist rules
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

    // 0B. Check sitewide emergency lockdown configuration
    const lockdown = await getSecurityLockdown();

    // Maintenance Mode Check
    if (
      lockdown.maintenance_mode &&
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/api/admin') &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/_next')
    ) {
      return new NextResponse(
        JSON.stringify({
          status: 'Maintenance',
          message: 'DevHost Cloud is undergoing scheduled infrastructure upgrades. Please check back shortly.',
          timestamp: new Date().toISOString(),
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Block New Signups Emergency Switch
    if (
      lockdown.block_new_signups &&
      (pathname === '/register' || pathname.startsWith('/api/auth/register'))
    ) {
      return new NextResponse(
        JSON.stringify({
          error: 'Registration Paused',
          message: 'New user registrations are temporarily paused by administration.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (wafErr) {
    // Fail-open defensively so unexpected Edge errors do not take down normal browsing
    console.warn('[Edge Middleware WAF Warning]:', wafErr);
  }

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
    !pathname.startsWith('/api/payments/webhook') && // External webhooks
    !pathname.startsWith('/api/webhooks/git') // GitHub deploy webhooks
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
  response.headers.set('X-DevHost-WAF', 'Active-Shield-v2.6');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
