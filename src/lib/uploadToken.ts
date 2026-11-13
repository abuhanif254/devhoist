/**
 * Signed Direct Upload Capability Tokens, Agent Artifact Download Tokens,
 * Plan Quota Resolution & Upload Session Persistence Helpers.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { timingSafeEqualStr } from '@/lib/authGuard';
import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';

export interface UploadCapabilityClaims {
  v: 1;
  purpose: 'upload';
  uploadId: string;
  serviceId: string;
  userId: string;
  r2Key: string;
  maxBytes: number;
  uploadMode: 'zip_upload' | 'folder_upload' | 'file_upload';
  deployTarget: 'auto' | 'static_edge' | 'container';
  expMs: number;
}

export interface ArtifactDownloadClaims {
  v: 1;
  purpose: 'artifact_download';
  serviceId: string;
  r2Key: string;
  expMs: number;
}

export interface UploadSessionRecord {
  id: string;
  service_id: string;
  user_id: string | null;
  file_name: string;
  upload_mode: 'zip_upload' | 'folder_upload' | 'file_upload';
  deploy_target: 'auto' | 'static_edge' | 'container';
  r2_object_key: string;
  declared_size_bytes: number;
  actual_size_bytes?: number | null;
  uncompressed_size_bytes?: number | null;
  entry_count?: number | null;
  detected_stack?: string | null;
  status: 'presigned' | 'uploaded' | 'scanning' | 'deployed' | 'rejected' | 'expired';
  rejection_reason?: string | null;
  deployment_id?: string | null;
  expires_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceUploadQuotaSnapshot {
  found: boolean;
  serviceId: string;
  domain: string;
  diskLimitGb: number;
  diskUsedGb: number;
  diskLimitBytes: number;
  diskUsedBytes: number;
  remainingDiskBytes: number;
  inodeLimit: number;
  inodeUsed: number;
  remainingInodes: number;
}

const sandboxUploadSessions = new Map<string, UploadSessionRecord>();

function getUploadSigningSecret(): string | null {
  const configured =
    process.env.DEVHOST_UPLOAD_SECRET ||
    process.env.DEVHOST_AGENT_SECRET ||
    process.env.SERVICE_WEBHOOK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (configured.trim().length > 0) {
    return configured.trim();
  }

  if (isDevSandboxMode()) {
    return 'devhost-local-sandbox-upload-signing-secret';
  }

  return null;
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string): string | null {
  try {
    return Buffer.from(input, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function signPayloadObject<T extends object>(payload: T): string | null {
  const secret = getUploadSigningSecret();
  if (!secret) return null;

  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const sigHex = createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${sigHex}`;
}

function verifyPayloadToken<T extends { expMs: number; v: number }>(token: string): T | null {
  const secret = getUploadSigningSecret();
  if (!secret || !token || typeof token !== 'string') return null;

  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigHex] = parts;
  if (!payloadB64 || !sigHex) return null;

  const expectedSigHex = createHmac('sha256', secret).update(payloadB64).digest('hex');
  if (!timingSafeEqualStr(sigHex.toLowerCase(), expectedSigHex.toLowerCase())) {
    return null;
  }

  const jsonStr = decodeBase64Url(payloadB64);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr) as T;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null;
    if (typeof parsed.expMs !== 'number' || Date.now() > parsed.expMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signUploadCapabilityToken(params: {
  uploadId: string;
  serviceId: string;
  userId: string;
  r2Key: string;
  maxBytes: number;
  uploadMode: 'zip_upload' | 'folder_upload' | 'file_upload';
  deployTarget: 'auto' | 'static_edge' | 'container';
  ttlMs?: number;
}): string | null {
  const ttlMs = Math.max(60_000, Math.min(params.ttlMs ?? 15 * 60_000, 60 * 60_000));
  return signPayloadObject<UploadCapabilityClaims>({
    v: 1,
    purpose: 'upload',
    uploadId: params.uploadId,
    serviceId: params.serviceId,
    userId: params.userId,
    r2Key: params.r2Key,
    maxBytes: params.maxBytes,
    uploadMode: params.uploadMode,
    deployTarget: params.deployTarget,
    expMs: Date.now() + ttlMs,
  });
}

export function verifyUploadCapabilityToken(token: string): UploadCapabilityClaims | null {
  const claims = verifyPayloadToken<UploadCapabilityClaims>(token);
  if (!claims || claims.purpose !== 'upload') return null;
  if (!claims.uploadId || !claims.serviceId || !claims.r2Key) return null;
  return claims;
}

export function signArtifactDownloadToken(params: {
  serviceId: string;
  r2Key: string;
  ttlMs?: number;
}): string | null {
  const ttlMs = Math.max(60_000, Math.min(params.ttlMs ?? 30 * 60_000, 2 * 60 * 60_000));
  return signPayloadObject<ArtifactDownloadClaims>({
    v: 1,
    purpose: 'artifact_download',
    serviceId: params.serviceId,
    r2Key: params.r2Key,
    expMs: Date.now() + ttlMs,
  });
}

export function verifyArtifactDownloadToken(token: string): ArtifactDownloadClaims | null {
  const claims = verifyPayloadToken<ArtifactDownloadClaims>(token);
  if (!claims || claims.purpose !== 'artifact_download') return null;
  if (!claims.serviceId || !claims.r2Key) return null;
  return claims;
}

export function buildSignedArtifactDownloadUrl(
  baseUrlOrigin: string,
  params: { serviceId: string; r2Key: string; ttlMs?: number }
): string | null {
  const token = signArtifactDownloadToken(params);
  if (!token) return null;
  const normalizedOrigin = baseUrlOrigin.replace(/\/+$/, '');
  return `${normalizedOrigin}/api/hosting/uploads/transfer?downloadToken=${encodeURIComponent(token)}`;
}

/**
 * Resolve disk & inode limits and current usage from `hosting_services`.
 */
