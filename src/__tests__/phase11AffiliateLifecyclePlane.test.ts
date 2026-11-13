import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  customer_developer_profiles: MockRow[];
  affiliate_profiles: MockRow[];
  affiliate_marketer_profiles: MockRow[];
  affiliate_clicks: MockRow[];
  affiliate_commissions: MockRow[];
  affiliate_payouts: MockRow[];
  hosting_services: MockRow[];
  hosting_preview_environments: MockRow[];
  whm_server_nodes: MockRow[];
  catalog_hosting_plans: MockRow[];
  invoices: MockRow[];
  transactions: MockRow[];
  wallet_transactions: MockRow[];
  financial_profit_ledger: MockRow[];
  security_audit_logs: MockRow[];
  fraud_alerts: MockRow[];
  domain_transfers: MockRow[];
}

const USER_BUYER = '11111111-1111-4111-8111-111111111111';
const USER_PARTNER = '33333333-3333-4333-8333-333333333333';
const USER_PARTNER_2 = '55555555-5555-4555-8555-555555555555';
const USER_ADMIN = '44444444-4444-4444-8444-444444444444';

function isoDayOffset(daysFromBase: number, base = new Date('2026-11-15T00:00:00.000Z')): string {
  return new Date(base.getTime() + daysFromBase * 86400000).toISOString().split('T')[0];
}

function createFreshState(): MockDbState {
  const baseNow = new Date('2026-11-15T00:00:00.000Z');
  return {
    profiles: [
      {
        id: USER_BUYER,
        email: 'legit.buyer@example.com',
        full_name: 'Legit Buyer',
        phone: '01811223344',
        role: 'client',
        wallet_balance_bdt: 2500,
        referral_code: 'BUYER01',
      },
      {
        id: USER_PARTNER,
        email: 'partner.rafat@example.com',
        full_name: 'Rafat Partner',
        phone: '01755667788',
        role: 'client',
        wallet_balance_bdt: 300,
        referral_code: 'RAFAT20',
      },
      {
        id: USER_PARTNER_2,
        email: 'partner.two@example.com',
        full_name: 'Second Partner',
        phone: '01955667788',
        role: 'client',
        wallet_balance_bdt: 100,
        referral_code: 'PROPARTNER',
      },
      {
        id: USER_ADMIN,
        email: 'founder@devhostcloud.com',
        full_name: 'Founder Admin',
        phone: '01799999999',
        role: 'admin',
        wallet_balance_bdt: 50000,
      },
    ],
    customer_developer_profiles: [
      {
        user_id: USER_BUYER,
        auto_pay_from_wallet: true,
      },
    ],
    affiliate_profiles: [
      {
        user_id: USER_PARTNER,
        referral_code: 'RAFAT20',
        custom_slug: null,
        tier_level: 'starter_20',
        commission_rate: 20,
        total_clicks: 12,
        total_signups: 4,
        active_conversions: 4,
        pending_clearance_bdt: 0,
        available_balance_bdt: 2200,
        total_withdrawn_bdt: 0,
        payout_method: 'bkash',
        payout_account_number: '01755667788',
        is_frozen_for_fraud: false,
        fraud_reason: null,
      },
      {
        user_id: USER_PARTNER_2,
        referral_code: 'PROPARTNER',
        custom_slug: 'taken-slug',
        tier_level: 'pro_25',
        commission_rate: 25,
        total_clicks: 30,
        total_signups: 12,
        active_conversions: 10,
        pending_clearance_bdt: 0,
        available_balance_bdt: 3000,
        total_withdrawn_bdt: 0,
        payout_method: 'nagad',
        payout_account_number: '01955667788',
        is_frozen_for_fraud: false,
      },
    ],
    affiliate_marketer_profiles: [
      {
        user_id: USER_PARTNER_2,
        custom_referral_slug: 'taken-slug',
        primary_payout_method: 'nagad_personal',
        payout_wallet_number: '01955667788',
        bank_account_details: {},
        payout_schedule_mode: 'manual',
        min_payout_threshold_bdt: 1000,
        conversion_postback_webhook_url: null,
        payout_lock_until: null,
      },
    ],
    affiliate_clicks: [],
    affiliate_commissions: [],
    affiliate_payouts: [],
    hosting_services: [],
    hosting_preview_environments: [],
    whm_server_nodes: [
      {
        node_code: 'sg1',
        whm_hostname: 'sg1.devhost.cloud',
        whm_username: 'root',
        agent_endpoint: 'https://agent-sg1.example.com',
        is_healthy: true,
      },
    ],
    catalog_hosting_plans: [
      {
        id: 'plan-dev-pro',
        slug: 'developer-pro',
        name_en: 'Developer Pro Cloud',
        selling_price_monthly_bdt: 450,
        unit_server_cost_bdt: 120,
        min_owner_profit_bdt: 200,
        whm_package_name: 'devhost_devpro_5g',
      },
    ],
    invoices: [],
    transactions: [],
    wallet_transactions: [],
    financial_profit_ledger: [],
    security_audit_logs: [],
    fraud_alerts: [],
    domain_transfers: [],
  };
  void baseNow;
}

