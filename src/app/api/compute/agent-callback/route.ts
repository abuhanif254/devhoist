// ==============================================================================
// DEVHOST CLOUD - COMPUTE AGENT SIGNED WEBHOOK CALLBACK
// Verifies HMAC-SHA256 signature (`x-devhost-timestamp`, `x-devhost-signature`)
// and updates `compute_build_jobs`, `project_deployments`, and `hosting_services`.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { verifyAgentCallbackSignature } from '@/lib/computeAgentClient';

interface AgentCallbackPayload {
  jobId?: string;
  serviceId?: string;
  domain?: string;
  containerId?: string;
  releaseId?: string;
  commitSha?: string;
  status?: 'queued' | 'building' | 'live' | 'failed' | 'cancelled';
  liveUrl?: string;
  r2ArtifactKey?: string;
  durationSeconds?: number;
  buildLogs?: string;
  errorMessage?: string;
  metrics?: {
    ramUsedMb?: number;
    diskUsedGb?: number;
    inodesUsed?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const timestampHeader = request.headers.get('x-devhost-timestamp') || '';
    const signatureHeader = request.headers.get('x-devhost-signature') || '';

    const verification = await verifyAgentCallbackSignature({
      rawBody,
      timestampHeader,
      signatureHeader,
    });

    if (!verification.valid) {
      return NextResponse.json(
        {
          error: verification.reason || 'Invalid or expired compute agent signature',
          code: 'UNAUTHORIZED_AGENT_CALLBACK',
        },
        { status: 401 }
      );
    }

    let payload: AgentCallbackPayload;
    try {
      payload = JSON.parse(rawBody) as AgentCallbackPayload;
    } catch {
      return NextResponse.json({ error: 'Malformed callback JSON payload' }, { status: 400 });
    }

    if (!payload.serviceId || !payload.status) {
      return NextResponse.json(
        { error: 'serviceId and status are required in callback payload' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();
    if (supabaseAdmin) {
      const nowIso = new Date().toISOString();

      if (payload.jobId) {
        await supabaseAdmin
          .from('compute_build_jobs')
          .update({
            status: payload.status,
            container_id: payload.containerId || null,
            r2_artifact_key: payload.r2ArtifactKey || null,
            live_url: payload.liveUrl || null,
            build_logs: payload.buildLogs || null,
            error_message: payload.errorMessage || null,
            completed_at:
              payload.status === 'live' || payload.status === 'failed' || payload.status === 'cancelled'
                ? nowIso
                : null,
          })
          .eq('id', payload.jobId);
      }

      if (payload.jobId && (payload.status === 'live' || payload.status === 'failed')) {
        if (payload.status === 'live') {
          await supabaseAdmin
            .from('project_deployments')
            .update({ status: 'superseded', is_current_production: false })
            .eq('service_id', payload.serviceId)
            .eq('status', 'live_production');
        }

        await supabaseAdmin
          .from('project_deployments')
          .update({
            status: payload.status === 'live' ? 'live_production' : 'failed',
            is_current_production: payload.status === 'live',
            duration_seconds: payload.durationSeconds ?? 4,
            build_logs: payload.buildLogs || undefined,
            container_id: payload.containerId || undefined,
            r2_artifact_key: payload.r2ArtifactKey || undefined,
            live_url: payload.liveUrl || undefined,
          })
          .eq('build_job_id', payload.jobId);
      }

      const serviceUpdates: Record<string, unknown> = {
        updated_at: nowIso,
      };
      if (payload.containerId) serviceUpdates.container_id = payload.containerId;
      if (payload.liveUrl) serviceUpdates.live_preview_url = payload.liveUrl;
      if (payload.metrics?.ramUsedMb !== undefined) {
        serviceUpdates.ram_used_mb = payload.metrics.ramUsedMb;
      }
      if (payload.metrics?.diskUsedGb !== undefined) {
        serviceUpdates.disk_used_gb = payload.metrics.diskUsedGb;
      }
      if (payload.metrics?.inodesUsed !== undefined) {
        serviceUpdates.inode_used = payload.metrics.inodesUsed;
      }
      if (payload.status === 'live') {
        serviceUpdates.status = 'active';
      }

      await supabaseAdmin
        .from('hosting_services')
        .update(serviceUpdates)
        .eq('id', payload.serviceId);
    }

    return NextResponse.json({
      success: true,
      received: true,
      jobId: payload.jobId || null,
      serviceId: payload.serviceId,
      status: payload.status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent callback failed' },
      { status: 500 }
    );
  }
}
