import { NextRequest, NextResponse } from 'next/server';
import { dispatchGitCommitDeployment, teardownPullRequestPreview } from '@/lib/gitDeployDispatcher';
import {
  getServiceGitConnection,
  getUserGitHubAccount,
  resolveServiceWebhookSecret,
  upsertGitHubPrComment,
} from '@/lib/githubIntegration';
import { verifyGitHubSignature } from '@/lib/projectEngine';
import { logSecurityAudit } from '@/lib/security';
import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface GitHubWebhookPayload {
  zen?: string;
  hook_id?: number;
  ref?: string;
  deleted?: boolean;
  after?: string;
  action?: string;
  number?: number;
  pusher?: { name?: string };
  repository?: {
    full_name?: string;
    clone_url?: string;
    html_url?: string;
    default_branch?: string;
  };
  head_commit?: {
    id?: string;
    message?: string;
    author?: { name?: string };
  };
  pull_request?: {
    number?: number;
    title?: string;
    html_url?: string;
    user?: { login?: string };
    head?: {
      ref?: string;
      sha?: string;
      repo?: {
        full_name?: string;
        clone_url?: string;
      } | null;
    };
  };
}

function getClientIp(request: NextRequest): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '127.0.0.1';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await context.params;
    const cleanServiceId = String(serviceId || '').trim();
    const signature = request.headers.get('x-hub-signature-256') || '';
    const eventType = (request.headers.get('x-github-event') || 'push').toLowerCase();
    const deliveryId = request.headers.get('x-github-delivery') || '';
    const clientIp = getClientIp(request);

    if (!cleanServiceId) {
      return NextResponse.json({ success: false, error: 'Missing serviceId.' }, { status: 400 });
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Webhook receiver requires configured backend storage.' },
        { status: 503 }
      );
    }

    const rawBody = await request.text();
    const webhookSecret = await resolveServiceWebhookSecret(cleanServiceId);

    if (!webhookSecret) {
      await logSecurityAudit({
        actionType: 'GITHUB_WEBHOOK_UNCONFIGURED',
        targetResource: `service:${cleanServiceId}`,
        ipAddress: clientIp,
        riskLevel: 'medium',
        metadata: { eventType, deliveryId },
      });
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured for this project.' },
        { status: 401 }
      );
    }

    const isSignatureValid =
      Boolean(signature) && (await verifyGitHubSignature(webhookSecret, rawBody, signature));

    if (!isSignatureValid) {
      await logSecurityAudit({
        actionType: 'GITHUB_WEBHOOK_INVALID_SIGNATURE',
        targetResource: `service:${cleanServiceId}`,
        ipAddress: clientIp,
        riskLevel: 'high',
        metadata: { eventType, deliveryId, hasSignature: Boolean(signature) },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing X-Hub-Signature-256 cryptographic HMAC signature.',
        },
        { status: 401 }
      );
    }

    let payload: GitHubWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as GitHubWebhookPayload;
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed webhook JSON payload.' }, { status: 400 });
    }

    if (eventType === 'ping') {
      return NextResponse.json({
        success: true,
        event: 'ping',
        pong: true,
        hookId: payload.hook_id || null,
        zen: payload.zen || 'Keep it logically awesome.',
      });
    }

    const conn = await getServiceGitConnection(cleanServiceId);
    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    const legacySettings =
      !conn && db
        ? ((
            await db
              .from('hosting_project_settings')
              .select('production_branch, auto_deploy_on_push, git_repo_url')
              .eq('service_id', cleanServiceId)
              .maybeSingle()
          ).data as {
            production_branch?: string;
            auto_deploy_on_push?: boolean;
            git_repo_url?: string;
          } | null)
        : null;

    // 1. Handle Push Events
    if (eventType === 'push') {
      const ref = String(payload.ref || '');
      const pushedBranch = ref.replace(/^refs\/heads\//, '') || 'main';
      const commitSha = String(payload.after || payload.head_commit?.id || '').trim();

      if (payload.deleted === true || /^0+$/.test(commitSha)) {
        return NextResponse.json({
          success: true,
          event: 'push',
          ignored: true,
          reason: `Branch deletion event on '${pushedBranch}' ignored.`,
        });
      }

      const autoDeployEnabled = conn
        ? conn.auto_deploy_on_push
        : legacySettings?.auto_deploy_on_push !== false;

      if (!autoDeployEnabled) {
        return NextResponse.json({
          success: true,
          event: 'push',
          ignored: true,
          reason: 'Auto-deploy on push is disabled for this project.',
        });
      }

      const targetBranch = conn?.selected_branch || legacySettings?.production_branch || 'main';
      if (pushedBranch !== targetBranch) {
        return NextResponse.json({
          success: true,
          event: 'push',
          ignored: true,
          reason: `Push to branch '${pushedBranch}' ignored; configured production branch is '${targetBranch}'.`,
        });
      }

      const repoFullName = String(payload.repository?.full_name || conn?.repo_full_name || '');
      if (
        conn?.repo_full_name &&
        repoFullName &&
        conn.repo_full_name.toLowerCase() !== repoFullName.toLowerCase()
      ) {
        await logSecurityAudit({
          actionType: 'GITHUB_WEBHOOK_REPO_MISMATCH',
          targetResource: `service:${cleanServiceId}`,
          ipAddress: clientIp,
          riskLevel: 'high',
          metadata: { boundRepo: conn.repo_full_name, webhookRepo: repoFullName },
        });
        return NextResponse.json(
          { success: false, error: 'Webhook repository does not match project Git binding.' },
          { status: 403 }
        );
      }

      const result = await dispatchGitCommitDeployment({
        serviceId: cleanServiceId,
        environment: 'production',
        triggerSource: 'github_webhook',
        repoFullName,
        cloneUrl: String(payload.repository?.clone_url || conn?.clone_url || legacySettings?.git_repo_url || ''),
        gitBranch: pushedBranch,
        commitSha: commitSha || 'HEAD',
        commitMessage: String(payload.head_commit?.message || `GitHub push to ${pushedBranch}`).slice(0, 500),
        authorName: String(payload.head_commit?.author?.name || payload.pusher?.name || 'GitHub Webhook'),
      });

      return NextResponse.json(
        {
          success: result.ok,
          event: 'push',
          branch: pushedBranch,
          deploymentId: result.deploymentId,
          buildJobId: result.buildJobId || null,
          releaseId: result.releaseId,
          status: result.deployStatus,
          liveUrl: result.liveUrl,
          edgeRouterUrl: result.edgeRouterUrl || null,
          code: result.code,
          error: result.error,
        },
        { status: result.status }
      );
    }

    // 2. Handle Pull Request Preview Events
    if (eventType === 'pull_request') {
      const action = String(payload.action || '').toLowerCase();
      const prNumber = Number(payload.number || payload.pull_request?.number || 0);
      const baseRepoFullName = String(payload.repository?.full_name || conn?.repo_full_name || '');
      const headRepoFullName = String(
        payload.pull_request?.head?.repo?.full_name || baseRepoFullName
      );
      const branchName = String(payload.pull_request?.head?.ref || `pr-${prNumber}`);
      const commitSha = String(payload.pull_request?.head?.sha || 'HEAD');
      const prTitle = String(payload.pull_request?.title || `Pull Request #${prNumber}`);
      const authorName = String(payload.pull_request?.user?.login || 'github-pr');
      const isForkPr = Boolean(
        headRepoFullName &&
          baseRepoFullName &&
          headRepoFullName.toLowerCase() !== baseRepoFullName.toLowerCase()
      );

      if (conn && !conn.pr_previews_enabled) {
        return NextResponse.json({
          success: true,
          event: 'pull_request',
          ignored: true,
          reason: 'Ephemeral PR previews are disabled for this project.',
        });
      }

      if (
        conn?.repo_full_name &&
        baseRepoFullName &&
        conn.repo_full_name.toLowerCase() !== baseRepoFullName.toLowerCase()
      ) {
        await logSecurityAudit({
          actionType: 'GITHUB_WEBHOOK_REPO_MISMATCH',
          targetResource: `service:${cleanServiceId}`,
          ipAddress: clientIp,
          riskLevel: 'high',
          metadata: { boundRepo: conn.repo_full_name, webhookRepo: baseRepoFullName },
        });
        return NextResponse.json(
          { success: false, error: 'Webhook repository does not match project Git binding.' },
          { status: 403 }
        );
      }

      if (!Number.isFinite(prNumber) || prNumber <= 0) {
        return NextResponse.json(
          { success: false, error: 'Pull request payload is missing a valid PR number.' },
          { status: 400 }
        );
      }

      if (action === 'opened' || action === 'synchronize' || action === 'reopened') {
        const result = await dispatchGitCommitDeployment({
          serviceId: cleanServiceId,
          environment: 'preview',
          triggerSource: 'github_webhook',
          repoFullName: headRepoFullName || baseRepoFullName,
          cloneUrl: String(
            payload.pull_request?.head?.repo?.clone_url ||
              payload.repository?.clone_url ||
              conn?.clone_url ||
              ''
          ),
          gitBranch: branchName,
          commitSha,
          commitMessage: prTitle,
          authorName,
          prNumber,
          prTitle,
          isForkPr,
          prUrl: payload.pull_request?.html_url,
        });

        let prCommentId: number | null = null;
        if (conn?.user_id && baseRepoFullName) {
          const account = await getUserGitHubAccount(conn.user_id).catch(() => null);
          if (account?.accessToken) {
            const previewLink = result.previewUrl || result.liveUrl;
            const statusLine = result.ok
              ? result.deployStatus === 'live'
                ? 'Ready Live'
                : 'Building'
              : `Failed (${result.error || 'Build Error'})`;

            const bodyMd = [
              `### DevHost Ephemeral Preview (${statusLine})`,
              '',
              `- **Branch**: \`${branchName}\` (${commitSha.slice(0, 7)})`,
              `- **Preview URL**: ${previewLink ? `[Open Preview](${previewLink})` : 'Provisioning...'}`,
              isForkPr
                ? '- **Security Isolation**: Fork PR — production `.env` secrets withheld.'
                : '- **Environment**: Isolated PR preview runtime',
            ].join('\n');

            const commentRes = await upsertGitHubPrComment({
              accessToken: account.accessToken,
              repoFullName: baseRepoFullName,
              prNumber,
              markerTag: `devhost-preview-${cleanServiceId}-pr-${prNumber}`,
              bodyMarkdown: bodyMd,
            }).catch(() => null);

            if (commentRes?.commentId) {
              prCommentId = commentRes.commentId;
              if (db) {
                await db
                  .from('hosting_preview_environments')
                  .update({ pr_comment_id: prCommentId })
                  .eq('service_id', cleanServiceId)
                  .eq('pr_number', prNumber);
              }
            }
          }
        }

        return NextResponse.json(
          {
            success: result.ok,
            event: 'pull_request',
            action,
            prNumber,
            isForkPr,
            deploymentId: result.deploymentId,
            buildJobId: result.buildJobId || null,
            releaseId: result.releaseId,
            status: result.deployStatus,
            previewUrl: result.previewUrl || result.liveUrl,
            previewHostname: result.previewHostname,
            prCommentId,
            code: result.code,
            error: result.error,
          },
          { status: result.status }
        );
      }

      if (action === 'closed') {
        const teardown = await teardownPullRequestPreview({
          serviceId: cleanServiceId,
          prNumber,
          branchName,
        });

        if (conn?.user_id && baseRepoFullName) {
          const account = await getUserGitHubAccount(conn.user_id).catch(() => null);
          if (account?.accessToken) {
            await upsertGitHubPrComment({
              accessToken: account.accessToken,
              repoFullName: baseRepoFullName,
              prNumber,
              markerTag: `devhost-preview-${cleanServiceId}-pr-${prNumber}`,
              bodyMarkdown: `### DevHost Ephemeral Preview Destroyed\n\nPR #${prNumber} (\`${branchName}\`) was closed and its isolated preview container / R2 manifest were torn down.`,
            }).catch(() => null);
          }
        }

        return NextResponse.json({
          success: true,
          event: 'pull_request',
          action: 'closed',
          prNumber,
          destroyed: true,
          r2ManifestDeleted: teardown.r2ManifestDeleted,
          agentDestroyed: teardown.agentDestroyed,
        });
      }

      return NextResponse.json({
        success: true,
        event: 'pull_request',
        ignored: true,
        action,
      });
    }

    return NextResponse.json({
      success: true,
      ignored: true,
      event: eventType,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'GitHub webhook processing failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
