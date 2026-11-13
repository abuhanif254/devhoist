import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  hosting_services: MockRow[];
  hosting_project_settings: MockRow[];
  project_deployments: MockRow[];
  project_env_variables: MockRow[];
  hosting_databases: MockRow[];
  hosting_email_accounts: MockRow[];
  hosting_backups: MockRow[];
  hosting_cron_jobs: MockRow[];
  hosting_virtual_filesystem: MockRow[];
  service_autoscaling_rules: MockRow[];
  terminal_and_sql_logs: MockRow[];
  service_uptime_telemetry: MockRow[];
  compute_build_jobs: MockRow[];
  whm_server_nodes: MockRow[];
  catalog_marketplace_stacks: MockRow[];
  catalog_hosting_plans: MockRow[];
  domain_dns_records: MockRow[];
  domains: MockRow[];
  customer_developer_profiles: MockRow[];
  developer_api_logs: MockRow[];
  security_audit_logs: MockRow[];
  service_invoices: MockRow[];
  invoices: MockRow[];
  waf_blocked_ips: MockRow[];
  diagnostic_scans: MockRow[];
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NODE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createInitialDb(): MockDbState {
  return {
    profiles: [
      { id: USER_ID, email: 'client@devhost.cloud', full_name: 'Demo Dev', role: 'client', wallet_balance_bdt: 5000 },
      { id: ADMIN_ID, email: 'founder@devhost.cloud', full_name: 'Founder Admin', role: 'admin', wallet_balance_bdt: 10000 },
    ],
    hosting_services: [
      {
        id: SERVICE_ID,
        user_id: USER_ID,
        domain: 'app.devhost.cloud',
        plan_id: 'developer-pro',
        plan_name: 'Developer Pro Cloud',
        cpanel_username: 'appdvhst',
        server_node: 'sg1',
        ip_address: '103.151.102.45',
        status: 'active',
        ram_limit_mb: 4096,
        ram_used_mb: 320,
        cpu_cores: 4,
        disk_limit_gb: 25,
        inode_limit: 500000,
        inode_used: 12000,
        stack_slug: 'nextjs-15-standalone',
        runtime_family: 'nodejs_passenger',
        container_id: 'dh_appdvhst',
      },
    ],
    hosting_project_settings: [
      {
        id: 'set-1',
        service_id: SERVICE_ID,
        user_id: USER_ID,
        stack_slug: 'nextjs-15-standalone',
        framework_preset: 'nextjs_standalone',
        runtime_version: '22.x LTS',
        install_command: 'npm ci',
        build_command: 'npm run build',
        startup_file: 'server.js',
        output_directory: '.next/standalone',
        git_repo_url: 'https://github.com/devhost-templates/nextjs-15-standalone.git',
        production_branch: 'main',
        webhook_secret_token: 'whsec_test_123456',
      },
    ],
    project_deployments: [
      {
        id: 'dep-old-1',
        service_id: SERVICE_ID,
        user_id: USER_ID,
        commit_sha: 'abc1234',
        commit_message: 'Previous release',
        branch: 'main',
        status: 'superseded',
        is_current_production: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    project_env_variables: [],
    hosting_databases: [],
    hosting_email_accounts: [],
    hosting_backups: [],
    hosting_cron_jobs: [],
    hosting_virtual_filesystem: [],
    service_autoscaling_rules: [],
    terminal_and_sql_logs: [],
    service_uptime_telemetry: [],
    compute_build_jobs: [
      {
        id: 'job_pending_1',
        service_id: SERVICE_ID,
        user_id: USER_ID,
        runtime_family: 'nodejs_passenger',
        stack_slug: 'nextjs-15-standalone',
        status: 'building',
        created_at: new Date().toISOString(),
      },
    ],
    whm_server_nodes: [
      {
        id: NODE_ID,
        node_code: 'sg1',
        node_name: 'Singapore Docker & Caddy Node',
        datacenter_location: 'Singapore (Equinix SG1)',
        ipv4_address: '103.151.102.45',
        whm_hostname: 'sg1.devhost.cloud',
        whm_username: 'root',
        monthly_node_cost_bdt: 3500,
        max_cpanel_slots: 50,
        used_cpanel_slots: 4,
        max_disk_gb: 100,
        allocated_disk_gb: 10,
        auto_provision_enabled: true,
        is_healthy: true,
        node_driver: 'devhost_docker',
        agent_endpoint: 'https://agent-sg1.devhost.cloud',
      },
    ],
    catalog_marketplace_stacks: [],
    catalog_hosting_plans: [{ id: 'plan-1', slug: 'developer-pro', name_en: 'Developer Pro Cloud' }],
    domain_dns_records: [],
    domains: [
      {
        id: 'dom-1',
        user_id: USER_ID,
        domain_name: 'app.devhost.cloud',
        status: 'Active',
        cloudflare_zone_id: 'cf_zone_1',
      },
    ],
    customer_developer_profiles: [
      {
        user_id: USER_ID,
        personal_api_tokens: [],
      },
    ],
    developer_api_logs: [],
    security_audit_logs: [],
    service_invoices: [],
    invoices: [],
    waf_blocked_ips: [],
    diagnostic_scans: [],
  };
}

const mockStore = vi.hoisted(() => ({
  supabaseConfigured: true,
  actorUser: { id: '11111111-1111-4111-8111-111111111111', email: 'client@devhost.cloud', role: 'client' },
  sudoValid: true,
  state: {} as MockDbState,
}));

interface QueryResult {
  data: MockRow | MockRow[] | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

interface MockQueryChain extends PromiseLike<QueryResult> {
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => MockQueryChain;
  insert: (payload: MockRow | MockRow[]) => MockQueryChain;
  upsert: (payload: MockRow | MockRow[], opts?: { onConflict?: string }) => MockQueryChain;
  update: (payload: MockRow) => MockQueryChain;
  delete: () => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  neq: (col: string, val: unknown) => MockQueryChain;
  in: (col: string, vals: unknown[]) => MockQueryChain;
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryChain;
  limit: (n: number) => MockQueryChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
}

function getTable(state: MockDbState, name: string): MockRow[] {
  const key = name as keyof MockDbState;
  if (!state[key]) {
    (state as unknown as Record<string, MockRow[]>)[name] = [];
  }
  return state[key];
}

function createQueryBuilder(tableName: string): MockQueryChain {
  let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  let payloadData: MockRow | MockRow[] = {};
  let upsertConflictCol = '';
  let countOnly = false;
  const predicates: Array<(r: MockRow) => boolean> = [];

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
      predicates.push((r) => r[col] === val);
      return chain;
    },
    neq: (col: string, val: unknown) => {
      predicates.push((r) => r[col] !== val);
      return chain;
    },
    in: (col: string, vals: unknown[]) => {
      predicates.push((r) => vals.includes(r[col]));
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    single: async () => {
      const res = execute();
      const first = Array.isArray(res.data) ? res.data[0] || null : res.data;
      return { data: first, error: first ? null : res.error };
    },
    maybeSingle: async () => {
      const res = execute();
      const first = Array.isArray(res.data) ? res.data[0] || null : res.data;
      return { data: first, error: res.error };
    },
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(execute()).then(onfulfilled, onrejected),
  };

  return chain;
}

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => mockStore.supabaseConfigured,
  isDevSandboxMode: () => process.env.DEV_SANDBOX_MODE === 'true',
  getServiceSupabase: () =>
    mockStore.supabaseConfigured ? { from: (t: string) => createQueryBuilder(t) } : null,
  supabase: null,
}));

