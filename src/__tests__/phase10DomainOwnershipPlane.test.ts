import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  catalog_domain_tlds: MockRow[];
  catalog_hosting_plans: MockRow[];
  domains: MockRow[];
  domain_transfers: MockRow[];
  domain_dns_records: MockRow[];
  hosting_services: MockRow[];
  hosting_addon_domains: MockRow[];
  whm_server_nodes: MockRow[];
  invoices: MockRow[];
  wallet_transactions: MockRow[];
  financial_profit_ledger: MockRow[];
  security_audit_logs: MockRow[];
  affiliate_commissions: MockRow[];
  promo_codes: MockRow[];
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OWNED_DOMAIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createInitialDb(): MockDbState {
  return {
    profiles: [
      {
        id: USER_ID,
        email: 'client@devhost.cloud',
        full_name: 'Demo Client',
        phone: '01711111111',
        role: 'client',
        wallet_balance_bdt: 10000,
        referral_code: null,
        referred_by: null,
      },
      {
        id: OTHER_USER_ID,
        email: 'other@devhost.cloud',
        full_name: 'Other User',
        phone: '01722222222',
        role: 'client',
        wallet_balance_bdt: 5000,
        referral_code: null,
        referred_by: null,
      },
      {
        id: ADMIN_ID,
        email: 'founder@devhost.cloud',
        full_name: 'Founder Admin',
        phone: '01799999999',
        role: 'admin',
        wallet_balance_bdt: 50000,
        referral_code: null,
        referred_by: null,
      },
    ],
    catalog_domain_tlds: [
      {
        tld: '.com',
        reg_price_bdt: 1350,
        renew_price_bdt: 1650,
        transfer_price_bdt: 1350,
        registrar_cost_bdt: 1150,
        owner_net_profit_reg_bdt: 200,
        affiliate_eligible: false,
        is_active: true,
      },
      {
        tld: '.io',
        reg_price_bdt: 4800,
        renew_price_bdt: 5200,
        transfer_price_bdt: 4800,
        registrar_cost_bdt: 4200,
        owner_net_profit_reg_bdt: 600,
        affiliate_eligible: false,
        is_active: true,
      },
    ],
    catalog_hosting_plans: [
      {
        id: 'plan-dev-pro',
        slug: 'developer-pro',
        name_en: 'Developer Pro Cloud',
        max_addon_domains: 5,
        selling_price_monthly_bdt: 450,
        unit_server_cost_bdt: 180,
        min_owner_profit_bdt: 150,
      },
    ],
    domains: [
      {
        id: OWNED_DOMAIN_ID,
        user_id: USER_ID,
        domain_name: 'shopbd.com',
        tld: '.com',
        status: 'Active',
        registrar_lock: true,
        whois_privacy: true,
        auto_renew: true,
        nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
        registrar_provider: 'resellerclub',
        registrar_order_id: 'rc-ord-existing',
        expiry_date: '2027-06-01',
      },
    ],
    domain_transfers: [],
    domain_dns_records: [],
    hosting_services: [
      {
        id: SERVICE_ID,
        user_id: USER_ID,
        domain: 'shopbd.com',
        plan_id: 'developer-pro',
        plan_name: 'Developer Pro Cloud',
        cpanel_username: 'shopbd1',
      },
    ],
    hosting_addon_domains: [],
    whm_server_nodes: [
      {
        id: 'node-sg1',
        hostname: 'sg1.devhost.cloud',
        ip_address: '103.151.102.45',
        is_active: true,
        status: 'active',
      },
    ],
    invoices: [],
    wallet_transactions: [],
    financial_profit_ledger: [],
    security_audit_logs: [],
    affiliate_commissions: [],
    promo_codes: [],
  };
}

const mockStore = vi.hoisted(() => ({
  supabaseConfigured: true,
  activeUserId: '11111111-1111-4111-8111-111111111111',
  isAdmin: false,
  state: null as unknown as MockDbState,
}));

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

