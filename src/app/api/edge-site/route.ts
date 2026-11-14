// ==============================================================================
// DEVHOST CLOUD - CLOUDFLARE EDGE STATIC SITE ROUTER
// Serves published `static_edge` releases directly from Cloudflare R2 (`DEVHOST_ARTIFACTS_BUCKET`).
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import {
  getR2Artifact,
  isR2ArtifactsConfigured,
} from '@/lib/cloudflareStorageQueue';
import { isEdgeExecutionOriginIsolated } from '@/lib/edgeIsolation';

function inferMimeType(filePath: string, fallback?: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return fallback || 'application/octet-stream';
}

function isExecutableWebMime(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return (
    lower.includes('text/html') ||
    lower.includes('application/xhtml') ||
    lower.includes('javascript') ||
    lower.includes('ecmascript') ||
    lower.includes('image/svg+xml')
  );
}

function sanitizeAssetPath(rawPath: string | null): string {
  const cleaned = (rawPath || 'index.html')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
  return cleaned || 'index.html';
}

export async function GET(request: NextRequest) {
  try {
    if (!isR2ArtifactsConfigured() && !isDevSandboxMode()) {
      return NextResponse.json(
        {
          error: 'Cloudflare R2 Edge Storage Plane is not configured.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    let siteId =
      searchParams.get('site') ||
      request.headers.get('x-devhost-site') ||
      '';
    const hostParam =
      searchParams.get('host') ||
      request.headers.get('x-forwarded-host') ||
      '';
    const requestedPath = sanitizeAssetPath(searchParams.get('path'));

    if (!siteId && hostParam) {
      const supabaseAdmin = getServiceSupabase();
      if (supabaseAdmin) {
        const cleanHost = hostParam.split(':')[0].toLowerCase();
        const { data: srv } = await supabaseAdmin
          .from('hosting_services')
          .select('id')
          .eq('domain', cleanHost)
          .maybeSingle();
        if (srv?.id) {
          siteId = String(srv.id);
        }
      }
    }

    if (!siteId) {
      return NextResponse.json(
        { error: 'site (serviceId) or host query parameter is required.' },
        { status: 400 }
      );
    }

    const manifestObj = await getR2Artifact(`sites/${siteId}/current.json`);
    if (!manifestObj.found || !manifestObj.bodyText) {
      return NextResponse.json(
        { error: `No published Edge release manifest found for site ${siteId}.` },
        { status: 404 }
      );
    }

    const manifest = JSON.parse(manifestObj.bodyText) as {
      releaseId?: string;
      domain?: string;
      files?: string[];
    };
    const releaseId = manifest.releaseId;
    if (!releaseId) {
      return NextResponse.json({ error: 'Corrupted Edge release manifest' }, { status: 500 });
    }

    const assetKey = `sites/${siteId}/releases/${releaseId}/${requestedPath}`;
    let assetObj = await getR2Artifact(assetKey);

    // SPA fallback for extensionless paths -> index.html
    if ((!assetObj.found || !assetObj.bodyBuffer) && !requestedPath.includes('.')) {
      assetObj = await getR2Artifact(`sites/${siteId}/releases/${releaseId}/index.html`);
    }

    if (!assetObj.found || (!assetObj.bodyBuffer && !assetObj.bodyText)) {
      return NextResponse.json({ error: 'Static asset not found' }, { status: 404 });
    }

    const bytes = assetObj.bodyBuffer
      ? new Uint8Array(assetObj.bodyBuffer)
      : new TextEncoder().encode(assetObj.bodyText || '');
    const contentType = inferMimeType(requestedPath, assetObj.contentType);
    const activeWebMime = isExecutableWebMime(contentType);

    if (activeWebMime) {
      const isolation = isEdgeExecutionOriginIsolated(request);
      if (!isolation.allowed) {
        return NextResponse.json(
          {
            error: 'Edge Origin Isolation Enforced',
            code: 'EDGE_ORIGIN_ISOLATION_REQUIRED',
            message: isolation.reason,
          },
          {
            status: 403,
            headers: {
              'X-Content-Type-Options': 'nosniff',
              'Cache-Control': 'no-store',
            },
          }
        );
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control':
        requestedPath === 'index.html'
          ? 'public, max-age=60, stale-while-revalidate=300'
          : 'public, max-age=31536000, immutable',
      'X-DevHost-Edge-Router': 'r2',
      'X-DevHost-Release': releaseId,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    if (activeWebMime) {
      // Force an opaque null origin without allow-same-origin so cookies/storage on any host stay unreachable
      headers['Content-Security-Policy'] =
        "sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline' 'self'; img-src * data:; font-src * data:; connect-src 'none'; form-action 'none'; frame-ancestors 'none';";
    }

    return new NextResponse(bytes, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Edge static router error' },
      { status: 500 }
    );
  }
}
