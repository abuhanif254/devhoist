// ==============================================================================
// DEVHOST CLOUD - EDGE COMPUTE AGENT PROTOCOL & ORCHESTRATION CLIENT
// 100% Edge-Compatible (Web Crypto HMAC-SHA256 + Fetch API only)
// Communicates with distributed `devhost-agent` Docker/Caddy/WHM runtime daemons
// ==============================================================================

import { isDevSandboxMode } from '@/lib/supabase';
import { timingSafeEqualStr } from '@/lib/authGuard';

export interface ComputeNodeConfig {
  configured: boolean;
  driver: 'docker_paas' | 'whm_cpanel' | 'hybrid';
  agentUrl: string;
  secret: string;
  controlPlaneCallbackUrl: string;
}

export interface ComputeAgentResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  mode: 'live_agent' | 'sandbox' | 'unconfigured';
  unconfigured?: boolean;
  data?: T;
  error?: string;
}

export interface AgentProvisionPayload {
  serviceId: string;
  cpanelUser: string;
  domain: string;
  stackSlug: string;
  runtimeFamily: string;
  runtimeVersion: string;
  installCommand: string;
  buildCommand: string;
  startupFile: string;
  documentRoot: string;
  gitRepoUrl?: string;
  gitBranch?: string;
  limits: {
    ramMb: number;
    cpuCores: number;
    diskGb: number;
    inodeLimit: number;
  };
  envVars: Record<string, string>;
  databaseConfig?: {
    engine: string;
    dbName: string;
    dbUser: string;
    dbPassword: string;
  } | null;
  requiresRedis?: boolean;
  requiresWebsocketProxy?: boolean;
  persistentVolumePaths?: string[];
  releaseId: string;
  callbackUrl: string;
}

export interface AgentProvisionResult {
  containerId: string;
  upstreamPort: number;
  upstreamUrl: string;
  liveUrl: string;
  healthStatus: 'healthy' | 'starting' | 'unhealthy';
  buildLogs: string;
  durationSeconds: number;
  nodeVersion?: string;
  metrics?: {
    diskUsedGb?: number;
    inodesUsed?: number;
    ramUsedMb?: number;
  };
}

export interface ContainerTelemetryPayload {
  serviceId: string;
  domain: string;
  containerId: string;
  status: 'running' | 'restarting' | 'stopped' | 'suspended' | 'error';
  cpuPercent: number;
  ramUsedMb: number;
  ramLimitMb: number;
  diskUsedGb: number;
  inodesUsed: number;
  httpStatus: number;
  uptimeSeconds: number;
  logs: string;
  checkedAt: string;
}

function getAgentSecret(): string {
  return (process.env.DEVHOST_COMPUTE_AGENT_SECRET || '').trim();
}

export function getComputeNodeConfig(overrideAgentUrl?: string | null): ComputeNodeConfig {
  const driverRaw = (process.env.COMPUTE_DEFAULT_DRIVER || 'hybrid').trim();
  const driver =
    driverRaw === 'docker_paas' || driverRaw === 'whm_cpanel' || driverRaw === 'hybrid'
      ? driverRaw
      : 'hybrid';

  const agentUrl = (overrideAgentUrl || process.env.COMPUTE_AGENT_URL || '').trim().replace(/\/+$/, '');
  const secret = getAgentSecret();
  const baseControlUrl = (
    process.env.DEVHOST_CONTROL_PLANE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    configured: Boolean(agentUrl && secret && secret.length >= 16),
    driver,
    agentUrl,
    secret,
    controlPlaneCallbackUrl: `${baseControlUrl}/api/compute/agent-callback`,
  };
}

export function isComputeAgentConfigured(overrideAgentUrl?: string | null): boolean {
  return getComputeNodeConfig(overrideAgentUrl).configured;
}

async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create HMAC-SHA256 headers for outbound Control Plane -> devhost-agent requests
 * or agent -> Control Plane callbacks.
 */
export async function signAgentPayload(
  secret: string,
  rawBody: string,
  timestampMs: string = String(Date.now())
): Promise<{ timestamp: string; signatureHeader: string }> {
  const hex = await computeHmacSha256Hex(secret, `${timestampMs}.${rawBody}`);
  return {
    timestamp: timestampMs,
    signatureHeader: `sha256=${hex}`,
  };
}