const mockStore = vi.hoisted(() => ({
  state: {} as MockDbState,
  activeUserId: '33333333-3333-4333-8333-333333333333',
  isAdmin: false,
  sudoValid: false,
  supabaseConfigured: true,
  emailsSent: [] as Array<{ to: string; subject: string; template: string; html: string }>,
  postbackHits: [] as string[],
  whmCalls: [] as Array<{ op: string; user: string }>,
  agentLifecycleCalls: [] as Array<{ serviceId: string; action: string }>,
  backupCalls: [] as Array<{ serviceId: string; snapshotId: string }>,
  previewTeardowns: [] as Array<{ serviceId: string; prNumber: number }>,
  updateLocks: { casUsed: 0 },
}));

function buildMockSupabase() {
  function queryTable(table: string) {
    const filters: Array<(row: MockRow) => boolean> = [];
    let pendingOp: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let payload: unknown = null;
    let upsertConflictKey = 'id';
    let ignoreDuplicates = false;
    let sortCol: string | null = null;
    let sortAsc = true;
    let maxRows: number | null = null;

    const matchRows = (rows: MockRow[]) => {
      let out = rows.filter((r) => filters.every((fn) => fn(r)));
      if (sortCol) {
        const col = sortCol;
        out = [...out].sort((a, b) => {
          const av = String(a[col] ?? '');
          const bv = String(b[col] ?? '');
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (maxRows !== null) {
        out = out.slice(0, maxRows);
      }
      return out;
    };

    const run = (): { data: unknown; error: { message: string; code?: string } | null } => {
      const tableRows = (mockStore.state as unknown as Record<string, MockRow[]>)[table];
      if (!Array.isArray(tableRows)) {
        return { data: null, error: null };
      }

      if (pendingOp === 'insert') {
        const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
        const inserted: MockRow[] = [];
        for (const item of items) {
          const rec: MockRow = {
            id: item.id || `${table}-${tableRows.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item,
          };
          tableRows.push(rec);
          inserted.push(rec);
        }
        return { data: inserted, error: null };
      }

      if (pendingOp === 'upsert') {
        const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
        const out: MockRow[] = [];
        for (const item of items) {
          const idx = tableRows.findIndex(
            (r) => r[upsertConflictKey] && r[upsertConflictKey] === item[upsertConflictKey]
          );
          if (idx >= 0) {
            if (!ignoreDuplicates) {
              Object.assign(tableRows[idx], item);
            }
            out.push(tableRows[idx]);
          } else {
            const rec: MockRow = {
              id: item.id || `${table}-${tableRows.length + 1}`,
              created_at: item.created_at || new Date().toISOString(),
              ...item,
            };
            tableRows.push(rec);
            out.push(rec);
          }
        }
        return { data: out, error: null };
      }

      if (pendingOp === 'update') {
        const matched = matchRows(tableRows);
        for (const row of matched) {
          if (payload && !Array.isArray(payload)) {
            Object.assign(row, payload);
          }
        }
        return { data: matched, error: null };
      }

      return { data: matchRows(tableRows), error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (data: unknown) => {
        pendingOp = 'insert';
        payload = data;
        return chain;
      },
      upsert: (data: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        pendingOp = 'upsert';
        payload = data;
        if (opts?.onConflict) upsertConflictKey = opts.onConflict;
        if (opts?.ignoreDuplicates) ignoreDuplicates = opts.ignoreDuplicates;
        return chain;
      },
      update: (data: unknown) => {
        pendingOp = 'update';
        payload = data;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return chain;
      },
      ilike: (col: string, val: string) => {
        const target = String(val || '').toLowerCase();
        filters.push((r) => String(r[col] || '').toLowerCase() === target);
        return chain;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((r) => vals.includes(r[col]));
        return chain;
      },
      gte: (col: string, val: unknown) => {
        filters.push((r) => Number(r[col] ?? 0) >= Number(val ?? 0));
        return chain;
      },
      lte: (col: string, val: unknown) => {
        filters.push((r) => String(r[col] ?? '') <= String(val ?? ''));
        return chain;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        sortCol = col;
        sortAsc = opts?.ascending !== false;
        return chain;
      },
      limit: (n: number) => {
        maxRows = n;
        return chain;
      },
      single: async () => {
        const res = run();
        const arr = Array.isArray(res.data) ? res.data : [];
        if (res.error) return { data: null, error: res.error };
        if (arr.length === 0) return { data: null, error: { message: 'Row not found' } };
        return { data: arr[0], error: null };
      },
      maybeSingle: async () => {
        const res = run();
        const arr = Array.isArray(res.data) ? res.data : [];
        return { data: arr[0] ?? null, error: res.error };
      },
      then: (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) => {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    from: (table: string) => queryTable(table),
    rpc: async (fnName: string, args: Record<string, unknown> = {}) => {
      if (fnName === 'process_atomic_wallet_payment') {
        const inv = mockStore.state.invoices.find(
          (i) => i.invoice_number === args.p_invoice_number
        );
        if (!inv) {
          return { data: { ok: false, code: 'NOT_FOUND', error: 'Invoice not found' }, error: null };
        }
        if (inv.status !== 'unpaid') {
          return {
            data: { ok: false, code: 'ALREADY_PROCESSED', error: 'Already paid' },
            error: null,
          };
        }
        const profile = mockStore.state.profiles.find((p) => p.id === inv.user_id);
        const total = Number(inv.total_bdt || 0);
        const curBal = Number(profile?.wallet_balance_bdt || 0);
        if (!profile || curBal < total) {
          return {
            data: { ok: false, code: 'INSUFFICIENT_BALANCE', error: 'Insufficient balance' },
            error: null,
          };
        }
        const newBal = Number((curBal - total).toFixed(2));
        profile.wallet_balance_bdt = newBal;
        inv.status = 'paid';
        inv.payment_method = 'wallet';
        inv.trx_id = args.p_trx_id || 'WLT-AUTO-RPC';
        inv.paid_at = new Date().toISOString();
        mockStore.state.wallet_transactions.push({
          id: `wtx-${mockStore.state.wallet_transactions.length + 1}`,
          user_id: inv.user_id,
          type: 'debit',
          amount_bdt: total,
          balance_after_bdt: newBal,
          reference_id: inv.trx_id,
        });
        return {
          data: {
            ok: true,
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            new_balance: newBal,
            trx_id: inv.trx_id,
          },
          error: null,
        };
      }

      if (fnName === 'process_mature_affiliate_commissions') {
        const nowMs = Date.now();
        let matured = 0;
        for (const c of mockStore.state.affiliate_commissions) {
          if (c.status === 'pending_35d_hold' && new Date(String(c.matures_at)).getTime() <= nowMs) {
            c.status = 'cleared_available';
            c.cleared_at = new Date().toISOString();
            const aff = mockStore.state.affiliate_profiles.find(
              (a) => a.user_id === c.affiliate_user_id
            );
            if (aff) {
              const amt = Number(c.commission_amount_bdt || 0);
              aff.pending_clearance_bdt = Math.max(0, Number(aff.pending_clearance_bdt || 0) - amt);
              aff.available_balance_bdt = Number(aff.available_balance_bdt || 0) + amt;
            }
            matured += 1;
          }
        }
        return { data: matured, error: null };
      }

      return { data: null, error: null };
    },
  };
}

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => mockStore.supabaseConfigured,
  isDevSandboxMode: () => false,
  getServiceSupabase: () => buildMockSupabase(),
}));

vi.mock('@/lib/authGuard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/authGuard')>();
  return {
    ...actual,
    requireUser: async () => {
      const profile =
        mockStore.state.profiles.find((p) => p.id === mockStore.activeUserId) ||
        mockStore.state.profiles[0];
      return {
        ok: true,
        user: { id: profile.id, email: profile.email },
        profile,
      };
    },
    requireAdmin: async () => {
      if (!mockStore.isAdmin) {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        };
      }
      const admin = mockStore.state.profiles.find((p) => p.id === USER_ADMIN)!;
      return {
        ok: true,
        user: { id: admin.id, email: admin.email },
        profile: admin,
      };
    },
    verifyCronOrAdmin: async (req: Request) => {
      const secret = process.env.CRON_SECRET;
      const authHeader = req.headers.get('authorization') || '';
      if (secret && authHeader === `Bearer ${secret}`) {
        return { ok: true, via: 'cron_secret' as const };
      }
      if (mockStore.isAdmin) {
        const admin = mockStore.state.profiles.find((p) => p.id === USER_ADMIN)!;
        return {
          ok: true,
          via: 'admin' as const,
          auth: { ok: true, user: { id: admin.id, email: admin.email }, profile: admin },
        };
      }
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      };
    },
    verifySudoToken: async () => mockStore.sudoValid,
    getClientIp: () => '103.145.22.99',
  };
});

vi.mock('@/lib/security', () => ({
  createFraudAlert: async (params: MockRow) => {
    mockStore.state.fraud_alerts.push({
      id: `fa-${mockStore.state.fraud_alerts.length + 1}`,
      status: 'open',
      created_at: new Date().toISOString(),
      ...params,
    });
  },
  logSecurityAudit: async (params: MockRow) => {
    mockStore.state.security_audit_logs.push({
      id: `audit-${mockStore.state.security_audit_logs.length + 1}`,
      created_at: new Date().toISOString(),
      ...params,
    });
  },
}));

vi.mock('@/lib/emailEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/emailEngine')>();
  const recordEmail = async (opts: { to: string; subject: string; template: string; html: string }) => {
    mockStore.emailsSent.push(opts);
    return {
      success: true,
      id: `email-${mockStore.emailsSent.length}`,
      to: opts.to,
      status: 'delivered',
    };
  };
  return {
    ...actual,
    sendEmail: recordEmail,
    sendTransactionalEmail: recordEmail,
  };
});

vi.mock('@/lib/whmClient', () => ({
  WhmClient: {
    forNode: () => ({
      suspendAccount: async (user: string) => {
        mockStore.whmCalls.push({ op: 'suspend', user });
        return { success: true, message: 'Suspended' };
      },
      unsuspendAccount: async (user: string) => {
        mockStore.whmCalls.push({ op: 'unsuspend', user });
        return { success: true, message: 'Unsuspended' };
      },
      terminateAccount: async (user: string) => {
        mockStore.whmCalls.push({ op: 'terminate', user });
        return { success: true, message: 'Terminated' };
      },
    }),
  },
  whmClient: {
    suspendAccount: async (user: string) => {
      mockStore.whmCalls.push({ op: 'suspend', user });
      return { success: true, message: 'Suspended' };
    },
    unsuspendAccount: async (user: string) => {
      mockStore.whmCalls.push({ op: 'unsuspend', user });
      return { success: true, message: 'Unsuspended' };
    },
    terminateAccount: async (user: string) => {
      mockStore.whmCalls.push({ op: 'terminate', user });
      return { success: true, message: 'Terminated' };
    },
  },
}));

vi.mock('@/lib/computeTargetResolver', () => ({
  resolveServiceComputeTarget: async (_db: unknown, serviceId: string) => ({
    serviceId,
    agentEndpoint: 'https://agent-sg1.example.com',
    whmHost: 'sg1.devhost.cloud',
    whmUsername: 'root',
    whmApiToken: 'mock-token',
  }),
  resolveWhmClientForTarget: () => ({
    suspendAccount: async (user: string) => {
      mockStore.whmCalls.push({ op: 'suspend', user });
      return { success: true, message: 'Suspended' };
    },
    unsuspendAccount: async (user: string) => {
      mockStore.whmCalls.push({ op: 'unsuspend', user });
      return { success: true, message: 'Unsuspended' };
    },
    terminateAccount: async (user: string) => {
      mockStore.whmCalls.push({ op: 'terminate', user });
      return { success: true, message: 'Terminated' };
    },
  }),
}));

vi.mock('@/lib/computeAgentClient', () => ({
  controlContainerLifecycleOnAgent: async (payload: { serviceId: string; action: string }) => {
    mockStore.agentLifecycleCalls.push({ serviceId: payload.serviceId, action: payload.action });
    return { ok: true, data: { action: payload.action, status: payload.action, message: 'ok' } };
  },
  triggerBackupSnapshotOnAgent: async (payload: { serviceId: string; snapshotId: string }) => {
    mockStore.backupCalls.push({ serviceId: payload.serviceId, snapshotId: payload.snapshotId });
    return { ok: true, data: { sizeMb: 42.5 } };
  },
}));

vi.mock('@/lib/gitDeployDispatcher', () => ({
  teardownPullRequestPreview: async (input: { serviceId: string; prNumber: number }) => {
    mockStore.previewTeardowns.push({ serviceId: input.serviceId, prNumber: input.prNumber });
    return { ok: true, destroyed: true, prNumber: input.prNumber };
  },
}));

vi.mock('@/lib/transferLifecycle', () => ({
  syncDomainTransferStatuses: async () => ({ checked: 2, updated: 1, completed: 1 }),
}));

import { GET as affiliateGet, POST as affiliatePost } from '@/app/api/affiliate/route';
import { POST as cronPost } from '@/app/api/cron/lifecycle/route';
import { recordVerifiedAffiliateConversion } from '@/lib/affiliateEngine';
import {
  extendAndUnsuspendHostingService,
  runAutonomousLifecycleCron,
} from '@/lib/lifecycleEngine';
import { buildAffiliateReferralUrl, getCanonicalSiteUrl } from '@/lib/siteUrl';

describe('Phase 11 — Affiliate Lifecycle Automation, Profile Vault & Admin Financial Controls', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockStore.state = createFreshState();
    mockStore.activeUserId = USER_PARTNER;
    mockStore.isAdmin = false;
    mockStore.sudoValid = false;
    mockStore.supabaseConfigured = true;
    mockStore.emailsSent = [];
    mockStore.postbackHits = [];
    mockStore.whmCalls = [];
    mockStore.agentLifecycleCalls = [];
    mockStore.backupCalls = [];
    mockStore.previewTeardowns = [];
    process.env.CRON_SECRET = 'phase11-super-secret-cron-token-2026';
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      mockStore.postbackHits.push(urlStr);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('passes Phase 11 SQL RLS, Cloudflare Cron config, canonical URL, and zero-stub static audits', () => {
    const root = process.cwd();
    const sql = readFileSync(
      join(root, 'supabase/migrations/phase11_affiliate_lifecycle_plane.sql'),
      'utf8'
    );
    expect(sql).toContain('DROP POLICY IF EXISTS "Users can update own affiliate marketer profile"');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.process_affiliate_payout_review');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.process_mature_affiliate_commissions');
    expect(sql).toContain("'service_renewal'");

    const wranglerRaw = readFileSync(join(root, 'wrangler.jsonc'), 'utf8');
    expect(wranglerRaw).toContain('"main": "worker-entry.mjs"');
    expect(wranglerRaw).toContain('"0 0 * * *"');

    const workerEntry = readFileSync(join(root, 'worker-entry.mjs'), 'utf8');
    expect(workerEntry).toContain("export * from './.open-next/worker.js'");
    expect(workerEntry).toContain('async scheduled(controller, env, ctx)');
    expect(workerEntry).toContain('/api/cron/lifecycle');

    const cronRoute = readFileSync(join(root, 'src/app/api/cron/lifecycle/route.ts'), 'utf8');
    expect(cronRoute).not.toContain('demo.developer@gmail.com');
    expect(cronRoute).not.toContain('INV-2026-9021');
    expect(cronRoute).not.toContain('affiliateCommissionsMaturedBDT = 380');

    const portalCtx = readFileSync(join(root, 'src/context/PortalContext.tsx'), 'utf8');
    expect(portalCtx).not.toContain('Rule (7 Days): 2 renewal invoices generated');

    const affView = readFileSync(
      join(root, 'src/components/profiles/AffiliateProfileView.tsx'),
      'utf8'
    );
    expect(affView).not.toContain('hanif-dev');
    expect(affView).not.toContain('City Bank PLC');
    expect(affView).not.toContain('01712345678');

    process.env.NEXT_PUBLIC_SITE_URL = 'https://portal.devhostcloud.com/';
    expect(getCanonicalSiteUrl()).toBe('https://portal.devhostcloud.com');
    expect(buildAffiliateReferralUrl('rafat-vip', '/cloud-vps', 'yt')).toBe(
      'https://portal.devhostcloud.com/cloud-vps?ref=rafat-vip&subid=yt'
    );
  });

  it('enforces Sudo 2FA, SSRF validation, slug uniqueness, 24h cooling lock, and fires S2S postbacks', async () => {
    // 1. Without Sudo -> 403 requireSudo
    mockStore.sudoValid = false;
    const noSudoRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update_payout_profile',
          primaryPayoutMethod: 'bkash_personal',
          payoutWalletNumber: '01788990011',
        }),
      })
    );
    expect(noSudoRes.status).toBe(403);
    const noSudoJson = await noSudoRes.json();
    expect(noSudoJson.requireSudo).toBe(true);

    // 2. With Sudo, reject SSRF postback URLs (localhost / metadata / authority macro)
    mockStore.sudoValid = true;
    for (const maliciousUrl of [
      'http://127.0.0.1:8080/internal-hook',
      'http://169.254.169.254/latest/meta-data/?subid={subid}',
      'https://{subid}@169.254.169.254/steal',
    ]) {
      const ssrfRes = await affiliatePost(
        new NextRequest('http://localhost/api/affiliate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'update_payout_profile',
            conversionPostbackWebhookUrl: maliciousUrl,
          }),
        })
      );
      expect(ssrfRes.status).toBe(400);
      const ssrfJson = await ssrfRes.json();
      expect(ssrfJson.error).toBe('SSRF_BLOCKED');
    }

    // 3. Reject claimed slug from another partner (409 Conflict)
    const conflictSlugRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update_payout_profile',
          customSlug: 'taken-slug',
        }),
      })
    );
    expect(conflictSlugRes.status).toBe(409);

    // 4. Valid destination & SSRF-safe S2S postback update persists + sets 24h cooling lock
    const saveRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update_payout_profile',
          customSlug: 'rafat-dev',
          primaryPayoutMethod: 'nagad_personal',
          payoutWalletNumber: '01812345678',
          payoutScheduleMode: 'auto_threshold',
          minPayoutThresholdBDT: 1500,
          conversionPostbackWebhookUrl:
            'https://tracker.partner.io/pb?sub={subid}&amount={payout}&inv={order_id}',
        }),
      })
    );
    expect(saveRes.status).toBe(200);
    const saveJson = await saveRes.json();
    expect(saveJson.lockTriggered).toBe(true);
    expect(saveJson.isCoolingLocked).toBe(true);
    expect(saveJson.refLink).toBe('https://devhostcloud.com/?ref=rafat-dev');

    // GET /api/affiliate hydrates persisted marketer profile fields across reload
    const getRes = await affiliateGet(new NextRequest('http://localhost/api/affiliate'));
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.profile.customSlug).toBe('rafat-dev');
    expect(getJson.profile.primaryPayoutMethod).toBe('nagad_personal');
    expect(getJson.profile.minPayoutThresholdBDT).toBe(1500);
    expect(getJson.profile.isCoolingLocked).toBe(true);

    // 5. Payout withdrawal blocked while 24h cooling lock is active -> 423 Locked
    const lockedWithdrawRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'request_payout',
          amountBDT: 1600,
          payoutMethod: 'nagad_personal',
          accountDetails: '01812345678',
        }),
      })
    );
    expect(lockedWithdrawRes.status).toBe(423);
    const lockedJson = await lockedWithdrawRes.json();
    expect(lockedJson.code).toBe('PAYOUT_COOLING_LOCK_ACTIVE');

    // 6. Verified conversion fires real S2S postback HTTP GET with substituted placeholders
    const convRes = await recordVerifiedAffiliateConversion(buildMockSupabase() as never, {
      invoiceId: '99999999-9999-4999-8999-999999999991',
      invoiceNumber: 'INV-AFF-2026-01',
      buyerUserId: USER_BUYER,
      buyerEmail: 'legit.buyer@example.com',
      buyerPhone: '01811223344',
      buyerIp: '203.112.194.12',
      referralCode: 'RAFAT20',
      subId: 'yt_hero',
      amountBDT: 1500,
      unitServerCostBDT: 300,
      minOwnerProfitBDT: 200,
      senderPhone: '01811223344',
    });
    expect(convRes.recorded).toBe(true);
    expect(convRes.commissionBDT).toBe(300);
    expect(mockStore.postbackHits.some((u) => u.includes('https://tracker.partner.io/pb?sub=yt_hero&amount=300.00&inv=INV-AFF-2026-01'))).toBe(
      true
    );
  });

  it('prevents concurrent double-approve/reject payout races via atomic CAS & handles reject/refund + clawback', async () => {
    // Partner clears 24h lock and submits withdrawal of 1500 BDT (available starts at 2200 -> drops to 700)
    const withdrawRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'request_payout',
          amountBDT: 1500,
          payoutMethod: 'bkash',
          accountDetails: '01755667788',
        }),
      })
    );
    expect(withdrawRes.status).toBe(200);
    const wJson = await withdrawRes.json();
    const payoutId = String(wJson.payoutId);
    expect(mockStore.state.affiliate_profiles[0].available_balance_bdt).toBe(700);

    // Concurrent race: two admins click Approve simultaneously
    mockStore.isAdmin = true;
    mockStore.sudoValid = true;
    const [raceA, raceB] = await Promise.all([
      affiliatePost(
        new NextRequest('http://localhost/api/affiliate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'approve_payout',
            payoutId,
            adminTrxId: 'BK-CAS-WIN-01',
          }),
        })
      ),
      affiliatePost(
        new NextRequest('http://localhost/api/affiliate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'approve_payout',
            payoutId,
            adminTrxId: 'BK-CAS-LOSE-02',
          }),
        })
      ),
    ]);

    const statuses = [raceA.status, raceB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(mockStore.state.affiliate_profiles[0].total_withdrawn_bdt).toBe(1500);
    expect(
      mockStore.state.financial_profit_ledger.filter((l) => l.entry_type === 'affiliate_payout').length
    ).toBe(1);

    // Request second payout (700 fails < 1000; top up available balance cleanly for reject/refund test)
    mockStore.state.affiliate_profiles[0].available_balance_bdt = 1800;
    const withdraw2Res = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'request_payout',
          amountBDT: 1100,
          payoutMethod: 'bkash',
          accountDetails: '01755667788',
        }),
      })
    );
    const payout2Id = String((await withdraw2Res.json()).payoutId);
    expect(mockStore.state.affiliate_profiles[0].available_balance_bdt).toBe(700);

    // Admin scope GET enriches cooling/fraud flags
    const adminGetRes = await affiliateGet(
      new NextRequest('http://localhost/api/affiliate?scope=admin')
    );
    expect(adminGetRes.status).toBe(200);
    const adminGetJson = await adminGetRes.json();
    expect(adminGetJson.payouts.length).toBe(2);
    expect(adminGetJson.payouts[0]).toHaveProperty('isCoolingLocked');
    expect(adminGetJson.payouts[0]).toHaveProperty('isFrozenForFraud');

    // Admin rejects payout2 with refund (forfeitForFraud: false) -> restores 700 + 1100 = 1800
    const rejectRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_payout',
          payoutId: payout2Id,
          reason: 'Mismatched bKash KYC name',
          forfeitForFraud: false,
        }),
      })
    );
    expect(rejectRes.status).toBe(200);
    const rejJson = await rejectRes.json();
    expect(rejJson.refundedToAvailable).toBe(true);
    expect(mockStore.state.affiliate_profiles[0].available_balance_bdt).toBe(1800);

    // Concurrent retry on already rejected payout -> 409
    const lateApproveRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_payout',
          payoutId: payout2Id,
          adminTrxId: 'BK-TOO-LATE',
        }),
      })
    );
    expect(lateApproveRes.status).toBe(409);

    // Freeze partner cleanly via Admin Sudo action
    const freezeRes = await affiliatePost(
      new NextRequest('http://localhost/api/affiliate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'freeze_partner',
          affiliateUserId: USER_PARTNER,
          reason: 'Suspected coupon scraping ring',
        }),
      })
    );
    expect(freezeRes.status).toBe(200);
    expect(mockStore.state.affiliate_profiles[0].is_frozen_for_fraud).toBe(true);
  });

  it('executes real autonomous T-7, T-0 auto-renew, T-3 reminder, T+3 suspend, T+14 snapshot+terminate, maturity & preview pruning', async () => {
    const cronNow = new Date('2026-11-15T00:00:00.000Z');

    // Unauthenticated cron request -> 401 Fail Closed
    const unauthRes = await cronPost(
      new NextRequest('http://localhost/api/cron/lifecycle', { method: 'POST' })
    );
    expect(unauthRes.status).toBe(401);

    // Seed real services spanning every lifecycle horizon
    const srvT7Id = 'srv-t7-1111';
    const srvT0Id = 'srv-t0-2222';
    const srvT2Id = 'srv-t2-3333';
    const srvT4OverId = 'srv-t4-4444';
    const srvT15OverId = 'srv-t15-5555';

    mockStore.state.hosting_services.push(
      {
        id: srvT7Id,
        user_id: USER_BUYER,
        domain: 'upcoming7.example.com',
        plan_name: 'Developer Pro Cloud',
        server_node: 'sg1',
        cpanel_username: 'usr7day',
        status: 'active',
        billing_cycle: 'monthly',
        price_bdt: 450,
        next_due_date: isoDayOffset(7, cronNow),
        auto_renew: false,
      },
      {
        id: srvT0Id,
        user_id: USER_BUYER,
        domain: 'autorenew0.example.com',
        plan_name: 'Developer Pro Cloud',
        server_node: 'sg1',
        cpanel_username: 'usr0auto',
        status: 'active',
        billing_cycle: 'monthly',
        price_bdt: 450,
        next_due_date: isoDayOffset(0, cronNow),
        auto_renew: true,
      },
      {
        id: srvT2Id,
        user_id: USER_PARTNER, // Wallet 300 < 450 so auto-pay skips and T-3/T-1 reminder fires
        domain: 'urgent2.example.com',
        plan_name: 'Developer Pro Cloud',
        server_node: 'sg1',
        cpanel_username: 'usr2urg',
        status: 'active',
        billing_cycle: 'monthly',
        price_bdt: 450,
        next_due_date: isoDayOffset(2, cronNow),
        auto_renew: true,
      },
      {
        id: srvT4OverId,
        user_id: USER_PARTNER_2, // Wallet 100 < 450, 4 days overdue -> T+3 Suspend
        domain: 'suspend4.example.com',
        plan_name: 'Developer Pro Cloud',
        server_node: 'sg1',
        cpanel_username: 'usrsusp4',
        status: 'active',
        billing_cycle: 'monthly',
        price_bdt: 450,
        next_due_date: isoDayOffset(-4, cronNow),
        auto_renew: false,
      },
      {
        id: srvT15OverId,
        user_id: USER_PARTNER_2,
        domain: 'terminate15.example.com',
        plan_name: 'Developer Pro Cloud',
        server_node: 'sg1',
        cpanel_username: 'usrterm15',
        status: 'suspended',
        billing_cycle: 'monthly',
        price_bdt: 450,
        next_due_date: isoDayOffset(-15, cronNow),
        auto_renew: false,
      }
    );

    // Seed matured 35-day affiliate commission
    mockStore.state.affiliate_profiles[0].pending_clearance_bdt = 275;
    mockStore.state.affiliate_commissions.push({
      id: 'comm-mat-1',
      affiliate_user_id: USER_PARTNER,
      commission_amount_bdt: 275,
      status: 'pending_35d_hold',
      matures_at: '2026-11-10T00:00:00.000Z',
    });

    // Seed expired PR preview environment
    mockStore.state.hosting_preview_environments.push(
      {
        id: 'prev-exp-1',
        service_id: srvT7Id,
        pr_number: 42,
        branch_name: 'feat/pr-42',
        status: 'ready_live',
        expires_at: '2026-11-14T00:00:00.000Z',
      },
      {
        id: 'prev-active-2',
        service_id: srvT7Id,
        pr_number: 43,
        branch_name: 'feat/pr-43',
        status: 'ready_live',
        expires_at: '2026-11-22T00:00:00.000Z',
      }
    );

    const report = await runAutonomousLifecycleCron(buildMockSupabase() as never, {
      now: cronNow,
    });

    expect(report.success).toBe(true);
    // Invoices created for T-7, T-0 (auto-paid), T-2 (unpaid), T+4 (unpaid -> suspended) = 4
    expect(report.summary.renewalInvoicesCreated).toBe(4);
    expect(report.summary.autoRenewedViaWallet).toBe(1);
    expect(report.summary.accountsSuspendedOverdue).toBe(1);
    expect(report.summary.accountsTerminatedFinalSnapshot).toBe(1);
    expect(report.summary.affiliateCommissionsMaturedCount).toBe(1);
    expect(report.summary.affiliateCommissionsMaturedBDT).toBe(275);
    expect(report.summary.domainTransfersPolled).toBe(2);
    expect(report.summary.domainTransfersCompleted).toBe(1);
    expect(report.summary.previewsPruned).toBe(1);

    // Verify real state transitions
    const sAuto = mockStore.state.hosting_services.find((s) => s.id === srvT0Id)!;
    expect(sAuto.next_due_date).toBe('2026-12-15');
    expect(mockStore.state.profiles.find((p) => p.id === USER_BUYER)!.wallet_balance_bdt).toBe(2050);

    const sSusp = mockStore.state.hosting_services.find((s) => s.id === srvT4OverId)!;
    expect(sSusp.status).toBe('suspended');
    expect(mockStore.whmCalls.some((c) => c.op === 'suspend' && c.user === 'usrsusp4')).toBe(true);
    expect(
      mockStore.agentLifecycleCalls.some((c) => c.serviceId === srvT4OverId && c.action === 'suspend')
    ).toBe(true);

    const sTerm = mockStore.state.hosting_services.find((s) => s.id === srvT15OverId)!;
    expect(sTerm.status).toBe('terminated');
    expect(mockStore.backupCalls.some((b) => b.serviceId === srvT15OverId)).toBe(true);
    expect(
      mockStore.agentLifecycleCalls.some((c) => c.serviceId === srvT15OverId && c.action === 'terminate')
    ).toBe(true);
    expect(mockStore.whmCalls.some((c) => c.op === 'terminate' && c.user === 'usrterm15')).toBe(true);

    // Verify matured balance added to partner
    expect(mockStore.state.affiliate_profiles[0].available_balance_bdt).toBe(2475);
    expect(mockStore.state.affiliate_profiles[0].pending_clearance_bdt).toBe(0);

    // Verify expired preview pruned while future preview stays ready_live
    expect(mockStore.previewTeardowns).toEqual([{ serviceId: srvT7Id, prNumber: 42 }]);
    expect(mockStore.state.hosting_preview_environments[0].status).toBe('expired');
    expect(mockStore.state.hosting_preview_environments[1].status).toBe('ready_live');

    // Verify emails went only to real customers (never demo.developer@gmail.com)
    expect(mockStore.emailsSent.length).toBeGreaterThanOrEqual(3);
    expect(mockStore.emailsSent.some((e) => e.to === 'demo.developer@gmail.com')).toBe(false);

    // Verify manual/gateway settlement unsuspends suspended service via shared extendAndUnsuspendHostingService
    const unsuspendRes = await extendAndUnsuspendHostingService(buildMockSupabase() as never, {
      serviceId: srvT4OverId,
      userId: USER_PARTNER_2,
      reason: 'Customer paid overdue invoice',
      now: cronNow,
    });
    expect(unsuspendRes.ok).toBe(true);
    expect(unsuspendRes.unsuspended).toBe(true);
    expect(sSusp.status).toBe('active');
    expect(mockStore.whmCalls.some((c) => c.op === 'unsuspend' && c.user === 'usrsusp4')).toBe(true);

    // Re-running HTTP POST /api/cron/lifecycle with valid CRON_SECRET succeeds idempotently (0 dup invoices)
    const cronHttpRes = await cronPost(
      new NextRequest('http://localhost/api/cron/lifecycle', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ dryRun: false }),
      })
    );
    expect(cronHttpRes.status).toBe(200);
    const cronHttpJson = await cronHttpRes.json();
    expect(cronHttpJson.executionMode).toBe('Cloudflare Automated Schedule');
    expect(cronHttpJson.summary.renewalInvoicesCreated).toBe(0);
  });
});
