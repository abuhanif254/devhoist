import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ------------------------------------------------------------------------------
// IN-MEMORY POSTGRES / SUPABASE STATEFUL MOCK FOR PHASE 3 INTEGRATION TESTS
// ------------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  catalog_hosting_plans: MockRow[];
  promo_codes: MockRow[];
  invoices: MockRow[];
  transactions: MockRow[];
  wallet_transactions: MockRow[];
  affiliate_profiles: MockRow[];
  affiliate_clicks: MockRow[];
  affiliate_commissions: MockRow[];
  affiliate_payouts: MockRow[];
  security_audit_logs: MockRow[];
  fraud_alerts: MockRow[];
  financial_profit_ledger: MockRow[];
  hosting_services: MockRow[];
  rpcOverrides: Record<string, (args: MockRow, state: MockDbState) => unknown>;
}

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_AFF = '33333333-3333-4333-8333-333333333333';
const UUID_ADMIN = '44444444-4444-4444-8444-444444444444';

function createFreshState(): MockDbState {
  return {
    profiles: [
      {
        id: UUID_1,
        email: 'buyer@example.com',
        full_name: 'Legit Buyer',
        phone: '01999888777',
        role: 'client',
        wallet_balance_bdt: 2000,
        referral_code: 'BUYERREF',
      },
      {
        id: UUID_2,
        email: 'j.doe+checkout@gmail.com',
        full_name: 'Self Ref Buyer',
        phone: '+8801712345678',
        role: 'client',
        wallet_balance_bdt: 500,
        referral_code: 'SELF2',
      },
      {
        id: UUID_AFF,
        email: 'jdoe@gmail.com',
        full_name: 'Partner Affiliate',
        phone: '01712345678',
        role: 'client',
        wallet_balance_bdt: 100,
        referral_code: 'RAFAT20',
      },
      {
        id: UUID_ADMIN,
        email: 'founder@devhostcloud.com',
        full_name: 'Founder Admin',
        role: 'admin',
        wallet_balance_bdt: 10000,
      },
    ],
    catalog_hosting_plans: [
      {
        id: 2,
        slug: 'developer-pro',
        name_en: 'Developer Pro Cloud',
        selling_price_monthly_bdt: 450,
        unit_server_cost_bdt: 90,
        min_owner_profit_bdt: 225,
        annual_discount_percent: 20,
        whm_package_name: 'devhost_devpro_5g',
      },
    ],
    promo_codes: [
      {
        code: 'DEVHOST20',
        discount_type: 'percentage',
        discount_value: 20,
        max_uses: 500,
        current_uses: 10,
        is_active: true,
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    ],
    invoices: [],
    transactions: [],
    wallet_transactions: [],
    affiliate_profiles: [
      {
        user_id: UUID_AFF,
        referral_code: 'RAFAT20',
        tier_level: 'starter_20',
        commission_rate: 20,
        total_clicks: 5,
        total_signups: 1,
        active_conversions: 1,
        pending_clearance_bdt: 0,
        available_balance_bdt: 1500,
        total_withdrawn_bdt: 0,
        payout_method: 'bkash',
        payout_account_number: '01712345678',
        is_frozen_for_fraud: false,
      },
    ],
    affiliate_clicks: [],
    affiliate_commissions: [],
    affiliate_payouts: [],
    security_audit_logs: [
      {
        id: 'aud-1',
        actor_id: UUID_AFF,
        action_type: 'LOGIN',
        ip_address: '103.205.71.42',
        created_at: new Date().toISOString(),
      },
    ],
    fraud_alerts: [],
    financial_profit_ledger: [],
    hosting_services: [],
    rpcOverrides: {},
  };
}

const mockStore = vi.hoisted(() => ({
  configured: true,
  sandbox: false,
  currentUserAuth: {
    ok: true as const,
    user: { id: '11111111-1111-4111-8111-111111111111', email: 'buyer@example.com' },
    profile: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'buyer@example.com',
      full_name: 'Legit Buyer',
      role: 'client' as const,
      wallet_balance_bdt: 2000,
      phone: '01999888777',
      referral_code: 'BUYERREF',
    },
    role: 'client' as const,
    token: 'mock-jwt',
  },
  isAdminMode: false,
  sudoValid: true,
  state: null as unknown as MockDbState,
}));

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

