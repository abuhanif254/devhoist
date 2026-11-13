import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import {
  deployStaticEdgeRelease,
  enqueueBuildJob,
  isBuildQueueConfigured,
  isR2ArtifactsConfigured,
  putR2Artifact,
} from '@/lib/cloudflareStorageQueue';
import {
  dispatchBuildAndDeploy,
  dispatchRollbackRelease,
  getComputeNodeConfig,
  isComputeAgentConfigured,
} from '@/lib/computeAgentClient';
import { loadDecryptedEnvMap, resolveServiceComputeTarget } from '@/lib/computeTargetResolver';


async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, unknown>,
  ip: string = '127.0.0.1',
  riskLevel: string = 'medium'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_id: actorId,
      actor_role: 'client',
      action_type: actionType,
      target_resource: targetResource,
      ip_address: ip,
      risk_level: riskLevel,
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}

/**
 * GET /api/hosting/deployments?serviceId=...
 * Fetch release history & build logs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required.' }, { status: 400 });
    }

    const access = await requireServiceAccess(request, serviceId, 'services:read');
    if (!access.ok) return access.response;

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data, error } = await db
        .from('project_deployments')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, deployments: data || [] });
    }

    if (!isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Deployments');
    }

    // Offline mock deployments (DEV_SANDBOX_MODE only)
    return NextResponse.json({
      success: true,
      deployments: [
        {
          id: 'dep_1',
          service_id: serviceId,
          commit_sha: '7f93a12',
          commit_message: 'feat: integrated litespeed cache & redis object cache',
          branch: 'main',
          author_name: 'Abu Hanif',
          trigger_source: 'github_webhook',
          status: 'live_production',
          is_current_production: true,
          artifact_size_mb: 14.2,
          inodes_count: 1850,
          duration_seconds: 2.8,
          build_logs: '[00:00:01] Git pull origin main\n[00:00:02] Turbopack standalone compiled in 2.8s\n[00:00:03] Container reloaded: LIVE',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'dep_0',
          service_id: serviceId,
          commit_sha: '1b82c94',
          commit_message: 'chore: initial standalone app setup',
          branch: 'main',
          author_name: 'Abu Hanif',
          trigger_source: 'manual_dashboard',
          status: 'superseded',
          is_current_production: false,
          artifact_size_mb: 13.8,
          inodes_count: 1790,
          duration_seconds: 3.1,
          build_logs: '[00:00:01] Initial build completed.',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hosting/deployments
 * Actions:
 * 1. trigger_manual: Trigger new production build
 * 2. rollback: Instant rollback to a previous commit SHA
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const { action, serviceId, userId, targetDeploymentId, commitMessage } = body;

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required.' }, { status: 400 });
    }

    const access = await requireServiceAccess(request, serviceId, 'git:deploy');
    if (!access.ok) return access.response;
    const resolvedUserId = access.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Deployments');
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    const sandbox = isDevSandboxMode();
    const target = await resolveServiceComputeTarget(db, serviceId, resolvedUserId);

    // 1. MANUAL TRIGGER BUILD
    if (action === 'trigger_manual') {
      const commitSha = Math.random().toString(36).substring(2, 9);
      const releaseId = `rel_${commitSha}_${Date.now()}`;
      const jobId = `bld_${commitSha}_${Date.now()}`;

      let buildLogs = '';
      let r2ArtifactKey: string | null = null;
      let containerId: string | null = target.containerId;
      let liveUrl: string = `https://${target.domain}`;
      let buildJobId: string | null = null;
      let deployStatus: 'live_production' | 'building' = 'live_production';
      let durationSeconds = 3;

      if (target.runtimeFamily === 'static_edge') {
        if (!isR2ArtifactsConfigured() && !sandbox) {
          return serviceUnavailableResponse('Cloudflare R2 Artifacts Plane');
        }

        const staticRes = await deployStaticEdgeRelease({
          serviceId,
          domain: target.domain,
          stackSlug: target.stackSlug,
          stackName: target.stackSlug,
          releaseId,
        });
        if (!staticRes.ok) {
          return NextResponse.json(
            { success: false, error: staticRes.error || 'Static Edge deployment failed.' },
            { status: 502 }
          );
        }

        r2ArtifactKey = staticRes.artifactKey;
        liveUrl = staticRes.liveUrl;
        durationSeconds = 2;
        buildLogs = [
          `[${new Date().toISOString()}] Edge Static Build initialized for ${target.domain}`,
          `[00:01.00] Uploaded ${staticRes.filesUploaded} assets (${staticRes.totalBytes} bytes) to R2 key ${staticRes.artifactKey}`,
          `[00:01.80] Updated Edge manifest at ${staticRes.manifestKey} (Edge Router: ${staticRes.edgeRouterUrl}) — LIVE`,
        ].join('\n');
      } else {
        const agentConfigured = isComputeAgentConfigured(target.agentEndpoint);
        const queueConfigured = isBuildQueueConfigured();
        if (!agentConfigured && !queueConfigured && !sandbox) {
          return serviceUnavailableResponse('Compute & Build Plane');
        }

        const envVars = await loadDecryptedEnvMap(db, serviceId, 'production');
        const nodeCfg = getComputeNodeConfig(target.agentEndpoint);

        if (queueConfigured || sandbox) {
          const qRes = await enqueueBuildJob({
            jobId,
            serviceId,
            userId: resolvedUserId,
            domain: target.domain,
            cpanelUser: target.cpanelUser,
            stackSlug: target.stackSlug,
            runtimeFamily: target.runtimeFamily,
            runtimeVersion: target.runtimeVersion,
            triggerSource: 'manual_dashboard',
            gitRepoUrl: target.gitRepoUrl,
            gitBranch: target.gitBranch,
            commitSha,
            installCommand: target.installCommand,
            buildCommand: target.buildCommand,
            startupFile: target.startupFile,
            outputDirectory: target.outputDirectory,
            envVars,
            ramMb: target.ramLimitMb,
            cpuCores: target.cpuCores,
            diskGb: target.diskLimitGb,
            targetAgentEndpoint: target.agentEndpoint || undefined,
            requestedAt: new Date().toISOString(),
          });
          if (qRes.ok) {
            buildJobId = qRes.jobId;
          }
        }

        if (agentConfigured || sandbox) {
          const agentRes = await dispatchBuildAndDeploy(
            {
              jobId,
              serviceId,
              cpanelUser: target.cpanelUser,
              domain: target.domain,
              stackSlug: target.stackSlug,
              runtimeFamily: target.runtimeFamily,
              runtimeVersion: target.runtimeVersion,
              gitRepoUrl: target.gitRepoUrl,
              gitBranch: target.gitBranch,
              commitSha,
              installCommand: target.installCommand,
              buildCommand: target.buildCommand,
              startupFile: target.startupFile,
              outputDirectory: target.outputDirectory,
              envVars,
              callbackUrl: nodeCfg.controlPlaneCallbackUrl,
            },
            target.agentEndpoint || undefined
          );
          if (!agentRes.ok) {
            return NextResponse.json(
              { success: false, error: agentRes.error || 'Compute agent build failed.' },
              { status: 502 }
            );
          }

          containerId = agentRes.data?.containerId || containerId;
          liveUrl = agentRes.data?.liveUrl || liveUrl;
          durationSeconds = agentRes.data?.durationSeconds || 3;
          buildLogs = agentRes.data?.buildLogs || `[Agent] Live production deployment active on ${liveUrl}`;
          if (agentRes.data?.queuedAsync) {
            deployStatus = 'building';
          }
        } else {
          deployStatus = 'building';
          buildLogs = `[Queue] Enqueued build job ${jobId} into DEVHOST_BUILD_QUEUE.`;
        }
      }

      let newId = `dep_${Date.now()}`;
      if (db) {
        if (deployStatus === 'live_production') {
          await db
            .from('project_deployments')
            .update({ is_current_production: false, status: 'superseded' })
            .eq('service_id', serviceId)
            .eq('is_current_production', true);
        }

        const { data, error } = await db
          .from('project_deployments')
          .insert({
            service_id: serviceId,
            user_id: resolvedUserId,
            commit_sha: commitSha,
            commit_message: commitMessage || 'Manual production deploy via dashboard',
            branch: target.gitBranch || 'main',
            author_name: access.user.email || 'Developer (Dashboard)',
            trigger_source: 'manual_dashboard',
            status: deployStatus,
            is_current_production: deployStatus === 'live_production',
            artifact_size_mb: 14.5,
            inodes_count: 1890,
            duration_seconds: durationSeconds,
            build_logs: buildLogs,
            r2_artifact_key: r2ArtifactKey,
            container_id: containerId,
            build_job_id: buildJobId,
            live_url: liveUrl,
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;

        if (buildJobId) {
          try {
            await db.from('compute_build_jobs').upsert(
              {
                id: buildJobId,
                service_id: serviceId,
                user_id: resolvedUserId,
                runtime_family: target.runtimeFamily,
                stack_slug: target.stackSlug,
                git_repo_url: target.gitRepoUrl,
                git_branch: target.gitBranch,
                commit_sha: commitSha,
                status: deployStatus === 'live_production' ? 'live' : 'queued',
                container_id: containerId,
                r2_artifact_key: r2ArtifactKey,
                live_url: liveUrl,
                build_logs: buildLogs,
                completed_at: deployStatus === 'live_production' ? new Date().toISOString() : null,
              },
              { onConflict: 'id' }
            );
          } catch {
            // Optional table during partial mocks
          }
        }

        const { data: allReleases } = await db
          .from('project_deployments')
          .select('id')
          .eq('service_id', serviceId)
          .order('created_at', { ascending: false });

        if (allReleases && allReleases.length > 5) {
          const idsToDelete = allReleases.slice(5).map((r: { id: string }) => r.id);
          await db.from('project_deployments').delete().in('id', idsToDelete);
        }
      }

      await logAudit(resolvedUserId, 'DEPLOYMENT_TRIGGERED', `service:${serviceId}`, { commitSha, buildJobId, r2ArtifactKey }, ip);

      return NextResponse.json({
        success: true,
        message: 'Deployment compiled and dispatched to compute plane!',
        deploymentId: newId,
        commitSha,
        buildJobId,
        r2ArtifactKey,
        liveUrl,
      });
    }

    // 2. 1-CLICK INSTANT ROLLBACK
    if (action === 'rollback') {
      if (!targetDeploymentId) {
        return NextResponse.json({ success: false, error: 'Target deployment ID required.' }, { status: 400 });
      }

      const targetDepRow = db
        ? (
            await db
              .from('project_deployments')
              .select('id, commit_sha, r2_artifact_key')
              .eq('id', targetDeploymentId)
              .eq('service_id', serviceId)
              .maybeSingle()
          ).data
        : null;

      if (db && !targetDepRow) {
        return NextResponse.json(
          { success: false, error: 'Forbidden or missing deployment for this hosting service.' },
          { status: 404 }
        );
      }

      if (target.runtimeFamily === 'static_edge') {
        if (!isR2ArtifactsConfigured() && !sandbox) {
          return serviceUnavailableResponse('Cloudflare R2 Artifacts Plane');
        }
        const rollbackRelease = String(targetDepRow?.r2_artifact_key || '').split('/')[3] || `rel_${targetDepRow?.commit_sha || 'rollback'}`;
        await putR2Artifact(
          `sites/${serviceId}/current.json`,
          JSON.stringify({
            serviceId,
            domain: target.domain,
            releaseId: rollbackRelease,
            rolledBackFromDeploymentId: targetDeploymentId,
            publishedAt: new Date().toISOString(),
          }),
          'application/json'
        );
      } else {
        if (!isComputeAgentConfigured(target.agentEndpoint) && !sandbox) {
          return serviceUnavailableResponse('Compute Agent Node');
        }
        const rbRes = await dispatchRollbackRelease(
          {
            serviceId,
            domain: target.domain,
            releaseId: targetDeploymentId,
            commitSha: targetDepRow?.commit_sha || undefined,
          },
          target.agentEndpoint || undefined
        );
        if (!rbRes.ok) {
          return NextResponse.json(
            { success: false, error: rbRes.error || 'Compute rollback failed.' },
            { status: 502 }
          );
        }
      }

      if (db) {
        // Demote existing current production
        await db
          .from('project_deployments')
          .update({ is_current_production: false, status: 'superseded' })
          .eq('service_id', serviceId)
          .eq('is_current_production', true);

        // Promote target deployment to current production (strictly scoped to service_id)
        const { error } = await db
          .from('project_deployments')
          .update({
            is_current_production: true,
            status: 'live_production',
          })
          .eq('id', targetDeploymentId)
          .eq('service_id', serviceId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId || resolvedUserId, 'INSTANT_ROLLBACK_EXECUTED', `service:${serviceId}`, { targetDeploymentId }, ip, 'high');

      return NextResponse.json({
        success: true,
        message: 'Instant rollback successful! Traffic restored to previous release.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