const seenCallbackNonces = new Map<string, number>();

/**
 * Constant-time HMAC-SHA256 + 5-minute replay-window + optional nonce-replay
 * verification for inbound agent callbacks.
 */
export async function verifyAgentCallbackSignature(opts: {
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  nonceHeader?: string | null;
  secret?: string;
  maxSkewMs?: number;
}): Promise<{ valid: boolean; reason?: string }> {
  const secret = (opts.secret || getAgentSecret()).trim();
  if (!secret || secret.length < 16) {
    return { valid: false, reason: 'DEVHOST_COMPUTE_AGENT_SECRET is not configured.' };
  }

  if (!opts.timestampHeader || !opts.signatureHeader) {
    return { valid: false, reason: 'Missing X-DevHost-Timestamp or X-DevHost-Signature headers.' };
  }

  const tsNum = Number(opts.timestampHeader);
  if (!Number.isFinite(tsNum)) {
    return { valid: false, reason: 'Invalid callback timestamp.' };
  }

  const now = Date.now();
  const skew = opts.maxSkewMs ?? 5 * 60 * 1000;
  if (Math.abs(now - tsNum) > skew) {
    return { valid: false, reason: 'Callback timestamp outside 5-minute replay window.' };
  }

  const nonce = String(opts.nonceHeader || '').trim();
  if (nonce) {
    for (const [k, exp] of seenCallbackNonces.entries()) {
      if (exp < now) seenCallbackNonces.delete(k);
    }
    if (seenCallbackNonces.has(nonce)) {
      return { valid: false, reason: 'Replay detected: callback nonce already used.' };
    }
    seenCallbackNonces.set(nonce, now + skew);
  }

  const normalizedSig = opts.signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();
  const expectedHex = (await computeHmacSha256Hex(secret, `${opts.timestampHeader}.${opts.rawBody}`)).toLowerCase();

  if (!timingSafeEqualStr(normalizedSig, expectedHex)) {
    return { valid: false, reason: 'HMAC-SHA256 signature mismatch.' };
  }

  return { valid: true };
}

async function callComputeAgent<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    agentUrl?: string | null;
    timeoutMs?: number;
    sandboxMock?: () => T;
  }
): Promise<ComputeAgentResponse<T>> {
  const cfg = getComputeNodeConfig(options.agentUrl);

  if (!cfg.configured) {
    if (isDevSandboxMode() && options.sandboxMock) {
      return {
        ok: true,
        status: 200,
        mode: 'sandbox',
        data: options.sandboxMock(),
      };
    }
    return {
      ok: false,
      status: 503,
      mode: 'unconfigured',
      unconfigured: true,
      error:
        'Compute Node Agent is not configured (missing COMPUTE_AGENT_URL or DEVHOST_COMPUTE_AGENT_SECRET).',
    };
  }

  const method = options.method || 'POST';
  const rawBody = options.body !== undefined ? JSON.stringify(options.body) : '';
  const { timestamp, signatureHeader } = await signAgentPayload(cfg.secret, rawBody);
  const nonce = crypto.randomUUID();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const res = await fetch(`${cfg.agentUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        'X-DevHost-Timestamp': timestamp,
        'X-DevHost-Nonce': nonce,
        'X-DevHost-Signature': signatureHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: method === 'GET' ? undefined : rawBody,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const parsed = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        mode: 'live_agent',
        data: parsed,
        error: parsed?.error || parsed?.message || `Compute agent HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      mode: 'live_agent',
      data: parsed,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 502,
      mode: 'live_agent',
      error: err instanceof Error ? err.message : 'Compute node daemon unreachable',
    };
  }
}

export async function pingComputeAgent(overrideAgentUrl?: string): Promise<
  ComputeAgentResponse<{
    healthy: boolean;
    version: string;
    dockerAvailable: boolean;
    caddyAvailable: boolean;
    activeContainers: number;
    freeDiskGb: number;
    loadAvg: number;
    latencyMs: number;
  }>
