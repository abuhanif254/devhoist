import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  domains: MockRow[];
  domain_dns_records: MockRow[];
  domain_url_forwards: MockRow[];
  domain_transfers: MockRow[];
  domain_child_nameservers: MockRow[];
  hosting_services: MockRow[];
  hosting_addon_domains: MockRow[];
  catalog_hosting_plans: MockRow[];
  edge_waf_rules: MockRow[];
  cms_global_config: MockRow[];
  customer_developer_profiles: MockRow[];
  security_audit_logs: MockRow[];
  fraud_alerts: MockRow[];
  invoices: MockRow[];
  financial_profit_ledger: MockRow[];
  whm_server_nodes: MockRow[];
  project_deployments: MockRow[];
  hosting_project_settings: MockRow[];
  affiliate_commissions: MockRow[];
  developer_api_logs: MockRow[];
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const DOMAIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createInitialDb(): MockDbState {
  return {
    profiles: [
      { id: USER_ID, email: 'client@devhost.cloud', full_name: 'Demo Client', role: 'client', wallet_balance_bdt: 5000 },
      { id: ADMIN_ID, email: 'founder@devhost.cloud', full_name: 'Founder Admin', role: 'admin', wallet_balance_bdt: 10000 },
    ],
    domains: [
      {
        id: DOMAIN_ID,
        user_id: USER_ID,
        domain_name: 'shopbd.com',
        tld: '.com',
        status: 'Active',
        registrar_lock: true,
        whois_privacy: true,
        auto_renew: true,
        nameservers: ['gina.ns.cloudflare.com', 'bob.ns.cloudflare.com'],
        cloudflare_zone_id: 'cf_zone_shopbd',
        cloudflare_zone_status: 'active',
        registrar_provider: 'resellerclub',
        registrar_order_id: '98765432',
        epp_code: 'EPP-PLAIN-7788',
      },
    ],
    domain_dns_records: [],
    domain_url_forwards: [],
    domain_transfers: [],
    domain_child_nameservers: [],
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
    catalog_hosting_plans: [
      {
        slug: 'developer-pro',
        name_en: 'Developer Pro Cloud',
        max_addon_domains: 5,
      },
    ],
    edge_waf_rules: [],
    cms_global_config: [],
    customer_developer_profiles: [
      {
        user_id: USER_ID,
        personal_api_tokens: [
          {
            id: 'pat-1',
            token: 'dh_live_phase4_secret_token_99',
            scopes: ['services:write', 'dns:write', 'git:deploy'],
            revoked: false,
            status: 'active',
          },
        ],
      },
    ],
    security_audit_logs: [],
    fraud_alerts: [],
    invoices: [],
    financial_profit_ledger: [],
    whm_server_nodes: [
      {
        id: 'node-sg1',
        node_code: 'sg1',
        hostname: 'sg1.devhost.cloud',
        ip_address: '103.151.102.45',
        nameserver_1: 'ns1.devhost.cloud',
        nameserver_2: 'ns2.devhost.cloud',
        status: 'active',
        current_accounts: 12,
        max_accounts: 200,
      },
    ],
    project_deployments: [],
    hosting_project_settings: [],
    affiliate_commissions: [],
    developer_api_logs: [],
  };
}

const mockStore = vi.hoisted(() => ({
  supabaseConfigured: true,
  isAdmin: false,
  sudoValid: true,
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
  ilike: (col: string, val: string) => MockQueryChain;
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
  const filters: Array<{ col: string; val: unknown }> = [];

  const applyFilters = (rows: MockRow[]) =>
    rows.filter((r) => filters.every((f) => r[f.col] === f.val));

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
      const kept = rows.filter((r) => !filters.every((f) => r[f.col] === f.val));
      const deletedCount = rows.length - kept.length;
      rows.length = 0;
      rows.push(...kept);
      return { data: null, error: null, count: deletedCount };
    }

    const matched = applyFilters(rows);
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
      filters.push({ col, val });
      return chain;
    },
    ilike: (col: string, val: string) => {
      filters.push({ col, val });
      return chain;
    },
    order: () => chain,
    limit: () => chain,
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
    }),
  };
});

