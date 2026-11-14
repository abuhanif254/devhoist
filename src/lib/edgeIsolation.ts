import type { NextRequest } from 'next/server';

function extractHostname(rawHostOrUrl: string | null | undefined): string {
  if (!rawHostOrUrl) return '';
  const trimmed = rawHostOrUrl.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    const parsed = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return trimmed.split('/')[0].split(':')[0].trim().toLowerCase();
  }
}

export function isEdgeExecutionOriginIsolated(request: NextRequest): {
  allowed: boolean;
  reason?: string;
} {
  const requestHost = extractHostname(
    request.headers.get('host') || request.nextUrl.host || request.nextUrl.hostname
  );
  const dashboardHost = extractHostname(process.env.NEXT_PUBLIC_SITE_URL);
  const wildcardBase = extractHostname(
    process.env.EDGE_SITES_WILDCARD_DOMAIN?.replace(/^\*\./, '').replace(/^\./, '')
  );
  const edgeOriginHost = extractHostname(process.env.EDGE_SITES_ORIGIN);

  if (wildcardBase) {
    if (dashboardHost && requestHost === dashboardHost) {
      return {
        allowed: false,
        reason: 'Tenant edge HTML/JS cannot execute on the primary dashboard origin.',
      };
    }
    const matchesWildcard =
      requestHost === wildcardBase || requestHost.endsWith(`.${wildcardBase}`);
    return matchesWildcard
      ? { allowed: true }
      : {
          allowed: false,
          reason: `Edge site assets must be accessed via an isolated *.${wildcardBase} host.`,
        };
  }

  if (edgeOriginHost) {
    if (dashboardHost && requestHost === dashboardHost && requestHost !== edgeOriginHost) {
      return {
        allowed: false,
        reason: 'Tenant edge HTML/JS cannot execute on the primary dashboard origin.',
      };
    }
    return requestHost === edgeOriginHost
      ? { allowed: true }
      : {
          allowed: false,
          reason: `Edge site assets must be requested via the configured EDGE_SITES_ORIGIN (${edgeOriginHost}).`,
        };
  }

  const isLoopback =
    requestHost === 'localhost' || requestHost === '127.0.0.1' || requestHost === '::1';
  if (isLoopback && process.env.NODE_ENV !== 'production') {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      'Isolated EDGE_SITES_ORIGIN or EDGE_SITES_WILDCARD_DOMAIN is required to execute tenant HTML/JS in production.',
  };
}
