import type { SupabaseClient } from '@supabase/supabase-js';
import { maturePendingCommissions } from '@/lib/affiliateEngine';
import {
  controlContainerLifecycleOnAgent,
  triggerBackupSnapshotOnAgent,
} from '@/lib/computeAgentClient';
import {
  resolveServiceComputeTarget,
  resolveWhmClientForTarget,
} from '@/lib/computeTargetResolver';
import {
  renderInvoicePaidEmail,
  renderRenewalReminderEmail,
  renderServiceSuspendedEmail,
  sendTransactionalEmail,
} from '@/lib/emailEngine';
import { teardownPullRequestPreview } from '@/lib/gitDeployDispatcher';
import { logSecurityAudit } from '@/lib/security';
import { buildDashboardUrl } from '@/lib/siteUrl';
import { syncDomainTransferStatuses } from '@/lib/transferLifecycle';

export interface LifecycleCronReport {
  success: boolean;
  executedAt: string;
  dryRun: boolean;
  summary: {
    renewalInvoicesCreated: number;
    renewalEmailsSent: number;
    autoRenewedViaWallet: number;
    urgentRemindersSent: number;
    accountsSuspendedOverdue: number;
    accountsTerminatedFinalSnapshot: number;
    affiliateCommissionsMaturedCount: number;
    affiliateCommissionsMaturedBDT: number;
    domainTransfersPolled: number;
    domainTransfersCompleted: number;
    previewsPruned: number;
  };
  logs: string[];
  errors: string[];
}

interface HostingServiceRow {
  id: string;
  user_id: string;
  domain: string;
  plan_name: string;
  server_node?: string | null;
  cpanel_username: string;
  status: string;
  billing_cycle?: string | null;
  price_bdt?: number | string | null;
  next_due_date?: string | null;
  auto_renew?: boolean | null;
  last_renewal_invoice_id?: string | null;
  last_renewal_billed_at?: string | null;
}

interface CustomerProfileRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  wallet_balance_bdt?: number | string | null;
}

interface RenewalInvoiceRow {
  id: string;
  invoice_number: string;
  user_id: string;
  service_id?: string | null;
  total_bdt: number | string;
  status: string;
  due_date?: string | null;
  order_type?: string | null;
  items?: Array<Record<string, unknown>> | null;
  reminder_t3_sent_at?: string | null;
  reminder_t1_sent_at?: string | null;
  created_at?: string | null;
}

