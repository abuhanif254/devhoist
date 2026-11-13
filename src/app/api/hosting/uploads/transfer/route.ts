import { NextRequest, NextResponse } from 'next/server';
import { serviceUnavailableResponse } from '@/lib/authGuard';
import { checkKeyedRateLimit } from '@/lib/edgeRateLimit';
import {
  getR2Artifact,
  isR2ArtifactsConfigured,
  putR2Artifact,
} from '@/lib/cloudflareStorageQueue';
import { isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';
import { hasZipMagic, MAX_COMPRESSED_UPLOAD_BYTES } from '@/lib/archiveSecurity';
import {
  getUploadSessionRecord,
  updateUploadSessionRecord,
  verifyArtifactDownloadToken,
  verifyUploadCapabilityToken,
} from '@/lib/uploadToken';

function extractToken(req: NextRequest, paramName: string, headerName: string): string {
  const fromQuery = req.nextUrl.searchParams.get(paramName) || '';
  if (fromQuery.trim()) return fromQuery.trim();
  const fromHeader = req.headers.get(headerName) || '';
  if (fromHeader.trim()) return fromHeader.trim();
  return '';
}

async function readUploadedArchiveBytes(req: NextRequest): Promise<Uint8Array | null> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return null;
    const file = formData.get('file');
    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      return new Uint8Array(await (file as Blob).arrayBuffer());
    }
    return null;
  }

  const ab = await req.arrayBuffer().catch(() => null);
  return ab ? new Uint8Array(ab) : null;
}

async function handleSignedUpload(req: NextRequest) {
  try {
    const token = extractToken(req, 'token', 'x-upload-token');
    const claims = verifyUploadCapabilityToken(token);
    if (!claims) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired signed upload token.' },
        { status: 401 }
      );
    }

    const rate = checkKeyedRateLimit(`upload-transfer:${claims.userId}`, 40, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Upload transfer rate limit exceeded.',
          retryAfterSeconds: Math.ceil((rate.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    if (!isR2ArtifactsConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare R2 Artifacts Storage');
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Supabase Upload Session Store');
    }

    const session = await getUploadSessionRecord(claims.uploadId, claims.serviceId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Upload session not found.' },
        { status: 404 }
      );
    }

    if (session.status === 'deployed' || session.status === 'rejected') {
      return NextResponse.json(
        {
          success: false,
          error: `Upload session is already closed (status: ${session.status}).`,
        },
        { status: 409 }
      );
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await updateUploadSessionRecord(session.id, { status: 'expired' });
      return NextResponse.json(
        { success: false, error: 'Upload session has expired. Request a new upload URL.' },
        { status: 410 }
      );
    }

    const bytes = await readUploadedArchiveBytes(req);
    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty upload body. Please provide a non-empty .zip archive.' },
        { status: 400 }
      );
    }

    const allowedLimit = Math.min(claims.maxBytes, MAX_COMPRESSED_UPLOAD_BYTES);
    if (bytes.byteLength > allowedLimit) {
      await updateUploadSessionRecord(session.id, {
        status: 'rejected',
        actual_size_bytes: bytes.byteLength,
        rejection_reason: `Archive size ${bytes.byteLength} exceeded signed cap ${allowedLimit}.`,
      });
      return NextResponse.json(
        {
          success: false,
          code: 'QUOTA_EXCEEDED',
          error: `Uploaded archive (${bytes.byteLength} bytes) exceeds allowed limit (${allowedLimit} bytes).`,
        },
        { status: 413 }
      );
    }

    if (!hasZipMagic(bytes)) {
      await updateUploadSessionRecord(session.id, {
        status: 'rejected',
        actual_size_bytes: bytes.byteLength,
        rejection_reason: 'Rejected non-ZIP payload without PK signature.',
      });
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_ARCHIVE',
          error: 'Only valid ZIP archives (PK header) are accepted.',
        },
        { status: 400 }
      );
    }

    const putRes = await putR2Artifact(claims.r2Key, bytes, 'application/zip');
    if (!putRes.ok) {
      return serviceUnavailableResponse('Cloudflare R2 Artifacts Storage');
    }

    await updateUploadSessionRecord(session.id, {
      status: 'uploaded',
      actual_size_bytes: bytes.byteLength,
    });

    return NextResponse.json({
      success: true,
      uploadId: claims.uploadId,
      serviceId: claims.serviceId,
      r2Key: claims.r2Key,
      bytesStored: bytes.byteLength,
      mode: putRes.mode,
    });
  } catch (err) {
    console.error('[PUT/POST /api/hosting/uploads/transfer]', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to store uploaded archive.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleSignedUpload(req);
}

export async function POST(req: NextRequest) {
  return handleSignedUpload(req);
}

/**
 * Compute node signed artifact download endpoint (`GET ?downloadToken=...`).
 * Avoids exposing raw Cloudflare R2 credentials to remote build/worker nodes.
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req, 'downloadToken', 'x-artifact-token');
    const claims = verifyArtifactDownloadToken(token);
    if (!claims) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired artifact download token.' },
        { status: 401 }
      );
    }

    if (!isR2ArtifactsConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare R2 Artifacts Storage');
    }

    const r2Res = await getR2Artifact(claims.r2Key);
    if (!r2Res.found || !r2Res.bodyBuffer) {
      return NextResponse.json(
        { success: false, error: 'Artifact object not found in storage.' },
        { status: 404 }
      );
    }

    const bytes = new Uint8Array(r2Res.bodyBuffer);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': r2Res.contentType || 'application/zip',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-DevHost-Artifact-Key': claims.r2Key,
      },
    });
  } catch (err) {
    console.error('[GET /api/hosting/uploads/transfer]', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to stream artifact.',
      },
      { status: 500 }
    );
  }
}
