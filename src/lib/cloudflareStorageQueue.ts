// ==============================================================================
// DEVHOST CLOUD - CLOUDFLARE R2 STORAGE & BUILD QUEUE BROKER CLIENT
// 100% Edge-Compatible (Native Worker Bindings + Cloudflare v4 REST API Fallback)
// ==============================================================================

import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';
import { getCloudflareConfig, purgeCloudflareCache } from '@/lib/cloudflareClient';

export interface EdgeR2Object {
  key: string;
  size: number;
  etag?: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  uploaded?: Date | string;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface EdgeR2Bucket {
  put: (
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream | Blob,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    }
  ) => Promise<EdgeR2Object | null>;
  get: (key: string) => Promise<EdgeR2Object | null>;
  delete: (keys: string | string[]) => Promise<void>;
  list: (options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }) => Promise<{ objects: Array<{ key: string; size: number; etag?: string }>; truncated: boolean }>;
}

export interface EdgeQueueProducer {
  send: (body: unknown, options?: { contentType?: string; delaySeconds?: number }) => Promise<void>;
}

export interface CloudflareWorkerRuntimeEnv {
  DEVHOST_ARTIFACTS_BUCKET?: EdgeR2Bucket;
  DEVHOST_BUILD_QUEUE?: EdgeQueueProducer;
  [key: string]: unknown;
}

export interface R2PutResult {
  ok: boolean;
  key: string;
  sizeBytes: number;
  etag?: string;
  mode: 'r2_binding' | 'r2_rest' | 'sandbox' | 'unconfigured';
  error?: string;
}

export interface R2GetResult {
  ok: boolean;
  found: boolean;
  key: string;
  contentType: string;
  bodyText?: string;
  bodyBuffer?: ArrayBuffer;
  etag?: string;
  mode: 'r2_binding' | 'r2_rest' | 'sandbox' | 'unconfigured';
  error?: string;
}

export interface BuildQueueJobPayload {
  jobId: string;
  serviceId: string;
  userId?: string;
  domain: string;
  cpanelUser: string;
  stackSlug: string;
  runtimeFamily: string;
  runtimeVersion: string;
  triggerSource:
    | 'stack_blueprint'
    | 'manual_dashboard'
    | 'github_webhook'
    | 'zip_upload'
    | 'rollback'
    | 'preview_promotion'
    | 'api_deploy';
  gitRepoUrl?: string;
  gitBranch?: string;
  commitSha?: string;
  installCommand?: string;
  buildCommand?: string;
  startupFile?: string;
  outputDirectory?: string;
  envVars?: Record<string, string>;
  ramMb?: number;
  cpuCores?: number;
  diskGb?: number;
  r2ArtifactKey?: string;
  deploymentId?: string;
  targetNodeCode?: string;
  targetAgentEndpoint?: string;
  callbackUrl?: string;
  requestedAt: string;
}

export interface EnqueueBuildResult {
  ok: boolean;
  jobId: string;
  queueMessageId?: string;
  mode: 'queue_binding' | 'queue_rest' | 'db_queue' | 'sandbox' | 'unconfigured';
  error?: string;
}

export interface StaticEdgeReleaseResult {
  ok: boolean;
  releaseId: string;
  artifactKey: string;
  manifestKey: string;
  filesUploaded: number;
  totalBytes: number;
  liveUrl: string;
  edgeRouterUrl: string;
  mode: R2PutResult['mode'];
  error?: string;
}

const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');

// Lightweight in-memory R2 & Queue store strictly for DEV_SANDBOX_MODE tests/dev
const sandboxR2Store = new Map<
  string,
  { body: Uint8Array; contentType: string; customMetadata?: Record<string, string>; etag: string }
>();
const sandboxQueueMessages: BuildQueueJobPayload[] = [];

function isRealToken(val?: string): string {
  const clean = String(val || '').trim();
  if (!clean || clean.length < 16 || clean.includes('your-cloudflare')) return '';
  return clean;
}

export function getWorkerRuntimeBindings(): CloudflareWorkerRuntimeEnv {
  const g = globalThis as Record<PropertyKey, unknown>;
  const ctx = g[CLOUDFLARE_CONTEXT_SYMBOL] as { env?: CloudflareWorkerRuntimeEnv } | undefined;
  return ctx?.env || {};
}

