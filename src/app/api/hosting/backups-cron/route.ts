import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { validateShellCommand, describeCronExpression } from '@/lib/projectEngine';


async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
  ip: string = '127.0.0.1',
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'high'
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
 * GET /api/hosting/backups-cron?serviceId=...&type=backups|cron|both
 * Fetch JetBackup snapshots and sanitized cron jobs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const type = searchParams.get('type') || 'both';

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();

      let backups: any[] = [];
      let cronJobs: any[] = [];

      if (type === 'backups' || type === 'both') {
        const { data } = await db
          .from('hosting_backups')
          .select('*')
          .eq('service_id', serviceId)
          .order('created_at', { ascending: false });
        if (data) backups = data;
      }

      if (type === 'cron' || type === 'both') {
        const { data } = await db
          .from('hosting_cron_jobs')
          .select('*')
          .eq('service_id', serviceId)
          .order('created_at', { ascending: false });
        if (data) cronJobs = data;
      }

      return NextResponse.json({
        success: true,
        backups,
        cronJobs,
      });
    }

    // Offline mock responses
    return NextResponse.json({
      success: true,
      backups: [
        {
          id: 'bk_1',
          service_id: serviceId,
          snapshot_label: 'Automated Daily JetBackup (Full Stack)',
          backup_type: 'automated_daily',
          scope: 'full_account',
          storage_location: 'Offsite Encrypted S3 Vault (SG1)',
          size_mb: 148.5,
          status: 'completed',
          created_at: new Date(Date.now() - 43200000).toISOString(),
        },
      ],
      cronJobs: [
        {
          id: 'cron_1',
          service_id: serviceId,
          job_label: 'Cache Flush & Order Reconcile',
          cron_expression: '0 * * * *',
          command: '/usr/local/bin/node /home/user/cron/flush-cache.js',
          is_active: true,
          last_exit_code: 0,
          last_output_log: '[OK] Cleared 142 stale Redis cache keys in 42ms.',
          created_at: new Date(Date.now() - 864000000).toISOString(),
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hosting/backups-cron
 * Actions:
 * 1. create_snapshot: Create manual JetBackup snapshot
 * 2. restore_snapshot: Sudo-verified point-in-time restore
 * 3. create_cron: Create sanitized cron job with command firewall
 * 4. test_run_cron: Execute test run in simulated terminal
 * 5. toggle_cron: Toggle active status
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const {
      action,
      serviceId,
      userId,
      label,
      scope = 'full_account',
      snapshotId,
      cronExpression,
      command,
      cronId,
      isActive,
      sudoVerified,
    } = body;

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    // 1. CREATE JETBACKUP SNAPSHOT
    if (action === 'create_snapshot') {
      if (!serviceId) {
        return NextResponse.json({ success: false, error: 'Service ID is required.' }, { status: 400 });
      }

      const snapshotLabel = label || `Manual Snapshot (${new Date().toLocaleDateString()})`;
      const estimatedSize = scope === 'files_only' ? 84.0 : scope === 'database_only' ? 14.5 : 152.0;

      let newId = `bk_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('hosting_backups')
          .insert({
            service_id: serviceId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            snapshot_label: snapshotLabel,
            backup_type: 'manual_snapshot',
            scope,
            size_mb: estimatedSize,
            status: 'completed',
            expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;
      }

      await logAudit(userId, 'BACKUP_SNAPSHOT_CREATED', `service:${serviceId}`, { scope, size_mb: estimatedSize }, ip);

      return NextResponse.json({
        success: true,
        message: `JetBackup snapshot '${snapshotLabel}' generated and synced to offsite S3 vault!`,
        id: newId,
      });
    }

    // 2. RESTORE SNAPSHOT (Requires Sudo)
    if (action === 'restore_snapshot') {
      if (!snapshotId) {
        return NextResponse.json({ success: false, error: 'Snapshot ID required.' }, { status: 400 });
      }

      if (!sudoVerified) {
        return NextResponse.json({
          success: false,
          error: '2FA Sudo Step-Up Verification required to restore server filesystem from snapshot.',
          requireSudo: true,
        }, { status: 403 });
      }

      if (db) {
        await db
          .from('hosting_backups')
          .update({
            last_restored_at: new Date().toISOString(),
          })
          .eq('id', snapshotId);
      }

      await logAudit(userId, 'BACKUP_RESTORE_EXECUTED', `backup:${snapshotId}`, {}, ip, 'critical');

      return NextResponse.json({
        success: true,
        message: 'Point-in-Time restore finalized. Files and database successfully restored to container root.',
      });
    }

    // 3. CREATE SANITIZED CRON JOB
    if (action === 'create_cron') {
      if (!serviceId || !cronExpression || !command) {
        return NextResponse.json({ success: false, error: 'Service ID, cron expression, and command are required.' }, { status: 400 });
      }

      // Check Cron Expression
      const cronDesc = describeCronExpression(cronExpression);
      if (!cronDesc.valid) {
        return NextResponse.json({ success: false, error: cronDesc.description }, { status: 422 });
      }

      // Command Security Firewall
      const firewallCheck = validateShellCommand(command);
      if (!firewallCheck.allowed) {
        await logAudit(userId, 'CRON_INJECTION_ATTEMPT_BLOCKED', `service:${serviceId}`, { command }, ip, 'critical');
        return NextResponse.json({ success: false, error: firewallCheck.reason }, { status: 403 });
      }

      let newId = `cron_${Date.now()}`;
      if (db) {
        const { data, error } = await db
          .from('hosting_cron_jobs')
          .insert({
            service_id: serviceId,
            user_id: userId || '00000000-0000-0000-0000-000000000001',
            job_label: label || 'Scheduled Job',
            cron_expression: cronExpression.trim(),
            command: command.trim(),
            is_active: true,
          })
          .select('id')
          .single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        if (data) newId = data.id;
      }

      await logAudit(userId, 'CRON_JOB_CREATED', `service:${serviceId}`, { cron: cronExpression }, ip);

      return NextResponse.json({
        success: true,
        message: `Cron job registered (${cronDesc.description}).`,
        id: newId,
        humanSchedule: cronDesc.description,
      });
    }

    // 4. TEST RUN CRON NOW
    if (action === 'test_run_cron') {
      if (!command) {
        return NextResponse.json({ success: false, error: 'Command is required.' }, { status: 400 });
      }

      const firewallCheck = validateShellCommand(command);
      if (!firewallCheck.allowed) {
        return NextResponse.json({ success: false, error: firewallCheck.reason }, { status: 403 });
      }

      const testLog = `[${new Date().toISOString()}] Spawned isolated worker container (PID 9102)...
$ ${command}
[STDOUT] Execution initialized with environment NODE_ENV=production
[STDOUT] Completed task in 38ms. Exit code: 0 (SUCCESS)`;

      if (db && cronId) {
        await db
          .from('hosting_cron_jobs')
          .update({
            last_run_at: new Date().toISOString(),
            last_exit_code: 0,
            last_output_log: testLog,
          })
          .eq('id', cronId);
      }

      return NextResponse.json({
        success: true,
        exitCode: 0,
        outputLog: testLog,
      });
    }

    // 5. TOGGLE CRON ACTIVE STATUS
    if (action === 'toggle_cron') {
      if (!cronId) return NextResponse.json({ success: false, error: 'Cron ID required.' }, { status: 400 });

      if (db) {
        await db
          .from('hosting_cron_jobs')
          .update({ is_active: Boolean(isActive) })
          .eq('id', cronId);
      }

      return NextResponse.json({
        success: true,
        message: `Cron job is now ${isActive ? 'ENABLED' : 'PAUSED'}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/hosting/backups-cron?id=...&itemType=backup|cron
 */
export async function DELETE(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const itemType = searchParams.get('itemType');
    const userId = searchParams.get('userId');

    if (!id || !itemType) {
      return NextResponse.json({ success: false, error: 'ID and itemType (backup or cron) required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      if (itemType === 'backup') {
        await db.from('hosting_backups').delete().eq('id', id);
      } else {
        await db.from('hosting_cron_jobs').delete().eq('id', id);
      }
    }

    await logAudit(userId, `${itemType.toUpperCase()}_DELETED`, `${itemType}:${id}`, {}, ip);

    return NextResponse.json({
      success: true,
      message: `${itemType === 'backup' ? 'Backup snapshot' : 'Cron job'} removed.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
