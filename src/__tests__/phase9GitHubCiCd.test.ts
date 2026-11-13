import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { zipSync, strToU8 } from 'fflate';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAgentHandler } from '../../devhost-agent/server.mjs';
import { encryptEnvValue } from '@/lib/projectEngine';
import { clearSandboxStorageForTest, getR2Artifact, getSandboxQueueSnapshot } from '@/lib/cloudflareStorageQueue';
import { clearSandboxGitHubStateForTest } from '@/lib/githubIntegration';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  hosting_services: MockRow[];
  hosting_project_settings: MockRow[];
  github_oauth_accounts: MockRow[];
  project_git_connections: MockRow[];
  hosting_preview_environments: MockRow[];
  project_deployments: MockRow[];
  project_env_variables: MockRow[];
  compute_build_jobs: MockRow[];
  whm_server_nodes: MockRow[];
  security_audit_logs: MockRow[];
}

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SERVICE_STATIC_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SERVICE_NODE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createInitialDb(): MockDbState {
  return {
    profiles: [
      { id: USER_A, email: 'alice@devhost.cloud', full_name: 'Alice Dev', role: 'client' },
      { id: USER_B, email: 'bob@devhost.cloud', full_name: 'Bob Attacker', role: 'client' },
    ],
    hosting_services: [
      {
        id: SERVICE_STATIC_ID,
        user_id: USER_A,
        domain: 'static-git.devhost.cloud',
        plan_id: 'starter',
        cpanel_username: 'staticusr',
        server_node: 'sg1',
        ip_address: '103.151.102.45',
        status: 'active',
        ram_limit_mb: 1024,
        cpu_cores: 1,
        disk_limit_gb: 5,
        inode_limit: 250000,
        stack_slug: 'vite-react-spa',
        runtime_family: 'static_edge',
      },
      {
        id: SERVICE_NODE_ID,
        user_id: USER_A,
        domain: 'node-git.devhost.cloud',
        plan_id: 'developer-pro',
        cpanel_username: 'nodeusr',
        server_node: 'sg1',
        ip_address: '103.151.102.45',
        status: 'active',
        ram_limit_mb: 2048,
        cpu_cores: 2,
        disk_limit_gb: 15,
        inode_limit: 500000,
        stack_slug: 'nextjs-15-standalone',
        runtime_family: 'nodejs_passenger',
      },
    ],
    hosting_project_settings: [
      {
        id: 'set-static',
        service_id: SERVICE_STATIC_ID,
        user_id: USER_A,
        stack_slug: 'vite-react-spa',
        production_branch: 'main',
        auto_deploy_on_push: true,
        output_directory: 'dist',
      },
      {
        id: 'set-node',
        service_id: SERVICE_NODE_ID,
        user_id: USER_A,
        stack_slug: 'nextjs-15-standalone',
        production_branch: 'main',
        install_command: 'npm ci',
        build_command: 'npm run build',
        startup_file: 'server.js',
        output_directory: '.next/standalone',
        auto_deploy_on_push: true,
      },
    ],
    github_oauth_accounts: [],
    project_git_connections: [],
    hosting_preview_environments: [],
    project_deployments: [],
    project_env_variables: [],
    compute_build_jobs: [],
    whm_server_nodes: [],
    security_audit_logs: [],
  };
}

const mockStore = vi.hoisted(() => ({
  supabaseConfigured: true,
  activeUserId: '11111111-1111-4111-8111-111111111111',
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
  const record = state as unknown as Record<string, MockRow[]>;
  if (!record[name]) record[name] = [];
  return record[name];
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
      const conflictCols = upsertConflictCol
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
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
      for (const r of matched) Object.assign(r, payloadData);
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
    if (countOnly) return { data: null, error: null, count: matched.length };
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
    requireUser: vi.fn(async () => {
      const profile =
        mockStore.state.profiles.find((p) => p.id === mockStore.activeUserId) ||
        mockStore.state.profiles[0];
      return {
        ok: true,
        user: { id: mockStore.activeUserId, email: String(profile?.email || 'alice@devhost.cloud') },
        profile: {
          id: mockStore.activeUserId,
          email: String(profile?.email || 'alice@devhost.cloud'),
          full_name: String(profile?.full_name || 'Alice Dev'),
          role: 'client' as const,
          wallet_balance_bdt: 1000,
        },
        role: 'client' as const,
        token: 'mock-jwt',
        isAdmin: false,
        scopes: ['*'],
        authMethod: 'session' as const,
      };
    }),
    requireServiceAccess: vi.fn(async (_req: Request, serviceId: string) => {
      const srv = mockStore.state.hosting_services.find((s) => s.id === serviceId) || null;
      return {
        ok: true,
        user: { id: mockStore.activeUserId, email: 'alice@devhost.cloud' },
        profile: {
          id: mockStore.activeUserId,
          email: 'alice@devhost.cloud',
          full_name: 'Alice Dev',
          role: 'client' as const,
          wallet_balance_bdt: 1000,
        },
        role: 'client' as const,
        token: 'mock-jwt',
        isAdmin: false,
        isTeamMember: false,
        serviceId,
        scopes: ['*'],
        authMethod: 'session' as const,
        serviceRow: srv,
      };
    }),
  };
});

function signWebhookPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

async function invokeAgent(
  handler: ReturnType<typeof createAgentHandler>,
  opts: { method: string; path: string; body?: unknown; secret: string }
): Promise<{ status: number; json: Record<string, unknown> }> {
  const rawBody = opts.body !== undefined ? JSON.stringify(opts.body) : '';
  const ts = String(Date.now());
  const sig = createHmac('sha256', opts.secret).update(`${ts}.${rawBody}`).digest('hex');

  const req = Readable.from([Buffer.from(rawBody)]) as unknown as IncomingMessage;
  req.method = opts.method;
  req.url = opts.path;
  req.headers = {
    host: 'agent-local',
    'content-type': 'application/json',
    'x-devhost-timestamp': ts,
    'x-devhost-signature': `sha256=${sig}`,
    'x-devhost-nonce': `nonce-${Date.now()}-${Math.random()}`,
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
const originalEnv = { ...process.env };

describe('Phase 9: GitHub OAuth Integration, Real Push Auto-Deploys & Ephemeral PR Previews', () => {
  let tempDir = '';

  beforeEach(() => {
    mockStore.supabaseConfigured = true;
    mockStore.activeUserId = USER_A;
    mockStore.state = createInitialDb();
    clearSandboxStorageForTest();
    clearSandboxGitHubStateForTest();

    process.env.DEV_SANDBOX_MODE = 'false';
    process.env.GITHUB_CLIENT_ID = 'gh_client_test_id';
    process.env.GITHUB_CLIENT_SECRET = 'gh_client_test_secret';
    process.env.DEVHOST_SUDO_HMAC_SECRET = 'phase9_hmac_secret_value_32bytes_min';
    process.env.ENV_ENCRYPTION_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://panel.example.com';
    delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_API_TOKEN;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    delete process.env.DEVHOST_BUILD_QUEUE_ID;
    delete process.env.COMPUTE_AGENT_URL;
    delete process.env.DEVHOST_COMPUTE_AGENT_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('1. Fails closed (503) when GitHub OAuth credentials or Supabase are unconfigured', async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    process.env.DEV_SANDBOX_MODE = 'true';

    const { GET: connectGet } = await import('@/app/api/integrations/github/connect/route');
    const missingOAuthRes = await connectGet(
      new NextRequest('http://localhost/api/integrations/github/connect')
    );
    expect(missingOAuthRes.status).toBe(503);

    process.env.DEV_SANDBOX_MODE = 'false';
    mockStore.supabaseConfigured = false;
    process.env.GITHUB_CLIENT_ID = 'gh_client_test_id';
    process.env.GITHUB_CLIENT_SECRET = 'gh_client_test_secret';

    const noDbRes = await connectGet(
      new NextRequest('http://localhost/api/integrations/github/connect')
    );
    expect(noDbRes.status).toBe(503);

    const { GET: previewsGet } = await import('@/app/api/hosting/previews/route');
    const noDbPreviewsRes = await previewsGet(
      new NextRequest(`http://localhost/api/hosting/previews?serviceId=${SERVICE_STATIC_ID}`)
    );
    expect(noDbPreviewsRes.status).toBe(503);
  });

  it('2. Executes GitHub OAuth connect + callback, blocks CSRF/Login-CSRF, encrypts tokens at rest, and never leaks secrets on /repos', async () => {
    const { GET: connectGet } = await import('@/app/api/integrations/github/connect/route');
    const { GET: callbackGet } = await import('@/app/api/integrations/github/callback/route');
    const { GET: reposGet } = await import('@/app/api/integrations/github/repos/route');

    const initRes = await connectGet(
      new NextRequest(
        `https://panel.example.com/api/integrations/github/connect?serviceId=${SERVICE_STATIC_ID}&returnTo=/dashboard/services`
      )
    );
    expect(initRes.status).toBe(200);
    const initJson = (await initRes.json()) as {
      authorizeUrl: string;
      state: string;
    };
    expect(initJson.authorizeUrl).toContain('https://github.com/login/oauth/authorize');
    expect(initJson.authorizeUrl).toContain('client_id=gh_client_test_id');
    const nonceCookie = initRes.cookies.get('devhost_github_oauth_nonce')?.value || '';
    expect(nonceCookie.length).toBeGreaterThan(10);

    // Tampered state rejected with 400
    const tamperedRes = await callbackGet(
      new NextRequest('https://panel.example.com/api/integrations/github/callback?code=c1&state=bad.sig', {
        headers: { accept: 'application/json' },
      })
    );
    expect(tamperedRes.status).toBe(400);

    // Login-CSRF attempt: Alice's signed state replayed while Bob is logged in -> 403
    mockStore.activeUserId = USER_B;
    const loginCsrfRes = await callbackGet(
      new NextRequest(
        `https://panel.example.com/api/integrations/github/callback?code=c1&state=${encodeURIComponent(
          initJson.state
        )}`,
        { headers: { accept: 'application/json' } }
      )
    );
    expect(loginCsrfRes.status).toBe(403);
    expect(
      mockStore.state.security_audit_logs.some((l) => l.action_type === 'GITHUB_OAUTH_CSRF_MISMATCH')
    ).toBe(true);

    // Mismatched nonce cookie rejected -> 403
    mockStore.activeUserId = USER_A;
    const badCookieRes = await callbackGet(
      new NextRequest(
        `https://panel.example.com/api/integrations/github/callback?code=c1&state=${encodeURIComponent(
          initJson.state
        )}`,
        {
          headers: {
            accept: 'application/json',
            cookie: 'devhost_github_oauth_nonce=wrong_nonce_value',
          },
        }
      )
    );
    expect(badCookieRes.status).toBe(403);

    // Happy path OAuth code exchange + viewer lookup + encrypted persistence
    const secretOAuthToken = 'gho_super_secret_oauth_token_987654321';
    const secretRefreshToken = 'ghr_super_secret_refresh_token_123456';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return new Response(
          JSON.stringify({
            access_token: secretOAuthToken,
            refresh_token: secretRefreshToken,
            scope: 'repo,read:user,admin:repo_hook',
            expires_in: 28800,
          }),
          { status: 200 }
        );
      }
      if (url === 'https://api.github.com/user') {
        return new Response(
          JSON.stringify({ id: 778899, login: 'alice-octo', avatar_url: 'https://avatars.example/alice.png' }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.github.com/user/repos')) {
        return new Response(
          JSON.stringify([
            {
              id: 5001,
              name: 'portfolio-site',
              full_name: 'alice-octo/portfolio-site',
              private: true,
              default_branch: 'main',
              html_url: 'https://github.com/alice-octo/portfolio-site',
              clone_url: 'https://github.com/alice-octo/portfolio-site.git',
              updated_at: '2026-11-13T00:00:00Z',
            },
          ]),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const cbRes = await callbackGet(
      new NextRequest(
        `https://panel.example.com/api/integrations/github/callback?code=valid_code_123&state=${encodeURIComponent(
          initJson.state
        )}`,
        {
          headers: {
            accept: 'application/json',
            cookie: `devhost_github_oauth_nonce=${nonceCookie}`,
          },
        }
      )
    );
    expect(cbRes.status).toBe(200);
    const cbJsonText = JSON.stringify(await cbRes.json());
    expect(cbJsonText).not.toContain(secretOAuthToken);
    expect(cbJsonText).not.toContain(secretRefreshToken);

    // Stored DB row contains AES-256-GCM ciphertexts, NEVER plaintext tokens
    expect(mockStore.state.github_oauth_accounts).toHaveLength(1);
    const dbAccount = mockStore.state.github_oauth_accounts[0];
    expect(String(dbAccount.access_token_encrypted)).not.toContain(secretOAuthToken);
    expect(String(dbAccount.refresh_token_encrypted)).not.toContain(secretRefreshToken);

    // Repository listing never leaks ciphertexts or OAuth tokens
    const reposRes = await reposGet(
      new NextRequest(`https://panel.example.com/api/integrations/github/repos?serviceId=${SERVICE_STATIC_ID}`)
    );
    expect(reposRes.status).toBe(200);
    const reposRaw = await reposRes.text();
    expect(reposRaw).not.toContain(secretOAuthToken);
    expect(reposRaw).not.toContain(String(dbAccount.access_token_encrypted));
    const reposJson = JSON.parse(reposRaw) as {
      connected: boolean;
      repos: Array<{ fullName: string }>;
    };
    expect(reposJson.connected).toBe(true);
    expect(reposJson.repos[0].fullName).toBe('alice-octo/portfolio-site');
  });

  it('3. Binds repository with SSRF check, installs webhook automatically, persists encrypted webhook secret, and deletes webhook on unbind', async () => {
    const { POST: bindPost, DELETE: bindDelete } = await import('@/app/api/integrations/github/bind/route');

    mockStore.state.github_oauth_accounts.push({
      id: 'gh-acc-1',
      user_id: USER_A,
      github_user_id: 778899,
      github_login: 'alice-octo',
      access_token_encrypted: await encryptEnvValue('gho_bind_token_secret'),
    });

    // Reject path traversal / SSRF repo names
    const ssrfRes = await bindPost(
      new NextRequest('https://panel.example.com/api/integrations/github/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_STATIC_ID,
          repoFullName: 'https://evil.internal/../../etc/passwd',
          branch: 'main',
        }),
      })
    );
    expect(ssrfRes.status).toBe(400);

    interface CapturedHookPayload {
      events?: string[];
      config?: { url?: string; secret?: string };
    }
    let capturedHookBody: CapturedHookPayload = {};
    let deletedHookUrl = '';

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.github.com/repos/alice-octo/portfolio-site' && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            id: 5001,
            name: 'portfolio-site',
            full_name: 'alice-octo/portfolio-site',
            private: true,
            default_branch: 'main',
            html_url: 'https://github.com/alice-octo/portfolio-site',
            clone_url: 'https://github.com/alice-octo/portfolio-site.git',
            updated_at: '2026-11-13T00:00:00Z',
          }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.github.com/repos/alice-octo/portfolio-site/hooks?')) {
        return new Response('[]', { status: 200 });
      }
      if (url === 'https://api.github.com/repos/alice-octo/portfolio-site/hooks' && init?.method === 'POST') {
        capturedHookBody = JSON.parse(String(init.body || '{}')) as CapturedHookPayload;
        return new Response(JSON.stringify({ id: 991234 }), { status: 201 });
      }
      if (url === 'https://api.github.com/repos/alice-octo/portfolio-site/hooks/991234' && init?.method === 'DELETE') {
        deletedHookUrl = url;
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const bindRes = await bindPost(
      new NextRequest('https://panel.example.com/api/integrations/github/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_STATIC_ID,
          repoFullName: 'alice-octo/portfolio-site',
          branch: 'main',
          autoDeployOnPush: true,
          prPreviewsEnabled: true,
        }),
      })
    );
    expect(bindRes.status).toBe(200);
    const bindJson = (await bindRes.json()) as {
      connection: { webhookId: number; webhookUrl: string; webhookConfigured: boolean };
      webhookSecretPreview: string;
    };
    expect(bindJson.connection.webhookId).toBe(991234);
    expect(bindJson.connection.webhookUrl).toBe(`https://panel.example.com/api/webhooks/git/${SERVICE_STATIC_ID}`);
    expect(bindJson.webhookSecretPreview).toContain('••••');
    expect(capturedHookBody?.events).toEqual(['push', 'pull_request']);
    expect(capturedHookBody?.config?.secret).toMatch(/^[a-f0-9]{64}$/);

    // Ensure raw webhook secret is NOT plaintext in project_git_connections or response
    const connRow = mockStore.state.project_git_connections[0];
    expect(String(connRow.webhook_secret_encrypted)).not.toBe(capturedHookBody?.config?.secret);

    // Unbind cleans GitHub hook + DB row
    const unbindRes = await bindDelete(
      new NextRequest(`https://panel.example.com/api/integrations/github/bind?serviceId=${SERVICE_STATIC_ID}`, {
        method: 'DELETE',
      })
    );
    expect(unbindRes.status).toBe(200);
    expect(deletedHookUrl).toBe('https://api.github.com/repos/alice-octo/portfolio-site/hooks/991234');
    expect(mockStore.state.project_git_connections).toHaveLength(0);
  });

  it('4. Verifies GitHub webhook HMAC, scans zipballs, deploys static_edge to R2, and rejects Zip-Slip/webshell archives', async () => {
    const { POST: webhookPost } = await import('@/app/api/webhooks/git/[serviceId]/route');
    const webhookSecret = 'whsec_test_static_push_hmac_998877';

    process.env.DEV_SANDBOX_MODE = 'true'; // Enable sandbox R2 storage verification without external R2 creds
    mockStore.state.github_oauth_accounts.push({
      id: 'gh-acc-static',
      user_id: USER_A,
      github_user_id: 778899,
      github_login: 'alice-octo',
      access_token_encrypted: await encryptEnvValue('gho_static_token_123'),
    });
    mockStore.state.project_git_connections.push({
      id: 'conn-static',
      service_id: SERVICE_STATIC_ID,
      user_id: USER_A,
      github_account_id: 'gh-acc-static',
      provider: 'github',
      repo_full_name: 'alice-octo/portfolio-site',
      clone_url: 'https://github.com/alice-octo/portfolio-site.git',
      default_branch: 'main',
      selected_branch: 'main',
      is_private: true,
      auto_deploy_on_push: true,
      pr_previews_enabled: true,
      webhook_id: 991234,
      webhook_secret_encrypted: await encryptEnvValue(webhookSecret),
    });

    // Invalid HMAC rejected + high risk audit log
    const badSigRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_STATIC_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-hub-signature-256': 'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        },
        body: JSON.stringify({ ref: 'refs/heads/main' }),
      }),
      { params: Promise.resolve({ serviceId: SERVICE_STATIC_ID }) }
    );
    expect(badSigRes.status).toBe(401);
    expect(
      mockStore.state.security_audit_logs.some((l) => l.action_type === 'GITHUB_WEBHOOK_INVALID_SIGNATURE')
    ).toBe(true);

    // Ping event succeeds
    const pingBody = JSON.stringify({ zen: 'Approachable is better than simple.', hook_id: 991234 });
    const pingRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_STATIC_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'ping',
          'x-hub-signature-256': signWebhookPayload(pingBody, webhookSecret),
        },
        body: pingBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_STATIC_ID }) }
    );
    expect(pingRes.status).toBe(200);
    expect(((await pingRes.json()) as { pong: boolean }).pong).toBe(true);

    // Valid static zipball wrapped in top-level folder -> scanned -> unwrapped -> published to R2
    const cleanZipBytes = zipSync({
      'alice-octo-portfolio-abcdef1/dist/index.html': strToU8('<!doctype html><h1>Hello Git Push Edge!</h1>'),
      'alice-octo-portfolio-abcdef1/dist/app.js': strToU8('console.log("built");'),
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/zipball/')) {
        return new Response(Buffer.from(cleanZipBytes), {
          status: 200,
          headers: { 'Content-Type': 'application/zip' },
        });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const pushBody = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'abcdef1234567890abcdef1234567890abcdef12',
      repository: {
        full_name: 'alice-octo/portfolio-site',
        clone_url: 'https://github.com/alice-octo/portfolio-site.git',
      },
      head_commit: {
        id: 'abcdef1234567890abcdef1234567890abcdef12',
        message: 'feat: publish static landing page',
        author: { name: 'Alice Dev' },
      },
    });

    const pushRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_STATIC_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-hub-signature-256': signWebhookPayload(pushBody, webhookSecret),
        },
        body: pushBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_STATIC_ID }) }
    );
    expect(pushRes.status).toBe(200);
    const pushJson = (await pushRes.json()) as { status: string; deploymentId: string; releaseId: string };
    expect(pushJson.status).toBe('live');

    const manifest = await getR2Artifact(`sites/${SERVICE_STATIC_ID}/current.json`);
    expect(manifest.found).toBe(true);
    const indexObj = await getR2Artifact(`sites/${SERVICE_STATIC_ID}/releases/${pushJson.releaseId}/index.html`);
    expect(indexObj.found).toBe(true);
    expect(indexObj.bodyText).toContain('Hello Git Push Edge!');

    // Malicious Zip-Slip push must be rejected BEFORE any R2 write & marked failed
    const evilZipBytes = zipSync({
      'alice-octo-portfolio-evil/../../etc/cron.d/backdoor': strToU8('* * * * * root id'),
    });
    globalThis.fetch = vi.fn(async () => new Response(Buffer.from(evilZipBytes), { status: 200 })) as typeof fetch;

    const evilPushBody = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'deadbeef1234567890deadbeef12345678901234',
      repository: { full_name: 'alice-octo/portfolio-site', clone_url: 'https://github.com/alice-octo/portfolio-site.git' },
      head_commit: { id: 'deadbeef1234567890deadbeef12345678901234', message: 'evil archive', author: { name: 'Mallory' } },
    });

    const evilRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_STATIC_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-hub-signature-256': signWebhookPayload(evilPushBody, webhookSecret),
        },
        body: evilPushBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_STATIC_ID }) }
    );
    expect(evilRes.status).toBeGreaterThanOrEqual(400);
    expect(
      mockStore.state.security_audit_logs.some((l) => l.action_type === 'GIT_ARCHIVE_SECURITY_REJECTED')
    ).toBe(true);
    expect(mockStore.state.project_deployments.some((d) => d.status === 'failed')).toBe(true);
  });

  it('5. Handles container runtime Git push enqueue/dispatch (omitting token from DB rows) and full PR preview lifecycle + Fork PR secret isolation', async () => {
    const { POST: webhookPost } = await import('@/app/api/webhooks/git/[serviceId]/route');
    const { GET: previewsGet, POST: previewsPost } = await import('@/app/api/hosting/previews/route');

    const webhookSecret = 'whsec_test_node_container_hmac_445566';
    const rawGitOAuthToken = 'gho_private_container_repo_token_abc123';
    process.env.DEV_SANDBOX_MODE = 'true';
    process.env.DEVHOST_PREVIEW_BASE_DOMAIN = 'previews.example.net';
    process.env.COMPUTE_AGENT_URL = 'https://agent-sg1.example.net';
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase9_agent_hmac_secret';

    mockStore.state.github_oauth_accounts.push({
      id: 'gh-acc-node',
      user_id: USER_A,
      github_user_id: 778899,
      github_login: 'alice-octo',
      access_token_encrypted: await encryptEnvValue(rawGitOAuthToken),
    });
    mockStore.state.project_git_connections.push({
      id: 'conn-node',
      service_id: SERVICE_NODE_ID,
      user_id: USER_A,
      github_account_id: 'gh-acc-node',
      provider: 'github',
      repo_full_name: 'alice-octo/nextjs-saas',
      clone_url: 'https://github.com/alice-octo/nextjs-saas.git',
      default_branch: 'main',
      selected_branch: 'main',
      is_private: true,
      auto_deploy_on_push: true,
      pr_previews_enabled: true,
      webhook_id: 881122,
      webhook_secret_encrypted: await encryptEnvValue(webhookSecret),
    });
    mockStore.state.project_env_variables.push({
      id: 'env-1',
      service_id: SERVICE_NODE_ID,
      env_key: 'PROD_API_SECRET',
      encrypted_value: await encryptEnvValue('super_secret_prod_db_password'),
      target_environment: 'production',
    });

    const dispatchedAgentBodies: Array<{ url: string; body: Record<string, unknown> }> = [];
    const prCommentsPosted: Array<{ url: string; body: string }> = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/v1/builds/deploy')) {
        const parsed = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        dispatchedAgentBodies.push({ url, body: parsed });
        return new Response(
          JSON.stringify({
            ok: true,
            containerId: parsed.prNumber
              ? `dh_nodeusr_${String(parsed.serviceId).slice(0, 8)}_pr_${parsed.prNumber}`
              : 'dh_nodeusr_prod',
            upstreamPort: 3150,
            upstreamUrl: 'http://127.0.0.1:3150',
            liveUrl: parsed.previewHostname ? `https://${parsed.previewHostname}` : 'https://node-git.devhost.cloud',
            healthStatus: 'healthy',
            buildLogs: 'Container build ok',
            durationSeconds: 4,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/v1/builds/preview-destroy')) {
        const parsed = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        dispatchedAgentBodies.push({ url, body: parsed });
        return new Response(JSON.stringify({ ok: true, destroyed: true, prNumber: parsed.prNumber }), {
          status: 200,
        });
      }
      if (url.includes('/issues/') && url.includes('/comments') && (!init?.method || init.method === 'GET')) {
        return new Response('[]', { status: 200 });
      }
      if (url.includes('/issues/') && url.includes('/comments') && init?.method === 'POST') {
        prCommentsPosted.push({ url, body: String(init.body || '') });
        return new Response(JSON.stringify({ id: 554433 }), { status: 201 });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    // A) Push to production branch dispatches agent with transient token + prod env, omits token from DB rows
    const prodPushBody = JSON.stringify({
      ref: 'refs/heads/main',
      after: '11223344556677889900aabbccddeeff00112233',
      repository: { full_name: 'alice-octo/nextjs-saas', clone_url: 'https://github.com/alice-octo/nextjs-saas.git' },
      head_commit: { id: '11223344556677889900aabbccddeeff00112233', message: 'deploy prod', author: { name: 'Alice' } },
    });

    const prodPushRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_NODE_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-hub-signature-256': signWebhookPayload(prodPushBody, webhookSecret),
        },
        body: prodPushBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_NODE_ID }) }
    );
    expect(prodPushRes.status).toBe(200);
    expect(dispatchedAgentBodies[0].body.gitAccessToken).toBe(rawGitOAuthToken);
    expect((dispatchedAgentBodies[0].body.envVars as Record<string, string>).PROD_API_SECRET).toBe(
      'super_secret_prod_db_password'
    );
    expect(getSandboxQueueSnapshot().length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(mockStore.state.compute_build_jobs)).not.toContain(rawGitOAuthToken);
    expect(JSON.stringify(mockStore.state.project_deployments)).not.toContain(rawGitOAuthToken);

    // B) Pull Request opened (same-repo PR #12) -> isolated preview hostname & PR comment
    const prOpenedBody = JSON.stringify({
      action: 'opened',
      number: 12,
      repository: { full_name: 'alice-octo/nextjs-saas', clone_url: 'https://github.com/alice-octo/nextjs-saas.git' },
      pull_request: {
        number: 12,
        title: 'feat: PR checkout upgrade',
        user: { login: 'alice-octo' },
        head: {
          ref: 'feat/checkout',
          sha: '9988776655443322110099887766554433221100',
          repo: { full_name: 'alice-octo/nextjs-saas', clone_url: 'https://github.com/alice-octo/nextjs-saas.git' },
        },
      },
    });
    const prOpenRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_NODE_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signWebhookPayload(prOpenedBody, webhookSecret),
        },
        body: prOpenedBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_NODE_ID }) }
    );
    expect(prOpenRes.status).toBe(200);
    const prOpenJson = (await prOpenRes.json()) as {
      previewHostname: string;
      previewUrl: string;
      prCommentId: number;
    };
    expect(prOpenJson.previewHostname).toContain('pr-12-feat-checkout');
    expect(prOpenJson.previewUrl).toContain('previews.example.net');
    expect(prOpenJson.prCommentId).toBe(554433);
    expect(prCommentsPosted).toHaveLength(1);
    expect(mockStore.state.hosting_preview_environments[0].status).toBe('ready_live');

    // C) Synchronize from UNTRUSTED FORK PR -> production .env secrets MUST BE WITHHELD!
    const forkPrBody = JSON.stringify({
      action: 'synchronize',
      number: 99,
      repository: { full_name: 'alice-octo/nextjs-saas', clone_url: 'https://github.com/alice-octo/nextjs-saas.git' },
      pull_request: {
        number: 99,
        title: 'contrib: untrusted fork pr',
        user: { login: 'external-contributor' },
        head: {
          ref: 'patch-1',
          sha: '7777777777777777777777777777777777777777',
          repo: {
            full_name: 'external-contributor/nextjs-saas',
            clone_url: 'https://github.com/external-contributor/nextjs-saas.git',
          },
        },
      },
    });
    const forkRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_NODE_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signWebhookPayload(forkPrBody, webhookSecret),
        },
        body: forkPrBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_NODE_ID }) }
    );
    expect(forkRes.status).toBe(200);
    const forkAgentDispatch = dispatchedAgentBodies[dispatchedAgentBodies.length - 1];
    expect((forkAgentDispatch.body.envVars as Record<string, string>).PROD_API_SECRET).toBeUndefined();
    expect((forkAgentDispatch.body.envVars as Record<string, string>).NODE_ENV).toBe('preview');

    // D) PR Closed tears down preview container & marks DB 'destroyed'
    const prCloseBody = JSON.stringify({
      action: 'closed',
      number: 12,
      repository: { full_name: 'alice-octo/nextjs-saas', clone_url: 'https://github.com/alice-octo/nextjs-saas.git' },
      pull_request: {
        number: 12,
        title: 'feat: PR checkout upgrade',
        head: { ref: 'feat/checkout', sha: '9988776655443322110099887766554433221100' },
      },
    });
    const prCloseRes = await webhookPost(
      new NextRequest(`https://panel.example.com/api/webhooks/git/${SERVICE_NODE_ID}`, {
        method: 'POST',
        headers: {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signWebhookPayload(prCloseBody, webhookSecret),
        },
        body: prCloseBody,
      }),
      { params: Promise.resolve({ serviceId: SERVICE_NODE_ID }) }
    );
    expect(prCloseRes.status).toBe(200);
    const prCloseJson = (await prCloseRes.json()) as { destroyed: boolean; agentDestroyed: boolean };
    expect(prCloseJson.destroyed).toBe(true);
    expect(prCloseJson.agentDestroyed).toBe(true);
    expect(dispatchedAgentBodies.some((d) => d.url.includes('/v1/builds/preview-destroy'))).toBe(true);
    const pr12Row = mockStore.state.hosting_preview_environments.find((p) => p.pr_number === 12);
    expect(pr12Row?.status).toBe('destroyed');

    // E) Previews GET returns real DB rows (never fake seeded rows in prod mode) & POST destroy works
    process.env.DEV_SANDBOX_MODE = 'false';
    const liveEmptyPreviews = await previewsGet(
      new NextRequest(`https://panel.example.com/api/hosting/previews?serviceId=${SERVICE_STATIC_ID}`)
    );
    expect(liveEmptyPreviews.status).toBe(200);
    const liveEmptyJson = (await liveEmptyPreviews.json()) as { previews: unknown[]; source: string };
    expect(liveEmptyJson.source).toBe('supabase');
    expect(liveEmptyJson.previews).toHaveLength(0);

    process.env.DEV_SANDBOX_MODE = 'true';
    const pr99Row = mockStore.state.hosting_preview_environments.find((p) => p.pr_number === 99);
    const destroyDashboardRes = await previewsPost(
      new NextRequest('https://panel.example.com/api/hosting/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'destroy_preview',
          serviceId: SERVICE_NODE_ID,
          previewId: pr99Row?.id,
        }),
      })
    );
    expect(destroyDashboardRes.status).toBe(200);
    expect(
      mockStore.state.hosting_preview_environments.find((p) => p.pr_number === 99)?.status
    ).toBe('destroyed');
  });

  it('6. Hardens devhost-agent private repo cloning (GIT_ASKPASS cleanup + token redaction + building callback) and isolated PR preview destroy', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-phase9-agent-'));
    const caddyDir = path.join(tempDir, 'caddy');
    const agentSecret = 'phase9_agent_secret_for_server_test';
    const gitToken = 'gho_secret_agent_token_never_leak_999';

    let capturedAskpassExisted = false;
    let capturedAskpassPath = '';
    const recordedCmds: Array<{ cmd: string; args: string[]; askpassEnv?: string }> = [];
    const callbacks: Array<Record<string, unknown>> = [];

    const handler = createAgentHandler({
      agentSecret,
      workRoot: tempDir,
      backupRoot: path.join(tempDir, 'backups'),
      caddySitesDir: caddyDir,
      allowWorkspaceOnly: true,
      runExecFile: async (cmd: string, args: string[], opts?: { env?: Record<string, string> }) => {
        const askpassFile = opts?.env?.GIT_ASKPASS;
        if (cmd === 'git' && askpassFile) {
          capturedAskpassPath = askpassFile;
          capturedAskpassExisted = fs.existsSync(askpassFile);
        }
        recordedCmds.push({ cmd, args, askpassEnv: opts?.env?.DEVHOST_GIT_TOKEN });
        if (cmd === 'docker' && args[0] === 'build') {
          return {
            ok: true,
            code: 0,
            stdout: `Step 1: cloned using leaked echo ${gitToken}`,
            stderr: '',
          };
        }
        return { ok: true, code: 0, stdout: 'ok', stderr: '' };
      },
      fetchImpl: (async (_url: string, init?: { body?: string }) => {
        if (init?.body) {
          callbacks.push(JSON.parse(init.body) as Record<string, unknown>);
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    });

    const deployRes = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/builds/deploy',
      secret: agentSecret,
      body: {
        serviceId: 'svc9test01',
        cpanelUser: 'aliceusr',
        domain: 'app.example.net',
        previewHostname: 'pr-17-feature.previews.example.net',
        environment: 'preview',
        prNumber: 17,
        releaseId: 'pr17_123456',
        buildJobId: 'job-pr-17',
        gitRepoUrl: 'https://github.com/alice-octo/private-app.git',
        gitBranch: 'feature/pr-17',
        commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        gitAccessToken: gitToken,
        callbackUrl: 'https://panel.example.com/api/compute/agent-callback',
      },
    });

    expect(deployRes.status).toBe(200);
    // Token NEVER placed in git CLI arguments
    const gitCommands = recordedCmds.filter((c) => c.cmd === 'git');
    expect(gitCommands.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(gitCommands.map((c) => c.args))).not.toContain(gitToken);

    // Ephemeral GIT_ASKPASS existed during clone and was deleted afterwards
    expect(capturedAskpassExisted).toBe(true);
    expect(capturedAskpassPath).toBeTruthy();
    expect(fs.existsSync(capturedAskpassPath)).toBe(false);

    // Token scrubbed from buildLogs & callbacks
    expect(String(deployRes.json.buildLogs)).not.toContain(gitToken);
    expect(String(deployRes.json.containerId)).toContain('_pr_17');
    expect(fs.existsSync(path.join(caddyDir, 'svc9test01__pr_17.caddy'))).toBe(true);
    expect(callbacks.some((c) => c.status === 'building')).toBe(true);
    expect(callbacks.some((c) => c.status === 'live' && c.prNumber === 17)).toBe(true);
    expect(JSON.stringify(callbacks)).not.toContain(gitToken);

    // Destroy PR preview endpoint removes container, Caddyfile & preview dirs
    const destroyRes = await invokeAgent(handler, {
      method: 'POST',
      path: '/v1/builds/preview-destroy',
      secret: agentSecret,
      body: {
        serviceId: 'svc9test01',
        cpanelUser: 'aliceusr',
        prNumber: 17,
      },
    });
    expect(destroyRes.status).toBe(200);
    expect(destroyRes.json.destroyed).toBe(true);
    expect(fs.existsSync(path.join(caddyDir, 'svc9test01__pr_17.caddy'))).toBe(false);
    expect(
      recordedCmds.some((c) => c.cmd === 'docker' && c.args[0] === 'rm' && c.args[2]?.includes('_pr_17'))
    ).toBe(true);
  });

  it('7. Verifies Phase 9 SQL migration RLS + cleanup of hardcoded devhost.cloud webhook URL in UI', () => {
    const sqlText = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', 'phase9_github_ci_cd.sql'),
      'utf8'
    );
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS public.github_oauth_accounts');
    expect(sqlText).toContain('REVOKE ALL ON TABLE public.github_oauth_accounts FROM anon, authenticated');
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS public.project_git_connections');
    expect(sqlText).toContain('hosting_preview_environments_status_check');

    const studioText = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'hosting', 'HostingProjectControlStudio.tsx'),
      'utf8'
    );
    expect(studioText).not.toContain('https://devhost.cloud/api/webhooks/git/');
    expect(studioText).toContain('GitHubRepoConnectorPanel');
  });
});