interface MockQueryChain extends PromiseLike<QueryResult> {
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => MockQueryChain;
  insert: (payload: MockRow | MockRow[]) => MockQueryChain;
  upsert: (payload: MockRow | MockRow[], opts?: { onConflict?: string }) => MockQueryChain;
  update: (payload: MockRow) => MockQueryChain;
  delete: () => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  in: (col: string, vals: unknown[]) => MockQueryChain;
  ilike: (col: string, val: string) => MockQueryChain;
  gt: (col: string, val: unknown) => MockQueryChain;
  gte: (col: string, val: unknown) => MockQueryChain;
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryChain;
  limit: (n: number) => MockQueryChain;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
}

function getTable(state: MockDbState, name: string): MockRow[] {
  const key = name as keyof MockDbState;
  if (!Array.isArray(state[key])) {
    (state as unknown as Record<string, MockRow[]>)[name] = [];
  }
  return state[key];
}

function createQueryBuilder(tableName: string): MockQueryChain {
  let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  let payloadData: MockRow | MockRow[] = {};
  let upsertConflictCol = '';
  let countOnly = false;
  let limitCount = 0;
  let orderCol = '';
  let orderAsc = true;
  const predicates: Array<(row: MockRow) => boolean> = [];

  const applyFilters = (rows: MockRow[]) => rows.filter((r) => predicates.every((fn) => fn(r)));

  const execute = (): QueryResult => {
    const rows = getTable(mockStore.state, tableName);

    if (op === 'insert') {
      const items = Array.isArray(payloadData) ? payloadData : [payloadData];
      const inserted = items.map((item) => {
        const rec = { id: `${tableName}_${Math.random().toString(36).slice(2, 9)}`, ...item };
        rows.push(rec);
        return rec;
      });
      return { data: Array.isArray(payloadData) ? inserted : inserted[0], error: null };
    }

    if (op === 'upsert') {
      const items = Array.isArray(payloadData) ? payloadData : [payloadData];
      const conflictCols = upsertConflictCol.split(',').map((s) => s.trim()).filter(Boolean);
      const out: MockRow[] = [];
      for (const item of items) {
        const existingIdx =
          conflictCols.length > 0
            ? rows.findIndex((r) => conflictCols.every((c) => r[c] === item[c]))
            : -1;
        if (existingIdx >= 0) {
          rows[existingIdx] = { ...rows[existingIdx], ...item };
          out.push(rows[existingIdx]);
        } else {
          const rec = { id: `${tableName}_${Math.random().toString(36).slice(2, 9)}`, ...item };
          rows.push(rec);
          out.push(rec);
        }
      }
      return { data: Array.isArray(payloadData) ? out : out[0], error: null };
    }

    if (op === 'update') {
      const matched = applyFilters(rows);
      for (const r of matched) {
        Object.assign(r, payloadData);
      }
      return { data: matched, error: null };
    }

    if (op === 'delete') {
      const kept = rows.filter((r) => !predicates.every((fn) => fn(r)));
      const deletedCount = rows.length - kept.length;
      rows.length = 0;
      rows.push(...kept);
      return { data: null, error: null, count: deletedCount };
    }

    let matched = applyFilters(rows);
    if (orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = String(a[orderCol] ?? '');
        const bv = String(b[orderCol] ?? '');
        return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (limitCount > 0) {
      matched = matched.slice(0, limitCount);
    }
    if (countOnly) {
      return { data: null, error: null, count: matched.length };
    }
    return { data: matched, error: null };
  };

  const chain: MockQueryChain = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) countOnly = true;
      return chain;
    },
    insert: (p: MockRow | MockRow[]) => {
      op = 'insert';
      payloadData = p;
      return chain;
    },
    upsert: (p: MockRow | MockRow[], opts?: { onConflict?: string }) => {
      op = 'upsert';
      payloadData = p;
      upsertConflictCol = opts?.onConflict || '';
      return chain;
    },
    update: (p: MockRow) => {
      op = 'update';
      payloadData = p;
      return chain;
    },
    delete: () => {
      op = 'delete';
      return chain;
    },
    eq: (col: string, val: unknown) => {
      predicates.push((r) => r[col] === val);
      return chain;
    },
    in: (col: string, vals: unknown[]) => {
      predicates.push((r) => vals.includes(r[col]));
      return chain;
    },
    ilike: (col: string, val: string) => {
      predicates.push((r) => String(r[col] ?? '').toLowerCase() === val.toLowerCase());
      return chain;
    },
    gt: (col: string, val: unknown) => {
      predicates.push((r) => Number(r[col] ?? 0) > Number(val));
      return chain;
    },
    gte: (col: string, val: unknown) => {
      predicates.push((r) => Number(r[col] ?? 0) >= Number(val));
      return chain;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orderCol = col;
      orderAsc = opts?.ascending !== false;
      return chain;
    },
    limit: (n: number) => {
      limitCount = n;
      return chain;
    },
    maybeSingle: async () => {
      const res = execute();
      const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
      return { data: first, error: res.error };
    },
    single: async () => {
      const res = execute();
      const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
      return {
        data: first,
        error: first ? res.error : { code: 'PGRST116', message: 'Not found' },
      };
    },
    then: (onfulfilled, onrejected) => Promise.resolve(execute()).then(onfulfilled, onrejected),
  };

  return chain;
}