export async function resolveServiceUploadQuota(
  serviceId: string,
  fallbackDomain = 'app.devhost.cloud'
): Promise<ServiceUploadQuotaSnapshot> {
  const BYTES_PER_GB = 1024 * 1024 * 1024;
  const defaultLimitGb = 5;
  const defaultInodeLimit = 250_000;

  if (!isSupabaseConfigured()) {
    return {
      found: isDevSandboxMode(),
      serviceId,
      domain: fallbackDomain,
      diskLimitGb: defaultLimitGb,
      diskUsedGb: 0,
      diskLimitBytes: defaultLimitGb * BYTES_PER_GB,
      diskUsedBytes: 0,
      remainingDiskBytes: defaultLimitGb * BYTES_PER_GB,
      inodeLimit: defaultInodeLimit,
      inodeUsed: 0,
      remainingInodes: defaultInodeLimit,
    };
  }

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('hosting_services')
    .select('id, domain, disk_limit_gb, disk_used_gb, inode_limit, inode_used')
    .eq('id', serviceId)
    .maybeSingle();

  const row = data as Record<string, unknown> | null;
  if (!row) {
    return {
      found: false,
      serviceId,
      domain: fallbackDomain,
      diskLimitGb: defaultLimitGb,
      diskUsedGb: 0,
      diskLimitBytes: defaultLimitGb * BYTES_PER_GB,
      diskUsedBytes: 0,
      remainingDiskBytes: defaultLimitGb * BYTES_PER_GB,
      inodeLimit: defaultInodeLimit,
      inodeUsed: 0,
      remainingInodes: defaultInodeLimit,
    };
  }

  const diskLimitGb = Math.max(0.001, Number(row.disk_limit_gb ?? defaultLimitGb));
  const diskUsedGb = Math.max(0, Number(row.disk_used_gb ?? row.disk_usage_gb ?? 0));
  const diskLimitBytes = Math.round(diskLimitGb * BYTES_PER_GB);
  const diskUsedBytes = Math.round(diskUsedGb * BYTES_PER_GB);
  const remainingDiskBytes = Math.max(0, diskLimitBytes - diskUsedBytes);

  const inodeLimit = Math.max(10, Number(row.inode_limit ?? defaultInodeLimit));
  const inodeUsed = Math.max(0, Number(row.inode_used ?? 0));
  const remainingInodes = Math.max(0, inodeLimit - inodeUsed);

  return {
    found: true,
    serviceId,
    domain: String(row.domain || fallbackDomain),
    diskLimitGb,
    diskUsedGb,
    diskLimitBytes,
    diskUsedBytes,
    remainingDiskBytes,
    inodeLimit,
    inodeUsed,
    remainingInodes,
  };
}

