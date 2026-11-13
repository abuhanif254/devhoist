/**
 * Cloudflare Edge Control Plane Client (Cloudflare Workers Compatible)
 * Uses native fetch() against Cloudflare API v4 with CLOUDFLARE_DNS_API_TOKEN.
 * Supports Zones, DNS Records, Cloudflare for SaaS Custom Hostnames (Edge TLS 1.3 + HTTP/3),
 * Edge Cache Purge, IP Access Rules / WAF, Dynamic 301/302 Redirect Rules, and Security Level toggles.
 */

import { isDevSandboxMode } from './supabase';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const PROXY_ELIGIBLE_RECORD_TYPES = new Set(['A', 'AAAA', 'CNAME']);

export interface CloudflareConfig {
  token: string;
  accountId: string;
  saasZoneId: string;
  fallbackOrigin: string;
  configured: boolean;
  saasConfigured: boolean;
}

export interface CloudflareZoneResult {
  ok: boolean;
  configured: boolean;
  zoneId?: string;
  nameServers?: string[];
  status?: string;
  error?: string;
}

export interface CloudflareDnsSyncResult {
  ok: boolean;
  configured: boolean;
  cloudflareRecordId?: string;
  zoneId?: string;
  proxied?: boolean;
  error?: string;
}

export interface CloudflareCustomHostnameResult {
  ok: boolean;
  configured: boolean;
  hostnameId?: string;
  status?: string;
  sslStatus?: 'active_tls13' | 'pending_validation' | 'provisioning' | 'expired';
  dcvMethod?: string;
  dcvRecordName?: string;
  dcvRecordValue?: string;
  error?: string;
}

export interface CloudflareApiEnvelope<T> {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
}

export function getCloudflareConfig(): CloudflareConfig {
  const token = (
    process.env.CLOUDFLARE_DNS_API_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    ''
  ).trim();
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const saasZoneId = (
    process.env.CLOUDFLARE_SAAS_ZONE_ID ||
    process.env.CLOUDFLARE_PRIMARY_ZONE_ID ||
    ''
  ).trim();
  const fallbackOrigin = (
    process.env.CLOUDFLARE_FALLBACK_ORIGIN || 'edge-origin.devhost.net'
  ).trim();

  const looksPlaceholder =
    !token ||
    token.includes('your-cloudflare-dns-zone-api-token') ||
    token.length < 16;

  return {
    token,
    accountId,
    saasZoneId,
    fallbackOrigin,
    configured: !looksPlaceholder,
    saasConfigured: !looksPlaceholder && Boolean(saasZoneId && !saasZoneId.includes('your-primary')),
  };
}

export function isCloudflareConfigured(): boolean {
  return getCloudflareConfig().configured;
}

export function isCloudflareSaasConfigured(): boolean {
  return getCloudflareConfig().saasConfigured;
}

