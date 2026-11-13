import { NextResponse } from 'next/server';
import { requireServiceAccess, requireUser } from '@/lib/authGuard';
import {
  getGitHubOAuthConfig,
  getServiceGitConnection,
  getUserGitHubAccount,
  GitHubApiError,
  listGitHubRepoBranches,
  listGitHubRepositories,
  sanitizeGitConnectionForClient,
  validateRepoFullName,
} from '@/lib/githubIntegration';
import { isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serviceId = (url.searchParams.get('serviceId') || '').trim();
    const repoParam = (url.searchParams.get('repo') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const query = (url.searchParams.get('query') || '').trim() || undefined;

    const auth = serviceId
      ? await requireServiceAccess(req, serviceId, 'services:read')
      : await requireUser(req);
    if (!auth.ok) return auth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Control plane database backend is not configured.' },
        { status: 503 }
      );
    }

    const oauthConfigured = getGitHubOAuthConfig(url.origin).configured;
    const connection = serviceId ? await getServiceGitConnection(serviceId) : null;
    const account = await getUserGitHubAccount(auth.user.id);

    if (!account) {
      return NextResponse.json({
        success: true,
        oauthConfigured,
        connected: false,
        account: null,
        repos: [],
        branches: [],
        connection: sanitizeGitConnectionForClient(connection),
      });
    }

    const safeAccount = {
      id: account.id,
      githubUserId: account.githubUserId,
      githubLogin: account.githubLogin,
      avatarUrl: account.avatarUrl,
      scopes: account.scopes,
      updatedAt: account.updatedAt,
    };

    if (repoParam) {
      const validRepo = validateRepoFullName(repoParam);
      if (!validRepo) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid repository name. Expected owner/repo.' },
          { status: 400 }
        );
      }

      const branches = await listGitHubRepoBranches(account.accessToken, validRepo);
      return NextResponse.json({
        success: true,
        oauthConfigured,
        connected: true,
        account: safeAccount,
        repo: validRepo,
        branches,
        connection: sanitizeGitConnectionForClient(connection),
      });
    }

    const repos = await listGitHubRepositories(account.accessToken, { page, query });
    let branches = undefined;
    if (connection?.repo_full_name) {
      const validBound = validateRepoFullName(connection.repo_full_name);
      if (validBound) {
        try {
          branches = await listGitHubRepoBranches(account.accessToken, validBound);
        } catch {
          branches = [];
        }
      }
    }

    return NextResponse.json({
      success: true,
      oauthConfigured,
      connected: true,
      account: safeAccount,
      repos,
      branches,
      connection: sanitizeGitConnectionForClient(connection),
    });
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      const status = err.status === 401 ? 401 : err.status >= 400 && err.status < 500 ? 400 : 502;
      return NextResponse.json(
        {
          error: err.message,
          reconnectRequired: err.status === 401,
        },
        { status }
      );
    }
    const msg = err instanceof Error ? err.message : 'Failed to load GitHub repositories';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