> {
  const started = Date.now();
  const res = await callComputeAgent<{
    healthy?: boolean;
    version?: string;
    dockerAvailable?: boolean;
    caddyAvailable?: boolean;
    activeContainers?: number;
    freeDiskGb?: number;
    loadAvg?: number;
  }>('/health', {
    method: 'GET',
    agentUrl: overrideAgentUrl,
    timeoutMs: 6000,
    sandboxMock: () => ({
      healthy: true,
      version: 'devhost-agent/1.0.0-sandbox',
      dockerAvailable: true,
      caddyAvailable: true,
      activeContainers: 6,
      freeDiskGb: 78.4,
      loadAvg: 0.32,
    }),
  });

  if (!res.ok || !res.data) {
    return {
      ok: false,
      status: res.status,
      mode: res.mode,
      unconfigured: res.unconfigured,
      error: res.error,
    };
  }

  return {
    ok: true,
    status: res.status,
    mode: res.mode,
    data: {
      healthy: Boolean(res.data.healthy ?? true),
      version: String(res.data.version || 'devhost-agent/1.0.0'),
      dockerAvailable: Boolean(res.data.dockerAvailable ?? true),
      caddyAvailable: Boolean(res.data.caddyAvailable ?? true),
      activeContainers: Number(res.data.activeContainers ?? 0),
      freeDiskGb: Number(res.data.freeDiskGb ?? 0),
      loadAvg: Number(res.data.loadAvg ?? 0),
      latencyMs: Date.now() - started,
    },
  };
}

export async function dispatchProvisionContainer(
  payload: AgentProvisionPayload,
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<AgentProvisionResult>> {
  return callComputeAgent<AgentProvisionResult>('/v1/containers/provision', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    timeoutMs: 25000,
    sandboxMock: () => ({
      containerId: `dh_${payload.cpanelUser}_${payload.releaseId.slice(0, 6)}`,
      upstreamPort: 3100 + (payload.serviceId.charCodeAt(0) % 400),
      upstreamUrl: `http://127.0.0.1:${3100 + (payload.serviceId.charCodeAt(0) % 400)}`,
      liveUrl: `https://${payload.domain}`,
      healthStatus: 'healthy',
      durationSeconds: 3,
      buildLogs: [
        `[${new Date().toISOString()}] Provisioned ${payload.runtimeFamily} container for ${payload.domain}`,
        `[00:00.80] Injected ${Object.keys(payload.envVars).length} encrypted runtime .env keys`,
        `[00:01.90] Executed: ${payload.installCommand} && ${payload.buildCommand}`,
        `[00:02.70] Caddy & Cloudflare Tunnel upstream health probe HTTP 200 OK`,
      ].join('\n'),
    }),
  });
}

export async function dispatchBuildAndDeploy(
  payload: {
    jobId: string;
    serviceId: string;
    cpanelUser: string;
    domain: string;
    stackSlug: string;
    runtimeFamily: string;
    runtimeVersion: string;
    gitRepoUrl?: string;
    gitBranch?: string;
    commitSha?: string;
    gitAccessToken?: string;
    environment?: 'production' | 'preview';
    prNumber?: number;
    previewHostname?: string;
    installCommand?: string;
    buildCommand?: string;
    startupFile?: string;
    outputDirectory?: string;
    r2ArtifactKey?: string;
    artifactDownloadUrl?: string;
    releaseId?: string;
    deploymentId?: string;
    startCommand?: string;
    ramLimitMb?: number;
    cpuCores?: number;
    diskLimitGb?: number;
    envVars: Record<string, string>;
    callbackUrl: string;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<AgentProvisionResult & { queuedAsync?: boolean }>> {
  return callComputeAgent<AgentProvisionResult & { queuedAsync?: boolean }>('/v1/builds/deploy', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    timeoutMs: 20000,
    sandboxMock: () => {
      const isPreview = payload.environment === 'preview' && Number.isFinite(payload.prNumber);
      const effectiveHost = payload.previewHostname || payload.domain;
      return {
        containerId: isPreview
          ? `dh_${payload.cpanelUser}_${payload.jobId.slice(0, 6)}_pr_${payload.prNumber}`
          : `dh_${payload.cpanelUser}_${payload.jobId.slice(0, 6)}`,
        upstreamPort: 3200,
        upstreamUrl: 'http://127.0.0.1:3200',
        liveUrl: `https://${effectiveHost}`,
        healthStatus: 'healthy',
        durationSeconds: 3,
        buildLogs: [
          `[${new Date().toISOString()}] Build job ${payload.jobId} started (${payload.stackSlug}${
            isPreview ? ` PR #${payload.prNumber}` : ''
          })`,
          `[00:01.10] Synced release ${payload.commitSha || 'HEAD'} and installed dependencies`,
          `[00:02.40] Compiled ${payload.buildCommand || 'production bundle'} and verified HTTP 200 OK`,
        ].join('\n'),
      };
    },
  });
}

export async function dispatchRollbackRelease(
  payload: { serviceId: string; domain: string; releaseId: string; commitSha?: string },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ rolledBack: boolean; liveUrl: string; message: string }>> {
  return callComputeAgent('/v1/builds/rollback', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      rolledBack: true,
      liveUrl: `https://${payload.domain}`,
      message: `Swapped atomic release symlink to ${payload.commitSha || payload.releaseId} on Caddy/Passenger.`,
    }),
  });
}