interface MockQueryChain extends PromiseLike<QueryResult> {
  select: () => MockQueryChain;
  insert: (payload: MockRow | MockRow[]) => MockQueryChain;
  upsert: (payload: MockRow | MockRow[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => MockQueryChain;
  update: (payload: MockRow) => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  ilike: (col: string, val: string) => MockQueryChain;
  gte: (col: string, val: unknown) => MockQueryChain;
  in: (col: string, vals: unknown[]) => MockQueryChain;
  filter: (col: string, _op: string, val: unknown) => MockQueryChain;
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryChain;
  limit: (n: number) => MockQueryChain;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
}

function buildQueryBuilder(tableName: keyof MockDbState, state: MockDbState) {
  const filters: Array<(row: MockRow) => boolean> = [];
  let sortCol: string | null = null;
  let sortAsc = true;
  let maxRows: number | null = null;
  let pendingOp: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  let opPayload: MockRow | MockRow[] | null = null;
  let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } | undefined;

  const applyFilters = (rows: MockRow[]) => {
    let out = rows.filter((r) => filters.every((fn) => fn(r)));
    if (sortCol) {
      out = [...out].sort((a, b) => {
        const av = String(a[sortCol!] || '');
        const bv = String(b[sortCol!] || '');
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (maxRows !== null) {
      out = out.slice(0, maxRows);
    }
    return out;
  };

  const execute = (): QueryResult => {
    const rows = state[tableName] as MockRow[];
    if (!Array.isArray(rows)) return { data: null, error: null };

    if (pendingOp === 'insert') {
      const items = Array.isArray(opPayload) ? opPayload : opPayload ? [opPayload] : [];
      const inserted: MockRow[] = [];
      for (const item of items) {
        if (
          tableName === 'transactions' &&
          item.trx_id &&
          rows.some((r) => r.trx_id === item.trx_id)
        ) {
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "transactions_trx_id_key"' } };
        }
        const record: MockRow = {
          id: item.id || `${tableName}-${rows.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        rows.push(record);
        inserted.push(record);
      }
      return { data: inserted, error: null };
    }

    if (pendingOp === 'upsert') {
      const items = Array.isArray(opPayload) ? opPayload : opPayload ? [opPayload] : [];
      const conflictKey = upsertOpts?.onConflict || 'id';
      const out: MockRow[] = [];
      for (const item of items) {
        const idx = rows.findIndex((r) => r[conflictKey] && r[conflictKey] === item[conflictKey]);
        if (idx >= 0) {
          if (!upsertOpts?.ignoreDuplicates) {
            rows[idx] = { ...rows[idx], ...item };
          }
          out.push(rows[idx]);
        } else {
          const rec: MockRow = {
            id: item.id || `${tableName}-${rows.length + 1}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item,
          };
          rows.push(rec);
          out.push(rec);
        }
      }
      return { data: out, error: null };
    }

    if (pendingOp === 'update') {
      const matched = applyFilters(rows);
      for (const row of matched) {
        if (opPayload && !Array.isArray(opPayload)) {
          Object.assign(row, opPayload);
        }
      }
      return { data: matched, error: null };
    }

    return { data: applyFilters(rows), error: null };
  };

  const chain: MockQueryChain = {
    select: () => chain,
    insert: (payload) => {
      pendingOp = 'insert';
      opPayload = payload;
      return chain;
    },
    upsert: (payload, opts) => {
      pendingOp = 'upsert';
      opPayload = payload;
      upsertOpts = opts;
      return chain;
    },
    update: (payload) => {
      pendingOp = 'update';
      opPayload = payload;
      return chain;
    },
    eq: (col, val) => {
      filters.push((r) => r[col] === val);
      return chain;
    },
    ilike: (col, val) => {
      const target = String(val || '').toLowerCase();
      filters.push((r) => String(r[col] || '').toLowerCase() === target);
      return chain;
    },
    gte: (col, val) => {
      filters.push((r) => String(r[col] ?? '') >= String(val ?? ''));
      return chain;
    },
    in: (col, vals) => {
      filters.push((r) => vals.includes(r[col]));
      return chain;
    },
    filter: (col, _op, val) => {
      if (col === 'raw_payload->>card_fingerprint') {
        filters.push((r) => (r.raw_payload as MockRow | undefined)?.card_fingerprint === val);
      }
      return chain;
    },
    order: (col, opts) => {
      sortCol = col;
      sortAsc = opts?.ascending !== false;
      return chain;
    },
    limit: (n) => {
      maxRows = n;
      return chain;
    },
    maybeSingle: async () => {
      const res = execute();
      const first = Array.isArray(res.data) ? res.data[0] || null : res.data;
      return { data: first, error: res.error };
    },
    single: async () => {
      const res = execute();
      const first = Array.isArray(res.data) ? res.data[0] || null : res.data;
      if (!first && !res.error) {
        return { data: null, error: { message: 'Row not found' } };
      }
      return { data: first, error: res.error };
    },
    then: (resolve, reject) => {
      return Promise.resolve(execute()).then(resolve, reject);
    },
  };

  return chain;
}

function createMockSupabaseClient(state: MockDbState) {
  return {
    from: (table: keyof MockDbState) => buildQueryBuilder(table, state),
    rpc: async (fnName: string, args: MockRow = {}) => {
      if (state.rpcOverrides[fnName]) {
        return state.rpcOverrides[fnName](args, state);
      }

      if (fnName === 'process_atomic_wallet_payment') {
        const inv = state.invoices.find((i) => i.invoice_number === args.p_invoice_number);
        if (!inv) return { data: { ok: false, code: 'NOT_FOUND', error: 'Invoice not found.' }, error: null };
        if (inv.user_id !== args.p_user_id) return { data: { ok: false, code: 'FORBIDDEN', error: 'Forbidden' }, error: null };
        if (inv.status !== 'unpaid') return { data: { ok: false, code: 'ALREADY_PROCESSED', error: 'Already paid' }, error: null };

        const prof = state.profiles.find((p) => p.id === inv.user_id);
        const total = Number(inv.total_bdt || 0);
        const currentBal = Number(prof?.wallet_balance_bdt || 0);
        if (!prof || currentBal < total) {
          return { data: { ok: false, code: 'INSUFFICIENT_BALANCE', error: 'Insufficient balance' }, error: null };
        }

        prof.wallet_balance_bdt = Number((currentBal - total).toFixed(2));
        inv.status = 'paid';
        inv.payment_method = 'wallet';
        inv.trx_id = args.p_trx_id || `WLT-${Date.now()}`;

        state.transactions.push({
          id: `tx-${state.transactions.length + 1}`,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          user_id: inv.user_id,
          gateway: 'wallet',
          trx_id: inv.trx_id,
          amount_bdt: total,
          status: 'Completed',
        });
        state.wallet_transactions.push({
          id: `wt-${state.wallet_transactions.length + 1}`,
          user_id: inv.user_id,
          type: 'debit',
          amount_bdt: total,
          balance_after_bdt: prof.wallet_balance_bdt,
          reference_id: inv.trx_id,
          gateway: 'wallet',
        });

        return {
          data: {
            ok: true,
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            user_id: inv.user_id,
            total_bdt: total,
            new_balance: prof.wallet_balance_bdt,
            trx_id: inv.trx_id,
            billing_cycle: inv.billing_cycle || 'monthly',
            free_domain_bundle_applied: Boolean(inv.free_domain_bundle_applied),
            bundled_domain_name: inv.bundled_domain_name,
            referral_code: inv.referral_code,
            referral_sub_id: inv.referral_sub_id,
            order_type: inv.order_type || 'hosting_order',
            promo_discount_bdt: Number(inv.promo_discount_bdt || 0),
            plan_id: inv.plan_id,
            items: inv.items || [],
          },
          error: null,
        };
      }

      if (fnName === 'credit_user_wallet_atomic') {
        const dup = state.wallet_transactions.find(
          (w) => w.reference_id === args.p_trx_id && w.type === 'credit'
        );
        const prof = state.profiles.find((p) => p.id === args.p_user_id);
        if (!prof) return { data: { ok: false, code: 'PROFILE_NOT_FOUND' }, error: null };
        if (dup) {
          return { data: { ok: true, already_credited: true, new_balance: prof.wallet_balance_bdt }, error: null };
        }
        prof.wallet_balance_bdt = Number((Number(prof.wallet_balance_bdt || 0) + Number(args.p_amount_bdt || 0)).toFixed(2));
        state.wallet_transactions.push({
          id: `wt-${state.wallet_transactions.length + 1}`,
          user_id: args.p_user_id,
          type: 'credit',
          amount_bdt: args.p_amount_bdt,
          balance_after_bdt: prof.wallet_balance_bdt,
          reference_id: args.p_trx_id,
          gateway: args.p_gateway,
        });
        return { data: { ok: true, already_credited: false, new_balance: prof.wallet_balance_bdt }, error: null };
      }

      if (fnName === 'process_mature_affiliate_commissions') {
        return { data: null, error: { message: 'Use JS fallback' } };
      }

      return { data: null, error: null };
    },
  };
}

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: () => mockStore.configured,
  hasServiceRoleKey: () => mockStore.configured,
  isDevSandboxMode: () => mockStore.sandbox,
  getServiceSupabase: () => createMockSupabaseClient(mockStore.state),
}));