function getR2RestConfig(): { accountId: string; bucketName: string; apiToken: string } | null {
  const cfCfg = getCloudflareConfig();
  const bucketName = (process.env.CLOUDFLARE_R2_BUCKET || 'devhost-artifacts').trim();
  const apiToken = isRealToken(process.env.CLOUDFLARE_R2_API_TOKEN) || cfCfg.token;
  if (!cfCfg.accountId || !apiToken || !bucketName) return null;
  return { accountId: cfCfg.accountId, bucketName, apiToken };
}

function getQueueRestConfig(): { accountId: string; queueId: string; apiToken: string } | null {
  const cfCfg = getCloudflareConfig();
  const queueId = (process.env.CLOUDFLARE_BUILD_QUEUE_ID || '').trim();
  if (!cfCfg.accountId || !cfCfg.token || !queueId) return null;
  return { accountId: cfCfg.accountId, queueId, apiToken: cfCfg.token };
}

export function getStorageAndQueueStatus() {
  const bindings = getWorkerRuntimeBindings();
  const r2Rest = getR2RestConfig();
  const queueRest = getQueueRestConfig();
  return {
    r2Configured: Boolean(bindings.DEVHOST_ARTIFACTS_BUCKET || r2Rest),
    r2Mode: bindings.DEVHOST_ARTIFACTS_BUCKET
      ? 'worker_binding'
      : r2Rest
      ? 'rest_api'
      : isDevSandboxMode()
      ? 'sandbox'
      : 'unconfigured',
    r2BucketName: process.env.CLOUDFLARE_R2_BUCKET || 'devhost-artifacts',
    queueConfigured: Boolean(bindings.DEVHOST_BUILD_QUEUE || queueRest),
    queueMode: bindings.DEVHOST_BUILD_QUEUE
      ? 'worker_binding'
      : queueRest
      ? 'rest_api'
      : isDevSandboxMode()
      ? 'sandbox'
      : 'unconfigured',
    sandboxQueueDepth: sandboxQueueMessages.length,
  };
}

export function isR2ArtifactsConfigured(): boolean {
  const bindings = getWorkerRuntimeBindings();
  return Boolean(bindings.DEVHOST_ARTIFACTS_BUCKET || getR2RestConfig());
}

export function isBuildQueueConfigured(): boolean {
  const bindings = getWorkerRuntimeBindings();
  return Boolean(bindings.DEVHOST_BUILD_QUEUE || getQueueRestConfig());
}

/**
 * Put a static asset or archive artifact into DEVHOST_ARTIFACTS_BUCKET (R2).
 */
export async function putR2Artifact(
  key: string,
  content: string | Uint8Array,
  contentType = 'application/octet-stream',
  customMetadata?: Record<string, string>
): Promise<R2PutResult> {
  const cleanKey = key.replace(/^\/+/, '');
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const bindings = getWorkerRuntimeBindings();

  if (bindings.DEVHOST_ARTIFACTS_BUCKET) {
    try {
      const obj = await bindings.DEVHOST_ARTIFACTS_BUCKET.put(cleanKey, bytes, {
        httpMetadata: {
          contentType,
          cacheControl: contentType.includes('text/html') ? 'public, max-age=60, s-maxage=300' : 'public, max-age=86400',
        },
        customMetadata,
      });
      return {
        ok: true,
        key: cleanKey,
        sizeBytes: bytes.byteLength,
        etag: obj?.etag || `r2_${Date.now().toString(36)}`,
        mode: 'r2_binding',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        key: cleanKey,
        sizeBytes: bytes.byteLength,
        mode: 'r2_binding',
        error: err instanceof Error ? err.message : 'R2 binding put failed',
      };
    }
  }

  const r2Rest = getR2RestConfig();
  if (r2Rest) {
    try {
      const encodedKey = cleanKey.split('/').map(encodeURIComponent).join('/');
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        r2Rest.accountId
      )}/r2/buckets/${encodeURIComponent(r2Rest.bucketName)}/objects/${encodedKey}`;

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${r2Rest.apiToken}`,
          'Content-Type': contentType,
        },
        body: new Blob([Uint8Array.from(bytes)], { type: contentType }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          key: cleanKey,
          sizeBytes: bytes.byteLength,
          mode: 'r2_rest',
          error: `Cloudflare R2 REST HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`,
        };
      }

      return {
        ok: true,
        key: cleanKey,
        sizeBytes: bytes.byteLength,
        etag: res.headers.get('etag') || `r2rest_${Date.now().toString(36)}`,
        mode: 'r2_rest',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        key: cleanKey,
        sizeBytes: bytes.byteLength,
        mode: 'r2_rest',
        error: err instanceof Error ? err.message : 'R2 REST upload error',
      };
    }
  }

  if (isDevSandboxMode()) {
    const etag = `sbx_${Date.now().toString(36)}`;
    sandboxR2Store.set(cleanKey, { body: bytes, contentType, customMetadata, etag });
    return {
      ok: true,
      key: cleanKey,
      sizeBytes: bytes.byteLength,
      etag,
      mode: 'sandbox',
    };
  }

  return {
    ok: false,
    key: cleanKey,
    sizeBytes: bytes.byteLength,
    mode: 'unconfigured',
    error: 'Cloudflare R2 DEVHOST_ARTIFACTS_BUCKET binding or R2 REST credentials are not configured.',
  };
}

