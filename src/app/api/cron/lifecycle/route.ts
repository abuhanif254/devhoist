import { NextRequest, NextResponse } from 'next/server';
import { serviceUnavailableResponse, verifyCronOrAdmin } from '@/lib/authGuard';
import { runAutonomousLifecycleCron, type LifecycleCronReport } from '@/lib/lifecycleEngine';
import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Preserves backward-compatible `results` keys (e.g. Phase 10 `transfersPolled` /
 * `transfersCompleted`) alongside the Phase 11 canonical `summary` payload.
 */
function buildCronResults(summary: LifecycleCronReport['summary']) {
  return {
    ...summary,
    invoicesGenerated: summary.renewalInvoicesCreated,
    remindersSent: summary.renewalEmailsSent + summary.urgentRemindersSent,
    autoRenewed: summary.autoRenewedViaWallet,
    suspendedAccounts: summary.accountsSuspendedOverdue,
    terminatedAccounts: summary.accountsTerminatedFinalSnapshot,
    commissionsMatured: summary.affiliateCommissionsMaturedCount,
    commissionsReleasedBDT: summary.affiliateCommissionsMaturedBDT,
    transfersPolled: summary.domainTransfersPolled,
    transfersCompleted: summary.domainTransfersCompleted,
    previewsPruned: summary.previewsPruned,
  };
}

/**
 * Automated Lifecycle & Billing Engine Cron Endpoint
 * Protected strictly by CRON_SECRET or verified Admin session.
 * Triggered daily at 00:00 UTC by Cloudflare Cron Triggers (`worker-entry.mjs`)
 * or manually by Founder/Admin from Command Center.
 */
async function handleLifecycleTrigger(req: NextRequest) {
  try {
    const auth = await verifyCronOrAdmin(req);
    if (!auth.ok) return auth.response;

    let dryRun = false;
    if (req.method === 'POST') {
      try {
        const body = (await req.json()) as { dryRun?: boolean };
        dryRun = Boolean(body?.dryRun);
      } catch {
        dryRun = false;
      }
    }

    const executionMode =
      auth.via === 'cron_secret' ? 'Cloudflare Automated Schedule' : 'Admin Manual Execution';

    if (!isSupabaseConfigured()) {
      if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Autonomous Lifecycle Cron');
      }

      const emptyReport: LifecycleCronReport = {
        success: true,
        executedAt: new Date().toISOString(),
        dryRun,
        summary: {
          renewalInvoicesCreated: 0,
          renewalEmailsSent: 0,
          autoRenewedViaWallet: 0,
          urgentRemindersSent: 0,
          accountsSuspendedOverdue: 0,
          accountsTerminatedFinalSnapshot: 0,
          affiliateCommissionsMaturedCount: 0,
          affiliateCommissionsMaturedBDT: 0,
          domainTransfersPolled: 0,
          domainTransfersCompleted: 0,
          previewsPruned: 0,
        },
        logs: [
          `[${new Date().toISOString()}] Lifecycle Cron running in DEV_SANDBOX_MODE (Supabase unconfigured; 0 live records processed).`,
        ],
        errors: [],
      };

      return NextResponse.json({
        ...emptyReport,
        results: buildCronResults(emptyReport.summary),
        executionMode,
        message: 'DevHost Cloud Autonomous Lifecycle Engine executed cleanly (sandbox idle).',
      });
    }

    const db = getServiceSupabase();
    const report = await runAutonomousLifecycleCron(db, { dryRun });

    return NextResponse.json({
      ...report,
      results: buildCronResults(report.summary),
      executionMode,
      message: 'DevHost Cloud Autonomous Lifecycle Engine executed successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron execution failed';
    console.error('[Lifecycle Cron Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Cron Execution Failed', message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleLifecycleTrigger(req);
}

export async function GET(req: NextRequest) {
  return handleLifecycleTrigger(req);
}
