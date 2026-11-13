import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireServiceAccess } from '@/lib/authGuard';
import { checkKeyedRateLimit } from '@/lib/edgeRateLimit';
import {
  deleteGitHubRepoWebhook,
  fetchGitHubRepositoryDetails,
  getCanonicalSiteUrl,
  getServiceGitConnection,
  getUserGitHubAccount,
  GitHubApiError,
  removeServiceGitConnection,
  sanitizeGitConnectionForClient,
  upsertGitHubRepoWebhook,
  upsertServiceGitConnection,
  validateRepoFullName,
} from '@/lib/githubIntegration';
import { logSecurityAudit } from '@/lib/security';
import { isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BRANCH_REGEX = /^[a-zA-Z0-9._/-]{1,120}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const serviceId = String(body.serviceId || '').trim();
    const rawRepoFullName = String(body.repoFullName || '').trim();
    const rawBranch = String(body.branch || '').trim();
    const autoDeployOnPush = body.autoDeployOnPush !== false;
    const prPreviewsEnabled = body.prPreviewsEnabled !== false;

    const auth = await requireServiceAccess(req, serviceId, 'services:write');
    if (!auth.ok) return auth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Control plane database backend is not configured.' },
        { status: 503 }
      );
    }

    const rate = checkKeyedRateLimit(`github-bind:${auth.user.id}:${auth.serviceId}`, 15, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before updating Git bindings.' },
        { status: 429, headers: { 'Retry-After': String(rate.reset) } }
      );
    }

    const validRepo = validateRepoFullName(rawRepoFullName);
    if (!validRepo) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid repository full name. Expected owner/repo.' },
        { status: 400 }
      );
    }

    const account = await getUserGitHubAccount(auth.user.id);
    if (!account) {
      return NextResponse.json(
        {
          error: 'GitHub Account Not Connected',
          message: 'Please connect your GitHub account via OAuth before binding a repository.',
          connectRequired: true,
        },
        { status: 400 }
      );
    }

    const repoDetails = await fetchGitHubRepositoryDetails(account.accessToken, validRepo);
    const selectedBranch = rawBranch || repoDetails.defaultBranch || 'main';
    if (!BRANCH_REGEX.test(selectedBranch) || selectedBranch.includes('..')) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid Git branch name.' },
        { status: 400 }
      );
    }

    const webhookSecret = randomBytes(32).toString('hex');
    const canonicalOrigin = getCanonicalSiteUrl(new URL(req.url).origin);
    const webhookUrl = `${canonicalOrigin}/api/webhooks/git/${encodeURIComponent(auth.serviceId)}`;

    const hook = await upsertGitHubRepoWebhook({
      accessToken: account.accessToken,
      repoFullName: repoDetails.fullName,
      webhookUrl,
      webhookSecret,
    });

    const { connection, webhookSecretPreview } = await upsertServiceGitConnection({
      serviceId: auth.serviceId,
      userId: auth.user.id,
      githubAccountId: account.id,
      repoId: repoDetails.id,
      repoFullName: repoDetails.fullName,
      repoHtmlUrl: repoDetails.htmlUrl,
      cloneUrl: repoDetails.cloneUrl,
      defaultBranch: repoDetails.defaultBranch,
      selectedBranch,
      isPrivate: repoDetails.private,
      autoDeployOnPush,
      prPreviewsEnabled,
      webhookId: hook.webhookId,
      webhookUrl,
      webhookSecret,
    });

    await logSecurityAudit({
      actorId: auth.user.id,
      actorRole: auth.role,
      actionType: 'GITHUB_REPO_BOUND',
      targetResource: `service:${auth.serviceId}`,
      riskLevel: 'medium',
      metadata: {
        repoFullName: repoDetails.fullName,
        selectedBranch,
        webhookId: hook.webhookId,
        autoDeployOnPush,
        prPreviewsEnabled,
      },
    });

    return NextResponse.json({
      success: true,
      connection: sanitizeGitConnectionForClient(connection),
      webhookSecretPreview,
      message: `Repository ${repoDetails.fullName} (${selectedBranch}) bound with automatic push & PR webhook.`,
    });
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      return NextResponse.json(
        { error: err.message, reconnectRequired: err.status === 401 },
        { status: err.status === 401 ? 401 : err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    const msg = err instanceof Error ? err.message : 'Failed to bind GitHub repository';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let serviceId = (url.searchParams.get('serviceId') || '').trim();
    if (!serviceId) {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      serviceId = String(body.serviceId || '').trim();
    }

    const auth = await requireServiceAccess(req, serviceId, 'services:write');
    if (!auth.ok) return auth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Control plane database backend is not configured.' },
        { status: 503 }
      );
    }

    const existing = await getServiceGitConnection(auth.serviceId);
    if (existing?.webhook_id && existing.repo_full_name) {
      const account = await getUserGitHubAccount(auth.user.id);
      if (account) {
        await deleteGitHubRepoWebhook({
          accessToken: account.accessToken,
          repoFullName: existing.repo_full_name,
          webhookId: existing.webhook_id,
        }).catch(() => {});
      }
    }

    await removeServiceGitConnection(auth.serviceId);

    await logSecurityAudit({
      actorId: auth.user.id,
      actorRole: auth.role,
      actionType: 'GITHUB_REPO_UNBOUND',
      targetResource: `service:${auth.serviceId}`,
      riskLevel: 'medium',
      metadata: {
        repoFullName: existing?.repo_full_name || null,
        webhookId: existing?.webhook_id || null,
      },
    });

    return NextResponse.json({
      success: true,
      unbound: true,
      serviceId: auth.serviceId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to unbind GitHub repository';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
