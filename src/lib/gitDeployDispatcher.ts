/**
 * Unified Git Push & Pull Request Preview Deployment Dispatcher.
 * Orchestrates static edge deployments (zipball -> ArchiveSecurity scan -> R2)
 * and dynamic container builds (DEVHOST_BUILD_QUEUE -> devhost-agent over HMAC),
 * plus complete ephemeral PR preview teardown.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import {
  ArchiveSecurityError,
  extractAndScanZipArchive,
  type ExtractedArchiveFile,
} from '@/lib/archiveSecurity';
import { getCloudflareConfig, purgeCloudflareCache } from '@/lib/cloudflareClient';
import {
  deleteR2Artifact,
  deployStaticEdgeRelease,
  enqueueBuildJob,
  getR2Artifact,
  isBuildQueueConfigured,
} from '@/lib/cloudflareStorageQueue';
import {
  dispatchBuildAndDeploy,
  dispatchDestroyPreview,
  getComputeNodeConfig,
  isComputeAgentConfigured,
} from '@/lib/computeAgentClient';
import { loadDecryptedEnvMap, resolveServiceComputeTarget } from '@/lib/computeTargetResolver';
import {
  buildIsolatedPreviewTarget,
  downloadGitHubZipball,
  getServiceGitConnection,
  getUserGitHubAccount,
} from '@/lib/githubIntegration';
import { logSecurityAudit } from '@/lib/security';
import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export interface GitDeployTriggerInput {
  serviceId: string;
  environment: 'production' | 'preview';
  triggerSource: 'github_webhook' | 'manual_dashboard' | 'preview_promotion';
  repoFullName: string;
  cloneUrl: string;
  gitBranch: string;
  commitSha: string;
  commitMessage: string;
  authorName: string;
  prNumber?: number;
  prTitle?: string;
  isForkPr?: boolean;
  prUrl?: string;
}

export interface GitDeployDispatchResult {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  environment: 'production' | 'preview';
  runtimeFamily: string;
  deploymentId: string;
  buildJobId?: string;
  releaseId: string;
  liveUrl: string;
  previewUrl?: string;
  previewHostname?: string;
  edgeRouterUrl?: string;
  containerId?: string;
  buildLogs?: string;
  deployStatus: 'queued' | 'building' | 'live' | 'failed';
}

export interface PreviewTeardownInput {
  serviceId: string;
  prNumber: number;
  previewId?: string;
  actorId?: string | null;
  branchName?: string;
}

export interface PreviewTeardownResult {
  ok: boolean;
  destroyed: boolean;
  prNumber: number;
  r2ManifestDeleted: boolean;
  agentDestroyed: boolean;
  previewRecord: Record<string, unknown> | null;
}

function unwrapStaticBuildDirectory(files: ExtractedArchiveFile[]): ExtractedArchiveFile[] {
  const hasRootIndex = files.some((f) => f.path.toLowerCase() === 'index.html');
  if (hasRootIndex) return files;

  const candidatePrefixes = ['dist/', 'build/', 'out/', 'public/'];
  for (const prefix of candidatePrefixes) {
    const matched = files.filter((f) => f.path.toLowerCase().startsWith(prefix));
    const hasSubIndex = matched.some((f) => f.path.toLowerCase() === `${prefix}index.html`);
    if (hasSubIndex) {
      return matched.map((f) => ({
        ...f,
        path: f.path.slice(prefix.length),
      }));
    }
  }

  return files;
}

function sanitizeBuildFailureText(raw: string, token?: string | null): string {
  let cleaned = String(raw || '');
  if (token && token.length > 6) {
    cleaned = cleaned.split(token).join('[REDACTED_GITHUB_TOKEN]');
  }
  return cleaned.slice(-4000);
}

async function resolveTargetServiceContext(serviceId: string): Promise<{
  found: boolean;
  ownerUserId: string;
  target: Awaited<ReturnType<typeof resolveServiceComputeTarget>>;
}> {
  const supabaseReady = isSupabaseConfigured();
  const db = supabaseReady ? getServiceSupabase() : null;

  if (db) {
    const { data: srv } = await db
      .from('hosting_services')
      .select('id, user_id')
      .eq('id', serviceId)
      .maybeSingle();

    if (!srv && !isDevSandboxMode()) {
      const fallback = await resolveServiceComputeTarget(null, serviceId, '');
      return { found: false, ownerUserId: '', target: fallback };
    }

    const ownerUserId = srv?.user_id ? String(srv.user_id) : '';
    const target = await resolveServiceComputeTarget(db, serviceId, ownerUserId);
    return { found: true, ownerUserId, target };
  }

  const target = await resolveServiceComputeTarget(null, serviceId, '');
  return { found: isDevSandboxMode(), ownerUserId: target.userId, target };
}

export async function dispatchGitCommitDeployment(
  input: GitDeployTriggerInput
): Promise<GitDeployDispatchResult> {
  const supabaseReady = isSupabaseConfigured();
  const sandbox = isDevSandboxMode();
  const db = supabaseReady ? getServiceSupabase() : null;

  const { found, ownerUserId, target } = await resolveTargetServiceContext(input.serviceId);
  if (!found) {
    return {
      ok: false,
      status: 404,
      error: 'Target hosting service was not found.',
      environment: input.environment,
      runtimeFamily: target.runtimeFamily,
      deploymentId: randomUUID(),
      releaseId: '',
      liveUrl: '',
      deployStatus: 'failed',
    };
  }

  const gitConn = await getServiceGitConnection(input.serviceId);
  const tokenOwnerId = gitConn?.user_id || ownerUserId || target.userId;
  const ghAccount = tokenOwnerId ? await getUserGitHubAccount(tokenOwnerId) : null;
  const gitAccessToken = ghAccount?.accessToken || undefined;

  const releaseId =
    input.environment === 'preview' && input.prNumber
      ? `pr${input.prNumber}_${Date.now().toString(36)}`
      : `rel_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const deploymentId = randomUUID();
  const buildJobId = randomUUID();
  const now = new Date().toISOString();

  const isPreview = input.environment === 'preview';
  const prNum = Number(input.prNumber || 1);
  const previewTarget = isPreview
    ? buildIsolatedPreviewTarget({
        serviceId: input.serviceId,
        domain: target.domain,
        prNumber: prNum,
        branchName: input.gitBranch,
      })
    : null;

  const siteKey = previewTarget ? previewTarget.previewSiteKey : input.serviceId;
  const targetDomain = previewTarget ? previewTarget.previewHostname : target.domain;
  const expectedUrl = previewTarget ? previewTarget.previewUrl : `https://${target.domain}`;
  const r2Prefix = `sites/${siteKey}`;

  // Fork PRs never receive encrypted production/preview environment secrets
  const envVars: Record<string, string> =
    isPreview && input.isForkPr
      ? {
          NODE_ENV: 'preview',
          DEVHOST_PREVIEW: '1',
          DEVHOST_PR_NUMBER: String(prNum),
        }
      : {
          ...(db ? await loadDecryptedEnvMap(db, input.serviceId, isPreview ? 'preview' : 'production') : {}),
          NODE_ENV: isPreview ? 'preview' : 'production',
        };

  if (db) {
    await db.from('project_deployments').insert({
      id: deploymentId,
      service_id: input.serviceId,
      user_id: tokenOwnerId || null,
      branch: input.gitBranch,
      commit_sha: input.commitSha,
      commit_message: input.commitMessage,
      author_name: input.authorName,
      trigger_source: input.triggerSource,
      environment: input.environment,
      build_job_id: buildJobId,
      pr_number: isPreview ? prNum : null,
      live_url: isPreview ? null : expectedUrl,
      preview_url: isPreview ? expectedUrl : null,
      r2_artifact_key: target.runtimeFamily === 'static_edge' ? `${r2Prefix}/releases/${releaseId}/index.html` : null,
      runtime_family: target.runtimeFamily,
      health_check_status: 'unknown',
      is_current_production: false,
      status: 'building',
      created_at: now,
    });

    if (isPreview) {
      const { data: existingPreview } = await db
        .from('hosting_preview_environments')
        .select('id')
        .eq('service_id', input.serviceId)
        .eq('pr_number', prNum)
        .maybeSingle();

      if (existingPreview?.id) {
        await db
          .from('hosting_preview_environments')
          .update({
            branch_name: input.gitBranch,
            pr_title: input.prTitle || input.commitMessage,
            preview_url: expectedUrl,
            commit_sha: input.commitSha.slice(0, 12),
            commit_message: input.commitMessage,
            release_id: releaseId,
            build_job_id: buildJobId,
            deployment_id: deploymentId,
            r2_prefix: target.runtimeFamily === 'static_edge' ? r2Prefix : null,
            status: 'building',
            updated_at: now,
          })
          .eq('id', existingPreview.id);
      } else {
        await db.from('hosting_preview_environments').insert({
          id: randomUUID(),
          service_id: input.serviceId,
          user_id: tokenOwnerId || null,
          pr_number: prNum,
          branch_name: input.gitBranch,
          pr_title: input.prTitle || input.commitMessage,
          preview_url: expectedUrl,
          commit_sha: input.commitSha.slice(0, 12),
          commit_message: input.commitMessage,
          release_id: releaseId,
          build_job_id: buildJobId,
          deployment_id: deploymentId,
          r2_prefix: target.runtimeFamily === 'static_edge' ? r2Prefix : null,
          status: 'building',
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  const markFailed = async (reason: string) => {
    const cleanLog = sanitizeBuildFailureText(reason, gitAccessToken);
    if (db) {
      await db
        .from('project_deployments')
        .update({
          status: 'failed',
          health_check_status: 'unhealthy',
          build_logs: cleanLog,
          finished_at: new Date().toISOString(),
        })
        .eq('id', deploymentId);
      if (isPreview) {
        await db
          .from('hosting_preview_environments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('service_id', input.serviceId)
          .eq('pr_number', prNum);
      }
    }
  };

  // Path A: Static Edge Runtimes (Zipball -> Zip-Slip/Webshell/Bomb Scan -> Cloudflare R2)
  if (target.runtimeFamily === 'static_edge') {
    let filesToDeploy: Array<{ path: string; content: string | Uint8Array; contentType?: string }> | undefined;

    try {
      const zipBytes = await downloadGitHubZipball({
        repoFullName: input.repoFullName,
        ref: input.commitSha || input.gitBranch,
        accessToken: gitAccessToken,
      });

      if (zipBytes) {
        const scanned = extractAndScanZipArchive(zipBytes, { deployTarget: 'static_edge' });
        const webrootFiles = unwrapStaticBuildDirectory(scanned.files);
        filesToDeploy = webrootFiles.map((f) => ({
          path: f.path,
          content: f.data,
          contentType: f.contentType,
        }));
      } else if (!sandbox) {
        const msg = `Failed to download GitHub archive for ${input.repoFullName}@${input.commitSha.slice(0, 8)}`;
        await markFailed(msg);
        return {
          ok: false,
          status: 502,
          error: msg,
          environment: input.environment,
          runtimeFamily: target.runtimeFamily,
          deploymentId,
          buildJobId,
          releaseId,
          liveUrl: expectedUrl,
          deployStatus: 'failed',
        };
      } else {
        filesToDeploy = [
          {
            path: 'index.html',
            content: `<!doctype html><html><body><h1>${targetDomain}</h1><p>${input.repoFullName} (${input.gitBranch}@${input.commitSha.slice(0, 7)})</p></body></html>`,
            contentType: 'text/html; charset=utf-8',
          },
        ];
      }
    } catch (err: unknown) {
      if (err instanceof ArchiveSecurityError) {
        await markFailed(`Security violation in GitHub repository archive: ${err.message}`);
        await logSecurityAudit({
          actorId: tokenOwnerId || undefined,
          actorRole: 'system',
          actionType: 'GIT_ARCHIVE_SECURITY_REJECTED',
          targetResource: `service:${input.serviceId}`,
          riskLevel: 'high',
          metadata: {
            code: err.code,
            offendingEntry: err.offendingEntry || null,
            repoFullName: input.repoFullName,
            commitSha: input.commitSha,
            prNumber: isPreview ? prNum : null,
          },
        });
        return {
          ok: false,
          status: err.status,
          code: err.code,
          error: err.message,
          environment: input.environment,
          runtimeFamily: target.runtimeFamily,
          deploymentId,
          buildJobId,
          releaseId,
          liveUrl: expectedUrl,
          deployStatus: 'failed',
        };
      }
      const msg = err instanceof Error ? err.message : 'Git archive processing failed';
      await markFailed(msg);
      return {
        ok: false,
        status: 502,
        error: msg,
        environment: input.environment,
        runtimeFamily: target.runtimeFamily,
        deploymentId,
        buildJobId,
        releaseId,
        liveUrl: expectedUrl,
        deployStatus: 'failed',
      };
    }

    const edgeRes = await deployStaticEdgeRelease({
      serviceId: siteKey,
      domain: targetDomain,
      stackSlug: target.stackSlug,
      stackName: target.stackSlug,
      releaseId,
      files: filesToDeploy,
    });

    if (!edgeRes.ok) {
      const msg = edgeRes.error || 'Static Edge R2 upload failed.';
      await markFailed(msg);
      return {
        ok: false,
        status: 502,
        error: msg,
        environment: input.environment,
        runtimeFamily: target.runtimeFamily,
        deploymentId,
        buildJobId,
        releaseId,
        liveUrl: expectedUrl,
        deployStatus: 'failed',
      };
    }

    const liveUrl = isPreview
      ? previewTarget!.previewUrl
      : edgeRes.edgeRouterUrl || edgeRes.liveUrl;
    const logs = [
      `[00:00.10] Synced ${input.repoFullName} (${input.gitBranch}@${input.commitSha.slice(0, 7)})`,
      `[00:00.45] Archive security & Zip-Slip scanner passed (${edgeRes.filesUploaded} assets, ${edgeRes.totalBytes} bytes)`,
      `[00:00.85] Published to Cloudflare R2 manifest ${edgeRes.manifestKey}`,
    ].join('\n');

    if (db) {
      if (!isPreview) {
        await db
          .from('project_deployments')
          .update({ is_current_production: false, status: 'superseded' })
          .eq('service_id', input.serviceId)
          .eq('is_current_production', true);
      }

      await db
        .from('project_deployments')
        .update({
          status: 'live_production',
          is_current_production: !isPreview,
          live_url: isPreview ? null : liveUrl,
          preview_url: isPreview ? liveUrl : null,
          r2_artifact_key: edgeRes.artifactKey,
          health_check_status: 'healthy',
          build_logs: logs,
          duration_seconds: 1,
          finished_at: new Date().toISOString(),
        })
        .eq('id', deploymentId);

      if (!isPreview) {
        await db
          .from('hosting_services')
          .update({
            status: 'active',
            r2_bucket_prefix: r2Prefix,
            live_preview_url: edgeRes.edgeRouterUrl || liveUrl,
            health_check_status: 'healthy',
            last_deployed_at: new Date().toISOString(),
          })
          .eq('id', input.serviceId);
      } else {
        await db
          .from('hosting_preview_environments')
          .update({
            status: 'ready_live',
            preview_url: liveUrl,
            r2_prefix: r2Prefix,
            updated_at: new Date().toISOString(),
          })
          .eq('service_id', input.serviceId)
          .eq('pr_number', prNum);
      }

      await db
        .from('project_git_connections')
        .update({
          last_commit_sha: input.commitSha,
          last_synced_at: new Date().toISOString(),
        })
        .eq('service_id', input.serviceId);
    }

    if (!isPreview && getCloudflareConfig().configured) {
      await purgeCloudflareCache({ domain: target.domain, purgeEverything: true }).catch(() => null);
    }

    return {
      ok: true,
      status: 200,
      environment: input.environment,
      runtimeFamily: target.runtimeFamily,
      deploymentId,
      buildJobId,
      releaseId,
      liveUrl,
      previewUrl: isPreview ? liveUrl : undefined,
      previewHostname: previewTarget?.previewHostname,
      edgeRouterUrl: edgeRes.edgeRouterUrl,
      buildLogs: logs,
      deployStatus: 'live',
    };
  }

  // Path B: Dynamic Container Runtimes (Queue + devhost-agent with transient gitAccessToken)
  const agentConfigured = isComputeAgentConfigured(target.agentEndpoint);
  const queueConfigured = isBuildQueueConfigured();
  if (!agentConfigured && !queueConfigured && !sandbox) {
    const msg = 'Compute & Build Plane is not configured for Git container deployments.';
    await markFailed(msg);
    return {
      ok: false,
      status: 503,
      error: msg,
      environment: input.environment,
      runtimeFamily: target.runtimeFamily,
      deploymentId,
      buildJobId,
      releaseId,
      liveUrl: expectedUrl,
      deployStatus: 'failed',
    };
  }

  const nodeCfg = getComputeNodeConfig(target.agentEndpoint);
  if (queueConfigured || sandbox) {
    await enqueueBuildJob({
      jobId: buildJobId,
      serviceId: input.serviceId,
      userId: tokenOwnerId || undefined,
      domain: targetDomain,
      cpanelUser: target.cpanelUser,
      stackSlug: target.stackSlug,
      runtimeFamily: target.runtimeFamily,
      runtimeVersion: target.runtimeVersion,
      triggerSource: input.triggerSource,
      gitRepoUrl: input.cloneUrl,
      gitBranch: input.gitBranch,
      commitSha: input.commitSha,
      environment: input.environment,
      prNumber: isPreview ? prNum : undefined,
      previewHostname: previewTarget?.previewHostname,
      installCommand: target.installCommand,
      buildCommand: target.buildCommand,
      startupFile: target.startupFile,
      outputDirectory: target.outputDirectory,
      envVars,
      ramMb: target.ramLimitMb,
      cpuCores: target.cpuCores,
      diskGb: target.diskLimitGb,
      releaseId,
      deploymentId,
      targetNodeCode: target.serverNode,
      targetAgentEndpoint: target.agentEndpoint || undefined,
      callbackUrl: nodeCfg.controlPlaneCallbackUrl,
      requestedAt: now,
    });
  }

  let finalContainerId: string | undefined;
  let finalLogs = `Queued container build job ${buildJobId} (${input.gitBranch}@${input.commitSha.slice(0, 7)})`;
  let deployStatus: GitDeployDispatchResult['deployStatus'] = 'queued';
  let finalLiveUrl = expectedUrl;

  if (agentConfigured || sandbox) {
    const agentRes = await dispatchBuildAndDeploy(
      {
        jobId: buildJobId,
        serviceId: input.serviceId,
        cpanelUser: target.cpanelUser,
        domain: targetDomain,
        stackSlug: target.stackSlug,
        runtimeFamily: target.runtimeFamily,
        runtimeVersion: target.runtimeVersion,
        gitRepoUrl: input.cloneUrl,
        gitBranch: input.gitBranch,
        commitSha: input.commitSha,
        gitAccessToken,
        environment: input.environment,
        prNumber: isPreview ? prNum : undefined,
        previewHostname: previewTarget?.previewHostname,
        installCommand: target.installCommand,
        buildCommand: target.buildCommand,
        startupFile: target.startupFile,
        outputDirectory: target.outputDirectory,
        releaseId,
        deploymentId,
        ramLimitMb: target.ramLimitMb,
        cpuCores: target.cpuCores,
        diskLimitGb: target.diskLimitGb,
        envVars,
        callbackUrl: nodeCfg.controlPlaneCallbackUrl,
      },
      target.agentEndpoint || undefined
    );

    if (!agentRes.ok) {
      const errMsg = agentRes.error || 'Compute agent Git build failed.';
      await markFailed(errMsg);
      return {
        ok: false,
        status: 502,
        error: sanitizeBuildFailureText(errMsg, gitAccessToken),
        environment: input.environment,
        runtimeFamily: target.runtimeFamily,
        deploymentId,
        buildJobId,
        releaseId,
        liveUrl: finalLiveUrl,
        previewUrl: isPreview ? finalLiveUrl : undefined,
        previewHostname: previewTarget?.previewHostname,
        deployStatus: 'failed',
      };
    }

    if (agentRes.data?.queuedAsync) {
      deployStatus = 'building';
      finalLogs = sanitizeBuildFailureText(agentRes.data.buildLogs || finalLogs, gitAccessToken);
    } else {
      deployStatus = 'live';
      finalContainerId = agentRes.data?.containerId;
      finalLiveUrl = agentRes.data?.liveUrl || expectedUrl;
      finalLogs = sanitizeBuildFailureText(agentRes.data?.buildLogs || finalLogs, gitAccessToken);

      if (db) {
        if (!isPreview) {
          await db
            .from('project_deployments')
            .update({ is_current_production: false, status: 'superseded' })
            .eq('service_id', input.serviceId)
            .eq('is_current_production', true);
        }

        await db
          .from('project_deployments')
          .update({
            status: 'live_production',
            is_current_production: !isPreview,
            container_id: finalContainerId || null,
            live_url: isPreview ? null : finalLiveUrl,
            preview_url: isPreview ? finalLiveUrl : null,
            health_check_status: 'healthy',
            build_logs: finalLogs,
            duration_seconds: agentRes.data?.durationSeconds || 3,
            finished_at: new Date().toISOString(),
          })
          .eq('id', deploymentId);

        if (!isPreview) {
          await db
            .from('hosting_services')
            .update({
              status: 'active',
              container_id: finalContainerId || target.containerId,
              live_preview_url: finalLiveUrl,
              health_check_status: 'healthy',
              last_deployed_at: new Date().toISOString(),
            })
            .eq('id', input.serviceId);
        } else {
          await db
            .from('hosting_preview_environments')
            .update({
              status: 'ready_live',
              preview_url: finalLiveUrl,
              container_id: finalContainerId || null,
              updated_at: new Date().toISOString(),
            })
            .eq('service_id', input.serviceId)
            .eq('pr_number', prNum);
        }
      }

      if (!isPreview && getCloudflareConfig().configured) {
        await purgeCloudflareCache({ domain: target.domain, purgeEverything: true }).catch(() => null);
      }
    }
  }

  if (db) {
    await db
      .from('project_git_connections')
      .update({
        last_commit_sha: input.commitSha,
        last_synced_at: new Date().toISOString(),
      })
      .eq('service_id', input.serviceId);
  }

  return {
    ok: true,
    status: deployStatus === 'live' ? 200 : 202,
    environment: input.environment,
    runtimeFamily: target.runtimeFamily,
    deploymentId,
    buildJobId,
    releaseId,
    liveUrl: finalLiveUrl,
    previewUrl: isPreview ? finalLiveUrl : undefined,
    previewHostname: previewTarget?.previewHostname,
    containerId: finalContainerId,
    buildLogs: finalLogs,
    deployStatus,
  };
}

export async function teardownPullRequestPreview(
  input: PreviewTeardownInput
): Promise<PreviewTeardownResult> {
  const supabaseReady = isSupabaseConfigured();
  const db = supabaseReady ? getServiceSupabase() : null;
  const { target } = await resolveTargetServiceContext(input.serviceId);
  const previewTarget = buildIsolatedPreviewTarget({
    serviceId: input.serviceId,
    domain: target.domain,
    prNumber: input.prNumber,
    branchName: input.branchName || `pr-${input.prNumber}`,
  });

  let existingPreview: Record<string, unknown> | null = null;
  if (db) {
    const query = input.previewId
      ? db
          .from('hosting_preview_environments')
          .select('*')
          .eq('id', input.previewId)
          .eq('service_id', input.serviceId)
          .maybeSingle()
      : db
          .from('hosting_preview_environments')
          .select('*')
          .eq('service_id', input.serviceId)
          .eq('pr_number', input.prNumber)
          .maybeSingle();

    const { data } = await query;
    existingPreview = (data as Record<string, unknown> | null) || null;
  }

  // 1. Delete R2 static edge preview manifest & index artifact (if present)
  let r2ManifestDeleted = false;
  const manifestKey = `sites/${previewTarget.previewSiteKey}/current.json`;
  const manifestObj = await getR2Artifact(manifestKey).catch(() => null);
  if (manifestObj?.found && manifestObj.bodyText) {
    try {
      const parsed = JSON.parse(manifestObj.bodyText) as { releasePrefix?: string };
      if (parsed.releasePrefix) {
        await deleteR2Artifact(`${parsed.releasePrefix}/index.html`).catch(() => false);
      }
    } catch {
      // Malformed manifest; still remove manifest key below
    }
  }
  r2ManifestDeleted = await deleteR2Artifact(manifestKey).catch(() => false);

  // 2. Tear down ephemeral container & Caddy config on compute agent (if applicable)
  let agentDestroyed = false;
  if (
    target.runtimeFamily !== 'static_edge' &&
    (isComputeAgentConfigured(target.agentEndpoint) || isDevSandboxMode())
  ) {
    const destroyRes = await dispatchDestroyPreview(
      {
        serviceId: input.serviceId,
        cpanelUser: target.cpanelUser,
        prNumber: input.prNumber,
        previewHostname: previewTarget.previewHostname,
      },
      target.agentEndpoint || undefined
    );
    agentDestroyed = destroyRes.ok;
  }

  // 3. Mark preview record 'destroyed' in Supabase
  let updatedRecord: Record<string, unknown> | null = existingPreview;
  if (db && existingPreview?.id) {
    const { data: updated } = await db
      .from('hosting_preview_environments')
      .update({
        status: 'destroyed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', String(existingPreview.id))
      .eq('service_id', input.serviceId)
      .select('*')
      .single();
    if (updated) {
      updatedRecord = updated as Record<string, unknown>;
    }
  }

  await logSecurityAudit({
    actorId: input.actorId || undefined,
    actorRole: input.actorId ? 'client' : 'system',
    actionType: 'PR_PREVIEW_DESTROYED',
    targetResource: `service:${input.serviceId}:pr-${input.prNumber}`,
    riskLevel: 'low',
    metadata: {
      prNumber: input.prNumber,
      previewSiteKey: previewTarget.previewSiteKey,
      r2ManifestDeleted,
      agentDestroyed,
    },
  });

  return {
    ok: true,
    destroyed: true,
    prNumber: input.prNumber,
    r2ManifestDeleted,
    agentDestroyed,
    previewRecord: updatedRecord,
  };
}
