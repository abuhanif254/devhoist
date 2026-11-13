// ==============================================================================
// DEVHOST CLOUD - PHASE 5 COMPUTE RUNTIME CONTROL PLANE API
// GET live telemetry/logs/build-jobs | POST restart/stop/start/rebuild/recheck_health
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import {
  deployStaticEdgeRelease,
  enqueueBuildJob,
  getStorageAndQueueStatus,
  isBuildQueueConfigured,
  isR2ArtifactsConfigured,
} from '@/lib/cloudflareStorageQueue';
import {
  controlContainerLifecycleOnAgent,
  dispatchBuildAndDeploy,
  fetchContainerTelemetryAndLogs,
  getComputeNodeConfig,
  isComputeAgentConfigured,
} from '@/lib/computeAgentClient';
import { loadDecryptedEnvMap, resolveServiceComputeTarget } from '@/lib/computeTargetResolver';

export async function GET(request: NextRequest) {
  try {
    const serviceId = request.nextUrl.searchParams.get('serviceId');
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    }

    const access = await requireServiceAccess(request, serviceId, 'services:read');
    if (!access.ok) return access.response;

    const supabaseAdmin = getServiceSupabase();
    if (!supabaseAdmin && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Supabase Service');
    }

    const target = await resolveServiceComputeTarget(supabaseAdmin, serviceId, access.user.id);
    const storageQueue = getStorageAndQueueStatus();
    const nodeCfg = getComputeNodeConfig(target.agentEndpoint);

    let telemetry = null;
    if (isComputeAgentConfigured(target.agentEndpoint) || isDevSandboxMode()) {
      const tRes = await fetchContainerTelemetryAndLogs(
        serviceId,
        target.domain,
        target.agentEndpoint || undefined
      );
      if (tRes.ok && tRes.data) {
        telemetry = {
          ...tRes.data,
          source: tRes.mode,
        };
      }
    }

    let buildJobs: Record<string, unknown>[] = [];
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('compute_build_jobs')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(10);
      buildJobs = data || [];
    }

    return NextResponse.json({
      success: true,
      target,
      computePlane: {
        driver: nodeCfg.driver,
        agentConfigured: nodeCfg.configured,
        storageQueue,
      },
      telemetry,
      buildJobs,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to inspect compute plane' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      serviceId?: string;
      action?: 'restart' | 'stop' | 'start' | 'rebuild' | 'recheck_health';
      commitSha?: string;
    };

    const { serviceId, action, commitSha } = body;
    if (!serviceId || !action) {
      return NextResponse.json(
        { error: 'serviceId and action are required' },
        { status: 400 }
      );
    }

    const access = await requireServiceAccess(request, serviceId, 'services:write');
    if (!access.ok) return access.response;

    const supabaseAdmin = getServiceSupabase();
    if (!supabaseAdmin && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Supabase Service');
    }

    const target = await resolveServiceComputeTarget(supabaseAdmin, serviceId, access.user.id);

    if (action === 'restart' || action === 'stop' || action === 'start') {
      const agentConfigured = isComputeAgentConfigured(target.agentEndpoint);
      if (!agentConfigured && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Compute Agent Node');
      }

      const res = await controlContainerLifecycleOnAgent(
        {
          serviceId,
          domain: target.domain,
          cpanelUser: target.cpanelUser,
          action,
        },
        target.agentEndpoint || undefined
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: res.error || `Compute action ${action} failed` },
          { status: 502 }
        );
      }

      if (supabaseAdmin) {
        const nextStatus = action === 'stop' ? 'suspended' : 'active';
        await supabaseAdmin
          .from('hosting_services')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', serviceId);
      }

      return NextResponse.json({
        success: true,
        action,
        mode: res.mode,
        result: res.data,
        message: res.data?.message || `Container ${action} executed for ${target.domain}.`,
      });
    }

    if (action === 'rebuild') {
      const sandbox = isDevSandboxMode();
      const shortSha = (commitSha || Date.now().toString(16)).slice(0, 7);
      const releaseId = `rel_${shortSha}_${Date.now()}`;

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
            { error: staticRes.error || 'Static Edge rebuild failed' },
            { status: 502 }
          );
        }

        if (supabaseAdmin) {
          await supabaseAdmin
            .from('project_deployments')
            .update({ status: 'superseded', is_current_production: false })
            .eq('service_id', serviceId)
            .eq('status', 'live_production');

          await supabaseAdmin.from('project_deployments').insert({
            service_id: serviceId,
            user_id: access.user.id,
            commit_sha: shortSha,
            commit_message: `Edge Rebuild (${target.stackSlug})`,
            author_name: access.user.email || 'Compute Studio',
            branch: target.gitBranch,
            trigger_source: 'manual_rebuild',
            environment: 'production',
            status: 'live_production',
            is_current_production: true,
            duration_seconds: 2,
            r2_artifact_key: staticRes.artifactKey,
            live_url: staticRes.liveUrl,
            build_logs: `[Edge Build] Uploaded ${staticRes.filesUploaded} assets to ${staticRes.artifactKey}`,
          });
        }

        return NextResponse.json({
          success: true,
          action: 'rebuild',
          deploymentMode: 'r2_static_edge',
          liveUrl: staticRes.liveUrl,
          r2ArtifactKey: staticRes.artifactKey,
        });
      }

      const agentConfigured = isComputeAgentConfigured(target.agentEndpoint);
      const queueConfigured = isBuildQueueConfigured();
      if (!agentConfigured && !queueConfigured && !sandbox) {
        return serviceUnavailableResponse('Compute & Build Plane');
      }

      const envVars = await loadDecryptedEnvMap(supabaseAdmin, serviceId, 'production');
      const jobId = `bld_${shortSha}_${Date.now()}`;
      const nodeCfg = getComputeNodeConfig(target.agentEndpoint);

      const qRes =
        queueConfigured || sandbox
          ? await enqueueBuildJob({
              jobId,
              serviceId,
              userId: access.user.id,
              domain: target.domain,
              cpanelUser: target.cpanelUser,
              stackSlug: target.stackSlug,
              runtimeFamily: target.runtimeFamily,
              runtimeVersion: target.runtimeVersion,
              triggerSource: 'manual_dashboard',
              gitRepoUrl: target.gitRepoUrl,
              gitBranch: target.gitBranch,
              commitSha: shortSha,
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
            })
          : null;

      const deployRes =
        agentConfigured || sandbox
          ? await dispatchBuildAndDeploy(
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
                commitSha: shortSha,
                installCommand: target.installCommand,
                buildCommand: target.buildCommand,
                startupFile: target.startupFile,
                outputDirectory: target.outputDirectory,
                envVars,
                callbackUrl: nodeCfg.controlPlaneCallbackUrl,
              },
              target.agentEndpoint || undefined
            )
          : null;

      if (deployRes && !deployRes.ok) {
        return NextResponse.json(
          { error: deployRes.error || 'Build dispatch failed' },
          { status: 502 }
        );
      }

      const buildLogs =
        deployRes?.data?.buildLogs ||
        `[Queue] Enqueued build job ${jobId} via ${qRes?.mode || 'agent'}`;

      if (supabaseAdmin) {
        await supabaseAdmin
          .from('project_deployments')
          .update({ status: 'superseded', is_current_production: false })
          .eq('service_id', serviceId)
          .eq('status', 'live_production');

        await supabaseAdmin.from('project_deployments').insert({
          service_id: serviceId,
          user_id: access.user.id,
          commit_sha: shortSha,
          commit_message: `Compute Rebuild (${target.stackSlug})`,
          author_name: access.user.email || 'Compute Studio',
          branch: target.gitBranch,
          trigger_source: 'manual_rebuild',
          environment: 'production',
          status: deployRes?.data?.queuedAsync ? 'building' : 'live_production',
          is_current_production: !deployRes?.data?.queuedAsync,
          duration_seconds: deployRes?.data?.durationSeconds || 3,
          build_job_id: jobId,
          container_id: deployRes?.data?.containerId || target.containerId,
          live_url: deployRes?.data?.liveUrl || `https://${target.domain}`,
          build_logs: buildLogs,
        });

        await supabaseAdmin.from('compute_build_jobs').upsert(
          {
            id: jobId,
            service_id: serviceId,
            user_id: access.user.id,
            runtime_family: target.runtimeFamily,
            stack_slug: target.stackSlug,
            git_repo_url: target.gitRepoUrl,
            git_branch: target.gitBranch,
            commit_sha: shortSha,
            status: deployRes?.data?.queuedAsync ? 'queued' : 'live',
            container_id: deployRes?.data?.containerId || target.containerId,
            live_url: deployRes?.data?.liveUrl || `https://${target.domain}`,
            build_logs: buildLogs,
            completed_at: deployRes?.data?.queuedAsync ? null : new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'rebuild',
        jobId,
        queueMode: qRes?.mode || 'direct_agent',
        containerId: deployRes?.data?.containerId || target.containerId,
        liveUrl: deployRes?.data?.liveUrl || `https://${target.domain}`,
      });
    }

    if (action === 'recheck_health') {
      if (!isComputeAgentConfigured(target.agentEndpoint) && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Compute Agent Node');
      }

      const tRes = await fetchContainerTelemetryAndLogs(
        serviceId,
        target.domain,
        target.agentEndpoint || undefined
      );
      if (!tRes.ok) {
        return NextResponse.json(
          { error: tRes.error || 'Telemetry probe failed' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'recheck_health',
        mode: tRes.mode,
        telemetry: tRes.data,
      });
    }

    return NextResponse.json({ error: 'Unsupported compute action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Compute action error' },
      { status: 500 }
    );
  }
}