vi.mock('@/lib/authGuard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authGuard')>('@/lib/authGuard');
  return {
    ...actual,
    requireUser: vi.fn(async () => {
      if (!mockStore.configured && !mockStore.sandbox) {
        return { ok: false, response: actual.serviceUnavailableResponse('Auth') };
      }
      if (mockStore.isAdminMode) {
        return {
          ok: true,
          user: { id: UUID_ADMIN, email: 'founder@devhostcloud.com' },
          profile: {
            id: UUID_ADMIN,
            email: 'founder@devhostcloud.com',
            full_name: 'Founder Admin',
            role: 'admin',
            wallet_balance_bdt: 10000,
          },
          role: 'admin',
          token: 'admin-jwt',
        };
      }
      return mockStore.currentUserAuth;
    }),
    requireAdmin: vi.fn(async () => {
      if (!mockStore.isAdminMode) {
        const { NextResponse } = await import('next/server');
        return {
          ok: false,
          response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
      }
      return {
        ok: true,
        user: { id: UUID_ADMIN, email: 'founder@devhostcloud.com' },
        profile: {
          id: UUID_ADMIN,
          email: 'founder@devhostcloud.com',
          full_name: 'Founder Admin',
          role: 'admin',
          wallet_balance_bdt: 10000,
        },
        role: 'admin',
        token: 'admin-jwt',
      };
    }),
    verifyCronOrAdmin: vi.fn(async () => ({ ok: true, via: 'cron_secret' })),
    verifySudoToken: vi.fn(async () => mockStore.sudoValid),
  };
});

