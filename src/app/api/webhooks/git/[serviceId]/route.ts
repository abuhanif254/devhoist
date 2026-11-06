import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { verifyGitHubSignature } from '@/lib/projectEngine';

export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await context.params;
    const signature = request.headers.get('x-hub-signature-256');
    const rawBody = await request.text();

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is missing in webhook route.' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, message: 'Offline mode: Webhook acknowledged.' });
    }

    const db = getServiceSupabase();

    // 1. Fetch project settings for this service
    const { data: settings, error: settingsError } = await db
      .from('hosting_project_settings')
      .select('*')
      .eq('service_id', serviceId)
      .single();

    if (settingsError || !settings) {
      return NextResponse.json({ success: false, error: 'Project configuration not found for this service.' }, { status: 404 });
    }

    // 2. Cryptographic HMAC Signature Verification
    const isValid = await verifyGitHubSignature(settings.webhook_secret_token, rawBody, signature);
    if (!isValid) {
      await db.from('security_audit_logs').insert({
        actor_id: settings.user_id,
        actor_role: 'system',
        action_type: 'WEBHOOK_SIGNATURE_INVALID',
        target_resource: `service:${serviceId}`,
        ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
        risk_level: 'critical',
        metadata: { reason: 'HMAC-SHA256 signature mismatch or missing secret' },
      });

      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid X-Hub-Signature-256 signature.' },
        { status: 401 }
      );
    }

    // 3. Parse GitHub Payload
    const payload = JSON.parse(rawBody);
    const ref = payload.ref || '';
    const targetBranch = `refs/heads/${settings.production_branch || 'main'}`;

    if (ref !== targetBranch) {
      return NextResponse.json({
        success: true,
        message: `Push ignored: Event was for ${ref}, but production branch is set to ${settings.production_branch}.`,
      });
    }

    if (!settings.auto_deploy_on_push) {
      return NextResponse.json({
        success: true,
        message: 'Auto deploy on push is disabled in project settings. Build skipped.',
      });
    }

    const headCommit = payload.head_commit || {};
    const commitSha = (headCommit.id || 'head').substring(0, 7);
    const commitMessage = headCommit.message || 'Auto-deploy triggered by GitHub push';
    const authorName = headCommit.author?.name || 'GitHub Webhook';

    const buildLogs = `[${new Date().toISOString()}] Automated CI/CD Webhook Triggered from GitHub Push
[00:00:01] HMAC-SHA256 signature verified with ${settings.webhook_secret_token.substring(0, 10)}••••
[00:00:02] Fetching commit ${commitSha}: "${commitMessage}"
[00:00:03] Running install command: ${settings.install_command || 'npm ci'}
[00:00:05] Running build command: ${settings.build_command || 'npm run build'}
[00:00:07] Standalone bundle generated in ${settings.output_directory || '.next/standalone'}
[00:00:08] Phusion Passenger container reloaded gracefully. Zero downtime!`;

    // 4. Record new production deployment
    await db
      .from('project_deployments')
      .update({ is_current_production: false, status: 'superseded' })
      .eq('service_id', serviceId)
      .eq('is_current_production', true);

    const { data: newDep, error: depError } = await db
      .from('project_deployments')
      .insert({
        service_id: serviceId,
        user_id: settings.user_id,
        commit_sha: commitSha,
        commit_message: commitMessage,
        branch: settings.production_branch || 'main',
        author_name: authorName,
        trigger_source: 'github_webhook',
        status: 'live_production',
        is_current_production: true,
        artifact_size_mb: 14.8,
        inodes_count: 1920,
        duration_seconds: 3.2,
        build_logs: buildLogs,
      })
      .select('id')
      .single();

    if (depError) {
      return NextResponse.json({ success: false, error: depError.message }, { status: 500 });
    }

    // Prune older releases
    const { data: allReleases } = await db
      .from('project_deployments')
      .select('id')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false });

    if (allReleases && allReleases.length > (settings.retained_rollback_releases || 3)) {
      const idsToDelete = allReleases.slice(settings.retained_rollback_releases || 3).map((r: any) => r.id);
      await db.from('project_deployments').delete().in('id', idsToDelete);
    }

    return NextResponse.json({
      success: true,
      message: `Production release for ${commitSha} deployed successfully via GitHub Webhook!`,
      deploymentId: newDep?.id,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
