import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  user_security_credentials: MockRow[];
  customer_developer_profiles: MockRow[];
  hosting_services: MockRow[];
  hosting_project_settings: MockRow[];
  hosting_virtual_filesystem: MockRow[];
  hosting_databases: MockRow[];
  hosting_organization_members: MockRow[];
  terminal_and_sql_logs: MockRow[];
  project_env_variables: MockRow[];
  project_deployments: MockRow[];
  compute_build_jobs: MockRow[];
  domains: MockRow[];
  domain_dns_records: MockRow[];
  invoices: MockRow[];
  catalog_hosting_plans: MockRow[];
  catalog_domain_tlds: MockRow[];
  promo_codes: MockRow[];
  whm_server_nodes: MockRow[];
  platform_settings: MockRow[];
  security_audit_logs: MockRow[];
  api_request_logs: MockRow[];
  [extraTable: string]: MockRow[];
}

const UUID_USER_A = '11111111-1111-4111-8111-111111111111';
const UUID_USER_B = '22222222-2222-4222-8222-222222222222';
const UUID_ADMIN = '33333333-3333-4333-8333-333333333333';
const UUID_SRV_A = 'aaaa1111-1111-4111-8111-111111111111';
const UUID_SRV_B = 'bbbb2222-2222-4222-8222-222222222222';