vi.mock('@/lib/supabase', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupabaseConfigured: () => mockStore.supabaseConfigured,
    getServiceSupabase: () => ({
      from: (table: string) => createQueryBuilder(table),
      rpc: async (fnName: string, args: Record<string, unknown>) => {
        if (fnName === 'process_atomic_wallet_payment') {
          const userId = String(args.p_user_id || '');
          const invNum = String(args.p_invoice_number || '');
          const trxId = String(args.p_trx_id || '');
          const inv = mockStore.state.invoices.find(
            (i) => i.invoice_number === invNum && i.user_id === userId
          );
          if (!inv) {
            return { data: [{ ok: false, error: 'Invoice not found' }], error: null };
          }
          if (inv.status === 'paid') {
            return { data: [{ ok: false, error: 'Invoice already paid' }], error: null };
          }
          const profile = mockStore.state.profiles.find((p) => p.id === userId);
          const total = Number(inv.total_bdt || 0);
          const balance = Number(profile?.wallet_balance_bdt || 0);
          if (!profile || balance < total) {
            return { data: [{ ok: false, error: 'Insufficient wallet balance' }], error: null };
          }
          const nextBal = Number((balance - total).toFixed(2));
          profile.wallet_balance_bdt = nextBal;
          inv.status = 'paid';
          inv.trx_id = trxId;
          inv.payment_method = 'wallet';
          mockStore.state.wallet_transactions.push({
            id: `wtx_${Date.now()}`,
            user_id: userId,
            type: 'debit',
            amount_bdt: total,
            balance_after_bdt: nextBal,
            reference_id: trxId,
          });
          return {
            data: [
              {
                ok: true,
                invoice_id: inv.id,
                invoice_number: inv.invoice_number,
                user_id: userId,
                total_bdt: total,
                new_balance: nextBal,
                trx_id: trxId,
                billing_cycle: inv.billing_cycle,
                free_domain_bundle_applied: inv.free_domain_bundle_applied,
                bundled_domain_name: inv.bundled_domain_name,
                referral_code: inv.referral_code,
                referral_sub_id: inv.referral_sub_id || 'organic',
                order_type: inv.order_type || 'hosting_order',
                promo_discount_bdt: Number(inv.promo_discount_bdt || 0),
                plan_id: inv.plan_id,
                items: Array.isArray(inv.items) ? inv.items : [],
              },
            ],
            error: null,
          };
        }
        return { data: null, error: { message: `Unknown RPC ${fnName}` } };
      },
    }),
  };
});