export async function createUploadSessionRecord(input: {
  id?: string;
  serviceId: string;
  userId: string;
  fileName: string;
  uploadMode: 'zip_upload' | 'folder_upload' | 'file_upload';
  deployTarget: 'auto' | 'static_edge' | 'container';
  r2ObjectKey: string;
  declaredSizeBytes: number;
  expiresAt: string;
  status?: UploadSessionRecord['status'];
}): Promise<UploadSessionRecord> {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const record: UploadSessionRecord = {
    id,
    service_id: input.serviceId,
    user_id: input.userId || null,
    file_name: input.fileName,
    upload_mode: input.uploadMode,
    deploy_target: input.deployTarget,
    r2_object_key: input.r2ObjectKey,
    declared_size_bytes: input.declaredSizeBytes,
    actual_size_bytes: null,
    uncompressed_size_bytes: null,
    entry_count: null,
    detected_stack: null,
    status: input.status || 'presigned',
    rejection_reason: null,
    deployment_id: null,
    expires_at: input.expiresAt,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('project_upload_sessions').insert({
      id: record.id,
      service_id: record.service_id,
      user_id: record.user_id,
      file_name: record.file_name,
      upload_mode: record.upload_mode,
      deploy_target: record.deploy_target,
      r2_object_key: record.r2_object_key,
      declared_size_bytes: record.declared_size_bytes,
      status: record.status,
      expires_at: record.expires_at,
    });
    if (error && !isDevSandboxMode()) {
      throw new Error(`Failed to persist upload session: ${error.message}`);
    }
  }

  sandboxUploadSessions.set(record.id, record);
  return record;
}

export async function getUploadSessionRecord(
  uploadId: string,
  serviceId: string
): Promise<UploadSessionRecord | null> {
  if (isSupabaseConfigured()) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('project_upload_sessions')
      .select('*')
      .eq('id', uploadId)
      .eq('service_id', serviceId)
      .maybeSingle();

    if (!error && data) {
      return data as UploadSessionRecord;
    }
  }

  const sandboxRec = sandboxUploadSessions.get(uploadId);
  if (sandboxRec && sandboxRec.service_id === serviceId) {
    return sandboxRec;
  }
  return null;
}

export async function updateUploadSessionRecord(
  uploadId: string,
  patch: Partial<
    Pick<
      UploadSessionRecord,
      | 'status'
      | 'actual_size_bytes'
      | 'uncompressed_size_bytes'
      | 'entry_count'
      | 'detected_stack'
      | 'rejection_reason'
      | 'deployment_id'
      | 'completed_at'
    >
  >
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const existing = sandboxUploadSessions.get(uploadId);
  if (existing) {
    sandboxUploadSessions.set(uploadId, {
      ...existing,
      ...patch,
      updated_at: updatedAt,
    });
  }

  if (isSupabaseConfigured()) {
    const supabase = getServiceSupabase();
    await supabase
      .from('project_upload_sessions')
      .update({
        ...patch,
        updated_at: updatedAt,
      })
      .eq('id', uploadId);
  }
}

export function clearSandboxUploadSessionsForTest(): void {
  sandboxUploadSessions.clear();
}