vi.mock('@/lib/authGuard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authGuard')>('@/lib/authGuard');
  return {
    ...actual,
    requireUser: vi.fn(async () => ({
      ok: true,
      user: mockStore.actorUser,
    })),
    requireAdmin: vi.fn(async () => ({
      ok: true,
      user: { ...mockStore.actorUser, role: 'admin' },
    })),
    requireServiceAccess: vi.fn(async (_req: unknown, serviceId?: string | null) => ({
      ok: true,
      user: mockStore.actorUser,
      serviceId: serviceId || SERVICE_ID,
    })),
    verifySudoToken: vi.fn(async () => mockStore.sudoValid),
  };
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const originalFetch = globalThis.fetch;
const CF_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');

describe('Phase 5: Hybrid Compute, Build Broker, R2 Artifacts & Fail-Closed Control Plane', () => {
  beforeEach(() => {
    mockStore.supabaseConfigured = true;
    mockStore.sudoValid = true;
    mockStore.actorUser = { id: USER_ID, email: 'client@devhost.cloud', role: 'client' };
    mockStore.state = createInitialDb();

    delete process.env.DEV_SANDBOX_MODE;
    delete process.env.COMPUTE_AGENT_URL;
    delete process.env.DEVHOST_COMPUTE_AGENT_SECRET;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    delete process.env.CLOUDFLARE_R2_API_TOKEN;
    delete process.env.CLOUDFLARE_BUILD_QUEUE_ID;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_DNS_API_TOKEN;
    delete (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL];
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    delete (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL];
    const { clearSandboxStorageForTest } = await import('@/lib/cloudflareStorageQueue');
    clearSandboxStorageForTest();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. SQL MIGRATION & WRANGLER CONFIG CONTRACT
  // =========================================================================
  it('1. phase5_compute_build_plane.sql & wrangler.jsonc define compute_build_jobs, node_driver, and R2/Queue bindings', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', 'phase5_compute_build_plane.sql'),
      'utf-8'
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.compute_build_jobs');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS node_driver');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS agent_endpoint');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS runtime_family');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS r2_object_key');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS quota_mb');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS command_or_query');
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");

    const wranglerRaw = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf-8');
    const wrangler = JSON.parse(wranglerRaw) as {
      r2_buckets?: Array<{ binding: string; bucket_name: string }>;
      queues?: { producers?: Array<{ binding: string; queue: string }> };
    };
    expect(wrangler.r2_buckets?.some((b) => b.binding === 'DEVHOST_ARTIFACTS_BUCKET')).toBe(true);
    expect(wrangler.queues?.producers?.some((q) => q.binding === 'DEVHOST_BUILD_QUEUE')).toBe(true);
  });

  // =========================================================================
  // 2. CLOUDFLARE R2 + QUEUE BINDING & EDGE STATIC ROUTER
  // =========================================================================
  it('2. R2 + Build Queue fail closed when unconfigured outside sandbox, and work via native Worker bindings + /api/edge-site', async () => {
    const {
      getStorageAndQueueStatus,
      putR2Artifact,
      enqueueBuildJob,
    } = await import('@/lib/cloudflareStorageQueue');
    const { GET: edgeSiteGet } = await import('@/app/api/edge-site/route');

    // A. Unconfigured & not in sandbox -> fail closed
    const statusOff = getStorageAndQueueStatus();
    expect(statusOff.r2Configured).toBe(false);
    expect(statusOff.queueConfigured).toBe(false);

    const putOff = await putR2Artifact('sites/x/index.html', '<h1>Hi</h1>', 'text/html');
    expect(putOff.ok).toBe(false);
    expect(putOff.mode).toBe('unconfigured');

    const qOff = await enqueueBuildJob({
      jobId: 'bld_off',
      serviceId: SERVICE_ID,
      userId: USER_ID,
      domain: 'app.devhost.cloud',
      cpanelUser: 'appdvhst',
      stackSlug: 'nextjs-15-standalone',
      runtimeFamily: 'nodejs_passenger',
      runtimeVersion: '22.x LTS',
      triggerSource: 'manual_dashboard',
      gitRepoUrl: 'https://github.com/devhost/demo.git',
      gitBranch: 'main',
      commitSha: '1234567',
      installCommand: 'npm ci',
      buildCommand: 'npm run build',
      startupFile: 'server.js',
      outputDirectory: '.next/standalone',
      requestedAt: new Date().toISOString(),
    });
    expect(qOff.ok).toBe(false);
    expect(qOff.mode).toBe('unconfigured');

    const edgeRes503 = await edgeSiteGet(
      new NextRequest(`http://localhost/api/edge-site?site=${SERVICE_ID}`)
    );
    expect(edgeRes503.status).toBe(503);

    // B. Attach native Worker bindings via Symbol.for('__cloudflare-context__')
    const r2Store = new Map<string, { body: Uint8Array; contentType: string }>();
    const sentMessages: unknown[] = [];

    (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL] = {
      env: {
        DEVHOST_ARTIFACTS_BUCKET: {
          put: async (
            key: string,
            val: string | ArrayBuffer | ArrayBufferView,
            opts?: { httpMetadata?: { contentType?: string } }
          ) => {
            const bytes =
              typeof val === 'string'
                ? new TextEncoder().encode(val)
                : val instanceof ArrayBuffer
                  ? new Uint8Array(val)
                  : new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
            r2Store.set(key, {
              body: bytes,
              contentType: opts?.httpMetadata?.contentType || 'application/octet-stream',
            });
            return { key, etag: `etag_${key}` };
          },
          get: async (key: string) => {
            const hit = r2Store.get(key);
            if (!hit) return null;
            return {
              key,
              etag: `etag_${key}`,
              httpMetadata: { contentType: hit.contentType },
              text: async () => new TextDecoder().decode(hit.body),
              arrayBuffer: async () =>
                hit.body.buffer.slice(hit.body.byteOffset, hit.body.byteOffset + hit.body.byteLength),
            };
          },
          delete: async (key: string) => {
            r2Store.delete(key);
          },
        },
        DEVHOST_BUILD_QUEUE: {
          send: async (msg: unknown) => {
            sentMessages.push(msg);
          },
        },
      },
    };

    const statusOn = getStorageAndQueueStatus();
    expect(statusOn.r2Configured).toBe(true);
    expect(statusOn.r2Mode).toBe('worker_binding');
    expect(statusOn.queueMode).toBe('worker_binding');

    // Deploy Static Site via /api/hosting/install-stack with static_edge blueprint
    const { POST: installStack } = await import('@/app/api/hosting/install-stack/route');
    const staticInstallRes = await installStack(
      new NextRequest('http://localhost/api/hosting/install-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          stackSlug: 'astro-mdx-blog',
          domain: 'app.devhost.cloud',
          cpanelUser: 'appdvhst',
        }),
      })
    );
    expect(staticInstallRes.status).toBe(200);
    const staticInstallJson = await staticInstallRes.json();
    expect(staticInstallJson.result.deploymentMode).toBe('r2_static_edge');
    expect(staticInstallJson.result.r2ArtifactKey).toContain(`sites/${SERVICE_ID}/releases/`);

    // Serve via Edge Static Site Router (/api/edge-site)
    const edgeOk = await edgeSiteGet(
      new NextRequest(`http://localhost/api/edge-site?site=${SERVICE_ID}&path=index.html`)
    );
    expect(edgeOk.status).toBe(200);
    expect(edgeOk.headers.get('X-DevHost-Edge-Router')).toBe('r2');
    const html = await edgeOk.text();
    expect(html).toContain('app.devhost.cloud');

    // SPA fallback on unknown extensionless route
    const edgeSpa = await edgeSiteGet(
      new NextRequest(`http://localhost/api/edge-site?site=${SERVICE_ID}&path=pricing`)
    );
    expect(edgeSpa.status).toBe(200);
  });

  // =========================================================================
  // 3. HMAC-SHA256 SIGNED CALLBACK SECURITY & REPLAY PROTECTION
  // =========================================================================
  it('3. /api/compute/agent-callback enforces HMAC-SHA256 signature + replay window and updates DB on valid webhook', async () => {
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'super_secret_agent_key_2026';

    const { signAgentPayload } = await import('@/lib/computeAgentClient');
    const { POST: agentCallback } = await import('@/app/api/compute/agent-callback/route');

    const callbackPayload = JSON.stringify({
      jobId: 'job_pending_1',
      serviceId: SERVICE_ID,
      domain: 'app.devhost.cloud',
      containerId: 'dh_appdvhst_v2',
      status: 'live',
      liveUrl: 'https://app.devhost.cloud',
      durationSeconds: 6,
      buildLogs: '[build] Vite + Next standalone complete',
      metrics: { ramUsedMb: 512, diskUsedGb: 1.4, inodesUsed: 19000 },
    });

    // Reject unsigned callback
    const unauthRes = await agentCallback(
      new NextRequest('http://localhost/api/compute/agent-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: callbackPayload,
      })
    );
    expect(unauthRes.status).toBe(401);

    // Reject expired timestamp (> 5 minutes skew)
    const staleSig = await signAgentPayload(
      process.env.DEVHOST_COMPUTE_AGENT_SECRET,
      callbackPayload,
      String(Date.now() - 10 * 60 * 1000)
    );
    const staleRes = await agentCallback(
      new NextRequest('http://localhost/api/compute/agent-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-devhost-timestamp': staleSig.timestamp,
          'x-devhost-signature': staleSig.signatureHeader,
        },
        body: callbackPayload,
      })
    );
    expect(staleRes.status).toBe(401);

    // Accept valid fresh HMAC-SHA256 callback
    const validSig = await signAgentPayload(
      process.env.DEVHOST_COMPUTE_AGENT_SECRET,
      callbackPayload
    );
    const okRes = await agentCallback(
      new NextRequest('http://localhost/api/compute/agent-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-devhost-timestamp': validSig.timestamp,
          'x-devhost-signature': validSig.signatureHeader,
        },
        body: callbackPayload,
      })
    );
    expect(okRes.status).toBe(200);
    const okJson = await okRes.json();
    expect(okJson.success).toBe(true);
    expect(mockStore.state.compute_build_jobs[0].status).toBe('live');
    expect(mockStore.state.hosting_services[0].container_id).toBe('dh_appdvhst_v2');
    expect(mockStore.state.hosting_services[0].ram_used_mb).toBe(512);
  });

  // =========================================================================
  // 4. ALL DYNAMIC RUNTIME FAMILIES & HMAC COMPUTE DISPATCH
  // =========================================================================
  it('4. Dynamic runtime families (nodejs, php, python, docker) enqueue to Build Queue + dispatch signed calls to devhost-agent', async () => {
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase5_shared_secret';

    const queuedMessages: Array<{ stackSlug: string; runtimeFamily: string }> = [];
    (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL] = {
      env: {
        DEVHOST_BUILD_QUEUE: {
          send: async (msg: { stackSlug: string; runtimeFamily: string }) => {
            queuedMessages.push(msg);
          },
        },
      },
    };

    const agentRequests: Array<{ url: string; signature: string | null }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = new Headers(init?.headers);
      agentRequests.push({ url, signature: headers.get('x-devhost-signature') });

      if (url.includes('/v1/containers/provision')) {
        return new Response(
          JSON.stringify({
            containerId: 'dh_live_node_99',
            upstreamPort: 3188,
            liveUrl: 'https://app.devhost.cloud',
            healthStatus: 'healthy',
            durationSeconds: 4,
            buildLogs: '[agent] Container running',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/v1/databases/provision')) {
        return new Response(
          JSON.stringify({ dbName: 'appdvhst_db', dbUsername: 'appdvhst_usr', host: '103.151.102.45', port: 5432 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const { POST: installStack } = await import('@/app/api/hosting/install-stack/route');
    const slugs = [
      'nextjs-15-standalone',
      'laravel-11-saas',
      'fastapi-django-python',
      'n8n-workflow-automation',
    ];

    for (const slug of slugs) {
      const res = await installStack(
        new NextRequest('http://localhost/api/hosting/install-stack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: SERVICE_ID,
            stackSlug: slug,
            domain: 'app.devhost.cloud',
          }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.deploymentMode).toBe('docker_caddy_agent');
      expect(data.result.containerId).toBe('dh_live_node_99');
    }

    expect(queuedMessages.map((q) => q.runtimeFamily)).toEqual([
      'nodejs_passenger',
      'php_litespeed',
      'python_wsgi_asgi',
      'docker_kvm_vps',
    ]);
    expect(agentRequests.every((r) => r.signature && r.signature.startsWith('sha256='))).toBe(true);
  });

  // =========================================================================
  // 5. FAIL-CLOSED 503 ENFORCEMENT ON LIVE CONTROL ENDPOINTS + HAPPY PATHS
  // =========================================================================
  it('5. Compute/Console/Files/Databases/Email/Backups/Autoscaler/Deployments fail closed 503 when unconfigured & execute live when agent configured', async () => {
    // Strip node agent_endpoint to test truly unconfigured node outside sandbox
    mockStore.state.whm_server_nodes[0].agent_endpoint = null;

    const { POST: computePost } = await import('@/app/api/compute/route');
    const { POST: consolePost } = await import('@/app/api/hosting/console/route');
    const { POST: filesPost } = await import('@/app/api/hosting/files/route');
    const { POST: dbPost } = await import('@/app/api/hosting/databases/route');
    const { POST: emailPost } = await import('@/app/api/hosting/email/route');
    const { POST: backupsPost } = await import('@/app/api/hosting/backups-cron/route');
    const { POST: autoscalerPost } = await import('@/app/api/hosting/autoscaler/route');
    const { POST: deployPost } = await import('@/app/api/hosting/deployments/route');

    const failClosedChecks = [
      computePost(
        new NextRequest('http://localhost/api/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: SERVICE_ID, action: 'restart' }),
        })
      ),
      consolePost(
        new NextRequest('http://localhost/api/hosting/console', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: SERVICE_ID, consoleType: 'jailed_ssh', commandOrQuery: 'ls -la' }),
        })
      ),
      filesPost(
        new NextRequest('http://localhost/api/hosting/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_file',
            serviceId: SERVICE_ID,
            filePath: '/public_html/app.js',
            contentText: 'console.log("ok")',
          }),
        })
      ),
      dbPost(
        new NextRequest('http://localhost/api/hosting/databases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_database',
            serviceId: SERVICE_ID,
            dbSuffix: 'prod',
            dbEngine: 'PostgreSQL 16',
          }),
        })
      ),
      emailPost(
        new NextRequest('http://localhost/api/hosting/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_mailbox',
            serviceId: SERVICE_ID,
            localPart: 'ops',
          }),
        })
      ),
      backupsPost(
        new NextRequest('http://localhost/api/hosting/backups-cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_snapshot', serviceId: SERVICE_ID, scope: 'full_account' }),
        })
      ),
      autoscalerPost(
        new NextRequest('http://localhost/api/hosting/autoscaler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'scale_now', serviceId: SERVICE_ID }),
        })
      ),
      deployPost(
        new NextRequest('http://localhost/api/hosting/deployments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'trigger_manual', serviceId: SERVICE_ID }),
        })
      ),
    ];

    const responses = await Promise.all(failClosedChecks);
    for (const res of responses) {
      expect(res.status).toBe(503);
    }

    // Now restore compute agent endpoint & secret + mock live agent fetch
    mockStore.state.whm_server_nodes[0].agent_endpoint = 'https://agent-sg1.devhost.cloud';
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase5_live_secret';

    const calledEndpoints: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      calledEndpoints.push(url);
      if (url.includes('/v1/telemetry/')) {
        return new Response(
          JSON.stringify({
            serviceId: SERVICE_ID,
            domain: 'app.devhost.cloud',
            containerId: 'dh_appdvhst',
            status: 'running',
            cpuPercent: 12.5,
            ramUsedMb: 440,
            ramLimitMb: 4096,
            diskUsedGb: 1.2,
            inodesUsed: 8400,
            httpStatus: 200,
            uptimeSeconds: 12000,
            logs: '[live] OK',
            checkedAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      }
      if (url.includes('/v1/console/ssh')) {
        return new Response(JSON.stringify({ output: 'total 4\ndrwxr-xr-x 2 app app 4096 .', exitCode: 0, executionTimeMs: 9 }), { status: 200 });
      }
      if (url.includes('/v1/files')) {
        return new Response(JSON.stringify({ synced: true, sizeBytes: 17, reloaded: true }), { status: 200 });
      }
      if (url.includes('/v1/containers/scale')) {
        return new Response(JSON.stringify({ scaled: true, ramLimitMb: 4096, cpuCores: 2 }), { status: 200 });
      }
      if (url.includes('/v1/backups/snapshot')) {
        return new Response(JSON.stringify({ sizeMb: 64.2, r2ObjectKey: `backups/${SERVICE_ID}/snap.tar.gz`, checksumSha256: 'abc' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, action: 'restart', status: 'running', message: 'Container restarted.' }), { status: 200 });
    }) as typeof fetch;

    const { GET: computeGet } = await import('@/app/api/compute/route');
    const cGet = await computeGet(
      new NextRequest(`http://localhost/api/compute?serviceId=${SERVICE_ID}`)
    );
    expect(cGet.status).toBe(200);
    const cGetJson = await cGet.json();
    expect(cGetJson.telemetry.cpuPercent).toBe(12.5);

    const sshOk = await consolePost(
      new NextRequest('http://localhost/api/hosting/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: SERVICE_ID, consoleType: 'jailed_ssh', commandOrQuery: 'ls -la' }),
      })
    );
    expect(sshOk.status).toBe(200);
    const sshJson = await sshOk.json();
    expect(sshJson.source).toBe('live_agent');

    // Path traversal remains strictly 403 even with live agent configured
    const traversalBlocked = await filesPost(
      new NextRequest('http://localhost/api/hosting/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_file',
          serviceId: SERVICE_ID,
          filePath: '/../../etc/passwd',
          contentText: 'hacked',
        }),
      })
    );
    expect(traversalBlocked.status).toBe(403);

    const scaleOk = await autoscalerPost(
      new NextRequest('http://localhost/api/hosting/autoscaler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scale_now', serviceId: SERVICE_ID }),
      })
    );
    expect(scaleOk.status).toBe(200);
    const scaleJson = await scaleOk.json();
    expect(scaleJson.source).toBe('live_agent');
    expect(calledEndpoints.some((u) => u.includes('/v1/containers/scale'))).toBe(true);
  });

  // =========================================================================
  // 6. SELF-HEALING PROBE HONESTY, PUBLIC API V1 DEPLOY, NODES CRM PING & SYSTEM AUDIT CHECK 11
  // =========================================================================
  it('6. Self-healing fails honestly outside sandbox; Public API v1 deploy, Admin Nodes Ping & System Audit Check 11 execute live', async () => {
    const { probeServiceHealth } = await import('@/lib/selfHealingEngine');
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    const failedProbe = await probeServiceHealth('app.devhost.cloud', 1000);
    expect(failedProbe.isHealthy).toBe(false);
    expect(failedProbe.statusCode).toBe(503);
    expect(failedProbe.detectedIncident).toBe('http_503_passenger_hang');

    // Seed valid PAT token for /api/v1/deploy
    const rawPat = 'dh_live_phase5_pat_token_123';
    mockStore.state.customer_developer_profiles[0].personal_api_tokens = [
      {
        id: 'tok-1',
        token_hash: await sha256Hex(rawPat),
        scopes: ['git:deploy', 'services:write'],
        revoked: false,
      },
    ];

    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase5_live_secret';
    process.env.COMPUTE_AGENT_URL = 'https://agent-sg1.devhost.cloud';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/health')) {
        return new Response(
          JSON.stringify({
            healthy: true,
            version: 'devhost-agent/1.0.0',
            dockerAvailable: true,
            caddyAvailable: true,
            activeContainers: 14,
            freeDiskGb: 88,
            loadAvg: 0.41,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/v1/builds/deploy')) {
        return new Response(
          JSON.stringify({
            containerId: 'dh_pat_deployed_1',
            liveUrl: 'https://app.devhost.cloud',
            healthStatus: 'healthy',
            durationSeconds: 3,
            buildLogs: '[v1/deploy] Build complete',
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    // A. Public API v1 deploy dispatch
    const { POST: v1Deploy } = await import('@/app/api/v1/deploy/route');
    const deployRes = await v1Deploy(
      new NextRequest('http://localhost/api/v1/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rawPat}`,
        },
        body: JSON.stringify({
          action: 'deploy',
          domain: 'app.devhost.cloud',
          branch: 'main',
          commitSha: '9f8e7d6',
        }),
      })
    );
    expect(deployRes.status).toBe(200);
    const deployJson = await deployRes.json();
    expect(deployJson.status).toBe('success');
    expect(deployJson.liveUrl).toBe('https://app.devhost.cloud');

    // B. Admin Nodes CRM ping_node & save_node
    mockStore.actorUser = { id: ADMIN_ID, email: 'founder@devhost.cloud', role: 'admin' };
    const { POST: nodesCrmPost } = await import('@/app/api/admin/nodes-crm/route');
    const pingRes = await nodesCrmPost(
      new NextRequest('http://localhost/api/admin/nodes-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping_node',
          nodeId: NODE_ID,
        }),
      })
    );
    expect(pingRes.status).toBe(200);
    const pingJson = await pingRes.json();
    expect(pingJson.health.version).toBe('devhost-agent/1.0.0');
    expect(mockStore.state.whm_server_nodes[0].agent_version).toBe('devhost-agent/1.0.0');

    // C. Admin System Audit Check 11
    const { GET: systemAuditGet } = await import('@/app/api/admin/system-audit/route');
    const auditRes = await systemAuditGet(new NextRequest('http://localhost/api/admin/system-audit'));
    expect(auditRes.status).toBe(200);
    const auditJson = await auditRes.json();
    const check11 = (auditJson.checks as Array<{ id: string; details?: Record<string, unknown> }>).find(
      (c) => c.id === 'compute_build_plane'
    );
    expect(check11).toBeTruthy();
    expect(check11?.details?.agentHealthy).toBe(true);
  });
});