function toUtcDayStartMs(input: string | Date): number {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return 0;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Computes integer days from today (UTC midnight) until targetIsoDate.
 * Positive => due in future (e.g. +7 = T-7), 0 => due today (T-0), negative => overdue (e.g. -3 = T+3).
 */
export function computeDaysUntilDueUtc(targetIsoDate: string, now: Date): number {
  const targetMs = toUtcDayStartMs(targetIsoDate);
  if (!targetMs) return Number.POSITIVE_INFINITY;
  const todayMs = toUtcDayStartMs(now);
  return Math.round((targetMs - todayMs) / 86400000);
}

/**
 * Advances next_due_date cleanly across monthly / annually / triennially billing cycles.
 */
export function addBillingCycleDate(
  currentDueDate: string | null | undefined,
  billingCycle: string | null | undefined,
  referenceNow: Date = new Date()
): string {
  const baseMs = currentDueDate ? toUtcDayStartMs(currentDueDate) : 0;
  const nowMs = toUtcDayStartMs(referenceNow);
  const startMs = Math.max(baseMs || nowMs, nowMs);
  const days =
    billingCycle === 'triennially'
      ? 1095
      : billingCycle === 'annually'
      ? 365
      : 30;
  return new Date(startMs + days * 86400000).toISOString().split('T')[0];
}

function buildRenewalInvoiceNumber(now: Date): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-REN-${datePart}-${rand}`;
}

async function resolveInvoiceForServiceCycle(
  db: SupabaseClient,
  service: HostingServiceRow,
  now: Date
): Promise<{ invoice: RenewalInvoiceRow | null; created: boolean; error?: string }> {
  const { data: openInvoices } = await db
    .from('invoices')
    .select(
      'id, invoice_number, user_id, service_id, total_bdt, status, due_date, order_type, items, reminder_t3_sent_at, reminder_t1_sent_at, created_at'
    )
    .eq('user_id', service.user_id)
    .in('status', ['unpaid', 'verifying_trxid'])
    .order('created_at', { ascending: false })
    .limit(25);

  const openList = (openInvoices || []) as RenewalInvoiceRow[];
  const existing = openList.find((inv) => {
    if (inv.service_id && inv.service_id === service.id) return true;
    if (service.last_renewal_invoice_id && inv.id === service.last_renewal_invoice_id) return true;
    const isRenewalType = inv.order_type === 'service_renewal' || inv.order_type === 'renewal';
    const items = Array.isArray(inv.items) ? inv.items : [];
    return items.some(
      (it) => it?.serviceId === service.id || (isRenewalType && it?.domain === service.domain)
    );
  });

  if (existing) {
    return { invoice: existing, created: false };
  }

  // Guard against creating duplicate renewal invoices if already billed recently in this cycle
  if (service.last_renewal_billed_at) {
    const billedDaysAgo = Math.abs(
      (now.getTime() - new Date(service.last_renewal_billed_at).getTime()) / 86400000
    );
    if (billedDaysAgo < 15) {
      return { invoice: null, created: false };
    }
  }

  const amountBDT = Number(service.price_bdt || 0);
  if (!Number.isFinite(amountBDT) || amountBDT <= 0) {
    return { invoice: null, created: false, error: `Invalid price_bdt on service ${service.domain}` };
  }

  const invoiceNumber = buildRenewalInvoiceNumber(now);
  const dueDate = service.next_due_date || new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const { data: inserted, error: insertErr } = await db
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      user_id: service.user_id,
      service_id: service.id,
      items: [
        {
          desc: `${service.plan_name} Renewal (${service.domain})`,
          name: `${service.plan_name} Renewal`,
          cycle: service.billing_cycle || 'monthly',
          serviceId: service.id,
          domain: service.domain,
          amount: amountBDT,
          amountBDT,
        },
      ],
      subtotal_bdt: amountBDT,
      discount_bdt: 0,
      total_bdt: amountBDT,
      status: 'unpaid',
      payment_method: 'bKash / Nagad / Wallet',
      order_type: 'service_renewal',
      due_date: dueDate,
      updated_at: now.toISOString(),
    })
    .select(
      'id, invoice_number, user_id, service_id, total_bdt, status, due_date, order_type, items, reminder_t3_sent_at, reminder_t1_sent_at, created_at'
    )
    .single();

  if (insertErr || !inserted) {
    return { invoice: null, created: false, error: insertErr?.message || 'Renewal invoice insert failed.' };
  }

  await db
    .from('hosting_services')
    .update({
      last_renewal_invoice_id: String((inserted as RenewalInvoiceRow).id),
      updated_at: now.toISOString(),
    })
    .eq('id', service.id);

  return { invoice: inserted as RenewalInvoiceRow, created: true };
}

/**
 * Shared service extension & unsuspend routine called both by T-0 cron auto-renewal
 * and manual gateway settlement of a renewal invoice.
 */
export async function extendAndUnsuspendHostingService(
  db: SupabaseClient,
  params: {
    serviceId: string;
    userId?: string;
    reason?: string;
    now?: Date;
  }
): Promise<{ ok: boolean; nextDueDate?: string; unsuspended?: boolean; error?: string }> {
  const now = params.now || new Date();
  const { data: serviceRow } = await db
    .from('hosting_services')
    .select('id, user_id, domain, cpanel_username, status, billing_cycle, next_due_date, server_node')
    .eq('id', params.serviceId)
    .maybeSingle();

  if (!serviceRow) {
    return { ok: false, error: 'Hosting service not found for renewal extension.' };
  }

  const service = serviceRow as HostingServiceRow;
  const nextDueDate = addBillingCycleDate(service.next_due_date, service.billing_cycle, now);
  const wasSuspended = service.status === 'suspended';

  await db
    .from('hosting_services')
    .update({
      status: 'active',
      next_due_date: nextDueDate,
      last_renewal_billed_at: now.toISOString(),
      suspended_at: null,
      suspended_reason: null,
      updated_at: now.toISOString(),
    })
    .eq('id', service.id);

  if (wasSuspended) {
    const target = await resolveServiceComputeTarget(db, service.id, service.user_id).catch(() => null);
    if (target) {
      const whm = resolveWhmClientForTarget(target);
      await whm.unsuspendAccount(service.cpanel_username).catch(() => {});
      await controlContainerLifecycleOnAgent(
        {
          serviceId: service.id,
          domain: service.domain,
          cpanelUser: service.cpanel_username,
          action: 'resume',
        },
        target.agentEndpoint
      ).catch(() => {});
    }

    await logSecurityAudit({
      actorId: params.userId || service.user_id,
      actorRole: 'system',
      actionType: 'LIFECYCLE_SERVICE_UNSUSPENDED',
      targetResource: `service:${service.id}:${service.domain}`,
      riskLevel: 'low',
      metadata: { reason: params.reason || 'Renewal paid', nextDueDate },
    });
  }

  return { ok: true, nextDueDate, unsuspended: wasSuspended };
}

async function tryWalletAutoRenewal(
  db: SupabaseClient,
  service: HostingServiceRow,
  invoice: RenewalInvoiceRow,
  profile: CustomerProfileRow | undefined,
  now: Date
): Promise<{ paid: boolean; newBalanceBDT?: number; trxId?: string; skippedReason?: string }> {
  const requiredBDT = Number(invoice.total_bdt || 0);
  const currentBalance = Number(profile?.wallet_balance_bdt || 0);
  if (requiredBDT <= 0 || currentBalance < requiredBDT) {
    return { paid: false, skippedReason: 'insufficient_wallet_balance' };
  }

  const trxId = `WLT-REN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const dbWithRpc = db as unknown as {
    rpc?: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  if (typeof dbWithRpc.rpc === 'function') {
    const { data: rpcRes, error: rpcErr } = await dbWithRpc.rpc('process_atomic_wallet_payment', {
      p_user_id: service.user_id,
      p_invoice_number: invoice.invoice_number,
      p_trx_id: trxId,
    });
    if (rpcErr) {
      return { paid: false, skippedReason: rpcErr.message || 'rpc_error' };
    }
    const parsed = (Array.isArray(rpcRes) ? rpcRes[0] : rpcRes) as {
      ok?: boolean;
      code?: string;
      new_balance?: number;
      trx_id?: string;
    } | null;

    if (!parsed?.ok) {
      return { paid: false, skippedReason: parsed?.code || 'declined' };
    }

    const ext = await extendAndUnsuspendHostingService(db, {
      serviceId: service.id,
      userId: service.user_id,
      reason: `Auto-renewed via Wallet (${invoice.invoice_number})`,
      now,
    });

    if (profile) {
      profile.wallet_balance_bdt = Number(parsed.new_balance ?? Math.max(0, currentBalance - requiredBDT));
    }

    return {
      paid: ext.ok,
      newBalanceBDT: Number(parsed.new_balance ?? 0),
      trxId: parsed.trx_id || trxId,
    };
  }

  return { paid: false, skippedReason: 'wallet_rpc_unavailable' };
}

async function suspendOverdueService(
  db: SupabaseClient,
  service: HostingServiceRow,
  profile: CustomerProfileRow | undefined,
  daysOverdue: number,
  invoice: RenewalInvoiceRow | null,
  now: Date
): Promise<{ suspended: boolean; emailSent: boolean }> {
  const target = await resolveServiceComputeTarget(db, service.id, service.user_id).catch(() => null);
  if (target) {
    const whm = resolveWhmClientForTarget(target);
    await whm.suspendAccount(service.cpanel_username, `Invoice overdue ${daysOverdue} days`).catch(() => {});
    await controlContainerLifecycleOnAgent(
      {
        serviceId: service.id,
        domain: service.domain,
        cpanelUser: service.cpanel_username,
        action: 'suspend',
      },
      target.agentEndpoint
    ).catch(() => {});
  }

  await db
    .from('hosting_services')
    .update({
      status: 'suspended',
      suspended_at: now.toISOString(),
      suspended_reason: `Unpaid renewal overdue (${daysOverdue} days)`,
      updated_at: now.toISOString(),
    })
    .eq('id', service.id);

  await logSecurityAudit({
    actorId: service.user_id,
    actorRole: 'system',
    actionType: 'LIFECYCLE_SERVICE_SUSPENDED',
    targetResource: `service:${service.id}:${service.domain}`,
    riskLevel: 'medium',
    metadata: {
      daysOverdue,
      invoiceNumber: invoice?.invoice_number || null,
      cpanelUsername: service.cpanel_username,
    },
  });

  let emailSent = false;
  if (profile?.email) {
    const html = renderServiceSuspendedEmail({
      name: profile.full_name || 'Developer',
      serviceName: service.plan_name,
      domain: service.domain,
      overdueDays: daysOverdue,
      outstandingAmountBDT: Number(invoice?.total_bdt || service.price_bdt || 0),
      terminationGraceDays: Math.max(1, 14 - daysOverdue),
      payUnlockUrl: buildDashboardUrl('invoices'),
    });
    const mailRes = await sendTransactionalEmail({
      to: profile.email,
      subject: `Service Suspended: ${service.domain} (${daysOverdue} Days Overdue)`,
      html,
      template: 'service_suspended_alert',
    });
    emailSent = mailRes.success;
  }

  return { suspended: true, emailSent };
}

async function terminateOverdueService(
  db: SupabaseClient,
  service: HostingServiceRow,
  daysOverdue: number,
  now: Date
): Promise<{ terminated: boolean; snapshotId: string }> {
  const snapshotId = `final-snap-${service.id.slice(0, 8)}-${now.toISOString().slice(0, 10)}`;
  const target = await resolveServiceComputeTarget(db, service.id, service.user_id).catch(() => null);

  if (target) {
    await triggerBackupSnapshotOnAgent(
      {
        action: 'create',
        serviceId: service.id,
        cpanelUser: service.cpanel_username,
        snapshotId,
        scope: 'full_archive',
        r2ObjectKey: `archives/terminated/${service.id}/${snapshotId}.tar.gz`,
      },
      target.agentEndpoint
    ).catch(() => {});

    await controlContainerLifecycleOnAgent(
      {
        serviceId: service.id,
        domain: service.domain,
        cpanelUser: service.cpanel_username,
        action: 'terminate',
      },
      target.agentEndpoint
    ).catch(() => {});

    const whm = resolveWhmClientForTarget(target);
    await whm.terminateAccount(service.cpanel_username).catch(() => {});
  }

  await db
    .from('hosting_services')
    .update({
      status: 'terminated',
      terminated_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', service.id);

  // Mark lingering unpaid renewal invoices for this terminated service as cancelled
  await db
    .from('invoices')
    .update({ status: 'cancelled', updated_at: now.toISOString() })
    .eq('service_id', service.id)
    .eq('status', 'unpaid');

  await logSecurityAudit({
    actorId: service.user_id,
    actorRole: 'system',
    actionType: 'LIFECYCLE_SERVICE_TERMINATED',
    targetResource: `service:${service.id}:${service.domain}`,
    riskLevel: 'high',
    metadata: {
      daysOverdue,
      snapshotId,
      cpanelUsername: service.cpanel_username,
    },
  });

  return { terminated: true, snapshotId };
}

async function pruneExpiredPreviews(
  db: SupabaseClient,
  now: Date
): Promise<{ prunedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let prunedCount = 0;

  const { data: expiredRows, error } = await db
    .from('hosting_preview_environments')
    .select('id, service_id, pr_number, branch_name, preview_url, status, expires_at')
    .in('status', ['ready_live', 'building'])
    .limit(100);

  if (error || !Array.isArray(expiredRows)) {
    return { prunedCount: 0, errors: error ? [error.message] : [] };
  }

  const nowMs = now.getTime();
  for (const row of expiredRows) {
    if (!row?.expires_at) continue;
    const expMs = new Date(String(row.expires_at)).getTime();
    if (Number.isNaN(expMs) || expMs > nowMs) continue;

    const prNumber = Number(row.pr_number || 0);
    if (prNumber > 0 && row.service_id) {
      const res = await teardownPullRequestPreview({
        previewId: row.id ? String(row.id) : undefined,
        serviceId: String(row.service_id),
        prNumber,
        branchName: row.branch_name ? String(row.branch_name) : undefined,
        actorId: 'system-cron',
      }).catch((e) => {
        errors.push(e instanceof Error ? e.message : 'Preview teardown failed');
        return null;
      });
      if (row.id) {
        await db
          .from('hosting_preview_environments')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', String(row.id))
          .in('status', ['ready_live', 'building']);
      }
      if (res?.ok || row.id) {
        prunedCount += 1;
      }
    } else if (row.id) {
      await db
        .from('hosting_preview_environments')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', String(row.id));
      prunedCount += 1;
    }
  }

  return { prunedCount, errors };
}

function extractDaysSince(isoTimestamp: string | null | undefined, now: Date): number {
  if (!isoTimestamp) return Number.POSITIVE_INFINITY;
  const ts = new Date(isoTimestamp).getTime();
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - ts) / 86400000;
}

/**
 * Executes all 8 autonomous daily lifecycle workflows against real Supabase state.
 */
export async function runAutonomousLifecycleCron(
  db: SupabaseClient,
  options: { now?: Date; dryRun?: boolean } = {}
): Promise<LifecycleCronReport> {
  const now = options.now || new Date();
  const dryRun = Boolean(options.dryRun);
  const logs: string[] = [];
  const errors: string[] = [];

  const summary: LifecycleCronReport['summary'] = {
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
  };

  logs.push(`[${now.toISOString()}] Autonomous Lifecycle Cron started (dryRun=${dryRun}).`);

  // 1-5: Hosting service renewals, auto-pay, dunning reminders, T+3 suspend, T+14 terminate
  const { data: rawServices, error: srvErr } = await db
    .from('hosting_services')
    .select(
      'id, user_id, domain, plan_name, server_node, cpanel_username, status, billing_cycle, price_bdt, next_due_date, auto_renew, last_renewal_invoice_id, last_renewal_billed_at'
    )
    .in('status', ['active', 'suspended']);

  if (srvErr) {
    errors.push(`Failed loading hosting_services: ${srvErr.message}`);
  } else {
    const services = (rawServices || []) as HostingServiceRow[];
    const userIds = Array.from(new Set(services.map((s) => s.user_id).filter(Boolean)));

    const profilesById = new Map<string, CustomerProfileRow>();
    const autoPayPrefByUser = new Map<string, boolean>();

    if (userIds.length > 0) {
      const { data: profileRows } = await db
        .from('profiles')
        .select('id, email, full_name, wallet_balance_bdt')
        .in('id', userIds);

      for (const p of (profileRows || []) as CustomerProfileRow[]) {
        profilesById.set(p.id, p);
      }

      const { data: devProfiles } = await db
        .from('customer_developer_profiles')
        .select('user_id, auto_pay_from_wallet')
        .in('user_id', userIds);

      for (const dp of (devProfiles || []) as Array<{ user_id: string; auto_pay_from_wallet?: boolean }>) {
        autoPayPrefByUser.set(dp.user_id, dp.auto_pay_from_wallet !== false);
      }
    }

    for (const service of services) {
      if (!service.next_due_date) continue;
      const daysUntilDue = computeDaysUntilDueUtc(service.next_due_date, now);
      if (!Number.isFinite(daysUntilDue)) continue;
      const daysOverdue = -daysUntilDue;
      const profile = profilesById.get(service.user_id);

      // T+14: Final backup snapshot & permanent termination
      if (daysOverdue >= 14) {
        if (!dryRun) {
          const termRes = await terminateOverdueService(db, service, daysOverdue, now);
          if (termRes.terminated) {
            summary.accountsTerminatedFinalSnapshot += 1;
            logs.push(
              `Task 5 (T+14): Snapshotted (${termRes.snapshotId}) & terminated ${service.domain} (${service.cpanel_username}).`
            );
          }
        } else {
          summary.accountsTerminatedFinalSnapshot += 1;
        }
        continue;
      }

      // Upcoming <= 7 days or overdue (< 14 days): ensure renewal invoice exists
      if (daysUntilDue <= 7) {
        let invoice: RenewalInvoiceRow | null = null;
        if (!dryRun) {
          const invRes = await resolveInvoiceForServiceCycle(db, service, now);
          if (invRes.error) errors.push(invRes.error);
          invoice = invRes.invoice;
          if (invRes.created && invoice) {
            summary.renewalInvoicesCreated += 1;
            logs.push(
              `Task 1 (T-7): Generated renewal invoice ${invoice.invoice_number} (৳${invoice.total_bdt}) for ${service.domain}.`
            );

            if (profile?.email && daysUntilDue > 0) {
              const html = renderRenewalReminderEmail({
                name: profile.full_name || 'Developer',
                serviceName: service.plan_name,
                domain: service.domain,
                expiryDate: String(invoice.due_date || service.next_due_date),
                daysRemaining: Math.max(0, daysUntilDue),
                renewalAmountBDT: Number(invoice.total_bdt || service.price_bdt || 0),
                walletBalanceBDT: Number(profile?.wallet_balance_bdt || 0),
                renewUrl: buildDashboardUrl('billing'),
              });
              const sent = await sendTransactionalEmail({
                to: profile.email,
                subject: `Renewal Invoice ${invoice.invoice_number} for ${service.domain}`,
                html,
                template: 'renewal_reminder_notice',
              });
              if (sent.success) summary.renewalEmailsSent += 1;
            }
          }
        }

        // T-0 (or active overdue before suspension): Atomic Wallet Auto-Renewal
        const autoPayEnabled =
          service.auto_renew !== false && (autoPayPrefByUser.get(service.user_id) ?? true);

        if (!dryRun && daysUntilDue <= 0 && service.status === 'active' && invoice && autoPayEnabled) {
          const payRes = await tryWalletAutoRenewal(db, service, invoice, profile, now);
          if (payRes.paid) {
            summary.autoRenewedViaWallet += 1;
            logs.push(
              `Task 2 (T-0): Auto-renewed ${service.domain} via Wallet (${payRes.trxId}), invoice ${invoice.invoice_number}.`
            );
            if (profile?.email) {
              const paidHtml = renderInvoicePaidEmail({
                name: profile.full_name || 'Developer',
                invoiceNumber: invoice.invoice_number,
                amountBDT: Number(invoice.total_bdt || service.price_bdt || 0),
                paymentMethod: 'Prepaid Cloud Wallet (Auto-Renew)',
                trxId: payRes.trxId || 'WALLET-AUTO',
                paidDate: now.toISOString().split('T')[0],
                items: [{ desc: `${service.plan_name} Auto-Renewal (${service.domain})`, amount: Number(invoice.total_bdt || 0) }],
                viewInvoiceUrl: buildDashboardUrl('invoices'),
              });
              await sendTransactionalEmail({
                to: profile.email,
                subject: `Auto-Renewal Paid: ${invoice.invoice_number} (${service.domain})`,
                html: paidHtml,
                template: 'invoice_paid_receipt',
              });
            }
            continue;
          }
        }

        // T+3..T+13 Overdue Active Service Suspension
        if (!dryRun && daysOverdue >= 3 && service.status === 'active') {
          const suspRes = await suspendOverdueService(db, service, profile, daysOverdue, invoice, now);
          if (suspRes.suspended) {
            summary.accountsSuspendedOverdue += 1;
            if (suspRes.emailSent) summary.renewalEmailsSent += 1;
            logs.push(
              `Task 4 (T+3): Suspended overdue service ${service.domain} (${daysOverdue}d past due).`
            );
          }
          continue;
        }

        // Task 3: T-3 & T-1 Urgent Expiry Reminders
        if (!dryRun && invoice && invoice.status === 'unpaid' && daysUntilDue <= 3 && daysOverdue < 3 && profile?.email) {
          const isT1Window = daysUntilDue <= 1;
          const alreadySentRecently = isT1Window
            ? Boolean(invoice.reminder_t1_sent_at) || extractDaysSince(invoice.reminder_t1_sent_at, now) < 1
            : Boolean(invoice.reminder_t3_sent_at) || extractDaysSince(invoice.reminder_t3_sent_at, now) < 2;

          if (!alreadySentRecently) {
            const reminderHtml = renderRenewalReminderEmail({
              name: profile.full_name || 'Developer',
              serviceName: service.plan_name,
              domain: service.domain,
              expiryDate: String(invoice.due_date || service.next_due_date),
              daysRemaining: Math.max(0, daysUntilDue),
              renewalAmountBDT: Number(invoice.total_bdt || service.price_bdt || 0),
              walletBalanceBDT: Number(profile?.wallet_balance_bdt || 0),
              renewUrl: buildDashboardUrl('invoices'),
            });
            const mailRes = await sendTransactionalEmail({
              to: profile.email,
              subject: isT1Window
                ? `URGENT (Final Notice): ${service.domain} expires in ${Math.max(0, daysUntilDue)} day(s)`
                : `Reminder (T-3): ${service.domain} renewal invoice ${invoice.invoice_number}`,
              html: reminderHtml,
              template: 'renewal_reminder_notice',
            });
            if (mailRes.success) {
              summary.urgentRemindersSent += 1;
              await db
                .from('invoices')
                .update(
                  isT1Window
                    ? { reminder_t1_sent_at: now.toISOString(), updated_at: now.toISOString() }
                    : { reminder_t3_sent_at: now.toISOString(), updated_at: now.toISOString() }
                )
                .eq('id', invoice.id);
              logs.push(
                `Task 3 (${isT1Window ? 'T-1' : 'T-3'}): Sent reminder to ${profile.email} for ${service.domain}.`
              );
            }
          }
        }
      }
    }
  }

  // Task 6: Real 35-Day Affiliate Commission Maturity Engine
  if (!dryRun) {
    try {
      const matured = await maturePendingCommissions(db);
      summary.affiliateCommissionsMaturedCount = matured.maturedCount;
      summary.affiliateCommissionsMaturedBDT = matured.totalReleasedBDT;
      logs.push(
        `Task 6: Matured ${matured.maturedCount} affiliate commissions totaling ৳${matured.totalReleasedBDT} BDT.`
      );
    } catch (err: unknown) {
      errors.push(`Affiliate maturity error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // Task 7: Real Domain Registrar Transfer Lifecycle Polling
  if (!dryRun) {
    try {
      const transferStats = await syncDomainTransferStatuses(db);
      summary.domainTransfersPolled = transferStats.checked;
      summary.domainTransfersCompleted = transferStats.completed;
      logs.push(
        `Task 7: Polled ${transferStats.checked} active domain transfers (${transferStats.updated} updated, ${transferStats.completed} completed).`
      );
    } catch (err: unknown) {
      errors.push(`Domain transfer polling error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // Task 8: Prune Expired PR Preview Environments
  if (!dryRun) {
    const pruneRes = await pruneExpiredPreviews(db, now);
    summary.previewsPruned = pruneRes.prunedCount;
    errors.push(...pruneRes.errors);
    logs.push(`Task 8: Pruned ${pruneRes.prunedCount} expired PR preview environments.`);
  }

  return {
    success: errors.length === 0,
    executedAt: now.toISOString(),
    dryRun,
    summary,
    logs,
    errors,
  };
}