export function extractApexDomain(domainOrHost: string): string {
  const clean = domainOrHost
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return clean;

  // Preserve 2-level ccTLDs such as .com.bd, .co.uk, .org.bd
  const secondLast = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  if (last.length === 2 && ['com', 'net', 'org', 'edu', 'gov', 'ac', 'co'].includes(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

async function cfRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; result?: T; error?: string }> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      status: 503,
      error: 'CLOUDFLARE_DNS_API_TOKEN is not configured.',
    };
  }

  try {
    const res = await fetch(`${CF_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    const payload = (await res.json().catch(() => ({}))) as CloudflareApiEnvelope<T>;
    if (!res.ok || payload.success === false) {
      const cfMsg =
        payload.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
        `Cloudflare API returned HTTP ${res.status}`;
      return { ok: false, status: res.status, error: cfMsg };
    }

    return { ok: true, status: res.status, result: payload.result };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : 'Cloudflare API network failure',
    };
  }
}

export async function verifyCloudflareToken(): Promise<{
  configured: boolean;
  valid: boolean;
  status?: string;
  error?: string;
}> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      valid: false,
      error: 'CLOUDFLARE_DNS_API_TOKEN not set.',
    };
  }

  const res = await cfRequest<{ id?: string; status?: string }>('/user/tokens/verify');
  return {
    configured: true,
    valid: res.ok,
    status: res.result?.status || (res.ok ? 'active' : 'invalid'),
    error: res.error,
  };
}

export async function getCloudflareZoneByName(domainRaw: string): Promise<CloudflareZoneResult> {
  const apex = extractApexDomain(domainRaw);
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    return { ok: false, configured: false, error: 'Cloudflare API token not configured' };
  }

  const lookup = await cfRequest<Array<{ id: string; name: string; status: string; name_servers?: string[] }>>(
    `/zones?name=${encodeURIComponent(apex)}`
  );
  if (!lookup.ok) {
    return { ok: false, configured: true, error: lookup.error };
  }

  const match = lookup.result?.[0];
  if (!match) {
    return { ok: false, configured: true, error: `No Cloudflare zone found for ${apex}` };
  }

  return {
    ok: true,
    configured: true,
    zoneId: match.id,
    status: match.status,
    nameServers: match.name_servers || [],
  };
}

/**
 * Looks up an existing Cloudflare zone or creates a new Full DNS Zone when CLOUDFLARE_ACCOUNT_ID is set.
 */
export async function ensureCloudflareZone(domainRaw: string): Promise<CloudflareZoneResult> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        zoneId: `cf_sbx_zone_${extractApexDomain(domainRaw).replace(/[^a-z0-9]/g, '')}`,
        status: 'sandbox',
        nameServers: ['ns1.devhost.net', 'ns2.devhost.net'],
      };
    }
    return { ok: false, configured: false, error: 'Cloudflare API token not configured.' };
  }

  const existing = await getCloudflareZoneByName(domainRaw);
  if (existing.ok && existing.zoneId) {
    return existing;
  }

  if (!cfg.accountId || cfg.accountId.includes('your-cloudflare-account-id')) {
    return {
      ok: false,
      configured: true,
      error: `Cloudflare zone for ${extractApexDomain(domainRaw)} not found and CLOUDFLARE_ACCOUNT_ID is missing to auto-create it.`,
    };
  }

  const created = await cfRequest<{ id: string; status: string; name_servers?: string[] }>('/zones', {
    method: 'POST',
    body: JSON.stringify({
      name: extractApexDomain(domainRaw),
      account: { id: cfg.accountId },
      type: 'full',
      jump_start: false,
    }),
  });

  if (!created.ok || !created.result) {
    return { ok: false, configured: true, error: created.error };
  }

  return {
    ok: true,
    configured: true,
    zoneId: created.result.id,
    status: created.result.status || 'pending',
    nameServers: created.result.name_servers || [],
  };
}

function normalizeCfRecordName(name: string, apexDomain?: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || trimmed === '@') return apexDomain || '@';
  return trimmed;
}

export async function listCloudflareDnsRecords(zoneId: string) {
  return cfRequest<
    Array<{
      id: string;
      type: string;
      name: string;
      content: string;
      ttl: number;
      proxied?: boolean;
      priority?: number;
      comment?: string;
    }>
  >(`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=100`);
}

export async function upsertCloudflareDnsRecord(
  zoneId: string,
  record: {
    type: string;
    name: string;
    content: string;
    ttl?: number;
    priority?: number | null;
    proxied?: boolean;
    comment?: string | null;
  },
  options?: {
    existingCloudflareRecordId?: string | null;
    apexDomain?: string;
  }
): Promise<CloudflareDnsSyncResult> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    return { ok: false, configured: false, error: 'Cloudflare not configured' };
  }

  const upperType = record.type.toUpperCase();
  const proxied = PROXY_ELIGIBLE_RECORD_TYPES.has(upperType) ? Boolean(record.proxied) : false;
  const rawTtl = Number(record.ttl || 3600);
  const ttl = proxied ? 1 : rawTtl === 1 ? 1 : Math.max(60, rawTtl);

  const payload: Record<string, unknown> = {
    type: upperType,
    name: normalizeCfRecordName(record.name, options?.apexDomain),
    content: record.content.trim(),
    ttl,
    proxied,
  };

  if (record.priority !== undefined && record.priority !== null && (upperType === 'MX' || upperType === 'SRV')) {
    payload.priority = Number(record.priority);
  }
  if (record.comment) {
    payload.comment = record.comment;
  }

  const cfId = options?.existingCloudflareRecordId;
  const path = cfId
    ? `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(cfId)}`
    : `/zones/${encodeURIComponent(zoneId)}/dns_records`;

  const res = await cfRequest<{ id: string; proxied?: boolean }>(path, {
    method: cfId ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.result) {
    return { ok: false, configured: true, zoneId, error: res.error };
  }

  return {
    ok: true,
    configured: true,
    cloudflareRecordId: res.result.id,
    zoneId,
    proxied: Boolean(res.result.proxied),
  };
}

export async function deleteCloudflareDnsRecord(
  zoneId: string,
  cloudflareRecordId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await cfRequest<{ id: string }>(
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(cloudflareRecordId)}`,
    { method: 'DELETE' }
  );
  return { ok: res.ok, error: res.error };
}

