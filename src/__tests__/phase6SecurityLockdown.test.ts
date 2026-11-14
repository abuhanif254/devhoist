import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  catalog_hosting_plans: MockRow[];
  catalog_domain_tlds: MockRow[];
  promo_codes: MockRow[];
  invoices: MockRow[];
  transactions: MockRow[];
  wallet_transactions: MockRow[];
  hosting_services: MockRow[];
  domains: MockRow[];
  domain_transfers: MockRow[];
  service_autoscaling_rules: MockRow[];
  agency_handover_transfers: MockRow[];
  project_deployments: MockRow[];
  hosting_preview_environments: MockRow[];
  hosting_project_settings: MockRow[];
  whm_server_nodes: MockRow[];
  user_security_credentials: MockRow[];
  security_audit_logs: MockRow[];
  fraud_alerts: MockRow[];
  financial_profit_ledger: MockRow[];
  affiliate_profiles: MockRow[];
  affiliate_clicks: MockRow[];
  affiliate_commissions: MockRow[];
  hosting_virtual_filesystem: MockRow[];
  build_jobs: MockRow[];
}

const UUID_USER_A = 'aaaa1111-1111-4111-8111-111111111111';
const UUID_USER_B = 'bbbb2222-2222-4222-8222-222222222222';
const UUID_ATTACKER = 'cccc3333-3333-4333-8333-333333333333';
const UUID_ADMIN = 'dddd4444-4444-4444-8444-444444444444';
const UUID_SUPERADMIN = 'eeee5555-5555-4555-8555-555555555555';