const PAT_READ_ONLY = 'dh_live_readonly_phase12_secret_token';
const PAT_DEPLOY_OWNER = 'dh_live_deployown_phase12_secret_token';
const PAT_DEPLOY_OTHER = 'dh_live_deployoth_phase12_secret_token';
const PAT_REVOKED = 'dh_live_revoked_phase12_secret_token';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function createInitialState(): Promise<MockDbState> {
  const [readHash, deployOwnHash, deployOtherHash, revokedHash] = await Promise.all([
    sha256Hex(PAT_READ_ONLY),
    sha256Hex(PAT_DEPLOY_OWNER),
    sha256Hex(PAT_DEPLOY_OTHER),
    sha256Hex(PAT_REVOKED),
  ]);

  return {
    profiles: [
      {
        id: UUID_USER_A,
        email: 'alpha@example.com',
        full_name: 'Alpha Developer',
        role: 'client',
        wallet_balance_bdt: 2500,
      },
      {
        id: UUID_USER_B,
        email: 'beta@example.com',
        full_name: 'Beta Tenant',
        role: 'client',
        wallet_balance_bdt: 1500,
      },
      {
        id: UUID_ADMIN,
        email: 'founder@devhostcloud.com',
        full_name: 'Founder Admin',
        role: 'admin',
        wallet_balance_bdt: 99000,
      },
    ],
    user_security_credentials: [],
    customer_developer_profiles: [
      {
        user_id: UUID_USER_A,
        personal_api_tokens: [
          {
            id: 'pat-ro',
            token_hash: readHash,
            scopes: ['dns:read'],
            revoked: false,
            status: 'active',
          },
          {
            id: 'pat-deploy-a',
            token_hash: deployOwnHash,
            scopes: ['git:deploy'],
            revoked: false,
            status: 'active',
          },
          {
            id: 'pat-revoked',
            token_hash: revokedHash,
            scopes: ['*'],
            revoked: true,
            status: 'revoked',
          },
        ],
      },
      {
        user_id: UUID_USER_B,
        personal_api_tokens: [
          {
            id: 'pat-deploy-b',
            token_hash: deployOtherHash,
            scopes: ['git:deploy'],
            revoked: false,
            status: 'active',
          },
        ],
      },
    ],
    hosting_services: [
      {
        id: UUID_SRV_A,
        user_id: UUID_USER_A,
        domain: 'alpha-app.devhostcloud.com',
        cpanel_username: 'alphaapp',
        package_name: 'Developer Pro',
        status: 'active',
        ram_limit_mb: 2048,
        cpu_cores: 2,
        disk_limit_gb: 5,
      },
      {
        id: UUID_SRV_B,
        user_id: UUID_USER_B,
        domain: 'beta-app.devhostcloud.com',
        cpanel_username: 'betaapp',
        package_name: 'Developer Pro',
        status: 'active',
        ram_limit_mb: 2048,
        cpu_cores: 2,
        disk_limit_gb: 5,
      },
    ],
    hosting_project_settings: [
      {
        service_id: UUID_SRV_A,
        user_id: UUID_USER_A,
        stack_slug: 'nextjs-15-standalone',
        runtime_family: 'node_container',
        runtime_version: '22',
        git_branch: 'main',
      },
    ],
    hosting_virtual_filesystem: [
      {
        id: 'vf-a-1',
        service_id: UUID_SRV_A,
        user_id: UUID_USER_A,
        file_path: '/public_html/server.js',
        file_name: 'server.js',
        is_directory: false,
        size_bytes: 120,
        permissions_octal: '0644',
        mime_type: 'application/javascript',
        content_text: 'console.log("alpha");',
        updated_at: new Date().toISOString(),
      },
    ],
    hosting_databases: [
      {
        id: 'db-a-1',
        service_id: UUID_SRV_A,
        user_id: UUID_USER_A,
        db_engine: 'PostgreSQL 16',
        db_name: 'alphaapp_main',
        db_username: 'alphaapp_user',
        db_password_hash: 'enc:redacted',
        remote_access_ips: ['127.0.0.1'],
        created_at: new Date().toISOString(),
      },
    ],
    hosting_organization_members: [],
    terminal_and_sql_logs: [],
    project_env_variables: [],
    project_deployments: [],
    compute_build_jobs: [],
    domains: [],
    domain_dns_records: [],
    invoices: [
      {
        id: 'inv-row-dom-1',
        invoice_number: 'INV-DOM-1001',
        user_id: UUID_USER_A,
        status: 'paid',
        order_type: 'domain_registration',
        billing_cycle: 'annual',
        free_domain_bundle_applied: false,
        bundled_domain_name: 'brandnew-entitled.com',
        items: [{ desc: 'Domain Registration: brandnew-entitled.com (1 Year)', domain: 'brandnew-entitled.com', amount: 1450 }],
        domain_entitlement_consumed: false,
        domain_entitlement_consumed_at: null,
      },
      {
        id: 'inv-row-replay',
        invoice_number: 'INV-DOM-REPLAY',
        user_id: UUID_USER_A,
        status: 'paid',
        order_type: 'domain_registration',
        billing_cycle: 'annual',
        free_domain_bundle_applied: false,
        bundled_domain_name: 'replay-theft.com',
        items: [{ desc: 'Domain Registration: replay-theft.com (1 Year)', domain: 'replay-theft.com', amount: 1450 }],
        domain_entitlement_consumed: true,
        domain_entitlement_consumed_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    catalog_hosting_plans: [
      {
        id: 2,
        slug: 'developer-pro',
        name_en: 'Developer Pro',
        name_bn: 'ডেভেলপার প্রো',
        category: 'developer',
        selling_price_monthly_bdt: 450,
        unit_server_cost_bdt: 95,
        min_owner_profit_bdt: 220,
        max_affiliate_pool_bdt: 135,
        storage_gb: 5,
        ram_mb: 2048,
        cpu_cores: 2,
        inode_limit: 300000,
        sort_order: 2,
      },
    ],
    catalog_domain_tlds: [
      {
        tld: '.com',
        category: 'popular',
        reg_price_bdt: 1450,
        renew_price_bdt: 1550,
        transfer_price_bdt: 1400,
        registrar_cost_bdt: 1120,
        owner_net_profit_reg_bdt: 330,
      },
    ],
    promo_codes: [
      {
        id: 'promo-1',
        code: 'FOUNDER50',
        discount_value: 50,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    whm_server_nodes: [
      {
        id: 'node-sg1',
        node_code: 'sg1',
        node_name: 'Singapore Equinix SG1',
        datacenter_location: 'Singapore (SG1)',
        whm_hostname: 'internal-whm-01.devhostcloud.internal',
        max_cpanel_slots: 100,
        used_cpanel_slots: 12,
        max_disk_gb: 2000,
        allocated_disk_gb: 300,
        actual_physical_disk_gb: 140,
        is_healthy: true,
        status_message: 'Operational',
        auto_provision_enabled: true,
        created_at: new Date().toISOString(),
      },
    ],
    platform_settings: [],
    security_audit_logs: [],
    api_request_logs: [],
  };
}

const mockStore = vi.hoisted(() => ({
  configured: true,
  sandbox: true,
  registrarShouldFail: false,
  state: null as unknown as MockDbState,
}));

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

interface MockQueryChain extends PromiseLike<QueryResult> {
  select: (cols?: string) => MockQueryChain;
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
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryChain;
  limit: (n: number) => MockQueryChain;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
}

function projectColumns(rows: MockRow[], selectCols?: string): MockRow[] {
  if (!selectCols || selectCols.trim() === '*' || selectCols.includes('(')) {
    return rows.map((r) => ({ ...r }));
  }
  const cols = selectCols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (cols.length === 0) return rows.map((r) => ({ ...r }));
  return rows.map((row) => {
    const projected: MockRow = {};
    for (const c of cols) {
      if (c in row) projected[c] = row[c];
    }
    return projected;
  });
}

function buildQueryBuilder(tableName: string, state: MockDbState): MockQueryChain {
  if (!Array.isArray(state[tableName])) {
    state[tableName] = [];
  }
  const filters: Array<(row: MockRow) => boolean> = [];
  let sortCol: string | null = null;
  let sortAsc = true;
  let maxRows: number | null = null;
  let selectCols: string | undefined;
  let pendingOp: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  let opPayload: MockRow | MockRow[] | null = null;
  let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } | undefined;

  const execute = (): QueryResult => {
    const rows = state[tableName];

    if (pendingOp === 'insert') {
      const items = Array.isArray(opPayload) ? opPayload : opPayload ? [opPayload] : [];
      const inserted: MockRow[] = [];
      for (const item of items) {
        const rec: MockRow = {
          id: item.id || `${tableName}-${rows.length + 1}`,
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        rows.push(rec);
        inserted.push(rec);
      }
      return { data: projectColumns(inserted, selectCols), error: null };
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
      return { data: projectColumns(out, selectCols), error: null };
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
      return { data: projectColumns(updated, selectCols), error: null };
    }

    if (pendingOp === 'delete') {
      const removed: MockRow[] = [];
      for (let i = rows.length - 1; i >= 0; i--) {
        if (filters.every((fn) => fn(rows[i]))) {
          removed.push(rows[i]);
          rows.splice(i, 1);
        }
      }
      return { data: projectColumns(removed, selectCols), error: null };
    }

    let out = rows.filter((r) => filters.every((fn) => fn(r)));
    if (sortCol) {
      const col = sortCol;
      out = [...out].sort((a, b) => {
        const av = String(a[col] || '');
        const bv = String(b[col] || '');
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (maxRows !== null) out = out.slice(0, maxRows);
    return { data: projectColumns(out, selectCols), error: null };
  };

  const chain: MockQueryChain = {
    select: (cols?: string) => {
      if (cols) selectCols = cols;
      return chain;
    },
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

const TOKEN_TO_USER: Record<string, { id: string; email: string }> = {
  'tok-user-a': { id: UUID_USER_A, email: 'alpha@example.com' },
  'tok-user-b': { id: UUID_USER_B, email: 'beta@example.com' },
  'tok-admin': { id: UUID_ADMIN, email: 'founder@devhostcloud.com' },
};

function createMockSupabaseClient(state: MockDbState) {
  return {
    from: (table: string) => buildQueryBuilder(table, state),
    auth: {
      getUser: vi.fn(async (token?: string) => {
        const user = token ? TOKEN_TO_USER[token] : null;
        if (!user) {
          return { data: { user: null }, error: { message: 'Invalid JWT' } };
        }
        return { data: { user }, error: null };
      }),
    },
  };
}

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase');
  const getClient = () => createMockSupabaseClient(mockStore.state);
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => mockStore.configured),
    hasServiceRoleKey: vi.fn(() => true),
    isDevSandboxMode: vi.fn(() => mockStore.sandbox),
    getServiceSupabase: vi.fn(getClient),
    get supabase() {
      return getClient();
    },
  };
});

vi.mock('@/lib/registrarClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/registrarClient')>('@/lib/registrarClient');
  return {
    ...actual,
    registerDomainWithRegistrar: vi.fn(async ({ domain }: { domain: string }) => {
      if (mockStore.registrarShouldFail) {
        return {
          ok: false,
          provider: 'resellerclub',
          mode: 'live_api',
          statusCode: 502,
          error: 'Upstream EPP gateway timeout',
          message: 'Upstream registrar unavailable',
        };
      }
      return {
        ok: true,
        provider: 'resellerclub',
        mode: 'live_api',
        orderId: `rc-reg-${domain}`,
        message: `Registered ${domain}`,
      };
    }),
  };
});

vi.mock('@/lib/cloudflareClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cloudflareClient')>('@/lib/cloudflareClient');
  return {
    ...actual,
    isCloudflareConfigured: vi.fn(() => false),
    ensureCloudflareZone: vi.fn(async () => ({
      ok: true,
      zoneId: 'cf-zone-1',
      nameServers: ['ns1.devhostcloud.com', 'ns2.devhostcloud.com'],
    })),
  };
});

vi.mock('@/lib/adminNotifier', () => ({
  sendTelegramAlert: vi.fn(async () => ({ ok: true })),
}));

import { POST as twoFaPost } from '@/app/api/auth/2fa/route';
import { POST as v1DeployPost } from '@/app/api/v1/deploy/route';
import { POST as registrarPost } from '@/app/api/registrar/route';
import { GET as filesGet, POST as filesPost } from '@/app/api/hosting/files/route';
import { GET as databasesGet, POST as databasesPost } from '@/app/api/hosting/databases/route';
import { POST as consolePost } from '@/app/api/hosting/console/route';
import { GET as catalogGet } from '@/app/api/catalog/route';
import { POST as computePost } from '@/app/api/compute/route';
import { verifyPaidDomainEntitlement } from '@/lib/billingEntitlements';
import { verifySecurityPin } from '@/lib/totpEngine';
import { syncContainerFilesOnAgent, verifyAgentCallbackSignature } from '@/lib/computeAgentClient';
import { getServiceSupabase } from '@/lib/supabase';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_SUDO_SECRET = process.env.DEVHOST_SUDO_HMAC_SECRET;
const ORIGINAL_AGENT_URL = process.env.COMPUTE_AGENT_URL;
const ORIGINAL_AGENT_SECRET = process.env.DEVHOST_COMPUTE_AGENT_SECRET;

function makeJsonReq(
  url: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function extractCookiePair(res: Response, cookieName: string): string | null {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? `${cookieName}=${match[1]}` : null;
}

describe('Phase 12 Security & Architecture Hardening Suite', () => {
  beforeEach(async () => {
    mockStore.configured = true;
    mockStore.sandbox = true;
    mockStore.registrarShouldFail = false;
    mockStore.state = await createInitialState();
    process.env.DEVHOST_SUDO_HMAC_SECRET = 'phase12-test-sudo-signing-key-256bit';
    delete process.env.COMPUTE_AGENT_URL;
    delete process.env.DEVHOST_COMPUTE_AGENT_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_SUDO_SECRET === undefined) delete process.env.DEVHOST_SUDO_HMAC_SECRET;
    else process.env.DEVHOST_SUDO_HMAC_SECRET = ORIGINAL_SUDO_SECRET;
    if (ORIGINAL_AGENT_URL === undefined) delete process.env.COMPUTE_AGENT_URL;
    else process.env.COMPUTE_AGENT_URL = ORIGINAL_AGENT_URL;
    if (ORIGINAL_AGENT_SECRET === undefined) delete process.env.DEVHOST_COMPUTE_AGENT_SECRET;
    else process.env.DEVHOST_COMPUTE_AGENT_SECRET = ORIGINAL_AGENT_SECRET;
  });

  it('1. Enforces hashed Master Sudo PIN storage and Sudo step-up cookie on /api/auth/2fa', async () => {
    // Initial PIN creation stores salted SHA-256 hash, never plaintext
    const setPinRes = await twoFaPost(
      makeJsonReq(
        'https://devhostcloud.com/api/auth/2fa',
        'POST',
        { action: 'update_sudo_pin', sudoPin: '654321' },
        { authorization: 'Bearer tok-user-a' }
      )
    );
    expect(setPinRes.status).toBe(200);

    const credRow = mockStore.state.user_security_credentials[0];
    expect(credRow.sudo_security_pin_hash).toBeTruthy();
    expect(credRow.sudo_security_pin_hash).not.toBe('654321');
    expect(await verifySecurityPin('654321', String(credRow.sudo_security_pin_hash))).toBe(true);
    expect(await verifySecurityPin('000000', String(credRow.sudo_security_pin_hash))).toBe(false);

    // Changing existing PIN without an elevated Sudo session is blocked with 403
    const unverifiedChangeRes = await twoFaPost(
      makeJsonReq(
        'https://devhostcloud.com/api/auth/2fa',
        'POST',
        { action: 'update_sudo_pin', sudoPin: '987654' },
        { authorization: 'Bearer tok-user-a' }
      )
    );
    expect(unverifiedChangeRes.status).toBe(403);

    // Wrong PIN fails verify_sudo with 401
    const badVerifyRes = await twoFaPost(
      makeJsonReq(
        'https://devhostcloud.com/api/auth/2fa',
        'POST',
        { action: 'verify_sudo', sudoPin: '111111' },
        { authorization: 'Bearer tok-user-a', 'x-forwarded-for': '198.51.100.21' }
      )
    );
    expect(badVerifyRes.status).toBe(401);

    // Correct PIN passes verify_sudo and issues HttpOnly devhost_sudo_token cookie
    const goodVerifyRes = await twoFaPost(
      makeJsonReq(
        'https://devhostcloud.com/api/auth/2fa',
        'POST',
        { action: 'verify_sudo', sudoPin: '654321' },
        { authorization: 'Bearer tok-user-a', 'x-forwarded-for': '198.51.100.22' }
      )
    );
    expect(goodVerifyRes.status).toBe(200);
    const sudoCookie = extractCookiePair(goodVerifyRes, 'devhost_sudo_token');
    expect(sudoCookie).toBeTruthy();

    // Updating PIN WITH the verified Sudo cookie succeeds and updates the hash
    const verifiedChangeRes = await twoFaPost(
      makeJsonReq(
        'https://devhostcloud.com/api/auth/2fa',
        'POST',
        { action: 'update_sudo_pin', sudoPin: '987654' },
        { authorization: 'Bearer tok-user-a', cookie: sudoCookie! }
      )
    );
    expect(verifiedChangeRes.status).toBe(200);
    expect(
      await verifySecurityPin(
        '987654',
        String(mockStore.state.user_security_credentials[0].sudo_security_pin_hash)
      )
    ).toBe(true);
  });

  it('2. Enforces Personal Access Token scopes and tenant ownership on /api/v1/deploy', async () => {
    const missingAuth = await v1DeployPost(
      makeJsonReq('https://devhostcloud.com/api/v1/deploy', 'POST', {
        action: 'deploy',
        serviceId: UUID_SRV_A,
      })
    );
    expect(missingAuth.status).toBe(401);

    const revokedRes = await v1DeployPost(
      makeJsonReq(
        'https://devhostcloud.com/api/v1/deploy',
        'POST',
        { action: 'deploy', serviceId: UUID_SRV_A },
        { authorization: `Bearer ${PAT_REVOKED}` }
      )
    );
    expect(revokedRes.status).toBe(401);

    // Read-only PAT rejected for write/deploy scopes
    const deployMissingScope = await v1DeployPost(
      makeJsonReq(
        'https://devhostcloud.com/api/v1/deploy',
        'POST',
        { action: 'deploy', serviceId: UUID_SRV_A },
        { authorization: `Bearer ${PAT_READ_ONLY}` }
      )
    );
    expect(deployMissingScope.status).toBe(403);
    expect(await deployMissingScope.json()).toMatchObject({
      error: expect.stringContaining('git:deploy'),
    });

    const dnsMissingScope = await v1DeployPost(
      makeJsonReq(
        'https://devhostcloud.com/api/v1/deploy',
        'POST',
        { action: 'dns_record', domain: 'alpha-app.devhostcloud.com', recordType: 'A', recordName: '@' },
        { authorization: `Bearer ${PAT_READ_ONLY}` }
      )
    );
    expect(dnsMissingScope.status).toBe(403);
    expect(await dnsMissingScope.json()).toMatchObject({
      error: expect.stringContaining('dns:write'),
    });

    const cacheMissingScope = await v1DeployPost(
      makeJsonReq(
        'https://devhostcloud.com/api/v1/deploy',
        'POST',
        { action: 'cache_purge', serviceId: UUID_SRV_A },
        { authorization: `Bearer ${PAT_READ_ONLY}` }
      )
    );
    expect(cacheMissingScope.status).toBe(403);
    expect(await cacheMissingScope.json()).toMatchObject({
      error: expect.stringContaining('services:write'),
    });

    // Cross-tenant serviceId access rejected even with git:deploy scope
    const crossTenantDeploy = await v1DeployPost(
      makeJsonReq(
        'https://devhostcloud.com/api/v1/deploy',
        'POST',
        { action: 'deploy', serviceId: UUID_SRV_A },
        { authorization: `Bearer ${PAT_DEPLOY_OTHER}` }
      )
    );
    expect(crossTenantDeploy.status).toBe(403);

    // Owner PAT with git:deploy succeeds on own service
    const validDeploy = await v1DeployPost(
      makeJsonReq(
        'https://devhostcloud.com/api/v1/deploy',
        'POST',
        { action: 'deploy', serviceId: UUID_SRV_A, commitSha: 'abc1234' },
        { authorization: `Bearer ${PAT_DEPLOY_OWNER}` }
      )
    );
    expect(validDeploy.status).toBe(200);
    const deployBody = (await validDeploy.json()) as { status?: string; buildJobId?: string };
    expect(deployBody.status).toBe('success');
    expect(deployBody.buildJobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('3. Enforces single-use paid domain entitlement verification, consumption, and rollback on failure', async () => {
    // Registration without any matching paid invoice fails with 402
    const unpaidRes = await registrarPost(
      makeJsonReq(
        'https://devhostcloud.com/api/registrar',
        'POST',
        { action: 'register', domain: 'unpaid-site.com' },
        { authorization: 'Bearer tok-user-a', 'x-forwarded-for': '198.51.100.31' }
      )
    );
    expect(unpaidRes.status).toBe(402);

    // Registration backed by an already-consumed invoice fails with 402
    const consumedReplayRes = await registrarPost(
      makeJsonReq(
        'https://devhostcloud.com/api/registrar',
        'POST',
        { action: 'register', domain: 'replay-theft.com', invoiceNumber: 'INV-DOM-REPLAY' },
        { authorization: 'Bearer tok-user-a', 'x-forwarded-for': '198.51.100.32' }
      )
    );
    expect(consumedReplayRes.status).toBe(402);

    // Failed upstream registrar rolls back entitlement consumption so valid invoice isn't burned
    mockStore.registrarShouldFail = true;
    const transientFailRes = await registrarPost(
      makeJsonReq(
        'https://devhostcloud.com/api/registrar',
        'POST',
        { action: 'register', domain: 'brandnew-entitled.com', invoiceNumber: 'INV-DOM-1001' },
        { authorization: 'Bearer tok-user-a', 'x-forwarded-for': '198.51.100.33' }
      )
    );
    expect(transientFailRes.status).toBe(502);
    const rolledBackInv = mockStore.state.invoices.find((i) => i.invoice_number === 'INV-DOM-1001');
    expect(rolledBackInv?.domain_entitlement_consumed).toBe(false);

    // Successful retry consumes INV-DOM-1001 once
    mockStore.registrarShouldFail = false;
    const regSuccessRes = await registrarPost(
      makeJsonReq(
        'https://devhostcloud.com/api/registrar',
        'POST',
        { action: 'register', domain: 'brandnew-entitled.com', invoiceNumber: 'INV-DOM-1001' },
        { authorization: 'Bearer tok-user-a', 'x-forwarded-for': '198.51.100.34' }
      )
    );
    expect(regSuccessRes.status).toBe(200);
    const consumedInv = mockStore.state.invoices.find((i) => i.invoice_number === 'INV-DOM-1001');
    expect(consumedInv?.domain_entitlement_consumed).toBe(true);
    expect(consumedInv?.domain_entitlement_consumed_domain).toBe('brandnew-entitled.com');

    // Direct verifyPaidDomainEntitlement call now rejects reuse without allowConsumedRetry
    const db = getServiceSupabase();
    const recheck = await verifyPaidDomainEntitlement({
      db,
      userId: UUID_USER_A,
      role: 'client',
      domain: 'brandnew-entitled.com',
      operation: 'register',
      invoiceNumber: 'INV-DOM-1001',
    });
    expect(recheck.entitled).toBe(false);
  });

  it('4. Blocks IDOR cross-tenant and non-UUID access across hosting files, databases, and console routes', async () => {
    // Non-UUID serviceId rejected on client access
    const nonUuidFiles = await filesGet(
      makeJsonReq('https://devhostcloud.com/api/hosting/files?serviceId=srv-a', 'GET', undefined, {
        authorization: 'Bearer tok-user-a',
      })
    );
    expect(nonUuidFiles.status).toBe(403);

    // User B cannot read or mutate User A's files, databases, or console
    const idorResponses = await Promise.all([
      filesGet(
        makeJsonReq(`https://devhostcloud.com/api/hosting/files?serviceId=${UUID_SRV_A}`, 'GET', undefined, {
          authorization: 'Bearer tok-user-b',
        })
      ),
      filesPost(
        makeJsonReq(
          'https://devhostcloud.com/api/hosting/files',
          'POST',
          { action: 'save_file', serviceId: UUID_SRV_A, filePath: '/public_html/pwn.js', contentText: 'x' },
          { authorization: 'Bearer tok-user-b' }
        )
      ),
      databasesGet(
        makeJsonReq(`https://devhostcloud.com/api/hosting/databases?serviceId=${UUID_SRV_A}`, 'GET', undefined, {
          authorization: 'Bearer tok-user-b',
        })
      ),
      databasesPost(
        makeJsonReq(
          'https://devhostcloud.com/api/hosting/databases',
          'POST',
          { action: 'create_database', serviceId: UUID_SRV_A, dbSuffix: 'evil' },
          { authorization: 'Bearer tok-user-b' }
        )
      ),
      consolePost(
        makeJsonReq(
          'https://devhostcloud.com/api/hosting/console',
          'POST',
          { serviceId: UUID_SRV_A, consoleType: 'jailed_ssh', commandOrQuery: 'git status' },
          { authorization: 'Bearer tok-user-b' }
        )
      ),
    ]);

    for (const res of idorResponses) {
      expect(res.status).toBe(403);
    }

    // Legitimate owner (User A) can access own files and databases
    const ownerFiles = await filesGet(
      makeJsonReq(`https://devhostcloud.com/api/hosting/files?serviceId=${UUID_SRV_A}`, 'GET', undefined, {
        authorization: 'Bearer tok-user-a',
      })
    );
    const ownerDbs = await databasesGet(
      makeJsonReq(`https://devhostcloud.com/api/hosting/databases?serviceId=${UUID_SRV_A}`, 'GET', undefined, {
        authorization: 'Bearer tok-user-a',
      })
    );
    expect(ownerFiles.status).toBe(200);
    expect(ownerDbs.status).toBe(200);
  });

  it('5. Redacts cost margins, promos, and internal WHM hostnames for non-admin callers on /api/catalog', async () => {
    const anonRes = await catalogGet(makeJsonReq('https://devhostcloud.com/api/catalog', 'GET'));
    expect(anonRes.status).toBe(200);
    const anonBody = (await anonRes.json()) as {
      allPlans: Array<Record<string, unknown>>;
      domainTlds: Array<Record<string, unknown>>;
      promoCodes: Array<Record<string, unknown>>;
      serverNodes: Array<Record<string, unknown>>;
    };

    expect(anonBody.allPlans[0].unit_server_cost_bdt).toBeUndefined();
    expect(anonBody.allPlans[0].min_owner_profit_bdt).toBeUndefined();
    expect(anonBody.allPlans[0].max_affiliate_pool_bdt).toBeUndefined();
    expect(anonBody.domainTlds[0].registrar_cost_bdt).toBeUndefined();
    expect(anonBody.domainTlds[0].owner_net_profit_reg_bdt).toBeUndefined();
    expect(anonBody.promoCodes).toEqual([]);
    expect(anonBody.serverNodes[0].whm_hostname).toBeUndefined();

    // Admin caller receives full margin economics, promos, and whm_hostname
    const adminRes = await catalogGet(
      makeJsonReq('https://devhostcloud.com/api/catalog', 'GET', undefined, {
        authorization: 'Bearer tok-admin',
      })
    );
    expect(adminRes.status).toBe(200);
    const adminBody = (await adminRes.json()) as {
      allPlans: Array<Record<string, unknown>>;
      domainTlds: Array<Record<string, unknown>>;
      promoCodes: Array<Record<string, unknown>>;
      serverNodes: Array<Record<string, unknown>>;
    };

    expect(adminBody.allPlans[0].unit_server_cost_bdt).toBe(95);
    expect(adminBody.allPlans[0].min_owner_profit_bdt).toBe(220);
    expect(adminBody.domainTlds[0].registrar_cost_bdt).toBe(1120);
    expect(adminBody.promoCodes).toHaveLength(1);
    expect(adminBody.serverNodes[0].whm_hostname).toBe('internal-whm-01.devhostcloud.internal');
  });

  it('6. Enforces HMAC + X-DevHost-Nonce replay protection on /v1/files and UUID jobId on /api/compute', async () => {
    process.env.COMPUTE_AGENT_URL = 'https://agent-phase12.internal';
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase12-agent-hmac-secret-32-chars';

    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      const rawHeaders = (init?.headers || {}) as Record<string, string>;
      capturedHeaders = rawHeaders;
      capturedBody = String(init?.body || '');
      return new Response(JSON.stringify({ synced: true, sizeBytes: 12 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const syncRes = await syncContainerFilesOnAgent({
      action: 'write',
      serviceId: UUID_SRV_A,
      cpanelUser: 'alphaapp',
      filePath: '/public_html/index.js',
      contentText: 'console.log(1);',
    });

    expect(syncRes.ok).toBe(true);
    expect(capturedUrl).toBe('https://agent-phase12.internal/v1/files');
    expect(capturedHeaders['X-DevHost-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(capturedHeaders['X-DevHost-Nonce']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    const firstVerify = await verifyAgentCallbackSignature({
      rawBody: capturedBody,
      timestampHeader: capturedHeaders['X-DevHost-Timestamp'] || null,
      signatureHeader: capturedHeaders['X-DevHost-Signature'] || null,
      nonceHeader: capturedHeaders['X-DevHost-Nonce'] || null,
    });
    expect(firstVerify.valid).toBe(true);

    // Immediate nonce replay is rejected
    const replayVerify = await verifyAgentCallbackSignature({
      rawBody: capturedBody,
      timestampHeader: capturedHeaders['X-DevHost-Timestamp'] || null,
      signatureHeader: capturedHeaders['X-DevHost-Signature'] || null,
      nonceHeader: capturedHeaders['X-DevHost-Nonce'] || null,
    });
    expect(replayVerify.valid).toBe(false);
    expect(replayVerify.reason).toContain('Replay detected');

    // /api/compute rebuild issues a UUID jobId into compute_build_jobs
    delete process.env.COMPUTE_AGENT_URL;
    delete process.env.DEVHOST_COMPUTE_AGENT_SECRET;
    const computeRes = await computePost(
      makeJsonReq(
        'https://devhostcloud.com/api/compute',
        'POST',
        { serviceId: UUID_SRV_A, action: 'rebuild' },
        { authorization: 'Bearer tok-user-a' }
      )
    );
    expect(computeRes.status).toBe(200);
    const computeBody = (await computeRes.json()) as { success?: boolean; jobId?: string };
    expect(computeBody.success).toBe(true);
    expect(computeBody.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    const storedJob = mockStore.state.compute_build_jobs.find((j) => j.id === computeBody.jobId);
    expect(storedJob).toBeTruthy();
  });
});