vi.mock('@/lib/authGuard', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const makeAuthUser = () => {
    const uid = mockStore.isAdmin ? ADMIN_ID : mockStore.activeUserId;
    const role = mockStore.isAdmin ? 'admin' : 'client';
    return {
      ok: true as const,
      user: { id: uid, email: uid === ADMIN_ID ? 'founder@devhost.cloud' : 'client@devhost.cloud' },
      profile: {
        id: uid,
        email: uid === ADMIN_ID ? 'founder@devhost.cloud' : 'client@devhost.cloud',
        full_name: uid === ADMIN_ID ? 'Founder Admin' : 'Demo Client',
        phone: '01711111111',
        role,
        wallet_balance_bdt: 10000,
        referral_code: null,
      },
      role,
    };
  };

  return {
    ...actual,
    requireUser: async () => makeAuthUser(),
    requireAdmin: async () => {
      if (!mockStore.isAdmin) {
        return {
          ok: false as const,
          response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        };
      }
      return makeAuthUser();
    },
    verifyCronOrAdmin: async () => makeAuthUser(),
    requireDomainAccess: async (_req: Request, target: { domainId?: string; domainName?: string }) => {
      const uid = mockStore.isAdmin ? ADMIN_ID : mockStore.activeUserId;
      return {
        ok: true as const,
        user: { id: uid, email: 'client@devhost.cloud' },
        role: mockStore.isAdmin ? 'admin' : 'client',
        isAdmin: mockStore.isAdmin,
        domainId: target.domainId || OWNED_DOMAIN_ID,
        domainName: target.domainName || 'shopbd.com',
      };
    },
    requireServiceAccess: async () => {
      const uid = mockStore.isAdmin ? ADMIN_ID : mockStore.activeUserId;
      return {
        ok: true as const,
        user: { id: uid, email: 'client@devhost.cloud' },
        serviceId: SERVICE_ID,
        service: mockStore.state.hosting_services[0],
        isAdmin: mockStore.isAdmin,
      };
    },
  };
});

import { POST as createSessionPost } from '@/app/api/payments/create-session/route';
import { POST as walletPayPost } from '@/app/api/payments/wallet-pay/route';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';
import {
  GET as hostingDomainsGet,
  POST as hostingDomainsPost,
  PATCH as hostingDomainsPatch,
} from '@/app/api/hosting/domains/route';
import { POST as manageDomainPost } from '@/app/api/domains/manage/route';
import { POST as cronLifecyclePost } from '@/app/api/cron/lifecycle/route';
import { getServiceSupabase } from '@/lib/supabase';