/**
 * Retrieve a static asset or artifact from DEVHOST_ARTIFACTS_BUCKET (R2).
 */
export async function getR2Artifact(key: string): Promise<R2GetResult> {
  const cleanKey = key.replace(/^\/+/, '');
  const bindings = getWorkerRuntimeBindings();

  if (bindings.DEVHOST_ARTIFACTS_BUCKET) {
    try {
      const obj = await bindings.DEVHOST_ARTIFACTS_BUCKET.get(cleanKey);
      if (!obj) {
        return { ok: true, found: false, key: cleanKey, contentType: 'text/plain', mode: 'r2_binding' };
      }
      const contentType = obj.httpMetadata?.contentType || inferContentType(cleanKey);
      const buf = await obj.arrayBuffer();
      return {
        ok: true,
        found: true,
        key: cleanKey,
        contentType,
        bodyBuffer: buf,
        bodyText: isTextMime(contentType) ? new TextDecoder().decode(buf) : undefined,
        etag: obj.etag,
        mode: 'r2_binding',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        found: false,
        key: cleanKey,
        contentType: 'text/plain',
        mode: 'r2_binding',
        error: err instanceof Error ? err.message : 'R2 binding get failed',
      };
    }
  }

  const r2Rest = getR2RestConfig();
  if (r2Rest) {
    try {
      const encodedKey = cleanKey.split('/').map(encodeURIComponent).join('/');
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        r2Rest.accountId
      )}/r2/buckets/${encodeURIComponent(r2Rest.bucketName)}/objects/${encodedKey}`;

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${r2Rest.apiToken}`,
        },
      });

      if (res.status === 404) {
        return { ok: true, found: false, key: cleanKey, contentType: 'text/plain', mode: 'r2_rest' };
      }
      if (!res.ok) {
        return {
          ok: false,
          found: false,
          key: cleanKey,
          contentType: 'text/plain',
          mode: 'r2_rest',
          error: `R2 REST HTTP ${res.status}`,
        };
      }

      const contentType = res.headers.get('content-type') || inferContentType(cleanKey);
      const buf = await res.arrayBuffer();
      return {
        ok: true,
        found: true,
        key: cleanKey,
        contentType,
        bodyBuffer: buf,
        bodyText: isTextMime(contentType) ? new TextDecoder().decode(buf) : undefined,
        etag: res.headers.get('etag') || undefined,
        mode: 'r2_rest',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        found: false,
        key: cleanKey,
        contentType: 'text/plain',
        mode: 'r2_rest',
        error: err instanceof Error ? err.message : 'R2 REST read error',
      };
    }
  }

  if (isDevSandboxMode()) {
    const entry = sandboxR2Store.get(cleanKey);
    if (!entry) {
      return { ok: true, found: false, key: cleanKey, contentType: 'text/plain', mode: 'sandbox' };
    }
    const buf = entry.body.slice().buffer;
    return {
      ok: true,
      found: true,
      key: cleanKey,
      contentType: entry.contentType,
      bodyBuffer: buf,
      bodyText: isTextMime(entry.contentType) ? new TextDecoder().decode(buf) : undefined,
      etag: entry.etag,
      mode: 'sandbox',
    };
  }

  return {
    ok: false,
    found: false,
    key: cleanKey,
    contentType: 'text/plain',
    mode: 'unconfigured',
    error: 'Cloudflare R2 storage is not configured.',
  };
}