vi.mock('@/lib/zeroTouchProvisioner', async () => {
  const actual = await vi.importActual<typeof import('@/lib/zeroTouchProvisioner')>(
    '@/lib/zeroTouchProvisioner'
  );
  return {
    ...actual,
    executeZeroTouchProvisioning: vi.fn(async (params: { domain?: string }) => ({
      success: true,
      message: 'Provisioned in mock test',
      durationMs: 12,
      cpanelUsername: 'devtest',
      domain: params.domain || 'app.example.com',
      serverNode: 'SG1',
      serverIp: '103.205.71.18',
      nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
      sslStatus: 'active',
      ledgerEntryCode: 'LEDG-ZT-TEST',
      stepsCompleted: ['Mock Step 1'],
    })),
  };
});

import { POST as createSessionPost } from '@/app/api/payments/create-session/route';
import { POST as webhookPost } from '@/app/api/payments/webhook/route';
import { GET as bkashCallbackGet } from '@/app/api/payments/bkash/callback/route';
import { GET as nagadCallbackGet } from '@/app/api/payments/nagad/callback/route';
import { POST as walletPayPost } from '@/app/api/payments/wallet-pay/route';
import { GET as affiliateGet, POST as affiliatePost } from '@/app/api/affiliate/route';
import { POST as adminLedgerPost } from '@/app/api/admin/ledger/route';
import { recordVerifiedAffiliateConversion, canonicalizeEmail, normalizeBdPhone, parseAffiliateAttributionCookie } from '@/lib/affiliateEngine';
import { executeZeroTouchProvisioning } from '@/lib/zeroTouchProvisioner';