export async function dispatchDestroyPreview(
  payload: {
    serviceId: string;
    cpanelUser: string;
    prNumber: number;
    previewHostname?: string;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ destroyed: boolean; prNumber: number; containerId?: string }>> {
  return callComputeAgent('/v1/builds/preview-destroy', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      destroyed: true,
      prNumber: payload.prNumber,
      containerId: `dh_${payload.cpanelUser}_${payload.serviceId.slice(0, 8)}_pr_${payload.prNumber}`,
    }),
  });
}

export async function provisionDatabaseOnAgent(
  payload: {
    serviceId: string;
    cpanelUser: string;
    dbEngine: string;
    dbName: string;
    dbUsername: string;
    dbPassword: string;
    remoteIps: string[];
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ dbName: string; dbUsername: string; host: string; port: number }>> {
  const isPg = payload.dbEngine.toLowerCase().includes('postgres');
  return callComputeAgent('/v1/databases/provision', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      dbName: payload.dbName,
      dbUsername: payload.dbUsername,
      host: '103.151.102.45',
      port: isPg ? 5432 : 3306,
    }),
  });
}

export async function dropDatabaseOnAgent(
  payload: { serviceId: string; dbName: string; dbEngine: string },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ dropped: boolean }>> {
  return callComputeAgent('/v1/databases/drop', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({ dropped: true }),
  });
}

export async function updateDatabaseRemoteIpsOnAgent(
  payload: { serviceId: string; dbName: string; dbUsername: string; remoteIps: string[] },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ updated: boolean }>> {
  return callComputeAgent('/v1/databases/whitelist', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({ updated: true }),
  });
}

export async function execContainerCommandOnAgent(
  payload: {
    serviceId: string;
    cpanelUser: string;
    domain: string;
    command: string;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ output: string; exitCode: number; executionTimeMs: number }>> {
  return callComputeAgent('/v1/console/ssh', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    timeoutMs: 15000,
    sandboxMock: () => ({
      output: `[Sandbox Jailed-SSH ${payload.cpanelUser}@${payload.domain}]$ ${payload.command}\nExit code: 0 (DEV_SANDBOX_MODE)`,
      exitCode: 0,
      executionTimeMs: 12,
    }),
  });
}

export async function execSqlQueryOnAgent(
  payload: {
    serviceId: string;
    cpanelUser: string;
    dbName?: string;
    query: string;
  },
  overrideAgentUrl?: string | null
): Promise<
  ComputeAgentResponse<{
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  }>
> {
  return callComputeAgent('/v1/console/sql', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    timeoutMs: 12000,
    sandboxMock: () => ({
      columns: ['status', 'database', 'mode'],
      rows: [{ status: 'OK', database: payload.dbName || 'sandbox_db', mode: 'DEV_SANDBOX_MODE' }],
      rowCount: 1,
      executionTimeMs: 5,
    }),
  });
}

export async function syncContainerFilesOnAgent(
  payload: {
    action: 'list' | 'read' | 'write' | 'chmod' | 'delete';
    serviceId: string;
    cpanelUser: string;
    filePath: string;
    contentText?: string;
    permissionsOctal?: string;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ synced: boolean; contentText?: string; sizeBytes?: number; reloaded?: boolean }>> {
  return callComputeAgent('/v1/files', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      synced: true,
      contentText: payload.contentText,
      sizeBytes: payload.contentText ? new TextEncoder().encode(payload.contentText).length : 0,
      reloaded: payload.action === 'write',
    }),
  });
}