/**
 * Registers a customer hostname on Cloudflare for SaaS (Edge TLS 1.3 + HTTP/3 + DCV Validation).
 */
export async function createCloudflareCustomHostname(
  hostnameRaw: string,
  options?: { dcvMethod?: 'txt' | 'http'; customOriginServer?: string }
): Promise<CloudflareCustomHostnameResult> {
  const cfg = getCloudflareConfig();
  const hostname = hostnameRaw.trim().toLowerCase();

  if (!cfg.saasConfigured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        hostnameId: `cf_sbx_ch_${Date.now().toString(36)}`,
        status: 'pending',
        sslStatus: 'pending_validation',
        dcvMethod: options?.dcvMethod || 'txt',
        dcvRecordName: `_cf-custom-hostname.${hostname}`,
        dcvRecordValue: `devhost-sandbox-dcv-${hostname.replace(/[^a-z0-9]/g, '')}`,
      };
    }
    return {
      ok: false,
      configured: cfg.configured,
      error: 'CLOUDFLARE_SAAS_ZONE_ID not configured for Custom Hostname Edge SSL.',
    };
  }

  const body: Record<string, unknown> = {
    hostname,
    ssl: {
      method: options?.dcvMethod || 'txt',
      type: 'dv',
      settings: {
        http2: 'on',
        http3: 'on',
        min_tls_version: '1.2',
        tls_1_3: 'on',
      },
    },
  };
  if (options?.customOriginServer) {
    body.custom_origin_server = options.customOriginServer;
  }

  const res = await cfRequest<{
    id: string;
    status?: string;
    ssl?: {
      status?: string;
      method?: string;
      validation_records?: Array<{
        txt_name?: string;
        txt_value?: string;
        http_url?: string;
        http_body?: string;
      }>;
    };
    ownership_verification?: { name?: string; value?: string };
  }>(`/zones/${encodeURIComponent(cfg.saasZoneId)}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.result) {
    return { ok: false, configured: true, error: res.error };
  }

  const sslRaw = String(res.result.ssl?.status || 'pending_validation').toLowerCase();
  const sslStatus: CloudflareCustomHostnameResult['sslStatus'] =
    sslRaw === 'active'
      ? 'active_tls13'
      : sslRaw === 'pending_validation'
      ? 'pending_validation'
      : 'provisioning';

  const valRec = res.result.ssl?.validation_records?.[0];
  const ownership = res.result.ownership_verification;

  return {
    ok: true,
    configured: true,
    hostnameId: res.result.id,
    status: res.result.status || 'pending',
    sslStatus,
    dcvMethod: res.result.ssl?.method || options?.dcvMethod || 'txt',
    dcvRecordName: valRec?.txt_name || ownership?.name || `_cf-custom-hostname.${hostname}`,
    dcvRecordValue: valRec?.txt_value || ownership?.value || '',
  };
}

export async function getCloudflareCustomHostnameStatus(
  hostnameId: string
): Promise<CloudflareCustomHostnameResult> {
  const cfg = getCloudflareConfig();
  if (!cfg.saasConfigured) {
    return {
      ok: false,
      configured: false,
      error: 'CLOUDFLARE_SAAS_ZONE_ID not configured.',
    };
  }

  const res = await cfRequest<{
    id: string;
    status?: string;
    ssl?: {
      status?: string;
      method?: string;
      validation_records?: Array<{ txt_name?: string; txt_value?: string }>;
    };
  }>(
    `/zones/${encodeURIComponent(cfg.saasZoneId)}/custom_hostnames/${encodeURIComponent(hostnameId)}`
  );

  if (!res.ok || !res.result) {
    return { ok: false, configured: true, error: res.error };
  }

  const sslRaw = String(res.result.ssl?.status || 'pending_validation').toLowerCase();
  const sslStatus: CloudflareCustomHostnameResult['sslStatus'] =
    sslRaw === 'active'
      ? 'active_tls13'
      : sslRaw === 'pending_validation'
      ? 'pending_validation'
      : 'provisioning';
  const valRec = res.result.ssl?.validation_records?.[0];

  return {
    ok: true,
    configured: true,
    hostnameId: res.result.id,
    status: res.result.status,
    sslStatus,
    dcvMethod: res.result.ssl?.method,
    dcvRecordName: valRec?.txt_name,
    dcvRecordValue: valRec?.txt_value,
  };
}

export async function deleteCloudflareCustomHostname(
  hostnameId: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getCloudflareConfig();
  if (!cfg.saasConfigured) return { ok: false, error: 'Cloudflare SaaS zone not configured.' };

  const res = await cfRequest<{ id: string }>(
    `/zones/${encodeURIComponent(cfg.saasZoneId)}/custom_hostnames/${encodeURIComponent(hostnameId)}`,
    { method: 'DELETE' }
  );
  return { ok: res.ok, error: res.error };
}

/**
 * Purges Cloudflare Edge Cache for a zone or domain (files, hostnames, or purge_everything).
 */
export async function purgeCloudflareCache(params: {
  zoneId?: string;
  domain?: string;
  files?: string[];
  hosts?: string[];
  purgeEverything?: boolean;
}): Promise<{ ok: boolean; configured: boolean; zoneId?: string; error?: string }> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return { ok: true, configured: false, zoneId: params.zoneId || 'cf_sbx_zone' };
    }
    return { ok: false, configured: false, error: 'CLOUDFLARE_DNS_API_TOKEN not configured.' };
  }

  let zoneId = params.zoneId;
  if (!zoneId && params.domain) {
    const lookedUp = await getCloudflareZoneByName(params.domain);
    zoneId = lookedUp.zoneId;
  }
  if (!zoneId && cfg.saasZoneId) {
    zoneId = cfg.saasZoneId;
  }
  if (!zoneId) {
    return {
      ok: false,
      configured: true,
      error: `Unable to resolve Cloudflare Zone ID for ${params.domain || 'request'}.`,
    };
  }

  const body: Record<string, unknown> = params.files?.length
    ? { files: params.files }
    : params.hosts?.length
    ? { hosts: params.hosts }
    : { purge_everything: params.purgeEverything !== false };

  const res = await cfRequest<{ id?: string }>(
    `/zones/${encodeURIComponent(zoneId)}/purge_cache`,
    { method: 'POST', body: JSON.stringify(body) }
  );

  return { ok: res.ok, configured: true, zoneId, error: res.error };
}

/**
 * Synchronizes an IP Block / Challenge / Whitelist rule to Cloudflare Account or Zone IP Access Rules API.
 */
export async function upsertCloudflareIpAccessRule(params: {
  ipOrCidr: string;
  mode: 'block' | 'managed_challenge' | 'js_challenge' | 'whitelist';
  notes: string;
  zoneId?: string;
}): Promise<{ ok: boolean; configured: boolean; cloudflareRuleId?: string; error?: string }> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    return { ok: false, configured: false, error: 'Cloudflare API token not configured.' };
  }

  const scopePath = params.zoneId
    ? `/zones/${encodeURIComponent(params.zoneId)}/firewall/access_rules/rules`
    : cfg.accountId
    ? `/accounts/${encodeURIComponent(cfg.accountId)}/firewall/access_rules/rules`
    : cfg.saasZoneId
    ? `/zones/${encodeURIComponent(cfg.saasZoneId)}/firewall/access_rules/rules`
    : null;

  if (!scopePath) {
    return {
      ok: false,
      configured: true,
      error: 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_SAAS_ZONE_ID required to push IP Access Rules.',
    };
  }

  const target = params.ipOrCidr.includes('/') ? 'ip_range' : 'ip';
  const res = await cfRequest<{ id: string }>(scopePath, {
    method: 'POST',
    body: JSON.stringify({
      mode: params.mode,
      configuration: { target, value: params.ipOrCidr.trim() },
      notes: params.notes.slice(0, 500),
    }),
  });

  if (!res.ok || !res.result) {
    return { ok: false, configured: true, error: res.error };
  }

  return {
    ok: true,
    configured: true,
    cloudflareRuleId: res.result.id,
  };
}

export async function deleteCloudflareIpAccessRule(
  cloudflareRuleId: string,
  zoneId?: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) return { ok: false, error: 'Cloudflare not configured' };

  const scopePath = zoneId
    ? `/zones/${encodeURIComponent(zoneId)}/firewall/access_rules/rules/${encodeURIComponent(cloudflareRuleId)}`
    : cfg.accountId
    ? `/accounts/${encodeURIComponent(cfg.accountId)}/firewall/access_rules/rules/${encodeURIComponent(cloudflareRuleId)}`
    : cfg.saasZoneId
    ? `/zones/${encodeURIComponent(cfg.saasZoneId)}/firewall/access_rules/rules/${encodeURIComponent(cloudflareRuleId)}`
    : null;

  if (!scopePath) return { ok: false, error: 'Missing Cloudflare scope ID' };

  const res = await cfRequest<{ id: string }>(scopePath, { method: 'DELETE' });
  return { ok: res.ok, error: res.error };
}

export async function setCloudflareSecurityLevel(
  level: 'under_attack' | 'high' | 'medium' | 'low',
  zoneId?: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getCloudflareConfig();
  const targetZone = zoneId || cfg.saasZoneId;
  if (!cfg.configured || !targetZone) {
    return { ok: false, error: 'Cloudflare token or target zone not configured.' };
  }

  const res = await cfRequest<{ value: string }>(
    `/zones/${encodeURIComponent(targetZone)}/settings/security_level`,
    {
      method: 'PATCH',
      body: JSON.stringify({ value: level }),
    }
  );
  return { ok: res.ok, error: res.error };
}

/**
 * Adds a 301/302 URL redirect rule to a zone's dynamic redirect ruleset phase.
 */
export async function createCloudflareRedirectRule(params: {
  zoneId: string;
  domainName: string;
  sourcePrefix: string;
  targetUrl: string;
  statusCode: 301 | 302;
}): Promise<{ ok: boolean; configured: boolean; ruleId?: string; error?: string }> {
  const cfg = getCloudflareConfig();
  if (!cfg.configured) {
    return { ok: false, configured: false, error: 'Cloudflare not configured.' };
  }

  const prefix = params.sourcePrefix.trim() || '@';
  const hostExpr =
    prefix === '@'
      ? `(http.host eq "${params.domainName}")`
      : prefix.startsWith('/')
      ? `(http.host eq "${params.domainName}" and starts_with(http.request.uri.path, "${prefix}"))`
      : `(http.host eq "${prefix}.${params.domainName}")`;

  // Fetch existing entrypoint ruleset if present so we append cleanly
  const existing = await cfRequest<{
    id: string;
    rules?: Array<Record<string, unknown>>;
  }>(`/zones/${encodeURIComponent(params.zoneId)}/rulesets/phases/http_request_dynamic_redirect/entrypoint`);

  const newRule = {
    action: 'redirect',
    description: `DevHost ${params.statusCode} forward ${prefix} -> ${params.targetUrl}`,
    enabled: true,
    expression: hostExpr,
    action_parameters: {
      from_value: {
        status_code: params.statusCode,
        target_url: { value: params.targetUrl },
        preserve_query_string: true,
      },
    },
  };

  if (existing.ok && existing.result?.id) {
    const added = await cfRequest<{ rules?: Array<{ id: string }> }>(
      `/zones/${encodeURIComponent(params.zoneId)}/rulesets/${encodeURIComponent(existing.result.id)}/rules`,
      {
        method: 'POST',
        body: JSON.stringify(newRule),
      }
    );
    if (!added.ok) return { ok: false, configured: true, error: added.error };
    const createdRuleId = added.result?.rules?.[added.result.rules.length - 1]?.id;
    return { ok: true, configured: true, ruleId: createdRuleId };
  }

  // Create entrypoint ruleset cleanly
  const created = await cfRequest<{ rules?: Array<{ id: string }> }>(
    `/zones/${encodeURIComponent(params.zoneId)}/rulesets`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'DevHost Dynamic Redirects',
        kind: 'zone',
        phase: 'http_request_dynamic_redirect',
        rules: [newRule],
      }),
    }
  );
  if (!created.ok) return { ok: false, configured: true, error: created.error };
  const ruleId = created.result?.rules?.[0]?.id;
  return { ok: true, configured: true, ruleId };
}

export async function deleteCloudflareRedirectRule(
  zoneId: string,
  ruleId: string
): Promise<{ ok: boolean; error?: string }> {
  const existing = await cfRequest<{ id: string }>(
    `/zones/${encodeURIComponent(zoneId)}/rulesets/phases/http_request_dynamic_redirect/entrypoint`
  );
  if (!existing.ok || !existing.result?.id) {
    return { ok: false, error: existing.error || 'Redirect ruleset entrypoint not found.' };
  }

  const del = await cfRequest<unknown>(
    `/zones/${encodeURIComponent(zoneId)}/rulesets/${encodeURIComponent(existing.result.id)}/rules/${encodeURIComponent(ruleId)}`,
    { method: 'DELETE' }
  );
  return { ok: del.ok, error: del.error };
}