function createInitialDbState(): MockDbState {
  return {
    profiles: [
      {
        id: UUID_USER_A,
        email: 'usera@example.com',
        full_name: 'User Alpha',
        role: 'client',
        wallet_balance_bdt: 2500,
      },
      {
        id: UUID_USER_B,
        email: 'userb@example.com',
        full_name: 'User Beta',
        role: 'client',
        wallet_balance_bdt: 5000,
      },
      {
        id: UUID_ATTACKER,
        email: 'attacker@example.com',
        full_name: 'Malicious Actor',
        role: 'client',
        wallet_balance_bdt: 100,
      },
      {
        id: UUID_ADMIN,
        email: 'admin@devhostcloud.com',
        full_name: 'Platform Admin',
        role: 'admin',
        wallet_balance_bdt: 10000,
      },
      {
        id: UUID_SUPERADMIN,
        email: 'founder@devhostcloud.com',
        full_name: 'Super Admin',
        role: 'superadmin',
        wallet_balance_bdt: 10000,
      },
    ],
    catalog_hosting_plans: [
      {
        slug: 'starter',
        name_en: 'Starter Cloud',
        is_active: true,
        ram_mb: 2048,
        cpu_cores: 2,
        selling_price_monthly_bdt: 499,
        selling_price_annual_bdt: 4790,
        wholesale_cost_monthly_bdt: 200,
        annual_discount_percent: 20,
        whm_package_name: 'devhost_starter_2g',
      },
      {
        slug: 'developer-pro',
        name_en: 'Developer Pro',
        is_active: true,
        ram_mb: 4096,
        cpu_cores: 4,
        selling_price_monthly_bdt: 999,
        selling_price_annual_bdt: 9590,
        wholesale_cost_monthly_bdt: 400,
        annual_discount_percent: 20,
        whm_package_name: 'devhost_devpro_4g',
      },
    ],
    catalog_domain_tlds: [
      {
        tld: '.com',
        reg_price_bdt: 1450,
        renew_price_bdt: 1550,
        transfer_price_bdt: 1400,
        is_active: true,
      },
      {
        tld: '.dev',
        reg_price_bdt: 1850,
        renew_price_bdt: 1950,
        transfer_price_bdt: 1850,
        is_active: true,
      },
    ],
    promo_codes: [],
    invoices: [],
    transactions: [],
    wallet_transactions: [],
    hosting_services: [
      {
        id: 'srv-a',
        user_id: UUID_USER_A,
        domain: 'app-a.devhost.cloud',
        cpanel_username: 'appauser',
        plan_id: 'starter',
        plan_name: 'Starter Cloud',
        price_bdt: 499,
        ram_limit_mb: 2048,
        status: 'active',
        next_due_date: new Date(Date.now() + 18 * 86400000).toISOString(),
      },
      {
        id: 'srv-b',
        user_id: UUID_USER_B,
        domain: 'app-b.devhost.cloud',
        cpanel_username: 'appbuser',
        plan_id: 'starter',
        plan_name: 'Starter Cloud',
        price_bdt: 499,
        ram_limit_mb: 2048,
        status: 'active',
        next_due_date: new Date(Date.now() + 18 * 86400000).toISOString(),
      },
    ],
    domains: [
      {
        id: 'dom-a',
        user_id: UUID_USER_A,
        domain_name: 'alpha-client.com',
        registrar_status: 'active',
        registrar_lock: true,
        whois_privacy: true,
        expiry_date: '2027-01-01T00:00:00.000Z',
        nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
      },
    ],
    domain_transfers: [
      {
        id: 'trf-a',
        user_id: UUID_USER_A,
        domain_name: 'transfer-a.com',
        current_step: 2,
        status: 'verifying_epp',
      },
    ],
    service_autoscaling_rules: [
      {
        service_id: 'srv-a',
        user_id: UUID_USER_A,
        autoscale_enabled: true,
        ram_threshold_percent: 85,
        cpu_threshold_percent: 85,
        target_upgrade_plan_slug: 'developer-pro',
        max_monthly_budget_cap_bdt: 1500,
        edge_waf_mode: 'standard',
        blocked_countries: [],
        rate_limit_req_per_min: 300,
      },
    ],
    agency_handover_transfers: [
      {
        id: 'ho-1',
        developer_user_id: UUID_USER_A,
        developer_name: 'User Alpha',
        service_id: 'srv-a',
        client_name: 'User Beta',
        client_email: 'userb@example.com',
        project_title: 'Alpha Storefront',
        plan_slug: 'developer-pro',
        billing_cycle: 'annual',
        developer_setup_fee_bdt: 500,
        hosting_price_bdt: 9590,
        total_due_bdt: 10090,
        handover_token: 'ho_valid_token_123',
        status: 'pending_client_claim',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    ],
    project_deployments: [
      {
        id: 'dep-a-live',
        service_id: 'srv-a',
        user_id: UUID_USER_A,
        commit_sha: 'aaaa111',
        status: 'live_production',
        is_current_production: true,
        build_logs: 'live on srv-a',
        created_at: new Date().toISOString(),
      },
      {
        id: 'dep-b-secret',
        service_id: 'srv-b',
        user_id: UUID_USER_B,
        commit_sha: 'bbbb222',
        status: 'superseded',
        is_current_production: false,
        build_logs: 'srv-b secret release',
        created_at: new Date(Date.now() - 60000).toISOString(),
      },
    ],
    hosting_preview_environments: [
      {
        id: 'prev-a-1',
        service_id: 'srv-a',
        user_id: UUID_USER_A,
        branch_name: 'feat/a',
        pr_number: 11,
        commit_sha: 'aaa1111',
        preview_url: 'https://pr-11-feat-a.app-a.devhost.cloud',
        status: 'ready_live',
        created_at: new Date().toISOString(),
      },
      {
        id: 'prev-b-victim',
        service_id: 'srv-b',
        user_id: UUID_USER_B,
        branch_name: 'feat/b',
        pr_number: 99,
        commit_sha: 'bbb9999',
        preview_url: 'https://pr-99-feat-b.app-b.devhost.cloud',
        status: 'ready_live',
        created_at: new Date().toISOString(),
      },
    ],
    hosting_project_settings: [],
    whm_server_nodes: [],
    user_security_credentials: [],
    security_audit_logs: [],
    fraud_alerts: [],
    financial_profit_ledger: [],
    affiliate_profiles: [],
    affiliate_clicks: [],
    affiliate_commissions: [],
    hosting_virtual_filesystem: [],
    build_jobs: [],
  };
}

const mockStore = vi.hoisted(() => ({
  configured: true,
  sandbox: false,
  authenticated: true,
  activeUserId: 'aaaa1111-1111-4111-8111-111111111111',
  activeRole: 'client' as 'client' | 'admin' | 'superadmin',
  sudoValid: true,
  forceTransactionsInsertError: false,
  signUpCalls: [] as Array<{ email: string; password: string }>,
  adminCreateUserCalls: [] as Array<Record<string, unknown>>,
  getUserMockResult: null as { id: string; email: string } | null,
  r2OverrideHtml: null as string | null,
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
  delete: () => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  neq: (col: string, val: unknown) => MockQueryChain;
  ilike: (col: string, val: string) => MockQueryChain;
  gte: (col: string, val: unknown) => MockQueryChain;
  lte: (col: string, val: unknown) => MockQueryChain;
  in: (col: string, vals: unknown[]) => MockQueryChain;
  filter: (col: string, _op: string, val: unknown) => MockQueryChain;
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryChain;
  limit: (n: number) => MockQueryChain;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
}

function buildQueryBuilder(tableName: keyof MockDbState, state: MockDbState): MockQueryChain {
  const filters: Array<(row: MockRow) => boolean> = [];
  let sortCol: string | null = null;
  let sortAsc = true;
  let maxRows: number | null = null;
  let pendingOp: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
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
    if (maxRows !== null) out = out.slice(0, maxRows);
    return out;
  };

  const execute = (): QueryResult => {
    const rows = state[tableName] as MockRow[];
    if (!Array.isArray(rows)) return { data: null, error: null };

    if (pendingOp === 'insert') {
      if (tableName === 'transactions' && mockStore.forceTransactionsInsertError) {
        return {
          data: null,
          error: { code: '23514', message: 'violates check constraint or trigger failure on transactions' },
        };
      }
      const items = Array.isArray(opPayload) ? opPayload : opPayload ? [opPayload] : [];
      const inserted: MockRow[] = [];
      for (const item of items) {
        if (tableName === 'transactions' && item.trx_id && rows.some((r) => r.trx_id === item.trx_id)) {
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          };
        }
        const rec: MockRow = {
          id: item.id || `${tableName}-${rows.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        rows.push(rec);
        inserted.push(rec);
      }
      return { data: inserted, error: null };
    }

    if (pendingOp === 'upsert') {
      const items = Array.isArray(opPayload) ? opPayload : opPayload ? [opPayload] : [];
      const conflictKey = upsertOpts?.onConflict || 'id';
      const out: MockRow[] = [];
      for (const item of items) {
        const idx = rows.findIndex((r) => r[conflictKey] !== undefined && r[conflictKey] === item[conflictKey]);
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
      const patch = (opPayload || {}) as MockRow;
      const updated: MockRow[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (filters.every((fn) => fn(rows[i]))) {
          rows[i] = { ...rows[i], ...patch };
          updated.push(rows[i]);
        }
      }
      return { data: updated, error: null };
    }

    if (pendingOp === 'delete') {
      const removed: MockRow[] = [];
      for (let i = rows.length - 1; i >= 0; i--) {
        if (filters.every((fn) => fn(rows[i]))) {
          removed.push(rows[i]);
          rows.splice(i, 1);
        }
      }
      return { data: removed, error: null };
    }

    return { data: applyFilters(rows), error: null };
  };

  const chain: MockQueryChain = {
    select: () => chain,
    insert: (p) => {
      pendingOp = 'insert';
      opPayload = p;
      return chain;
    },
    upsert: (p, opts) => {
      pendingOp = 'upsert';
      opPayload = p;
      upsertOpts = opts;
      return chain;
    },
    update: (p) => {
      pendingOp = 'update';
      opPayload = p;
      return chain;
    },
    delete: () => {
      pendingOp = 'delete';
      return chain;
    },
    eq: (col, val) => {
      filters.push((r) => r[col] === val);
      return chain;
    },
    neq: (col, val) => {
      filters.push((r) => r[col] !== val);
      return chain;
    },
    ilike: (col, val) => {
      const needle = val.replace(/%/g, '').toLowerCase();
      filters.push((r) => String(r[col] || '').toLowerCase().includes(needle));
      return chain;
    },
    gte: (col, val) => {
      filters.push((r) => Number(r[col] ?? 0) >= Number(val) || String(r[col] || '') >= String(val));
      return chain;
    },
    lte: (col, val) => {
      filters.push((r) => Number(r[col] ?? 0) <= Number(val) || String(r[col] || '') <= String(val));
      return chain;
    },
    in: (col, vals) => {
      filters.push((r) => vals.includes(r[col]));
      return chain;
    },
    filter: (col, _op, val) => {
      filters.push((r) => String(r[col] || '').toLowerCase() === String(val).toLowerCase());
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
      const arr = Array.isArray(res.data) ? res.data : [];
      return { data: arr[0] ?? null, error: res.error };
    },
    single: async () => {
      const res = execute();
      const arr = Array.isArray(res.data) ? res.data : [];
      if (!arr[0] && !res.error) {
        return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
      }
      return { data: arr[0] ?? null, error: res.error };
    },
    then: (onfulfilled, onrejected) => Promise.resolve(execute()).then(onfulfilled, onrejected),
  };

  return chain;
}

function createMockSupabaseClient(state: MockDbState) {
  return {
    from: (table: keyof MockDbState) => buildQueryBuilder(table, state),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockStore.getUserMockResult },
        error: mockStore.getUserMockResult ? null : { message: 'Invalid token' },
      })),
      signUp: vi.fn(async ({ email, password }: { email: string; password: string }) => {
        mockStore.signUpCalls.push({ email, password });
        return {
          data: {
            user: {
              id: `signup-${mockStore.signUpCalls.length}`,
              email,
            },
          },
          error: null,
        };
      }),
      admin: {
        createUser: vi.fn(async (payload: Record<string, unknown>) => {
          mockStore.adminCreateUserCalls.push(payload);
          return { data: { user: null }, error: { message: 'Should not use auto-confirm createUser' } };
        }),
      },
    },
  };
}

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase');
  const getClient = () => createMockSupabaseClient(mockStore.state);
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => mockStore.configured),
    isDevSandboxMode: vi.fn(() => mockStore.sandbox),
    getServiceSupabase: vi.fn(getClient),
    get supabase() {
      return getClient();
    },
  };
});

vi.mock('@/lib/authGuard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authGuard')>('@/lib/authGuard');

  function getActiveProfile() {
    const found = mockStore.state.profiles.find((p) => p.id === mockStore.activeUserId);
    if (found) return found;
    return {
      id: mockStore.activeUserId,
      email: 'actor@example.com',
      full_name: 'Actor',
      role: mockStore.activeRole,
      wallet_balance_bdt: 0,
    };
  }

  return {
    ...actual,
    requireUser: vi.fn(async () => {
      if (!mockStore.authenticated) {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
      }
      const profile = getActiveProfile();
      const role = profile.role === 'admin' || profile.role === 'superadmin' ? 'admin' : 'client';
      return {
        ok: true,
        user: { id: String(profile.id), email: String(profile.email) },
        profile,
        role,
        token: 'mock-jwt',
      };
    }),
    requireAdmin: vi.fn(async () => {
      if (!mockStore.authenticated) {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
      }
      const profile = getActiveProfile();
      if (profile.role !== 'admin' && profile.role !== 'superadmin') {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
      }
      return {
        ok: true,
        user: { id: String(profile.id), email: String(profile.email) },
        profile,
        role: 'admin',
        token: 'mock-admin-jwt',
      };
    }),
    requireServiceAccess: vi.fn(async (_req: NextRequest, serviceId: string) => {
      if (!mockStore.authenticated) {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
      }
      const profile = getActiveProfile();
      const svc = mockStore.state.hosting_services.find((s) => s.id === serviceId);
      const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';
      if (svc && !isAdmin && svc.user_id !== profile.id) {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
      }
      return {
        ok: true,
        user: { id: String(profile.id), email: String(profile.email) },
        profile,
        role: isAdmin ? 'admin' : 'client',
        via: isAdmin ? 'admin' : 'owner',
        permissions: ['*'],
      };
    }),
    requireDomainAccess: vi.fn(async (_req: NextRequest, domainId: string | null, domainName?: string | null) => {
      if (!mockStore.authenticated) {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
      }
      const profile = getActiveProfile();
      const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';
      const dom = mockStore.state.domains.find(
        (d) => (domainId && d.id === domainId) || (domainName && d.domain_name === domainName)
      );
      if (dom && !isAdmin && dom.user_id !== profile.id) {
        const { NextResponse } = await import('next/server');
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
      }
      return {
        ok: true,
        user: { id: String(profile.id), email: String(profile.email) },
        profile,
        role: isAdmin ? 'admin' : 'client',
        via: isAdmin ? 'admin' : 'owner',
      };
    }),
    verifySudoToken: vi.fn(async () => mockStore.sudoValid),
  };
});

vi.mock('@/lib/paymentGateways', async () => {
  const actual = await vi.importActual<typeof import('@/lib/paymentGateways')>('@/lib/paymentGateways');
  return {
    ...actual,
    executeBkashPayment: vi.fn(async (paymentID: string) => ({
      ok: true,
      trxID: `BKASH-TRX-${paymentID}`,
      merchantInvoiceNumber: 'DEV-INV-BKASH-TEST',
      amountBDT: 499,
    })),
  };
});

vi.mock('@/lib/paymentFulfillment', async () => {
  const actual = await vi.importActual<typeof import('@/lib/paymentFulfillment')>('@/lib/paymentFulfillment');
  return {
    ...actual,
    fulfillPaidInvoiceAndAffiliate: vi.fn(async () => ({
      ok: true,
      alreadyPaid: false,
      provisionedServiceId: 'srv-fulfilled',
      affiliateCommissionAddedBDT: 0,
    })),
  };
});

vi.mock('@/lib/registrarClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/registrarClient')>('@/lib/registrarClient');
  return {
    ...actual,
    registerDomainWithRegistrar: vi.fn(async ({ domain }: { domain: string }) => ({
      ok: true,
      provider: 'resellerclub',
      mode: 'live_api',
      orderId: `rc-reg-${domain}`,
      message: `Registered ${domain}`,
    })),
    renewDomainWithRegistrar: vi.fn(async ({ domain }: { domain: string }) => ({
      ok: true,
      provider: 'resellerclub',
      mode: 'live_api',
      orderId: `rc-ren-${domain}`,
      message: `Renewed ${domain}`,
    })),
    transferDomainWithRegistrar: vi.fn(async ({ domain }: { domain: string }) => ({
      ok: true,
      provider: 'resellerclub',
      mode: 'live_api',
      orderId: `rc-trf-${domain}`,
      message: `Transfer submitted for ${domain}`,
    })),
  };
});

vi.mock('@/lib/cloudflareClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cloudflareClient')>('@/lib/cloudflareClient');
  return {
    ...actual,
    isCloudflareConfigured: vi.fn(() => false),
    ensureCloudflareZone: vi.fn(async () => ({ ok: true, zoneId: 'cf-zone-1', nameServers: ['ns1.cf.net', 'ns2.cf.net'] })),
  };
});

vi.mock('@/lib/cloudflareStorageQueue', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cloudflareStorageQueue')>('@/lib/cloudflareStorageQueue');
  return {
    ...actual,
    isR2ArtifactsConfigured: vi.fn(() => (mockStore.r2OverrideHtml !== null ? true : actual.isR2ArtifactsConfigured())),
    getR2Artifact: vi.fn(async (key: string) => {
      if (mockStore.r2OverrideHtml !== null) {
        if (key.endsWith('/current.json')) {
          const jsonText = JSON.stringify({
            serviceId: 'srv-a',
            domain: 'app-a.devhost.cloud',
            stackSlug: 'static_edge',
            releaseId: 'rel-edge-1',
            releasePrefix: 'sites/app-a.devhost.cloud/releases/rel-edge-1',
            entryFile: 'index.html',
          });
          return {
            found: true,
            key,
            bodyText: jsonText,
            bodyBuffer: new TextEncoder().encode(jsonText),
            contentType: 'application/json',
            etag: '"etag-manifest"',
            mode: 'sandbox' as const,
          };
        }
        return {
          found: true,
          key,
          bodyText: mockStore.r2OverrideHtml,
          bodyBuffer: new TextEncoder().encode(mockStore.r2OverrideHtml),
          contentType: 'text/html; charset=utf-8',
          etag: '"etag-test"',
          mode: 'sandbox' as const,
        };
      }
      return actual.getR2Artifact(key);
    }),
  };
});

vi.mock('@/lib/computeAgentClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/computeAgentClient')>('@/lib/computeAgentClient');
  return {
    ...actual,
    scaleContainerResourcesOnAgent: vi.fn(async () => ({
      ok: true,
      status: 200,
      mode: 'live_agent',
      data: { scaled: true },
    })),
  };
});

import { GET as edgeSiteGet } from '@/app/api/edge-site/route';
import { isEdgeExecutionOriginIsolated } from '@/lib/edgeIsolation';
import { deployStaticEdgeRelease, clearSandboxStorageForTest } from '@/lib/cloudflareStorageQueue';
import { POST as createSessionPost } from '@/app/api/payments/create-session/route';
import { GET as bkashCallbackGet } from '@/app/api/payments/bkash/callback/route';
import { POST as registrarPost } from '@/app/api/registrar/route';
import { POST as domainsManagePost } from '@/app/api/domains/manage/route';
import { POST as autoscalerPost } from '@/app/api/hosting/autoscaler/route';
import { GET as handoverGet, POST as handoverPost, PUT as handoverPut } from '@/app/api/agency/handover/route';
import { POST as deploymentsPost } from '@/app/api/hosting/deployments/route';
import { POST as previewsPost } from '@/app/api/hosting/previews/route';
import { PUT as projectPut } from '@/app/api/hosting/project/route';
import { GET as nodesCrmGet, POST as nodesCrmPost } from '@/app/api/admin/nodes-crm/route';
import { POST as twoFactorPost } from '@/app/api/auth/2fa/route';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { hashSecurityPin, verifySecurityPin } from '@/lib/totpEngine';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';

describe('Phase 6: Zero-Trust Security Lockdown, RLS & Billing/Domain Integrity', () => {
  const origEnv = { ...process.env };
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...origEnv };
    clearSandboxStorageForTest();
    mockStore.state = createInitialDbState();
    mockStore.configured = true;
    mockStore.sandbox = false;
    mockStore.authenticated = true;
    mockStore.activeUserId = UUID_USER_A;
    mockStore.activeRole = 'client';
    mockStore.sudoValid = true;
    mockStore.forceTransactionsInsertError = false;
    mockStore.signUpCalls = [];
    mockStore.adminCreateUserCalls = [];
    mockStore.getUserMockResult = null;
    mockStore.r2OverrideHtml = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...origEnv };
    globalThis.fetch = origFetch;
  });

  describe('1. Supabase RLS Migration, Cron Hardening & Superadmin Privilege Resolution', () => {
    it('phase6_security_rls_lockdown.sql locks credentials, logs, billing, and owned compute tables to server-side writes', () => {
      const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', 'phase6_security_rls_lockdown.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');

      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_admin()');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_admin_user()');
      expect(sql).toContain("role IN ('admin', 'superadmin')");
      expect(sql).toContain('SECURITY DEFINER SET search_path = public');

      // Credentials locked exclusively to service_role
      expect(sql).toContain('"phase6_security_credentials_service_only"');
      expect(sql).toContain('ON public.user_security_credentials');
      expect(sql).toContain('FOR ALL TO service_role');

      // Login attempts locked against anonymous inserts
      expect(sql).toContain('"phase6_login_attempts_admin_select"');

      // Critical financial & compute tables locked to SELECT-only for owners
      for (const tbl of [
        'affiliate_payouts',
        'transactions',
        'agency_handover_transfers',
        'hosting_services',
        'domains',
        'invoices',
        'service_autoscaling_rules',
        'hosting_project_settings',
        'project_deployments',
        'hosting_preview_environments',
        'domain_transfers',
      ]) {
        expect(sql).toContain(tbl);
      }
      expect(sql).toContain('FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin())');
    });

    it('supabase/cron_jobs.sql contains zero hardcoded bearer secrets or production hostnames', () => {
      const cronSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'cron_jobs.sql'), 'utf8');
      expect(cronSql).not.toContain('devhost_cron_secret_key');
      expect(cronSql).not.toContain('https://devhostcloud.com');
      expect(cronSql).toContain('<YOUR_STRONG_CRON_SECRET>');
      expect(cronSql).toContain('<YOUR_PRODUCTION_DOMAIN>');
    });

    it('real authGuard.requireAdmin recognizes superadmin profiles consistently with RLS', async () => {
      const actualAuthGuard = await vi.importActual<typeof import('@/lib/authGuard')>('@/lib/authGuard');
      mockStore.getUserMockResult = { id: UUID_SUPERADMIN, email: 'founder@devhostcloud.com' };

      const req = new NextRequest('https://devhostcloud.com/api/admin/nodes-crm', {
        headers: { authorization: 'Bearer valid-superadmin-token' },
      });
      const authRes = await actualAuthGuard.requireAdmin(req);
      expect(authRes.ok).toBe(true);
      if (authRes.ok) {
        expect(authRes.role).toBe('admin');
        expect(authRes.user.id).toBe(UUID_SUPERADMIN);
      }
    });
  });

  describe('2. Edge Site Origin Isolation & Strict CSP Sandbox Headers', () => {
    it('fails closed (403) on primary dashboard origin when EDGE_SITES_ORIGIN is configured or in production without isolated origin', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.EDGE_SITES_ORIGIN;
      delete process.env.EDGE_SITES_WILDCARD_DOMAIN;
      mockStore.r2OverrideHtml = '<html><body><script>alert(document.cookie)</script></body></html>';

      const unisolatedReq = new NextRequest('https://devhostcloud.com/api/edge-site?site=app-a.devhost.cloud');
      expect(isEdgeExecutionOriginIsolated(unisolatedReq).allowed).toBe(false);
      const resUnisolated = await edgeSiteGet(unisolatedReq);
      expect(resUnisolated.status).toBe(403);

      process.env.EDGE_SITES_ORIGIN = 'https://edge-sandbox.example';
      const dashboardReqWithConfig = new NextRequest('https://devhostcloud.com/api/edge-site?site=app-a.devhost.cloud');
      expect(isEdgeExecutionOriginIsolated(dashboardReqWithConfig).allowed).toBe(false);
      const resDashboard = await edgeSiteGet(dashboardReqWithConfig);
      expect(resDashboard.status).toBe(403);
    });

    it('serves static HTML on isolated origin / localhost with strict sandbox CSP (no allow-same-origin) and nosniff headers', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.EDGE_SITES_ORIGIN = 'https://edge-sandbox.example';
      mockStore.r2OverrideHtml = '<html><body>Hello Edge</body></html>';

      const isolatedReq = new NextRequest('https://edge-sandbox.example/api/edge-site?site=app-a.devhost.cloud');
      const res = await edgeSiteGet(isolatedReq);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');

      const csp = res.headers.get('Content-Security-Policy') || '';
      expect(csp).toContain('sandbox allow-scripts');
      expect(csp).not.toContain('allow-same-origin');
      expect(csp).toContain("form-action 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('deployStaticEdgeRelease prefixes edgeRouterUrl with EDGE_SITES_ORIGIN when configured', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      process.env.DEV_SANDBOX_MODE = 'true';
      mockStore.sandbox = true;
      mockStore.configured = false;
      process.env.EDGE_SITES_ORIGIN = 'https://sites.devhost-edge.example';

      const deployRes = await deployStaticEdgeRelease({
        serviceId: 'srv-a',
        domain: 'app-a.devhost.cloud',
        releaseId: 'rel-edge-1',
        stackSlug: 'static_edge',
        stackName: 'Static Edge',
        files: [{ path: 'index.html', content: '<h1>OK</h1>', contentType: 'text/html' }],
      });

      expect(deployRes.ok).toBe(true);
      expect(deployRes.edgeRouterUrl.startsWith('https://sites.devhost-edge.example/api/edge-site?site=srv-a')).toBe(true);
    });
  });

  describe('3. Payment Session Tamper Blocking & Fail-Closed Callback Ledger', () => {
    it('rejects customBundleTotal client bypass and unknown plan slugs with HTTP 400', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_phase6_only';

      const tamperedBundleReq = new NextRequest('https://devhostcloud.com/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'stripe',
          orderType: 'hosting_order',
          amountBDT: 5,
          items: [{ customBundleTotal: true, name: 'Hacked 5 BDT Hosting' }],
        }),
      });
      const resBundle = await createSessionPost(tamperedBundleReq);
      expect(resBundle.status).toBe(400);

      const unknownPlanReq = new NextRequest('https://devhostcloud.com/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'stripe',
          orderType: 'hosting_order',
          planId: 'nonexistent-free-plan',
          amountBDT: 1,
        }),
      });
      const resUnknown = await createSessionPost(unknownPlanReq);
      expect(resUnknown.status).toBe(400);
    });

    it('enforces authoritative catalog TLD pricing on domain_registration and rejects client underpricing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_phase6_only';

      const underpricedDomainReq = new NextRequest('https://devhostcloud.com/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'stripe',
          orderType: 'domain_registration',
          domain: 'premium-target.com',
          years: 1,
          amountBDT: 10,
        }),
      });
      const resUnder = await createSessionPost(underpricedDomainReq);
      expect(resUnder.status).toBe(400);
      const jsonUnder = await resUnder.json();
      expect(String(jsonUnder.error)).toContain('Price tampering');

      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: 'cs_test_domain_reg',
            url: 'https://checkout.stripe.com/c/pay/cs_test_domain_reg',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      ) as unknown as typeof fetch;

      const legitDomainReq = new NextRequest('https://devhostcloud.com/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'stripe',
          orderType: 'domain_registration',
          domain: 'premium-target.com',
          years: 1,
          amountBDT: 1450,
        }),
      });
      const resLegit = await createSessionPost(legitDomainReq);
      expect(resLegit.status).toBe(200);
      const insertedInv = mockStore.state.invoices.find((i) => i.order_type === 'domain_registration');
      expect(insertedInv?.total_bdt).toBe(1450);
      expect(insertedInv?.bundled_domain_name).toBe('premium-target.com');
    });

    it('bKash callback aborts fulfillment and redirects with ledger_error when non-23505 transactions insert fails', async () => {
      mockStore.state.invoices.push({
        id: 'inv-bkash-1',
        invoice_number: 'DEV-INV-BKASH-TEST',
        user_id: UUID_USER_A,
        total_bdt: 499,
        status: 'unpaid',
        order_type: 'hosting_order',
      });
      mockStore.forceTransactionsInsertError = true;

      const cbReq = new NextRequest(
        'https://devhostcloud.com/api/payments/bkash/callback?paymentID=PAY-ERR-1&status=success&invoice=DEV-INV-BKASH-TEST'
      );
      const res = await bkashCallbackGet(cbReq);

      expect(res.status).toBe(307);
      const loc = res.headers.get('location') || '';
      expect(loc).toContain('payment=failed');
      expect(loc).toContain('reason=ledger_error');
      expect(fulfillPaidInvoiceAndAffiliate).not.toHaveBeenCalled();
    });
  });

  describe('4. Registrar Billing Gates, Transfer Admin Lock & Handover Protection', () => {
    it('blocks unpaid register/renew/transfer in /api/registrar and /api/domains/manage with HTTP 402 PAYMENT_REQUIRED', async () => {
      const regReq = new NextRequest('https://devhostcloud.com/api/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', domain: 'unpaid-site.com', years: 1 }),
      });
      const resReg = await registrarPost(regReq);
      expect(resReg.status).toBe(402);

      const renewReq = new NextRequest('https://devhostcloud.com/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew_domain',
          domainId: 'dom-a',
          domainName: 'alpha-client.com',
          years: 1,
        }),
      });
      const resRenew = await domainsManagePost(renewReq);
      expect(resRenew.status).toBe(402);

      const transferReq = new NextRequest('https://devhostcloud.com/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate_transfer',
          domainName: 'unpaid-transfer.com',
          eppCode: 'EPP-1234-XYZ',
          deferRegistrarSubmit: false,
        }),
      });
      const resTrf = await domainsManagePost(transferReq);
      expect(resTrf.status).toBe(402);
    });

    it('blocks client users from spoofing update_transfer_step to Step 5 (403 Forbidden)', async () => {
      const spoofStepReq = new NextRequest('https://devhostcloud.com/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_transfer_step',
          transferId: 'trf-a',
          transferStep: 5,
        }),
      });
      const res = await domainsManagePost(spoofStepReq);
      expect(res.status).toBe(403);
      expect(mockStore.state.domain_transfers[0].current_step).toBe(2);
    });

    it('agency handover requires auth & participant check on GET and payment verification on PUT claim', async () => {
      // Unauthenticated GET blocked
      mockStore.authenticated = false;
      const unauthGet = await handoverGet(new NextRequest('https://devhostcloud.com/api/agency/handover?token=ho_valid_token_123'));
      expect(unauthGet.status).toBe(401);

      // Non-participant authenticated user blocked with 403
      mockStore.authenticated = true;
      mockStore.activeUserId = UUID_ATTACKER;
      const outsiderGet = await handoverGet(new NextRequest('https://devhostcloud.com/api/agency/handover?token=ho_valid_token_123'));
      expect(outsiderGet.status).toBe(403);

      // Client B attempts claim WITHOUT payment or invoice -> 402 PAYMENT_REQUIRED
      mockStore.activeUserId = UUID_USER_B;
      const unpaidPut = await handoverPut(
        new NextRequest('https://devhostcloud.com/api/agency/handover', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoverToken: 'ho_valid_token_123' }),
        })
      );
      expect(unpaidPut.status).toBe(402);
      expect(mockStore.state.hosting_services[0].user_id).toBe(UUID_USER_A);

      // Client B claims WITH paid handover invoice -> succeeds & transfers hosting_services ownership
      mockStore.state.invoices.push({
        id: 'inv-ho-paid',
        invoice_number: 'DEV-INV-HO-1',
        user_id: UUID_USER_B,
        total_bdt: 10090,
        status: 'paid',
        trx_id: 'TRX-HO-999',
        order_type: 'agency_handover',
        items: [{ handoverToken: 'ho_valid_token_123' }],
      });

      const paidPut = await handoverPut(
        new NextRequest('https://devhostcloud.com/api/agency/handover', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoverToken: 'ho_valid_token_123', invoiceNumber: 'DEV-INV-HO-1' }),
        })
      );
      expect(paidPut.status).toBe(200);
      expect(mockStore.state.hosting_services[0].user_id).toBe(UUID_USER_B);
      expect(mockStore.state.agency_handover_transfers[0].status).toBe('claimed_and_paid');
    });

    it('agency handover POST rejects client-spoofed below-catalog hostingPriceBDT and sets authoritative price', async () => {
      const postRes = await handoverPost(
        new NextRequest('https://devhostcloud.com/api/agency/handover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            developerName: 'User Alpha',
            serviceId: 'srv-a',
            clientName: 'Client Beta',
            clientEmail: 'userb@example.com',
            projectTitle: 'Ecom Launch',
            planSlug: 'developer-pro',
            billingCycle: 'monthly',
            developerSetupFeeBDT: 500,
            hostingPriceBDT: 1, // spoofed price
          }),
        })
      );
      expect(postRes.status).toBe(200);
      const data = await postRes.json();
      expect(data.handover.hosting_price_bdt).toBe(999);
      expect(data.handover.total_payable_bdt).toBe(1499);
    });
  });

  describe('5. Autoscaler Authoritative Wallet & Sudo Step-Up Verification', () => {
    it('enforces Sudo on manual scale_now, ignores spoofed client balance/price, returns 402 on low DB wallet, and debits on valid upgrade', async () => {
      process.env.COMPUTE_AGENT_URL = 'https://agent.devhost.test';
      process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'agent_test_secret_123';

      // No Sudo -> 403
      mockStore.sudoValid = false;
      const noSudoRes = await autoscalerPost(
        new NextRequest('https://devhostcloud.com/api/hosting/autoscaler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scale_now',
            serviceId: 'srv-a',
            walletBalanceBDT: 999999,
            targetPlanMonthlyBDT: 1,
          }),
        })
      );
      expect(noSudoRes.status).toBe(403);

      // Sudo valid, DB wallet low (10 BDT) even though client claims 999999 -> 402
      mockStore.sudoValid = true;
      mockStore.state.profiles[0].wallet_balance_bdt = 10;
      const lowWalletRes = await autoscalerPost(
        new NextRequest('https://devhostcloud.com/api/hosting/autoscaler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scale_now',
            serviceId: 'srv-a',
            walletBalanceBDT: 999999,
            targetPlanMonthlyBDT: 1,
          }),
        })
      );
      expect(lowWalletRes.status).toBe(402);

      // Sufficient DB wallet (2500 BDT) -> atomic debit, paid invoice, service upgraded to developer-pro
      mockStore.state.profiles[0].wallet_balance_bdt = 2500;
      const okRes = await autoscalerPost(
        new NextRequest('https://devhostcloud.com/api/hosting/autoscaler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scale_now',
            serviceId: 'srv-a',
            remainingDaysInCycle: 18,
          }),
        })
      );
      expect(okRes.status).toBe(200);
      expect(Number(mockStore.state.profiles[0].wallet_balance_bdt)).toBeLessThan(2500);
      expect(mockStore.state.hosting_services[0].plan_id).toBe('developer-pro');
      expect(mockStore.state.hosting_services[0].price_bdt).toBe(999);
      const autoInv = mockStore.state.invoices.find((i) => i.order_type === 'autoscaler_upgrade');
      expect(autoInv?.status).toBe('paid');
    });
  });

  describe('6. Cross-Service IDOR, Mass Assignment & Encrypted Admin Credentials', () => {
    it('blocks cross-service rollback on deployments and cross-service promote/destroy on previews (404)', async () => {
      const rollbackRes = await deploymentsPost(
        new NextRequest('https://devhostcloud.com/api/hosting/deployments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rollback',
            serviceId: 'srv-a',
            targetDeploymentId: 'dep-b-secret',
          }),
        })
      );
      expect(rollbackRes.status).toBe(404);
      expect(mockStore.state.project_deployments[1].status).toBe('superseded');

      const promoteRes = await previewsPost(
        new NextRequest('https://devhostcloud.com/api/hosting/previews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote_to_prod',
            serviceId: 'srv-a',
            previewId: 'prev-b-victim',
          }),
        })
      );
      expect(promoteRes.status).toBe(404);
      expect(mockStore.state.hosting_preview_environments[1].status).toBe('ready_live');

      const destroyRes = await previewsPost(
        new NextRequest('https://devhostcloud.com/api/hosting/previews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'destroy_preview',
            serviceId: 'srv-a',
            previewId: 'prev-b-victim',
          }),
        })
      );
      expect(destroyRes.status).toBe(404);
      expect(mockStore.state.hosting_preview_environments[1].status).toBe('ready_live');
    });

    it('strips unallowlisted fields (user_id, service_id, webhook_secret_token) in PUT /api/hosting/project', async () => {
      const putRes = await projectPut(
        new NextRequest('https://devhostcloud.com/api/hosting/project', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: 'srv-a',
            settings: {
              framework_preset: 'nextjs_standalone',
              user_id: UUID_ATTACKER,
              service_id: 'srv-b',
              webhook_secret_token: 'whsec_attacker_injected',
            },
          }),
        })
      );
      expect(putRes.status).toBe(200);
      const saved = mockStore.state.hosting_project_settings[0];
      expect(saved.service_id).toBe('srv-a');
      expect(saved.user_id).toBe(UUID_USER_A);
      expect(saved.webhook_secret_token).toBeUndefined();
      expect(saved.framework_preset).toBe('nextjs_standalone');
    });

    it('encrypts whmApiToken at rest in /api/admin/nodes-crm and omits ciphertext from GET responses', async () => {
      mockStore.activeUserId = UUID_ADMIN;
      mockStore.activeRole = 'admin';
      mockStore.sudoValid = true;
      process.env.ENV_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const saveRes = await nodesCrmPost(
        new NextRequest('https://devhostcloud.com/api/admin/nodes-crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_node',
            nodeData: {
              nodeCode: 'SG-EDGE-01',
              nodeName: 'Singapore Core 01',
              datacenterLocation: 'Singapore',
              ipv4Address: '203.0.113.10',
              whmHostname: 'sg01.example.net',
              whmUsername: 'root',
              whmApiToken: 'WHM_SUPER_SECRET_TOKEN_XYZ',
              monthlyCostBdt: 3500,
              maxSlots: 80,
              maxDiskGb: 500,
              nodeDriver: 'whm',
            },
          }),
        })
      );
      expect(saveRes.status).toBe(200);
      const storedNode = mockStore.state.whm_server_nodes[0];
      expect(String(storedNode.whm_api_token_encrypted)).not.toContain('WHM_SUPER_SECRET_TOKEN_XYZ');
      expect(String(storedNode.whm_api_token_encrypted).length).toBeGreaterThan(20);

      const getRes = await nodesCrmGet(new NextRequest('https://devhostcloud.com/api/admin/nodes-crm'));
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.nodes[0].has_whm_token).toBe(true);
      expect(getJson.nodes[0].whm_api_token_encrypted).toBeUndefined();
    });
  });

  describe('7. Salted PBKDF2 Sudo PIN, 2FA Brute-Force Lockout & Public Registration Hardening', () => {
    it('hashes Sudo PINs with unique-salt PBKDF2-SHA256 while preserving legacy SHA-256 verification compatibility', async () => {
      const h1 = await hashSecurityPin('482910');
      const h2 = await hashSecurityPin('482910');

      expect(h1.startsWith('pbkdf2_sha256$100000$')).toBe(true);
      expect(h1).not.toBe(h2);
      expect(await verifySecurityPin('482910', h1)).toBe(true);
      expect(await verifySecurityPin('000000', h1)).toBe(false);

      // Legacy unsalted SHA-256 hash compatibility check
      const rawBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('devhost_sudo_pin_482910'));
      const legacyHex = Array.from(new Uint8Array(rawBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(await verifySecurityPin('482910', legacyHex)).toBe(true);
    });

    it('enforces HTTP 429 rate limit on repeated invalid /api/auth/2fa verify_sudo attempts', async () => {
      const pinHash = await hashSecurityPin('654321');
      mockStore.activeUserId = UUID_ATTACKER;
      mockStore.state.user_security_credentials.push({
        user_id: UUID_ATTACKER,
        totp_enabled: false,
        sudo_security_pin_hash: pinHash,
        backup_recovery_hashes: [],
      });

      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await twoFactorPost(
          new NextRequest('https://devhostcloud.com/api/auth/2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_sudo', sudoPin: '111111' }),
          })
        );
        expect(res.status).toBe(401);
      }

      const throttledRes = await twoFactorPost(
        new NextRequest('https://devhostcloud.com/api/auth/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify_sudo', sudoPin: '654321' }),
        })
      );
      expect(throttledRes.status).toBe(429);
    });

    it('enforces >= 8-char password policy and uses email-verified supabase.auth.signUp instead of auto-confirm admin.createUser', async () => {
      const shortPassRes = await registerPost(
        new NextRequest('https://devhostcloud.com/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.55' },
          body: JSON.stringify({
            fullName: 'Short Pass',
            email: 'short@example.com',
            password: '1234567',
          }),
        })
      );
      expect(shortPassRes.status).toBe(400);

      const okRes = await registerPost(
        new NextRequest('https://devhostcloud.com/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.56' },
          body: JSON.stringify({
            fullName: 'Verified Signup',
            email: 'verified.signup@example.com',
            password: 'StrongPassword#2026',
            role: 'admin',
            wallet_balance_bdt: 99999,
          }),
        })
      );
      expect(okRes.status).toBe(200);
      expect(mockStore.signUpCalls).toHaveLength(1);
      expect(mockStore.adminCreateUserCalls).toHaveLength(0);
    });
  });
});