const ENV_BACKUP = { ...process.env };
const FETCH_BACKUP = globalThis.fetch;

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `103.200.1.${Math.floor(Math.random() * 200) + 1}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('Phase 10: Unified Domain Purchase, Transfer-In Lifecycle & Custom Domain Ownership Plane', () => {
  beforeEach(() => {
    mockStore.supabaseConfigured = true;
    mockStore.activeUserId = USER_ID;
    mockStore.isAdmin = false;
    mockStore.state = createInitialDb();

    process.env.DEV_SANDBOX_MODE = 'false';
    process.env.RESEND_API_KEY = '';
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.TELEGRAM_CHAT_ID = '';
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_test_token_1234567890abcdef';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc_99';
    process.env.CLOUDFLARE_SAAS_ZONE_ID = 'cf_saas_zone_88';
    process.env.CLOUDFLARE_FALLBACK_ORIGIN = 'edge.devhost.cloud';
    process.env.REGISTRAR_PROVIDER = 'resellerclub';
    process.env.REGISTRAR_API_USER = 'rc_uid_55';
    process.env.REGISTRAR_API_KEY = 'rc_key_secret_99';
    process.env.REGISTRAR_CUSTOMER_ID = 'rc_cust_100';
    process.env.REGISTRAR_DEFAULT_CONTACT_ID = 'rc_contact_200';
    delete process.env.NAMECHEAP_API_USER;
    delete process.env.NAMECHEAP_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ENV_BACKUP };
    globalThis.fetch = FETCH_BACKUP;
    vi.restoreAllMocks();
  });

  it('1. Rejects price tampering and fulfills paid domain registration + idempotent domain renewal via wallet checkout', async () => {
    const registrarCalls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('domains/register.json')) {
        registrarCalls.push(`register:${url}`);
        return new Response(JSON.stringify({ entityid: 'rc_reg_1001', status: 'Success' }), { status: 200 });
      }
      if (url.includes('domains/orderid.json')) {
        return new Response('998877', { status: 200 });
      }
      if (url.includes('domains/renew.json')) {
        registrarCalls.push(`renew:${url}`);
        return new Response(JSON.stringify({ entityid: 'rc_ren_2002', status: 'Success' }), { status: 200 });
      }
      if (url.includes('/client/v4/zones') && url.endsWith('/zones')) {
        return new Response(
          JSON.stringify({
            success: true,
            result: { id: 'cf_zone_newdom', status: 'pending', name_servers: ['ns1.cf.net', 'ns2.cf.net'] },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/dns_records')) {
        return new Response(JSON.stringify({ success: true, result: { id: 'rec_1' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as typeof fetch;

    // Price tampering attempt (tries 2y .com = ৳2,700 for ৳100)
    const tamperRes = await createSessionPost(
      jsonReq('http://localhost/api/payments/create-session', 'POST', {
        orderType: 'domain_registration',
        gateway: 'wallet',
        domain: 'freshbrand.com',
        years: 2,
        amountBDT: 100,
      })
    );
    expect(tamperRes.status).toBe(400);

    // Valid 2-year .com registration checkout
    const createReg = await createSessionPost(
      jsonReq('http://localhost/api/payments/create-session', 'POST', {
        orderType: 'domain_registration',
        gateway: 'wallet',
        domain: 'freshbrand.com',
        years: 2,
        amountBDT: 2700,
      })
    );
    expect(createReg.status).toBe(200);
    const regSession = (await createReg.json()) as { invoiceNumber: string; amountBDT: number };
    expect(regSession.amountBDT).toBe(2700);

    const payReg = await walletPayPost(
      jsonReq('http://localhost/api/payments/wallet-pay', 'POST', {
        invoiceNumber: regSession.invoiceNumber,
      })
    );
    expect(payReg.status).toBe(200);
    const payRegJson = (await payReg.json()) as {
      success: boolean;
      kind: string;
      domainOrder: { operation: string; domain: string; status: string; registrarOrderId: string };
    };
    expect(payRegJson.success).toBe(true);
    expect(payRegJson.kind).toBe('domain_order');
    expect(payRegJson.domainOrder.operation).toBe('register');
    expect(payRegJson.domainOrder.domain).toBe('freshbrand.com');
    expect(payRegJson.domainOrder.registrarOrderId).toBe('rc_reg_1001');

    const storedDomain = mockStore.state.domains.find((d) => d.domain_name === 'freshbrand.com');
    expect(storedDomain).toBeTruthy();
    expect(storedDomain?.status).toBe('Active');
    expect(mockStore.state.financial_profit_ledger.some((l) => l.entry_type === 'domain_registration')).toBe(true);

    // Valid 1-year domain renewal checkout
    const createRen = await createSessionPost(
      jsonReq('http://localhost/api/payments/create-session', 'POST', {
        orderType: 'domain_renewal',
        gateway: 'wallet',
        domain: 'shopbd.com',
        years: 1,
        amountBDT: 1650,
      })
    );
    expect(createRen.status).toBe(200);
    const renSession = (await createRen.json()) as { invoiceNumber: string };

    const payRen = await walletPayPost(
      jsonReq('http://localhost/api/payments/wallet-pay', 'POST', {
        invoiceNumber: renSession.invoiceNumber,
      })
    );
    expect(payRen.status).toBe(200);
    const payRenJson = (await payRen.json()) as {
      trxId: string;
      domainOrder: { operation: string; status: string };
    };
    expect(payRenJson.domainOrder.operation).toBe('renew');
    expect(payRenJson.domainOrder.status).toBe('Active');
    expect(registrarCalls.filter((c) => c.startsWith('renew:'))).toHaveLength(1);

    // Idempotent replay with same trxId must NOT re-call registrar API
    const paidInv = mockStore.state.invoices.find((i) => i.invoice_number === renSession.invoiceNumber)!;
    const replayOutcome = await fulfillPaidInvoiceAndAffiliate({
      db: getServiceSupabase(),
      invoice: paidInv,
      gateway: 'wallet',
      trxId: payRenJson.trxId,
      amountBDT: 1650,
      skipInvoiceMarkPaid: true,
    });
    expect(replayOutcome.domainOrder?.alreadyFulfilled).toBe(true);
    expect(registrarCalls.filter((c) => c.startsWith('renew:'))).toHaveLength(1);
  });

  it('2. Settles paid domain_transfer with encrypted EPP, polls registrar lifecycle to Step 5 Active, and allows owner EPP retry', async () => {
    let transferPollPhase: 'pending_losing_registrar' | 'completed' = 'pending_losing_registrar';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('domains/transfer.json')) {
        return new Response(JSON.stringify({ entityid: 'rc_trf_777', status: 'Success' }), { status: 200 });
      }
      if (url.includes('domains/details-by-name.json')) {
        return new Response(
          JSON.stringify({
            entityid: 'rc_trf_777',
            domainname: 'inbound-startup.com',
            currentstatus: transferPollPhase === 'completed' ? 'Active' : 'Pending Transfer Request',
            actionstatusdesc:
              transferPollPhase === 'completed'
                ? 'Transfer completed'
                : 'Awaiting FOA authorization from losing registrar',
          }),
          { status: 200 }
        );
      }
      if (url.includes('/client/v4/zones') && url.endsWith('/zones')) {
        return new Response(
          JSON.stringify({
            success: true,
            result: { id: 'cf_zone_inbound', status: 'pending', name_servers: ['ns1.cf.net', 'ns2.cf.net'] },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as typeof fetch;

    const createTrf = await createSessionPost(
      jsonReq('http://localhost/api/payments/create-session', 'POST', {
        orderType: 'domain_transfer',
        gateway: 'wallet',
        domain: 'inbound-startup.com',
        eppCode: 'EPP-TOP-SECRET-99',
        amountBDT: 1350,
      })
    );
    expect(createTrf.status).toBe(200);
    const trfSession = (await createTrf.json()) as { invoiceNumber: string };

    // Confirm raw EPP code is never persisted in plaintext inside invoice items
    const storedInv = mockStore.state.invoices.find((i) => i.invoice_number === trfSession.invoiceNumber)!;
    expect(JSON.stringify(storedInv.items)).not.toContain('EPP-TOP-SECRET-99');

    const payTrf = await walletPayPost(
      jsonReq('http://localhost/api/payments/wallet-pay', 'POST', {
        invoiceNumber: trfSession.invoiceNumber,
      })
    );
    expect(payTrf.status).toBe(200);
    const payTrfJson = (await payTrf.json()) as {
      domainOrder: { operation: string; transferId: string; registrarOrderId: string };
    };
    expect(payTrfJson.domainOrder.operation).toBe('transfer');
    expect(payTrfJson.domainOrder.registrarOrderId).toBe('rc_trf_777');
    expect(mockStore.state.financial_profit_ledger.some((l) => l.entry_type === 'domain_transfer')).toBe(true);

    const trfRow = mockStore.state.domain_transfers.find((t) => t.id === payTrfJson.domainOrder.transferId);
    expect(trfRow?.current_step).toBe(2);
    expect(trfRow?.epp_code_encrypted).toBeTruthy();
    expect(String(trfRow?.epp_code_encrypted)).not.toContain('EPP-TOP-SECRET-99');

    // Poll Step 2 -> Step 3 (awaiting losing registrar) via cron lifecycle
    mockStore.isAdmin = true;
    const cronRes1 = await cronLifecyclePost(jsonReq('http://localhost/api/cron/lifecycle', 'POST'));
    expect(cronRes1.status).toBe(200);
    const cronJson1 = (await cronRes1.json()) as {
      results: { transfersPolled: number; transfersCompleted: number };
    };
    expect(cronJson1.results.transfersPolled).toBe(1);
    expect(cronJson1.results.transfersCompleted).toBe(0);
    expect(trfRow?.current_step).toBe(3);
    expect(trfRow?.status).toBe('awaiting_losing_registrar');

    // Poll Step 3 -> Step 5 (completed + domain Active in DB)
    transferPollPhase = 'completed';
    const cronRes2 = await cronLifecyclePost(jsonReq('http://localhost/api/cron/lifecycle', 'POST'));
    expect(cronRes2.status).toBe(200);
    const cronJson2 = (await cronRes2.json()) as {
      results: { transfersPolled: number; transfersCompleted: number };
    };
    expect(cronJson2.results.transfersCompleted).toBe(1);
    expect(trfRow?.current_step).toBe(5);
    expect(trfRow?.status).toBe('completed');
    const promotedDomain = mockStore.state.domains.find((d) => d.domain_name === 'inbound-startup.com');
    expect(promotedDomain?.status).toBe('Active');
    expect(promotedDomain?.cloudflare_zone_id).toBe('cf_zone_inbound');

    // Client EPP retry flow on a rejected transfer (and ownership guard)
    mockStore.isAdmin = false;
    mockStore.state.domain_transfers.push({
      id: 'trf_rejected_1',
      user_id: USER_ID,
      domain_name: 'retry-epp.com',
      tld: '.com',
      transfer_price_bdt: 1350,
      current_step: 2,
      status: 'rejected_invalid_epp',
      epp_status: 'rejected',
      status_message: 'Invalid EPP authorization code.',
    });
    mockStore.state.invoices.push({
      id: 'inv-retry-1',
      invoice_number: 'DEV-INV-RETRY-1',
      user_id: USER_ID,
      order_type: 'domain_transfer',
      bundled_domain_name: 'retry-epp.com',
      status: 'paid',
      total_bdt: 1350,
    });

    const retryRes = await manageDomainPost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'resubmit_transfer_epp',
        transferId: 'trf_rejected_1',
        eppCode: 'NEW-EPP-VALID-2026',
      })
    );
    expect(retryRes.status).toBe(200);
    const updatedRetry = mockStore.state.domain_transfers.find((t) => t.id === 'trf_rejected_1');
    expect(updatedRetry?.status).toBe('verifying_epp');
    expect(updatedRetry?.epp_status).toBe('resubmitted');

    // Non-owner cannot resubmit EPP
    mockStore.activeUserId = OTHER_USER_ID;
    const unownedRetry = await manageDomainPost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'resubmit_transfer_epp',
        transferId: 'trf_rejected_1',
        eppCode: 'HIJACK-EPP',
      })
    );
    expect(unownedRetry.status).toBe(403);

    // Non-admin client remains blocked from forging update_transfer_step
    mockStore.activeUserId = USER_ID;
    const forgeStepRes = await manageDomainPost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'update_transfer_step',
        transferId: 'trf_rejected_1',
        transferStep: 5,
      })
    );
    expect(forgeStepRes.status).toBe(403);

    // list_transfers returns only the user's real DB records
    const listRes = await manageDomainPost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'list_transfers',
      })
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { transfers: Array<{ id: string }> };
    expect(listJson.transfers).toHaveLength(2);
  });

  it('3. Enforces DNS TXT ownership proof before Cloudflare Custom Hostname creation & blocks origin override / phishing domains', async () => {
    let txtRecordPublished = false;
    let cfCustomHostnameCreatedCount = 0;
    let lastCfCustomOrigin: string | undefined;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('cloudflare-dns.com/dns-query') || url.includes('dns.google/resolve')) {
        const pendingRow = mockStore.state.hosting_addon_domains[0];
        const expectedToken = pendingRow ? String(pendingRow.verification_token || '') : '';
        return new Response(
          JSON.stringify({
            Status: 0,
            Answer: txtRecordPublished
              ? [{ type: 16, data: `"${expectedToken}"` }]
              : [{ type: 16, data: '"v=spf1 ~all"' }],
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/custom_hostnames') && init?.method === 'POST') {
        cfCustomHostnameCreatedCount += 1;
        const parsed = init.body ? (JSON.parse(String(init.body)) as { custom_origin_server?: string }) : {};
        lastCfCustomOrigin = parsed.custom_origin_server;
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: `cf_ch_${cfCustomHostnameCreatedCount}`,
              status: 'pending',
              ssl: {
                status: 'pending_validation',
                method: 'txt',
                validation_records: [
                  { txt_name: '_cf-custom-hostname.external-client.org', txt_value: 'dcv-val-123' },
                ],
              },
            },
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as typeof fetch;

    // Phishing domain blocked
    const phishRes = await hostingDomainsPost(
      jsonReq('http://localhost/api/hosting/domains', 'POST', {
        serviceId: SERVICE_ID,
        domainType: 'addon_domain',
        hostname: 'bkash-login-verify.xyz',
      })
    );
    expect(phishRes.status).toBe(403);
    expect(cfCustomHostnameCreatedCount).toBe(0);

    // Arbitrary external origin override blocked
    const originRes = await hostingDomainsPost(
      jsonReq('http://localhost/api/hosting/domains', 'POST', {
        serviceId: SERVICE_ID,
        domainType: 'addon_domain',
        hostname: 'external-client.org',
        customOriginServer: 'attacker-origin.evil.com',
      })
    );
    expect(originRes.status).toBe(400);
    const originJson = (await originRes.json()) as { code: string };
    expect(originJson.code).toBe('ORIGIN_OVERRIDE_FORBIDDEN');
    expect(cfCustomHostnameCreatedCount).toBe(0);

    // External domain queued with pending_txt — MUST NOT touch Cloudflare before DNS TXT proof
    const extPost = await hostingDomainsPost(
      jsonReq('http://localhost/api/hosting/domains', 'POST', {
        serviceId: SERVICE_ID,
        domainType: 'addon_domain',
        hostname: 'external-client.org',
      })
    );
    expect(extPost.status).toBe(202);
    const extJson = (await extPost.json()) as {
      id: string;
      verificationRequired: boolean;
      verificationStatus: string;
      verification: { recordName: string; recordValue: string };
    };
    expect(extJson.verificationRequired).toBe(true);
    expect(extJson.verificationStatus).toBe('pending_txt');
    expect(extJson.verification.recordName).toBe('_devhost-verify.external-client.org');
    expect(extJson.verification.recordValue).toMatch(/^devhost-site-verification=/);
    expect(cfCustomHostnameCreatedCount).toBe(0);

    // PATCH before TXT is published -> 422 OWNERSHIP_TXT_MISSING
    const patchFail = await hostingDomainsPatch(
      jsonReq('http://localhost/api/hosting/domains', 'PATCH', {
        id: extJson.id,
        serviceId: SERVICE_ID,
      })
    );
    expect(patchFail.status).toBe(422);
    const patchFailJson = (await patchFail.json()) as { code: string };
    expect(patchFailJson.code).toBe('OWNERSHIP_TXT_MISSING');
    expect(cfCustomHostnameCreatedCount).toBe(0);

    // Publish TXT and re-verify -> transitions to verified & provisions Cloudflare Custom Hostname on locked platform origin
    txtRecordPublished = true;
    const patchPass = await hostingDomainsPatch(
      jsonReq('http://localhost/api/hosting/domains', 'PATCH', {
        id: extJson.id,
        serviceId: SERVICE_ID,
      })
    );
    expect(patchPass.status).toBe(200);
    const patchPassJson = (await patchPass.json()) as {
      verified: boolean;
      verificationStatus: string;
      cloudflareHostnameId: string;
    };
    expect(patchPassJson.verified).toBe(true);
    expect(patchPassJson.verificationStatus).toBe('verified');
    expect(patchPassJson.cloudflareHostnameId).toBe('cf_ch_1');
    expect(cfCustomHostnameCreatedCount).toBe(1);
    expect(lastCfCustomOrigin).toBe('edge.devhost.cloud');

    // Internally owned domain (`sub.shopbd.com`) auto-verifies and creates Cloudflare Custom Hostname immediately
    const intPost = await hostingDomainsPost(
      jsonReq('http://localhost/api/hosting/domains', 'POST', {
        serviceId: SERVICE_ID,
        domainType: 'subdomain',
        hostname: 'api.shopbd.com',
      })
    );
    expect(intPost.status).toBe(200);
    const intJson = (await intPost.json()) as { verificationStatus: string; cloudflareHostnameId: string };
    expect(intJson.verificationStatus).toBe('internal_owned');
    expect(intJson.cloudflareHostnameId).toBe('cf_ch_2');
    expect(cfCustomHostnameCreatedCount).toBe(2);

    const getListRes = await hostingDomainsGet(
      new NextRequest(`http://localhost/api/hosting/domains?serviceId=${SERVICE_ID}`)
    );
    expect(getListRes.status).toBe(200);
  });

  it('4. Ensures Phase 10 UI components and APIs contain zero mock transfer fallbacks or external WHMCS cart hops', () => {
    const filesToAudit = [
      'src/components/domains/DomainTransferTracker.tsx',
      'src/components/domains/DomainSearchEngine.tsx',
      'src/components/domains/DomainPricingTable.tsx',
      'src/components/home/DomainChecker.tsx',
      'src/app/partners/PartnersClient.tsx',
      'src/app/api/domain-check/route.ts',
      'src/app/api/migration/route.ts',
      'src/app/contact/page.tsx',
      'src/lib/whmcsRouter.ts',
    ];

    for (const rel of filesToAudit) {
      const content = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(content).not.toMatch(/cart\.php/);
      expect(content).not.toMatch(/register\.php/);
      expect(content).not.toMatch(/submitticket\.php/);
      expect(content).not.toMatch(/clientarea\.php/);
      expect(content).not.toMatch(/DEFAULT_TRANSFERS/);
    }
  });
});
