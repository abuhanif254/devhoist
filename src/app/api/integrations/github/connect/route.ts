import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireServiceAccess, requireUser } from '@/lib/authGuard';
import {
  buildGitHubAuthorizeUrl,
  getGitHubOAuthConfig,
  GITHUB_OAUTH_NONCE_COOKIE,
  sanitizeReturnToPath,
  signGitHubOAuthState,
} from '@/lib/githubIntegration';
import { isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serviceId = (url.searchParams.get('serviceId') || '').trim();
    const returnTo = sanitizeReturnToPath(url.searchParams.get('returnTo'));
    const redirectMode = url.searchParams.get('redirect') === '1' || url.searchParams.get('mode') === 'redirect';

    const auth = serviceId
      ? await requireServiceAccess(req, serviceId, 'services:write')
      : await requireUser(req);
    if (!auth.ok) return auth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Control plane database backend is not configured.' },
        { status: 503 }
      );
    }

    const oauthConfig = getGitHubOAuthConfig(url.origin);
    if (!oauthConfig.configured) {
      return NextResponse.json(
        {
          error: 'Service Unavailable',
          message:
            'GitHub OAuth is not configured on this control plane (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET required).',
          configured: false,
        },
        { status: 503 }
      );
    }

    const nonce = randomBytes(16).toString('hex');
    const state = signGitHubOAuthState({
      userId: auth.user.id,
      serviceId,
      returnTo,
      nonce,
    });

    if (!state) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'OAuth CSRF state signing secret is not configured.' },
        { status: 503 }
      );
    }

    const authorizeUrl = buildGitHubAuthorizeUrl({
      clientId: oauthConfig.clientId,
      redirectUri: oauthConfig.redirectUri,
      state,
      scopes: oauthConfig.scopes,
    });

    const isHttps = url.protocol === 'https:' || process.env.NODE_ENV === 'production';
    const response = redirectMode
      ? NextResponse.redirect(authorizeUrl, 302)
      : NextResponse.json({
          success: true,
          authorizeUrl,
          redirectUri: oauthConfig.redirectUri,
          state,
        });

    response.cookies.set(GITHUB_OAUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 600,
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to initialize GitHub OAuth flow';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