export async function deleteR2Artifact(key: string): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const bindings = getWorkerRuntimeBindings();
  if (bindings.DEVHOST_ARTIFACTS_BUCKET) {
    await bindings.DEVHOST_ARTIFACTS_BUCKET.delete(cleanKey);
    return true;
  }
  const r2Rest = getR2RestConfig();
  if (r2Rest) {
    const encodedKey = cleanKey.split('/').map(encodeURIComponent).join('/');
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      r2Rest.accountId
    )}/r2/buckets/${encodeURIComponent(r2Rest.bucketName)}/objects/${encodedKey}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${r2Rest.apiToken}` },
    });
    return res.ok || res.status === 404;
  }
  if (isDevSandboxMode()) {
    return sandboxR2Store.delete(cleanKey);
  }
  return false;
}

export async function recordQueuedBuildJob(
  payload: BuildQueueJobPayload,
  queueMessageId?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('compute_build_jobs').upsert(
      {
        id: payload.jobId,
        service_id: payload.serviceId,
        user_id: payload.userId || null,
        deployment_id: payload.deploymentId || null,
        node_code: payload.targetNodeCode || null,
        stack_slug: payload.stackSlug,
        runtime_family: payload.runtimeFamily,
        trigger_source: payload.triggerSource,
        status: 'queued',
        queue_message_id: queueMessageId || null,
        r2_artifact_key: payload.r2ArtifactKey || null,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {
    // Non-blocking when table isn't initialized yet or minimal test mock lacks compute_build_jobs
  }
}

/**
 * Push a build/provision job onto DEVHOST_BUILD_QUEUE so heavy compute runs asynchronously
 * without hitting Worker CPU limits.
 */
export async function enqueueBuildJob(payload: BuildQueueJobPayload): Promise<EnqueueBuildResult> {
  const bindings = getWorkerRuntimeBindings();

  if (bindings.DEVHOST_BUILD_QUEUE) {
    try {
      await bindings.DEVHOST_BUILD_QUEUE.send(payload, { contentType: 'json' });
      const msgId = `cfq_${Date.now().toString(36)}_${payload.jobId.slice(0, 8)}`;
      await recordQueuedBuildJob(payload, msgId);
      return {
        ok: true,
        jobId: payload.jobId,
        queueMessageId: msgId,
        mode: 'queue_binding',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        jobId: payload.jobId,
        mode: 'queue_binding',
        error: err instanceof Error ? err.message : 'DEVHOST_BUILD_QUEUE send failed',
      };
    }
  }

  const queueRest = getQueueRestConfig();
  if (queueRest) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        queueRest.accountId
      )}/queues/${encodeURIComponent(queueRest.queueId)}/messages`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${queueRest.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: payload }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: { message_id?: string };
        errors?: Array<{ message?: string }>;
      };

      if (!res.ok || data.success === false) {
        return {
          ok: false,
          jobId: payload.jobId,
          mode: 'queue_rest',
          error: data.errors?.[0]?.message || `Cloudflare Queue REST HTTP ${res.status}`,
        };
      }

      const msgId = data.result?.message_id || `cfqrest_${Date.now().toString(36)}`;
      await recordQueuedBuildJob(payload, msgId);
      return {
        ok: true,
        jobId: payload.jobId,
        queueMessageId: msgId,
        mode: 'queue_rest',
      };
    } catch (err: unknown) {
      return {
        ok: false,
        jobId: payload.jobId,
        mode: 'queue_rest',
        error: err instanceof Error ? err.message : 'Queue REST dispatch failed',
      };
    }
  }

  if (isDevSandboxMode()) {
    sandboxQueueMessages.push(payload);
    const msgId = `sbxq_${sandboxQueueMessages.length}_${Date.now().toString(36)}`;
    await recordQueuedBuildJob(payload, msgId);
    return {
      ok: true,
      jobId: payload.jobId,
      queueMessageId: msgId,
      mode: 'sandbox',
    };
  }

  return {
    ok: false,
    jobId: payload.jobId,
    mode: 'unconfigured',
    error: 'Cloudflare Build Queue (DEVHOST_BUILD_QUEUE) is not configured.',
  };
}

/**
 * Deploy `static_edge` stacks (Astro, Sitejet, Static HTML/SPA) directly to R2 + Edge Static Router.
 */
