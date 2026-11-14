import { NextResponse } from 'next/server';
import { extractCookie, requireUser, timingSafeEqualStr } from '@/lib/authGuard';
import {
  exchangeGitHubOAuthCode,
  fetchGitHubViewer,
  getCanonicalSiteUrl,
  getGitHubOAuthConfig,
  GITHUB_OAUTH_NONCE_COOKIE,
  GitHubApiError,
  saveUserGitHubAccount,
  sanitizeReturnToPath,
  verifyGitHubOAuthState,
} from '@/lib/githubIntegration';
import { logSecurityAudit } from '@/lib/security';
import { isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function wantsJsonResponse(req: Request, url: URL): boolean {
  if (url.searchParams.get('format') === 'json') return true;
  const accept = (req.headers.get('accept') || '').toLowerCase();
  return accept.includes('application/json') && !accept.includes('text/html');
}

function buildClearedCookieResponse(res: NextResponse, url: URL): NextResponse {
  const isHttps = url.protocol === 'https:' || process.env.NODE_ENV === 'production';
  res.cookies.set(GITHUB_OAUTH_NONCE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 0,
  });
  return res;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Control plane database backend is not configured.' },
        { status: 503 }
      );
    }

    const stateParam = (url.searchParams.get('state') || '').trim();
    const codeParam = (url.searchParams.get('code') || '').trim();
    const oauthError = (url.searchParams.get('error') || '').trim();
    const claims = verifyGitHubOAuthState(stateParam);

    if (!claims) {
      await logSecurityAudit({
        actorId: auth.user.id,
        actorRole: auth.role,
        actionType: 'GITHUB_OAUTH_INVALID_STATE',
        targetResource: `user:${auth.user.id}`,
        riskLevel: 'high',
        metadata: { hasState: Boolean(stateParam) },
      });
      return NextResponse.json(
        { error: 'Invalid or expired OAuth state parameter.' },
        { status: 400 }
      );
    }

    if (claims.userId !== auth.user.id) {
      await logSecurityAudit({
        actorId: auth.user.id,
        actorRole: auth.role,
        actionType: 'GITHUB_OAUTH_CSRF_MISMATCH',
        targetResource: `user:${auth.user.id}`,
        riskLevel: 'critical',
        metadata: { stateUserId: claims.userId, authenticatedUserId: auth.user.id },
      });
      return NextResponse.json(
        { error: 'Forbidden', message: 'OAuth state user binding mismatch (CSRF protection).' },
        { status: 403 }
      );
    }

    const cookieNonce = extractCookie(req, GITHUB_OAUTH_NONCE_COOKIE);
    if (!cookieNonce || !timingSafeEqualStr(cookieNonce, claims.nonce)) {
      await logSecurityAudit({
        actorId: auth.user.id,
        actorRole: auth.role,
        actionType: 'GITHUB_OAUTH_NONCE_MISMATCH',
        targetResource: `user:${auth.user.id}`,
        riskLevel: 'high',
        metadata: { serviceId: claims.serviceId || null },
      });
      return NextResponse.json(
        { error: 'Forbidden', message: 'OAuth CSRF nonce cookie mismatch.' },
        { status: 403 }
      );
    }

    const safeReturnTo = sanitizeReturnToPath(claims.returnTo);
    const canonicalOrigin = getCanonicalSiteUrl(url.origin);

    if (oauthError) {
      const errorDesc = (url.searchParams.get('error_description') || oauthError).slice(0, 160);
      if (wantsJsonResponse(req, url)) {
        return buildClearedCookieResponse(
          NextResponse.json({ error: errorDesc, code: oauthError }, { status: 400 }),
          url
        );
      }
      const redirectUrl = new URL(safeReturnTo, canonicalOrigin);
      redirectUrl.searchParams.set('github', 'error');
      redirectUrl.searchParams.set('github_error', errorDesc);
      return buildClearedCookieResponse(NextResponse.redirect(redirectUrl, 302), url);
    }

    if (!codeParam) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing GitHub authorization code.' },
        { status: 400 }
      );
    }

    const oauthConfig = getGitHubOAuthConfig(url.origin);
    if (!oauthConfig.configured) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'GitHub OAuth credentials are not configured.' },
        { status: 503 }
      );
    }

    const tokenExchange = await exchangeGitHubOAuthCode({
      code: codeParam,
      redirectUri: oauthConfig.redirectUri,
      requestOrigin: url.origin,
    });

    const viewer = await fetchGitHubViewer(tokenExchange.accessToken);

    const stored = await saveUserGitHubAccount({
      userId: auth.user.id,
      githubUserId: viewer.id,
      githubLogin: viewer.login,
      avatarUrl: viewer.avatarUrl,
      accessToken: tokenExchange.accessToken,
      refreshToken: tokenExchange.refreshToken,
      scopes: tokenExchange.scopes || oauthConfig.scopes,
      expiresAt: tokenExchange.expiresAt,
    });

    await logSecurityAudit({
      actorId: auth.user.id,
      actorRole: auth.role,
      actionType: 'GITHUB_OAUTH_CONNECTED',
      targetResource: `github:${viewer.login}`,
      riskLevel: 'low',
      metadata: {
        githubUserId: viewer.id,
        accountId: stored.id,
        serviceId: claims.serviceId || null,
      },
    });

    if (wantsJsonResponse(req, url)) {
      return buildClearedCookieResponse(
        NextResponse.json({
          success: true,
          connected: true,
          account: {
            id: stored.id,
            githubUserId: stored.githubUserId,
            githubLogin: stored.githubLogin,
            avatarUrl: stored.avatarUrl,
            scopes: stored.scopes,
          },
          serviceId: claims.serviceId || null,
          returnTo: safeReturnTo,
        }),
        url
      );
    }

    const redirectTarget = new URL(safeReturnTo, canonicalOrigin);
    redirectTarget.searchParams.set('github', 'connected');
    redirectTarget.searchParams.set('github_login', viewer.login);
    if (claims.serviceId) {
      redirectTarget.searchParams.set('serviceId', claims.serviceId);
    }
    return buildClearedCookieResponse(NextResponse.redirect(redirectTarget, 302), url);
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      return NextResponse.json(
        { error: err.message, upstreamStatus: err.status },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    const msg = err instanceof Error ? err.message : 'GitHub OAuth callback failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
