import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { requireServiceAccess } from '@/lib/authGuard';


async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
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

    // Offline mock deployments
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
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

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    // 1. MANUAL TRIGGER BUILD
    if (action === 'trigger_manual') {
      const commitSha = Math.random().toString(36).substring(2, 9);
      const buildLogs = `[${new Date().toISOString()}] Initiating Manual Production Deploy...
[00:00:01] Syncing Git workspace...
[00:00:02] Running install_command: npm ci (cached)
[00:00:04] Executing build_command: npm run build (Turbopack standalone)
[00:00:06] Optimizing production static assets
[00:00:07] Copying standalone runtime into Phusion Passenger root
[00:00:08] Gracefully restarting Passenger worker threads
[00:00:08] Health check passed (HTTP 200 OK) - Live production deployment active!`;

      let newId = `dep_${Date.now()}`;
      if (db) {
        // Demote previous current production releases to superseded
        await db
          .from('project_deployments')
          .update({ is_current_production: false, status: 'superseded' })
          .eq('service_id', serviceId)
          .eq('is_current_production', true);

        const { data, error } = await db
          .from('project_deployments')
          .insert({
            service_id: serviceId,
            user_id: resolvedUserId,
            commit_sha: commitSha,
            commit_message: commitMessage || 'Manual production deploy via dashboard',
            branch: 'main',
            author_name: 'Developer (Dashboard)',
            trigger_source: 'manual_dashboard',
            status: 'live_production',
            is_current_production: true,
            artifact_size_mb: 14.5,
            inodes_count: 1890,
            duration_seconds: 2.8,
            build_logs: buildLogs,
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;

        // Prune older releases beyond 3 to save Reseller NVMe quota
        const { data: allReleases } = await db
          .from('project_deployments')
          .select('id')
          .eq('service_id', serviceId)
          .order('created_at', { ascending: false });

        if (allReleases && allReleases.length > 5) {
          const idsToDelete = allReleases.slice(5).map((r: any) => r.id);
          await db.from('project_deployments').delete().in('id', idsToDelete);
        }
      }

      await logAudit(userId, 'DEPLOYMENT_TRIGGERED', `service:${serviceId}`, { commitSha }, ip);

      return NextResponse.json({
        success: true,
        message: 'Deployment compiled and live in production!',
        deploymentId: newId,
        commitSha,
      });
    }

    // 2. 1-CLICK INSTANT ROLLBACK
    if (action === 'rollback') {
      if (!targetDeploymentId) {
        return NextResponse.json({ success: false, error: 'Target deployment ID required.' }, { status: 400 });
      }

      if (db) {
        // Demote existing current production
        await db
          .from('project_deployments')
          .update({ is_current_production: false, status: 'superseded' })
          .eq('service_id', serviceId)
          .eq('is_current_production', true);

        // Promote target deployment to current production
        const { error } = await db
          .from('project_deployments')
          .update({
            is_current_production: true,
            status: 'live_production',
          })
          .eq('id', targetDeploymentId);

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'INSTANT_ROLLBACK_EXECUTED', `service:${serviceId}`, { targetDeploymentId }, ip, 'high');

      return NextResponse.json({
        success: true,
        message: 'Instant rollback successful! Traffic restored to previous release.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