vi.mock('@/lib/authGuard', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const makeAuthUser = (isAdmin: boolean) => ({
    ok: true as const,
    user: { id: isAdmin ? ADMIN_ID : USER_ID, email: isAdmin ? 'founder@devhost.cloud' : 'client@devhost.cloud' },
    profile: {
      id: isAdmin ? ADMIN_ID : USER_ID,
      email: isAdmin ? 'founder@devhost.cloud' : 'client@devhost.cloud',
      full_name: isAdmin ? 'Founder Admin' : 'Demo Client',
      role: (isAdmin ? 'admin' : 'client') as 'admin' | 'client',
      wallet_balance_bdt: 5000,
    },
    role: (isAdmin ? 'admin' : 'client') as 'admin' | 'client',
    token: 'mock-jwt',
  });

  return {
    ...actual,
    requireUser: async () => makeAuthUser(mockStore.isAdmin),
    requireAdmin: async () => makeAuthUser(true),
    requireDomainAccess: async (_req: Request, identifier: { domainId?: string | null; domainName?: string | null }) => ({
      ...makeAuthUser(mockStore.isAdmin),
      domainId: identifier.domainId || DOMAIN_ID,
      domainName: identifier.domainName || 'shopbd.com',
      isAdmin: mockStore.isAdmin,
    }),
    requireServiceAccess: async (_req: Request, serviceId: string | null) => ({
      ...makeAuthUser(mockStore.isAdmin),
      serviceId: serviceId || SERVICE_ID,
      isAdmin: mockStore.isAdmin,
    }),
    verifySudoToken: async () => mockStore.sudoValid,
  };
});

import { GET as domainCheckGet } from '@/app/api/domain-check/route';
import { POST as registrarPost } from '@/app/api/registrar/route';
import { POST as dnsPost, PUT as dnsPut, DELETE as dnsDelete } from '@/app/api/domains/dns/route';
import { POST as managePost } from '@/app/api/domains/manage/route';
import { POST as hostingDomainsPost, PATCH as hostingDomainsPatch, DELETE as hostingDomainsDelete } from '@/app/api/hosting/domains/route';
import { POST as v1DeployPost } from '@/app/api/v1/deploy/route';
import { POST as adminWafPost, DELETE as adminWafDelete } from '@/app/api/admin/waf/route';
import { executeZeroTouchProvisioning } from '@/lib/zeroTouchProvisioner';
import { upsertCloudflareDnsRecord } from '@/lib/cloudflareClient';
import { checkDomainsAvailability } from '@/lib/registrarClient';

