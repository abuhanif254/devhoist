import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import { checkKeyedRateLimit } from '@/lib/edgeRateLimit';
import { isR2ArtifactsConfigured } from '@/lib/cloudflareStorageQueue';
import { isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';
import {
  MAX_COMPRESSED_UPLOAD_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  type DeployTargetPreference,
} from '@/lib/archiveSecurity';
import {
  createUploadSessionRecord,
  resolveServiceUploadQuota,
  signUploadCapabilityToken,
} from '@/lib/uploadToken';

const VALID_UPLOAD_MODES = new Set(['zip_upload', 'folder_upload', 'file_upload']);
const VALID_DEPLOY_TARGETS = new Set(['auto', 'static_edge', 'container']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload.' },
        { status: 400 }
      );
    }

    const serviceId = String(body.serviceId || '').trim();
    const rawFileName = String(body.fileName || 'bundle.zip').trim();
    const sizeBytes = Number(body.sizeBytes ?? 0);
    const uploadModeRaw = String(body.uploadMode || 'zip_upload').trim();
    const deployTargetRaw = String(body.deployTarget || 'auto').trim();

    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'serviceId is required.' },
        { status: 400 }
      );
    }

    const access = await requireServiceAccess(req, serviceId, 'git:deploy');
    if (!access.ok) return access.response;

    const rate = checkKeyedRateLimit(
      `upload-presign:${access.user.id}:${serviceId}`,
      30,
      60_000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many upload requests. Please wait before starting another deployment.',
          retryAfterSeconds: Math.ceil((rate.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Supabase Upload Session Store');
    }

    if (!isR2ArtifactsConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare R2 Artifacts Storage');
    }

    const uploadMode = (VALID_UPLOAD_MODES.has(uploadModeRaw)
      ? uploadModeRaw
      : 'zip_upload') as 'zip_upload' | 'folder_upload' | 'file_upload';
    const deployTarget = (VALID_DEPLOY_TARGETS.has(deployTargetRaw)
      ? deployTargetRaw
      : 'auto') as DeployTargetPreference;

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json(
        { success: false, error: 'sizeBytes must be a positive integer.' },
        { status: 400 }
      );
    }

    if (sizeBytes > MAX_COMPRESSED_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          success: false,
          code: 'DECOMPRESSION_BOMB',
          error: `Upload exceeds maximum compressed archive limit of ${Math.round(
            MAX_COMPRESSED_UPLOAD_BYTES / (1024 * 1024)
          )} MB.`,
        },
        { status: 413 }
      );
    }

    const safeFileName =
      rawFileName
        .replace(/[/\\]/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 128) || 'bundle.zip';

    const quota = await resolveServiceUploadQuota(serviceId);
    if (isSupabaseConfigured() && !quota.found) {
      return NextResponse.json(
        { success: false, error: 'Hosting service not found.' },
        { status: 404 }
      );
    }

    if (sizeBytes > quota.remainingDiskBytes) {
      return NextResponse.json(
        {
          success: false,
          code: 'QUOTA_EXCEEDED',
          error: `Upload (${(sizeBytes / (1024 * 1024)).toFixed(
            2
          )} MB) exceeds remaining plan disk quota (${(
            quota.remainingDiskBytes /
            (1024 * 1024)
          ).toFixed(2)} MB available).`,
          quota,
        },
        { status: 413 }
      );
    }

    if (quota.remainingInodes <= 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'QUOTA_EXCEEDED',
          error: 'Hosting plan inode limit reached. Delete old files or upgrade your plan.',
          quota,
        },
        { status: 413 }
      );
    }

    const uploadId = randomUUID();
    const cleanServiceSegment = serviceId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `uploads/${cleanServiceSegment}/${uploadId}.zip`;
    const ttlMs = 15 * 60_000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const maxBytes = Math.min(MAX_COMPRESSED_UPLOAD_BYTES, quota.remainingDiskBytes);

    const uploadToken = signUploadCapabilityToken({
      uploadId,
      serviceId,
      userId: access.user.id,
      r2Key,
      maxBytes,
      uploadMode,
      deployTarget,
      ttlMs,
    });

    if (!uploadToken) {
      return serviceUnavailableResponse('Upload Capability Signing Key');
    }

    await createUploadSessionRecord({
      id: uploadId,
      serviceId,
      userId: access.user.id,
      fileName: safeFileName,
      uploadMode,
      deployTarget,
      r2ObjectKey: r2Key,
      declaredSizeBytes: Math.floor(sizeBytes),
      expiresAt,
      status: 'presigned',
    });

    const uploadUrl = `/api/hosting/uploads/transfer?token=${encodeURIComponent(uploadToken)}`;

    return NextResponse.json({
      success: true,
      uploadId,
      uploadToken,
      uploadUrl,
      method: 'PUT',
      r2Key,
      expiresAt,
      limits: {
        maxCompressedBytes: MAX_COMPRESSED_UPLOAD_BYTES,
        maxUncompressedBytes: MAX_UNCOMPRESSED_BYTES,
        maxAllowedForSessionBytes: maxBytes,
      },
      quota: {
        diskLimitGb: quota.diskLimitGb,
        diskUsedGb: quota.diskUsedGb,
        remainingDiskBytes: quota.remainingDiskBytes,
        inodeLimit: quota.inodeLimit,
        inodeUsed: quota.inodeUsed,
        remainingInodes: quota.remainingInodes,
      },
    });
  } catch (err) {
    console.error('[POST /api/hosting/uploads/presign]', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to initialize upload session.',
      },
      { status: 500 }
    );
  }
}