export async function deployStaticEdgeRelease(params: {
  serviceId: string;
  domain: string;
  stackSlug: string;
  stackName: string;
  releaseId: string;
  files?: Array<{ path: string; content: string | Uint8Array; contentType?: string }>;
}): Promise<StaticEdgeReleaseResult> {
  const cleanHost = params.domain.toLowerCase().trim();
  const siteKey = (params.serviceId || cleanHost).replace(/[^a-zA-Z0-9._-]/g, '_');
  const sitePrefix = `sites/${siteKey}`;
  const releasePrefix = `${sitePrefix}/releases/${params.releaseId}`;
  const manifestKey = `${sitePrefix}/current.json`;
  const edgeOrigin = process.env.EDGE_SITES_ORIGIN?.trim().replace(/\/+$/, '');
  const edgePath = `/api/edge-site?site=${encodeURIComponent(siteKey)}`;
  const edgeRouterUrl = edgeOrigin ? `${edgeOrigin}${edgePath}` : edgePath;

  const defaultIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(cleanHost)} — Powered by DevHost Cloud Edge</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;padding:2rem}
    .card{max-width:560px;background:#18181b;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem}
    .badge{display:inline-block;padding:.25rem .65rem;border-radius:999px;background:rgba(16,185,129,.15);color:#34d399;font-size:.75rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
    h1{margin:1rem 0 .5rem;font-size:1.5rem}
    p{color:#a1a1aa;line-height:1.6;margin:.5rem 0}
    code{background:#27272a;padding:.15rem .4rem;border-radius:6px;color:#93c5fd;font-size:.85rem}
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">Static Edge Active • Cloudflare R2</span>
    <h1>${escapeHtml(params.stackName)} Ready on ${escapeHtml(cleanHost)}</h1>
    <p>Release <code>${escapeHtml(params.releaseId)}</code> is live on the DevHost Cloudflare Anycast Edge Static Plane.</p>
    <p>Upload files directly or push to your Git repository to publish updated static assets to <code>${escapeHtml(releasePrefix)}</code>.</p>
  </main>
</body>
</html>`;

  const filesToWrite =
    params.files && params.files.length > 0
      ? params.files
      : [
          {
            path: 'index.html',
            content: defaultIndexHtml,
            contentType: 'text/html; charset=utf-8',
          },
        ];

  let totalBytes = 0;
  let lastMode: R2PutResult['mode'] = 'unconfigured';

  for (const file of filesToWrite) {
    const normalizedSubPath = file.path.replace(/^\/+/, '');
    const objectKey = `${releasePrefix}/${normalizedSubPath}`;
    const putRes = await putR2Artifact(
      objectKey,
      file.content,
      file.contentType || inferContentType(normalizedSubPath),
      {
        serviceId: params.serviceId,
        domain: cleanHost,
        releaseId: params.releaseId,
        stackSlug: params.stackSlug,
      }
    );

    lastMode = putRes.mode;
    if (!putRes.ok) {
      return {
        ok: false,
        releaseId: params.releaseId,
        artifactKey: `${releasePrefix}/index.html`,
        manifestKey,
        filesUploaded: 0,
        totalBytes,
        liveUrl: `https://${cleanHost}`,
        edgeRouterUrl,
        mode: putRes.mode,
        error: putRes.error,
      };
    }
    totalBytes += putRes.sizeBytes;
  }

  const pointerPayload = JSON.stringify(
    {
      serviceId: params.serviceId,
      domain: cleanHost,
      stackSlug: params.stackSlug,
      releaseId: params.releaseId,
      releasePrefix,
      entryFile: 'index.html',
      filesCount: filesToWrite.length,
      totalBytes,
      deployedAt: new Date().toISOString(),
    },
    null,
    2
  );

  const manifestRes = await putR2Artifact(manifestKey, pointerPayload, 'application/json');
  if (!manifestRes.ok) {
    return {
      ok: false,
      releaseId: params.releaseId,
      artifactKey: `${releasePrefix}/index.html`,
      manifestKey,
      filesUploaded: filesToWrite.length,
      totalBytes,
      liveUrl: `https://${cleanHost}`,
      edgeRouterUrl,
      mode: manifestRes.mode,
      error: manifestRes.error,
    };
  }

  if (getCloudflareConfig().configured) {
    await purgeCloudflareCache({ domain: cleanHost, purgeEverything: true }).catch(() => null);
  }

  return {
    ok: true,
    releaseId: params.releaseId,
    artifactKey: `${releasePrefix}/index.html`,
    manifestKey,
    filesUploaded: filesToWrite.length,
    totalBytes,
    liveUrl: `https://${cleanHost}`,
    edgeRouterUrl,
    mode: lastMode,
  };
}

export function getSandboxQueueSnapshot(): BuildQueueJobPayload[] {
  return [...sandboxQueueMessages];
}

export function clearSandboxStorageForTest(): void {
  sandboxR2Store.clear();
  sandboxQueueMessages.length = 0;
}

export function inferContentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.txt') || lower.endsWith('.xml')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function isTextMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return (
    lower.startsWith('text/') ||
    lower.includes('json') ||
    lower.includes('javascript') ||
    lower.includes('svg') ||
    lower.includes('xml')
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