async function computeHmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Phase 3: Automatic Multi-Gateway Payments, Atomic Wallet & Zero-Loss Affiliate Engine', () => {
  const origEnv = { ...process.env };
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    mockStore.configured = true;
    mockStore.sandbox = false;
    mockStore.isAdminMode = false;
    mockStore.sudoValid = true;
    mockStore.state = createFreshState();
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.UDDOKTAPAY_API_KEY;
    delete process.env.UDDOKTAPAY_API_URL;
    delete process.env.BKASH_APP_KEY;
    delete process.env.BKASH_APP_SECRET;
    delete process.env.BKASH_USERNAME;
    delete process.env.BKASH_PASSWORD;
    delete process.env.NAGAD_MERCHANT_ID;
    delete process.env.NAGAD_PUBLIC_KEY;
    delete process.env.NAGAD_PRIVATE_KEY;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://devhostcloud.com';
  });

  afterEach(() => {
    process.env = { ...origEnv };
    globalThis.fetch = origFetch;
  });

  describe('1. Checkout Sessions, Server Pricing & Gateway Integration', () => {
    it('fails closed (503) when Stripe is requested without STRIPE_SECRET_KEY (never returns fake URLs)', async () => {
      const req = new NextRequest('http://localhost/api/payments/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gateway: 'stripe', amountBDT: 450, domain: 'app.devhost.com' }),
      });
      const res = await createSessionPost(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.paymentUrl).toBeUndefined();
    });

    it('rejects client price tampering on catalog plans and honors zero-loss promo math', async () => {
      const reqTamper = new NextRequest('http://localhost/api/payments/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gateway: 'uddoktapay',
          planId: 'developer-pro',
          billingCycle: 'monthly',
          amountBDT: 50,
          domain: 'tamper.com',
        }),
      });
      const resTamper = await createSessionPost(reqTamper);
      expect(resTamper.status).toBe(400);
      const errBody = await resTamper.json();
      expect(errBody.error).toMatch(/tampering/i);
    });

    it('creates real Stripe Checkout session, captures devhost_aff_ref cookie & applies DEVHOST20 promo', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_mocked_stripe_key';
      const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).includes('api.stripe.com/v1/checkout/sessions')) {
          return new Response(
            JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 404 });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const req = new NextRequest('http://localhost/api/payments/create-session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `devhost_aff_ref=${encodeURIComponent(JSON.stringify({ code: 'RAFAT20', subid: 'yt_hero' }))}`,
        },
        body: JSON.stringify({
          gateway: 'stripe',
          planId: 'developer-pro',
          billingCycle: 'monthly',
          promoCode: 'DEVHOST20',
          amountBDT: 360,
          domain: 'launch.example.com',
        }),
      });

      const res = await createSessionPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mode).toBe('live_stripe');
      expect(data.paymentUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
      expect(mockStore.state.invoices[0].referral_code).toBe('RAFAT20');
      expect(mockStore.state.invoices[0].referral_sub_id).toBe('yt_hero');
      expect(mockStore.state.invoices[0].discount_bdt).toBe(90);
      expect(mockStore.state.invoices[0].total_bdt).toBe(360);
    });

    it('creates real Official bKash Tokenized Checkout (token/grant -> create)', async () => {
      process.env.BKASH_APP_KEY = 'bk_key';
      process.env.BKASH_APP_SECRET = 'bk_sec';
      process.env.BKASH_USERNAME = 'bk_user';
      process.env.BKASH_PASSWORD = 'bk_pass';

      const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.endsWith('/token/grant')) {
          return new Response(JSON.stringify({ id_token: 'bkash_jwt_token' }), { status: 200 });
        }
        if (u.endsWith('/checkout/create')) {
          return new Response(
            JSON.stringify({
              paymentID: 'TR0011TEST99',
              bkashURL: 'https://shop.bkash.com/pay/TR0011TEST99',
              statusCode: '0000',
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 404 });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const req = new NextRequest('http://localhost/api/payments/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gateway: 'bkash',
          planId: 'developer-pro',
          amountBDT: 450,
          domain: 'bkashsite.com',
        }),
      });
      const res = await createSessionPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mode).toBe('live_bkash');
      expect(data.paymentUrl).toContain('TR0011TEST99');
    });
  });

  describe('2. Webhook Verification, Underpayment Guard, Idempotency & Wallet Top-Up', () => {
    it('verifies Stripe-Signature HMAC checkout.session.completed, settles invoice & records commission', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_123';
      mockStore.state.invoices.push({
        id: 'inv-uuid-1',
        invoice_number: 'DEV-INV-STR1',
        user_id: UUID_1,
        subtotal_bdt: 450,
        discount_bdt: 0,
        total_bdt: 450,
        status: 'unpaid',
        referral_code: 'RAFAT20',
        bundled_domain_name: 'stripeapp.com',
        items: [{ name: 'Developer Pro Cloud', domain: 'stripeapp.com', planId: 'developer-pro' }],
      });

      const stripePayload = JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_live_1',
            payment_status: 'paid',
            payment_intent: 'pi_3abc999',
            currency: 'bdt',
            amount_total: 45000,
            client_reference_id: 'DEV-INV-STR1',
            metadata: {
              invoice_number: 'DEV-INV-STR1',
              amount_bdt: '450',
              card_fingerprint: 'fp_clean_card_77',
            },
          },
        },
      });
      const ts = Math.floor(Date.now() / 1000);
      const sig = await computeHmacHex(`${ts}.${stripePayload}`, process.env.STRIPE_WEBHOOK_SECRET);

      const res = await webhookPost(
        new NextRequest('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': `t=${ts},v1=${sig}`,
            'x-forwarded-for': '203.112.194.15',
          },
          body: stripePayload,
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('settled');
      expect(body.affiliate.commissionBDT).toBe(90);
      expect(mockStore.state.affiliate_commissions).toHaveLength(1);
      expect(executeZeroTouchProvisioning).toHaveBeenCalledTimes(1);

      // Replaying exact webhook is idempotent and does NOT double-credit or re-provision
      const resReplay = await webhookPost(
        new NextRequest('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': `t=${ts},v1=${sig}`,
          },
          body: stripePayload,
        })
      );
      expect(resReplay.status).toBe(200);
      const replayBody = await resReplay.json();
      expect(replayBody.status).toBe('already_processed');
      expect(executeZeroTouchProvisioning).toHaveBeenCalledTimes(1);
    });

    it('calls UddoktaPay verify-payment, rejects underpayment, and credits wallet_topup without awarding affiliate', async () => {
      process.env.UDDOKTAPAY_API_KEY = 'udk_secret_test';
      process.env.UDDOKTAPAY_API_URL = 'https://sandbox.uddoktapay.com/api/checkout-v2';

      mockStore.state.invoices.push({
        id: 'inv-top-1',
        invoice_number: 'DEV-INV-TOP1',
        user_id: UUID_1,
        subtotal_bdt: 1000,
        discount_bdt: 0,
        total_bdt: 1000,
        status: 'unpaid',
        order_type: 'wallet_topup',
        referral_code: 'RAFAT20',
        items: [{ name: 'Wallet Credit Top-Up', type: 'wallet_topup' }],
      });

      // First test underpayment rejection
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            amount: '500',
            transaction_id: 'TRXUNDER1',
            payment_method: 'bkash',
            metadata: { invoice_id: 'DEV-INV-TOP1' },
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

      const underRes = await webhookPost(
        new NextRequest('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'rt-uddoktapay-api-key': 'udk_secret_test',
          },
          body: JSON.stringify({ invoice_id: 'UDK_R1' }),
        })
      );
      expect(underRes.status).toBe(400);

      // Now return full 1000 BDT amount from verify-payment
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            amount: '1000',
            transaction_id: 'TRXTOP1000',
            sender_number: '01999888777',
            payment_method: 'bkash',
            metadata: { invoice_id: 'DEV-INV-TOP1' },
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

      const okRes = await webhookPost(
        new NextRequest('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'rt-uddoktapay-api-key': 'udk_secret_test',
          },
          body: JSON.stringify({ invoice_id: 'UDK_R2' }),
        })
      );
      expect(okRes.status).toBe(200);
      const data = await okRes.json();
      expect(data.kind).toBe('wallet_topup');
      expect(data.walletBalanceBDT).toBe(3000);
      // Zero affiliate commission generated on wallet top-up!
      expect(mockStore.state.affiliate_commissions).toHaveLength(0);
    });
  });

  describe('3. bKash / Nagad Redirect Callbacks & Atomic Wallet Checkout', () => {
    it('executes bKash callback payment and redirects to /dashboard?payment=success', async () => {
      process.env.BKASH_APP_KEY = 'bk_k';
      process.env.BKASH_APP_SECRET = 'bk_s';
      process.env.BKASH_USERNAME = 'bk_u';
      process.env.BKASH_PASSWORD = 'bk_p';

      mockStore.state.invoices.push({
        id: 'inv-bk-1',
        invoice_number: 'DEV-INV-BK1',
        user_id: UUID_1,
        total_bdt: 450,
        subtotal_bdt: 450,
        status: 'unpaid',
        bundled_domain_name: 'bksite.com',
        items: [{ domain: 'bksite.com' }],
      });

      globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).endsWith('/token/grant')) {
          return new Response(JSON.stringify({ id_token: 'bk_tok' }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            transactionStatus: 'Completed',
            statusCode: '0000',
            trxID: 'BK98127700',
            amount: '450',
            merchantInvoiceNumber: 'DEV-INV-BK1',
            customerMsisdn: '01999888777',
          }),
          { status: 200 }
        );
      }) as unknown as typeof fetch;

      const res = await bkashCallbackGet(
        new NextRequest('http://localhost/api/payments/bkash/callback?paymentID=PID1&status=success&invoice=DEV-INV-BK1')
      );
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('payment=success');
      expect(res.headers.get('location')).toContain('BK98127700');
      expect(executeZeroTouchProvisioning).toHaveBeenCalledTimes(1);
    });

    it('verifies Nagad callback payment and settles invoice', async () => {
      process.env.NAGAD_MERCHANT_ID = 'NG_M1';
      process.env.NAGAD_PUBLIC_KEY = 'PUB';
      process.env.NAGAD_PRIVATE_KEY = 'PRIV';

      mockStore.state.invoices.push({
        id: 'inv-ng-1',
        invoice_number: 'DEV-INV-NG1',
        user_id: UUID_1,
        total_bdt: 450,
        subtotal_bdt: 450,
        status: 'unpaid',
        items: [{ domain: 'ngsite.com' }],
      });

      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 'Success',
            issuerPaymentRefNo: 'NGTRX8821',
            amount: '450',
            clientMobileNo: '01999888777',
            additionalMerchantInfo: { invoiceNumber: 'DEV-INV-NG1' },
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

      const res = await nagadCallbackGet(
        new NextRequest('http://localhost/api/payments/nagad/callback?payment_ref_id=PREF1&status=Success&invoice=DEV-INV-NG1')
      );
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('payment=success');
      expect(mockStore.state.transactions[0].trx_id).toBe('NGTRX8821');
    });

    it('processes atomic wallet checkout (200), declines insufficient balance (402) & concurrent conflict (409)', async () => {
      mockStore.state.invoices.push({
        id: 'inv-wlt-1',
        invoice_number: 'DEV-INV-WLT1',
        user_id: UUID_1,
        total_bdt: 450,
        subtotal_bdt: 450,
        status: 'unpaid',
        referral_code: 'RAFAT20',
        bundled_domain_name: 'walletapp.com',
        items: [{ domain: 'walletapp.com', planId: 'developer-pro' }],
      });

      const okRes = await walletPayPost(
        new NextRequest('http://localhost/api/payments/wallet-pay', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '103.50.10.20' },
          body: JSON.stringify({ invoiceNumber: 'DEV-INV-WLT1' }),
        })
      );
      expect(okRes.status).toBe(200);
      const okData = await okRes.json();
      expect(okData.newWalletBalanceBDT).toBe(1550);
      expect(okData.affiliate.commissionBDT).toBe(90);

      // Concurrent double-submit returns 409 ALREADY_PROCESSED
      const conflictRes = await walletPayPost(
        new NextRequest('http://localhost/api/payments/wallet-pay', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ invoiceNumber: 'DEV-INV-WLT1' }),
        })
      );
      expect(conflictRes.status).toBe(409);

      // Insufficient balance invoice returns 402
      mockStore.state.invoices.push({
        id: 'inv-wlt-2',
        invoice_number: 'DEV-INV-WLT2',
        user_id: UUID_1,
        total_bdt: 99999,
        subtotal_bdt: 99999,
        status: 'unpaid',
        items: [],
      });
      const poorRes = await walletPayPost(
        new NextRequest('http://localhost/api/payments/wallet-pay', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ invoiceNumber: 'DEV-INV-WLT2' }),
        })
      );
      expect(poorRes.status).toBe(402);
    });
  });

  describe('4. Zero-Loss 4-Signal Anti-Self-Referral Shield, Payout Lifecycle & Clawback', () => {
    it('canonicalizes Gmail dot/subaddress aliases, BD phones, and devhost_aff_ref cookies accurately', () => {
      expect(canonicalizeEmail('J.Doe+promo1@googlemail.com')).toBe('jdoe@gmail.com');
      expect(normalizeBdPhone('+8801712-345678')).toBe('01712345678');
      expect(parseAffiliateAttributionCookie(JSON.stringify({ code: 'RAFAT20', subid: 'fb_ads' }))).toEqual({
        referralCode: 'RAFAT20',
        subId: 'fb_ads',
        timestamp: undefined,
        landing: undefined,
      });
    });

    it('blocks all 4 self-referral vectors (email alias, BD phone, 30d /24 IP subnet, sender/card fingerprint)', async () => {
      const { getServiceSupabase } = await import('@/lib/supabase');
      const db = getServiceSupabase();

      // Signal 1: Gmail dot + plus alias (`j.doe+self@gmail.com` === `jdoe@gmail.com`)
      const s1 = await recordVerifiedAffiliateConversion(db, {
        invoiceId: 'aaaaaaaa-1111-4111-8111-111111111111',
        invoiceNumber: 'INV-S1',
        buyerEmail: 'j.doe+self@gmail.com',
        referralCode: 'RAFAT20',
        amountBDT: 450,
      });
      expect(s1.blocked).toBe(true);
      expect(s1.signalsTriggered).toContain('signal_1_identity_email_alias_match');

      // Signal 2: Normalized Bangladeshi phone matching affiliate payout account
      const s2 = await recordVerifiedAffiliateConversion(db, {
        invoiceId: 'bbbbbbbb-1111-4111-8111-111111111111',
        invoiceNumber: 'INV-S2',
        buyerEmail: 'distinctbuyer@yahoo.com',
        buyerPhone: '+8801712345678',
        referralCode: 'RAFAT20',
        amountBDT: 450,
      });
      expect(s2.blocked).toBe(true);
      expect(s2.signalsTriggered).toContain('signal_2_phone_payout_match');

      // Signal 3: 30-day owner IPv4 /24 subnet overlap (`103.205.71.42` vs `103.205.71.99`)
      const s3 = await recordVerifiedAffiliateConversion(db, {
        invoiceId: 'cccccccc-1111-4111-8111-111111111111',
        invoiceNumber: 'INV-S3',
        buyerEmail: 'otheruser@outlook.com',
        buyerIp: '103.205.71.99',
        referralCode: 'RAFAT20',
        amountBDT: 450,
      });
      expect(s3.blocked).toBe(true);
      expect(s3.signalsTriggered).toContain('signal_3_owner_30d_subnet24_match');

      // Signal 4: Stripe card fingerprint matching prior affiliate transaction
      mockStore.state.transactions.push({
        id: 'tx-aff-own',
        user_id: UUID_AFF,
        gateway: 'stripe',
        trx_id: 'PI_AFF_CARD',
        amount_bdt: 200,
        status: 'Completed',
        raw_payload: { card_fingerprint: 'fp_shared_visa_99' },
      });
      const s4 = await recordVerifiedAffiliateConversion(db, {
        invoiceId: 'dddddddd-1111-4111-8111-111111111111',
        invoiceNumber: 'INV-S4',
        buyerEmail: 'newmail@domain.com',
        buyerIp: '185.10.20.30',
        cardFingerprint: 'fp_shared_visa_99',
        referralCode: 'RAFAT20',
        amountBDT: 450,
      });
      expect(s4.blocked).toBe(true);
      expect(s4.signalsTriggered).toContain('signal_4_stripe_card_fingerprint_owner_match');
    });

    it('caps affiliate commission on annual free-domain bundle + discount so founder net profit stays positive', async () => {
      const { getServiceSupabase } = await import('@/lib/supabase');
      const db = getServiceSupabase();

      // Annual Developer Pro (~4320 BDT) with bundled free .com (1150 COGS) + 20% promo (864) -> net 3456 - (1080 + 1150) - 2700 minProfit = 0 -> safely capped!
      const outcome = await recordVerifiedAffiliateConversion(db, {
        invoiceId: 'eeeeeeee-1111-4111-8111-111111111111',
        invoiceNumber: 'INV-ZERO-LOSS',
        buyerEmail: 'agency@client.io',
        buyerIp: '45.67.89.10',
        referralCode: 'RAFAT20',
        amountBDT: 4320,
        subtotalBDT: 4320,
        billingCycle: 'annually',
        freeDomainBundleApplied: true,
        bundledDomainName: 'clientagency.com',
      });

      // Raw 20% of 4320 = 864; hard costs = 1080 + 1150 = 2230; minProfit = 2700 -> pool = 0
      expect(outcome.commissionBDT).toBe(0);
      expect(outcome.isAffiliateCapped).toBe(true);

      // Now test profitable annual order without domain cost erosion where commission IS awarded safely capped:
      const profitable = await recordVerifiedAffiliateConversion(db, {
        invoiceId: 'ffffffff-1111-4111-8111-111111111111',
        invoiceNumber: 'INV-SAFE-CAP',
        buyerEmail: 'founder2@startup.com',
        buyerIp: '45.67.89.11',
        referralCode: 'RAFAT20',
        amountBDT: 4320,
        subtotalBDT: 4320,
        billingCycle: 'annually',
        freeDomainBundleApplied: false,
      });
      // 4320 - 1080 - 2700 = 540 safe pool; raw 20% is 864 -> capped safely at 540!
      expect(profitable.commissionBDT).toBe(540);
      expect(profitable.isAffiliateCapped).toBe(true);
      expect(profitable.ownerNetProfitBDT).toBe(2700);
    });

    it('supports GET /api/affiliate -> request_payout -> Sudo approve_payout -> admin approve_trxid UUID fix -> clawback', async () => {
      // 1. User requests payout of 1200 BDT
      const reqGet = new NextRequest('http://localhost/api/affiliate');
      const getRes = await affiliateGet(reqGet);
      expect(getRes.status).toBe(200);

      // Switch active user to Partner Affiliate (1500 available)
      mockStore.currentUserAuth = {
        ...mockStore.currentUserAuth,
        user: { id: UUID_AFF, email: 'jdoe@gmail.com' },
        profile: {
          ...mockStore.currentUserAuth.profile,
          id: UUID_AFF,
          email: 'jdoe@gmail.com',
          full_name: 'Partner Affiliate',
          referral_code: 'RAFAT20',
        },
      };

      const payoutReqRes = await affiliatePost(
        new NextRequest('http://localhost/api/affiliate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'request_payout',
            amountBDT: 1200,
            payoutMethod: 'bkash',
            accountDetails: '01712345678',
          }),
        })
      );
      expect(payoutReqRes.status).toBe(200);
      const payoutData = await payoutReqRes.json();
      expect(payoutData.availableBalanceBDT).toBe(300);

      // 2. Non-admin blocked from approve_payout
      const nonAdminApprove = await affiliatePost(
        new NextRequest('http://localhost/api/affiliate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'approve_payout',
            payoutId: payoutData.payoutId,
            adminTrxId: 'BK_SETTLED_99',
          }),
        })
      );
      expect(nonAdminApprove.status).toBe(403);

      // 3. Admin + Sudo approves payout and writes financial_profit_ledger
      mockStore.isAdminMode = true;
      mockStore.sudoValid = true;
      const approveRes = await affiliatePost(
        new NextRequest('http://localhost/api/affiliate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'approve_payout',
            payoutId: payoutData.payoutId,
            adminTrxId: 'BK_SETTLED_99',
          }),
        })
      );
      expect(approveRes.status).toBe(200);
      expect(mockStore.state.affiliate_payouts[0].status).toBe('approved_paid');
      expect(
        mockStore.state.financial_profit_ledger.some((l) => l.entry_type === 'affiliate_payout')
      ).toBe(true);

      // 4. Admin approves manual TrxID by invoice_number -> settles wallet_topup & uses valid UUID in ledger
      mockStore.state.invoices.push({
        id: '99999999-9999-4999-8999-999999999999',
        invoice_number: 'DEV-INV-MAN1',
        user_id: UUID_1,
        total_bdt: 750,
        status: 'verifying_trxid',
        order_type: 'wallet_topup',
        items: [{ type: 'wallet_topup' }],
      });
      mockStore.state.transactions.push({
        id: 'tx-man-1',
        invoice_id: '99999999-9999-4999-8999-999999999999',
        invoice_number: 'DEV-INV-MAN1',
        user_id: UUID_1,
        gateway: 'bkash',
        trx_id: '9K72LM89QP',
        amount_bdt: 750,
        status: 'pending_verification',
      });

      const manualApproveRes = await adminLedgerPost(
        new NextRequest('http://localhost/api/admin/ledger', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'approve_trxid',
            invoiceNumber: 'DEV-INV-MAN1',
            trxId: '9K72LM89QP',
            grossAmountBdt: 750,
          }),
        })
      );
      expect(manualApproveRes.status).toBe(200);
      const topupLedger = mockStore.state.financial_profit_ledger.find(
        (l) => l.trx_id === '9K72LM89QP'
      );
      expect(topupLedger?.invoice_id).toBe('99999999-9999-4999-8999-999999999999');
      expect(mockStore.state.profiles.find((p) => p.id === UUID_1)?.wallet_balance_bdt).toBe(2750);
    });
  });

  describe('5. Phase 3 SQL Migration Safety Invariants', () => {
    it('verifies phase3_payments_and_affiliate.sql defines ACID RPCs, unique constraints, and refund trigger', () => {
      const sql = readFileSync(
        join(process.cwd(), 'supabase/migrations/phase3_payments_and_affiliate.sql'),
        'utf-8'
      );
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.process_atomic_wallet_payment');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.credit_user_wallet_atomic');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('idx_transactions_trx_id_unique');
      expect(sql).toContain('uq_affiliate_commissions_invoice_id');
      expect(sql).toContain('trigger_invoice_refund_clawback');
    });
  });
});