function jsonReq(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('Phase 4: Real Domain Registrar & Cloudflare Anycast Edge Plane', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockStore.supabaseConfigured = true;
    mockStore.isAdmin = false;
    mockStore.sudoValid = true;
    mockStore.state = createInitialDb();

    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.DEV_SANDBOX_MODE;
    delete process.env.REGISTRAR_PROVIDER;
    delete process.env.REGISTRAR_API_USER;
    delete process.env.REGISTRAR_API_KEY;
    delete process.env.REGISTRAR_SANDBOX;
    delete process.env.CLOUDFLARE_DNS_API_TOKEN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_SAAS_ZONE_ID;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('validates phase4_registrar_and_cloudflare.sql migration columns and schema reload', () => {
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', 'phase4_registrar_and_cloudflare.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('registrar_provider');
    expect(sql).toContain('registrar_order_id');
    expect(sql).toContain('cloudflare_zone_id');
    expect(sql).toContain('cloudflare_zone_status');
    expect(sql).toContain('cloudflare_nameservers');
    expect(sql).toContain('cloudflare_record_id');
    expect(sql).toContain('sync_status');
    expect(sql).toContain('cloudflare_hostname_id');
    expect(sql).toContain('ssl_dcv_method');
    expect(sql).toContain('dcv_record_name');
    expect(sql).toContain('dcv_record_value');
    expect(sql).toContain('cloudflare_rule_id');
    expect(sql).toContain('registrar_transfer_id');
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('domain availability queries ResellerClub wholesale API, flags .bd as BTCL manual, and never fakes on DoH failure', async () => {
    process.env.REGISTRAR_PROVIDER = 'resellerclub';
    process.env.REGISTRAR_API_USER = '123456';
    process.env.REGISTRAR_API_KEY = 'rc_secret_key';

    const fetchedUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url.includes('/domains/available.json')) {
        return new Response(
          JSON.stringify({
            'brandnova.com': { status: 'available' },
            'brandnova.net': { status: 'regthroughothers' },
            'brandnova.io': { status: 'available' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Simulate DoH failure for .com.bd / fallback TLDs
      return new Response('DoH down', { status: 503 });
    }) as typeof fetch;

    const res = await domainCheckGet(
      new Request('http://localhost/api/domain-check?domain=brandnova.com.bd', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      registrarConfigured: boolean;
      registrarProvider: string;
      results: Array<{
        domain: string;
        tld: string;
        available: boolean;
        manualProvisioning?: boolean;
        verificationStatus?: string;
        source?: string;
      }>;
    };

    expect(json.registrarConfigured).toBe(true);
    expect(json.registrarProvider).toBe('resellerclub');
    expect(fetchedUrls.some((u) => u.includes('available.json'))).toBe(true);

    const comItem = json.results.find((r) => r.tld === '.com');
    const netItem = json.results.find((r) => r.tld === '.net');
    const bdItem = json.results.find((r) => r.tld === '.com.bd');
    const orgItem = json.results.find((r) => r.tld === '.org');

    expect(comItem?.available).toBe(true);
    expect(netItem?.available).toBe(false);
    expect(bdItem?.manualProvisioning).toBe(true);
    // Conservative unavailable when DoH fails (baseLabel 'brandnova'.length > 4 must NOT become available=true!)
    expect(orgItem?.available).toBe(false);
    expect(orgItem?.verificationStatus).toBe('unverified');
  });

  it('parses Namecheap XML wholesale availability & premium pricing accurately', async () => {
    process.env.REGISTRAR_PROVIDER = 'namecheap';
    process.env.REGISTRAR_API_USER = 'nc_user';
    process.env.REGISTRAR_API_KEY = 'nc_key';
    process.env.REGISTRAR_CLIENT_IP = '198.51.100.2';

    globalThis.fetch = vi.fn(async () => {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
        <ApiResponse Status="OK">
          <CommandResponse Type="namecheap.domains.check">
            <DomainCheckResult Domain="ai-saas.io" Available="true" IsPremiumName="true" PremiumRegistrationPrice="450.00" />
            <DomainCheckResult Domain="taken-site.com" Available="false" IsPremiumName="false" PremiumRegistrationPrice="0" />
          </CommandResponse>
        </ApiResponse>`;
      return new Response(xml, { status: 200 });
    }) as typeof fetch;

    const lookup = await checkDomainsAvailability(['ai-saas.io', 'taken-site.com']);
    expect(lookup?.configured).toBe(true);
    expect(lookup?.provider).toBe('namecheap');
    expect(lookup?.results['ai-saas.io']?.available).toBe(true);
    expect(lookup?.results['ai-saas.io']?.isPremium).toBe(true);
    expect(lookup?.results['ai-saas.io']?.premiumPriceUSD).toBe(450);
    expect(lookup?.results['taken-site.com']?.available).toBe(false);
  });

  it('POST /api/registrar fails closed with HTTP 503 when registrar unconfigured outside sandbox, and routes .bd to Pending BTCL queue', async () => {
    const unconfRes = await registrarPost(
      jsonReq('http://localhost/api/registrar', 'POST', {
        action: 'register',
        domain: 'newstartup.com',
      })
    );
    expect(unconfRes.status).toBe(503);

    // .com.bd routes cleanly to Pending BTCL manual queue without faking instant EPP Active
    const bdRes = await registrarPost(
      jsonReq('http://localhost/api/registrar', 'POST', {
        action: 'register',
        domain: 'dhakamart.com.bd',
      })
    );
    expect(bdRes.status).toBe(200);
    const bdJson = (await bdRes.json()) as {
      status: string;
      provider: string;
      mode: string;
      orderId: string;
    };
    expect(bdJson.status).toBe('Pending');
    expect(bdJson.provider).toBe('btcl_manual');
    expect(bdJson.mode).toBe('manual_btcl_queue');

    const storedBd = mockStore.state.domains.find((d) => d.domain_name === 'dhakamart.com.bd');
    expect(storedBd?.status).toBe('Pending');
    expect(storedBd?.registrar_provider).toBe('btcl_manual');
  });

  it('POST /api/registrar executes live ResellerClub registration + Cloudflare zone creation for .com domains', async () => {
    process.env.REGISTRAR_PROVIDER = 'resellerclub';
    process.env.REGISTRAR_API_USER = 'rc_user';
    process.env.REGISTRAR_API_KEY = 'rc_key';
    process.env.REGISTRAR_CUSTOMER_ID = 'cust_11';
    process.env.REGISTRAR_DEFAULT_CONTACT_ID = 'contact_22';
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_live_test_token_1234567890abcdef';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc_99';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/zones?name=')) {
        return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 });
      }
      if (url.endsWith('/zones') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'cf_zone_live_777',
              status: 'pending',
              name_servers: ['lisa.ns.cloudflare.com', 'todd.ns.cloudflare.com'],
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/domains/register.json')) {
        return new Response(
          JSON.stringify({ entityid: '55443322', status: 'Success' }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as typeof fetch;

    const regRes = await registrarPost(
      jsonReq('http://localhost/api/registrar', 'POST', {
        action: 'register',
        domain: 'cloudbengal.com',
        years: 2,
      })
    );
    expect(regRes.status).toBe(200);
    const regJson = (await regRes.json()) as {
      status: string;
      provider: string;
      orderId: string;
      cloudflareZoneId: string;
      nameservers: string[];
    };
    expect(regJson.status).toBe('Active');
    expect(regJson.provider).toBe('resellerclub');
    expect(regJson.orderId).toBe('55443322');
    expect(regJson.cloudflareZoneId).toBe('cf_zone_live_777');
    expect(regJson.nameservers).toEqual(['lisa.ns.cloudflare.com', 'todd.ns.cloudflare.com']);

    const savedDomain = mockStore.state.domains.find((d) => d.domain_name === 'cloudbengal.com');
    expect(savedDomain?.registrar_order_id).toBe('55443322');
    expect(savedDomain?.cloudflare_zone_id).toBe('cf_zone_live_777');
  });

  it('enforces Cloudflare proxy eligibility on non-HTTP record types and persists cloudflare_record_id across DNS CRUD', async () => {
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_live_test_token_1234567890abcdef';

    const cfBodies: Array<Record<string, unknown>> = [];
    const cfMethods: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      cfMethods.push(`${init?.method || 'GET'} ${url}`);
      if (init?.body && typeof init.body === 'string') {
        cfBodies.push(JSON.parse(init.body) as Record<string, unknown>);
      }
      if (url.includes('/dns_records/') && init?.method === 'PUT') {
        return new Response(
          JSON.stringify({ success: true, result: { id: 'cf_rec_a_1', proxied: false } }),
          { status: 200 }
        );
      }
      if (url.endsWith('/dns_records') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: cfBodies[cfBodies.length - 1]?.type === 'A' ? 'cf_rec_a_1' : 'cf_rec_mx_1',
              proxied: cfBodies[cfBodies.length - 1]?.proxied,
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/dns_records/cf_rec_a_1') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true, result: { id: 'cf_rec_a_1' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 });
    }) as typeof fetch;

    // 1. Proxy guard check directly on MX (must force proxied=false)
    await upsertCloudflareDnsRecord('cf_zone_shopbd', {
      type: 'MX',
      name: '@',
      content: 'mail.shopbd.com',
      priority: 10,
      proxied: true,
    });
    expect(cfBodies[0]?.proxied).toBe(false);

    // 2. POST /api/domains/dns add_record -> persists cloudflare_record_id & sync_status='synced'
    const addRes = await dnsPost(
      jsonReq('http://localhost/api/domains/dns', 'POST', {
        action: 'add_record',
        domainId: DOMAIN_ID,
        domainName: 'shopbd.com',
        record: { type: 'A', name: 'api', content: '103.151.102.50', ttl: 3600, proxied: true },
      })
    );
    expect(addRes.status).toBe(200);
    const addJson = (await addRes.json()) as { recordId: string; cloudflareRecordId: string };
    expect(addJson.cloudflareRecordId).toBe('cf_rec_a_1');
    const dbRec = mockStore.state.domain_dns_records.find((r) => r.id === addJson.recordId);
    expect(dbRec?.cloudflare_record_id).toBe('cf_rec_a_1');
    expect(dbRec?.cloudflare_zone_id).toBe('cf_zone_shopbd');
    expect(dbRec?.sync_status).toBe('synced');

    // 3. PUT /api/domains/dns updates existing Cloudflare record ID
    const putRes = await dnsPut(
      jsonReq('http://localhost/api/domains/dns', 'PUT', {
        recordId: addJson.recordId,
        domainId: DOMAIN_ID,
        record: { type: 'A', name: 'api', content: '103.151.102.55', ttl: 300, proxied: false },
      })
    );
    expect(putRes.status).toBe(200);
    expect(cfMethods.some((m) => m.includes('PUT') && m.includes('/dns_records/cf_rec_a_1'))).toBe(true);

    // 4. DELETE /api/domains/dns removes Cloudflare record ID first
    const delRes = await dnsDelete(
      new NextRequest(`http://localhost/api/domains/dns?recordId=${addJson.recordId}&domainId=${DOMAIN_ID}`, {
        method: 'DELETE',
      })
    );
    expect(delRes.status).toBe(200);
    expect(cfMethods.some((m) => m.includes('DELETE') && m.includes('/dns_records/cf_rec_a_1'))).toBe(true);
    expect(mockStore.state.domain_dns_records).toHaveLength(0);
  });

  it('wires /api/domains/manage live registrar EPP code lookup & Cloudflare 301 redirect ruleset lifecycle', async () => {
    process.env.REGISTRAR_PROVIDER = 'resellerclub';
    process.env.REGISTRAR_API_USER = 'rc_user';
    process.env.REGISTRAR_API_KEY = 'rc_key';
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_live_test_token_1234567890abcdef';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/domains/details-by-name.json')) {
        return new Response(
          JSON.stringify({ orderid: '98765432', domsecret: 'LIVE-RC-EPP-4499' }),
          { status: 200 }
        );
      }
      if (url.includes('/rulesets/phases/http_request_dynamic_redirect/entrypoint') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({ success: true, result: { id: 'ruleset_redir_1', rules: [] } }),
          { status: 200 }
        );
      }
      if (url.includes('/rulesets/ruleset_redir_1/rules') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ success: true, result: { rules: [{ id: 'cf_rule_301_99' }] } }),
          { status: 200 }
        );
      }
      if (url.includes('/rulesets/ruleset_redir_1/rules/cf_rule_301_99') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
    }) as typeof fetch;

    const eppRes = await managePost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'reveal_epp_code',
        domainId: DOMAIN_ID,
      })
    );
    expect(eppRes.status).toBe(200);
    const eppJson = (await eppRes.json()) as { eppCode: string };
    expect(eppJson.eppCode).toBe('LIVE-RC-EPP-4499');

    const redirRes = await managePost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'add_url_forward',
        domainId: DOMAIN_ID,
        forwardSource: '/blog',
        forwardTarget: 'https://news.shopbd.com',
        forwardType: 301,
      })
    );
    expect(redirRes.status).toBe(200);
    const redirJson = (await redirRes.json()) as { id: string; cloudflareRuleId: string };
    expect(redirJson.cloudflareRuleId).toBe('cf_rule_301_99');

    const delRedirRes = await managePost(
      jsonReq('http://localhost/api/domains/manage', 'POST', {
        action: 'delete_url_forward',
        domainId: DOMAIN_ID,
        forwardId: redirJson.id,
      })
    );
    expect(delRedirRes.status).toBe(200);
    expect(mockStore.state.domain_url_forwards).toHaveLength(0);
  });

  it('provisions, DCV-polls, and deprovisions Cloudflare SaaS Custom Hostnames via /api/hosting/domains', async () => {
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_live_test_token_1234567890abcdef';
    process.env.CLOUDFLARE_SAAS_ZONE_ID = 'cf_saas_zone_88';

    let dcvPollCount = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/custom_hostnames') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'cf_ch_abc123',
              status: 'pending',
              ssl: {
                status: 'pending_validation',
                method: 'txt',
                validation_records: [
                  {
                    txt_name: '_cf-custom-hostname.app.client.com',
                    txt_value: 'dcv-verify-xyz-999',
                  },
                ],
              },
            },
          }),
          { status: 200 }
        );
      }
      if (url.endsWith('/custom_hostnames/cf_ch_abc123') && (!init?.method || init.method === 'GET')) {
        dcvPollCount += 1;
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'cf_ch_abc123',
              status: 'active',
              ssl: { status: 'active', method: 'txt' },
            },
          }),
          { status: 200 }
        );
      }
      if (url.endsWith('/custom_hostnames/cf_ch_abc123') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true, result: { id: 'cf_ch_abc123' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as typeof fetch;

    const createRes = await hostingDomainsPost(
      jsonReq('http://localhost/api/hosting/domains', 'POST', {
        serviceId: SERVICE_ID,
        domainType: 'addon_domain',
        hostname: 'app.client.com',
      })
    );
    expect(createRes.status).toBe(200);
    const createJson = (await createRes.json()) as {
      id: string;
      cloudflareHostnameId: string;
      sslStatus: string;
      dcv: { recordName: string; recordValue: string };
    };
    expect(createJson.cloudflareHostnameId).toBe('cf_ch_abc123');
    expect(createJson.sslStatus).toBe('pending_validation');
    expect(createJson.dcv.recordValue).toBe('dcv-verify-xyz-999');

    const pollRes = await hostingDomainsPatch(
      jsonReq('http://localhost/api/hosting/domains', 'PATCH', {
        id: createJson.id,
        serviceId: SERVICE_ID,
      })
    );
    expect(pollRes.status).toBe(200);
    const pollJson = (await pollRes.json()) as { sslStatus: string };
    expect(dcvPollCount).toBe(1);
    expect(pollJson.sslStatus).toBe('active_tls13');

    const delRes = await hostingDomainsDelete(
      new NextRequest(`http://localhost/api/hosting/domains?id=${createJson.id}&serviceId=${SERVICE_ID}`, {
        method: 'DELETE',
      })
    );
    expect(delRes.status).toBe(200);
    expect(mockStore.state.hosting_addon_domains).toHaveLength(0);
  });

  it('executes live Cloudflare cache purge via /api/v1/deploy and syncs IP WAF block/unblock via /api/admin/waf', async () => {
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_live_test_token_1234567890abcdef';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc_99';
    process.env.CLOUDFLARE_SAAS_ZONE_ID = 'cf_zone_shopbd';

    const cfCalls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      cfCalls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('/zones?name=shopbd.com')) {
        return new Response(
          JSON.stringify({ success: true, result: [{ id: 'cf_zone_shopbd', status: 'active' }] }),
          { status: 200 }
        );
      }
      if (url.includes('/zones/cf_zone_shopbd/purge_cache') && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: true, result: { id: 'cf_zone_shopbd' } }), { status: 200 });
      }
      if (url.endsWith('/firewall/access_rules/rules') && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: true, result: { id: 'cf_waf_rule_555' } }), { status: 200 });
      }
      if (url.endsWith('/firewall/access_rules/rules/cf_waf_rule_555') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true, result: { id: 'cf_waf_rule_555' } }), { status: 200 });
      }
      if (url.endsWith('/settings/security_level') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ success: true, result: { value: 'under_attack' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
    }) as typeof fetch;

    // 1. PAT cache_purge
    const purgeRes = await v1DeployPost(
      jsonReq(
        'http://localhost/api/v1/deploy',
        'POST',
        { action: 'cache_purge', domain: 'shopbd.com' },
        { Authorization: 'Bearer dh_live_phase4_secret_token_99' }
      )
    );
    expect(purgeRes.status).toBe(200);
    expect(cfCalls.some((c) => c.includes('POST') && c.includes('/zones/cf_zone_shopbd/purge_cache'))).toBe(true);

    // 2. Admin WAF IP ban -> pushes Cloudflare Firewall IP Access Rule + deletes on DELETE
    const wafRes = await adminWafPost(
      jsonReq('http://localhost/api/admin/waf', 'POST', {
        action: 'add_rule',
        ruleType: 'ip_address',
        targetValue: '198.51.100.77',
        ruleAction: 'block_403',
        reason: 'Automated brute force attack',
      })
    );
    expect(wafRes.status).toBe(200);
    const wafJson = (await wafRes.json()) as { cloudflareRuleId: string; cloudflareSyncStatus: string };
    expect(wafJson.cloudflareRuleId).toBe('cf_waf_rule_555');
    expect(wafJson.cloudflareSyncStatus).toBe('synced');

    const lockdownRes = await adminWafPost(
      jsonReq('http://localhost/api/admin/waf', 'POST', {
        action: 'toggle_lockdown',
        lockdownSettings: { under_attack_mode: true },
      })
    );
    expect(lockdownRes.status).toBe(200);
    expect(cfCalls.some((c) => c.includes('PATCH') && c.includes('/settings/security_level'))).toBe(true);

    const savedRule = mockStore.state.edge_waf_rules.find((r) => r.target_value === '198.51.100.77');
    expect(savedRule?.cloudflare_rule_id).toBe('cf_waf_rule_555');

    const unbanRes = await adminWafDelete(
      new NextRequest(`http://localhost/api/admin/waf?id=${String(savedRule?.id)}`, { method: 'DELETE' })
    );
    expect(unbanRes.status).toBe(200);
    expect(cfCalls.some((c) => c.includes('DELETE') && c.includes('/firewall/access_rules/rules/cf_waf_rule_555'))).toBe(true);
  });

  it('wires Zero-Touch Provisioner Step 3 to ResellerClub + Cloudflare Zone + DNS Records + SaaS Custom Hostname', async () => {
    process.env.REGISTRAR_PROVIDER = 'resellerclub';
    process.env.REGISTRAR_API_USER = 'rc_user';
    process.env.REGISTRAR_API_KEY = 'rc_key';
    process.env.REGISTRAR_CUSTOMER_ID = 'cust_11';
    process.env.REGISTRAR_DEFAULT_CONTACT_ID = 'contact_22';
    process.env.CLOUDFLARE_DNS_API_TOKEN = 'cf_live_test_token_1234567890abcdef';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc_99';
    process.env.CLOUDFLARE_SAAS_ZONE_ID = 'cf_saas_zone_88';

    let dnsCreateCounter = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/zones?name=zerotouchlive.com')) {
        return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 });
      }
      if (url.endsWith('/zones') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'cf_zone_zt_1',
              status: 'pending',
              name_servers: ['ara.ns.cloudflare.com', 'hal.ns.cloudflare.com'],
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/domains/register.json')) {
        return new Response(JSON.stringify({ entityid: '77889900', status: 'Success' }), { status: 200 });
      }
      if (url.includes('/zones/cf_zone_zt_1/dns_records') && init?.method === 'POST') {
        dnsCreateCounter += 1;
        return new Response(
          JSON.stringify({ success: true, result: { id: `cf_rec_zt_${dnsCreateCounter}`, proxied: true } }),
          { status: 200 }
        );
      }
      if (url.endsWith('/custom_hostnames') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'cf_ch_zt_1',
              status: 'pending',
              ssl: { status: 'active', method: 'txt' },
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
    }) as typeof fetch;

    const ztRes = await executeZeroTouchProvisioning({
      userId: USER_ID,
      customerEmail: 'client@devhost.cloud',
      customerName: 'Demo Client',
      domain: 'zerotouchlive.com',
      planId: 'developer-pro',
      planName: 'Developer Pro Cloud',
      gateway: 'bkash',
      amountBDT: 1500,
      registerDomain: true,
      skipInvoiceMarkPaid: true,
    });

    expect(ztRes.success).toBe(true);
    expect(ztRes.cloudflareZoneId).toBe('cf_zone_zt_1');
    expect(ztRes.registrarProvider).toBe('resellerclub');
    expect(ztRes.registrarOrderId).toBe('77889900');
    expect(ztRes.nameservers).toEqual(['ara.ns.cloudflare.com', 'hal.ns.cloudflare.com']);
    expect(dnsCreateCounter).toBe(6);

    const ztDomain = mockStore.state.domains.find((d) => d.domain_name === 'zerotouchlive.com');
    expect(ztDomain?.registrar_order_id).toBe('77889900');
    expect(ztDomain?.cloudflare_zone_id).toBe('cf_zone_zt_1');

    const ztDns = mockStore.state.domain_dns_records.filter((r) => r.cloudflare_zone_id === 'cf_zone_zt_1');
    expect(ztDns).toHaveLength(6);
    expect(ztDns.every((r) => r.sync_status === 'synced')).toBe(true);

    const ztCh = mockStore.state.hosting_addon_domains.find((h) => h.hostname === 'zerotouchlive.com');
    expect(ztCh?.cloudflare_hostname_id).toBe('cf_ch_zt_1');
  });
});