export async function provisionMailboxOnAgent(
  payload: {
    action: 'create' | 'update' | 'delete' | 'sso';
    serviceId: string;
    domain: string;
    emailAddress: string;
    quotaMb?: number;
    forwardToEmail?: string | null;
    autoresponderEnabled?: boolean;
    autoresponderSubject?: string | null;
    autoresponderBody?: string | null;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ ok: boolean; ssoUrl?: string; message?: string }>> {
  return callComputeAgent('/v1/email/mailbox', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      ok: true,
      ssoUrl:
        payload.action === 'sso'
          ? `https://webmail.${payload.domain}/?_task=mail&sso=sandbox_${Date.now().toString(36)}`
          : undefined,
      message: `Sandbox mailbox ${payload.action} processed for ${payload.emailAddress}.`,
    }),
  });
}

export async function triggerBackupSnapshotOnAgent(
  payload: {
    action: 'create' | 'restore' | 'delete';
    serviceId: string;
    cpanelUser: string;
    snapshotId: string;
    scope: string;
    r2ObjectKey?: string;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ sizeMb: number; r2ObjectKey?: string; checksumSha256?: string }>> {
  return callComputeAgent('/v1/backups/snapshot', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    timeoutMs: 25000,
    sandboxMock: () => ({
      sizeMb: 124.5,
      r2ObjectKey: payload.r2ObjectKey || `backups/${payload.serviceId}/${payload.snapshotId}.tar.gz`,
      checksumSha256: 'sandbox_sha256_verified',
    }),
  });
}

export async function manageCronJobOnAgent(
  payload: {
    action: 'upsert' | 'run_now' | 'toggle' | 'delete';
    serviceId: string;
    cpanelUser: string;
    cronId: string;
    cronExpression?: string;
    command?: string;
    isActive?: boolean;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ exitCode: number; outputLog: string }>> {
  return callComputeAgent('/v1/cron', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      exitCode: 0,
      outputLog: `[${new Date().toISOString()}] Executed cron command: ${payload.command || payload.cronId}\nExit code: 0`,
    }),
  });
}

export async function fetchContainerTelemetryAndLogs(
  serviceId: string,
  domain: string,
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<ContainerTelemetryPayload>> {
  return callComputeAgent<ContainerTelemetryPayload>(
    `/v1/telemetry/${encodeURIComponent(serviceId)}?domain=${encodeURIComponent(domain)}`,
    {
      method: 'GET',
      agentUrl: overrideAgentUrl,
      timeoutMs: 8000,
      sandboxMock: () => ({
        serviceId,
        domain,
        containerId: `dh_${serviceId.slice(0, 8)}`,
        status: 'running',
        cpuPercent: 4.2,
        ramUsedMb: 286,
        ramLimitMb: 2048,
        diskUsedGb: 0.42,
        inodesUsed: 4210,
        httpStatus: 200,
        uptimeSeconds: 84200,
        logs: `[${new Date().toISOString()}] INFO Ready on https://${domain} (Worker PID 1042)\n[${new Date().toISOString()}] OK GET / 200 11ms`,
        checkedAt: new Date().toISOString(),
      }),
    }
  );
}

export async function scaleContainerResourcesOnAgent(
  payload: {
    serviceId: string;
    cpanelUser: string;
    ramLimitMb: number;
    cpuCores: number;
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ scaled: boolean; ramLimitMb: number; cpuCores: number }>> {
  return callComputeAgent('/v1/containers/scale', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      scaled: true,
      ramLimitMb: payload.ramLimitMb,
      cpuCores: payload.cpuCores,
    }),
  });
}

export async function controlContainerLifecycleOnAgent(
  payload: {
    serviceId: string;
    domain: string;
    cpanelUser: string;
    action: 'restart' | 'stop' | 'start' | 'suspend' | 'resume' | 'terminate' | 'purge_cache';
  },
  overrideAgentUrl?: string | null
): Promise<ComputeAgentResponse<{ action: string; status: string; message: string }>> {
  return callComputeAgent('/v1/containers/lifecycle', {
    method: 'POST',
    body: payload,
    agentUrl: overrideAgentUrl,
    sandboxMock: () => ({
      action: payload.action,
      status: payload.action === 'stop' || payload.action === 'suspend' ? 'suspended' : 'running',
      message: `Sandbox container ${payload.action} executed for ${payload.domain}.`,
    }),
  });
}
