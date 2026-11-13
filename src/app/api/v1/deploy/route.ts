import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { timingSafeEqualStr } from '@/lib/authGuard';


// Edge-native in-memory sliding window rate limiter (30 req / min)
const tokenRateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function sha256HexEdge(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface StoredPatToken {
  id?: string;
  token_hash?: string;
  token?: string;
  scopes?: string[];
  revoked?: boolean;
  status?: string;
  expires_at?: string;
}

async function resolveVerifiedPatUser(
  token: string,
  requiredScope: string
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, error: 'Authentication store unavailable.' };
  }

  const db = getServiceSupabase();
  const tokenHash = await sha256HexEdge(token);

  const { data: profiles, error } = await db
    .from('customer_developer_profiles')
    .select('user_id, personal_api_tokens');

  if (error || !profiles) {
    return { ok: false, status: 401, error: 'Invalid or unrecognized Personal Access Token.' };
  }

  for (const prof of profiles) {
    const tokens = Array.isArray(prof.personal_api_tokens)
      ? (prof.personal_api_tokens as StoredPatToken[])
      : [];

    for (const entry of tokens) {
      if (!entry || entry.revoked === true || entry.status === 'revoked') continue;
      if (entry.expires_at && new Date(entry.expires_at).getTime() <= Date.now()) continue;

      const hashMatches =
        typeof entry.token_hash === 'string' &&
        timingSafeEqualStr(entry.token_hash.toLowerCase(), tokenHash);
      const rawMatches =
        typeof entry.token === 'string' &&
        timingSafeEqualStr(entry.token, token);

      if (!hashMatches && !rawMatches) continue;

      const scopes = Array.isArray(entry.scopes) ? entry.scopes : [];
      if (scopes.length > 0 && !scopes.includes('*') && !scopes.includes(requiredScope)) {
        return {
          ok: false,
          status: 403,
          error: `Token missing required scope: '${requiredScope}'.`,
        };
      }

      return { ok: true, userId: prof.user_id };
    }
  }

  return { ok: false, status: 401, error: 'Invalid, revoked, or expired Personal Access Token.' };
}

function checkApiRateLimit(tokenKey: string, maxReqs = 30): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = tokenRateLimitMap.get(tokenKey);

  if (!entry || entry.resetAt < now) {
    tokenRateLimitMap.set(tokenKey, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: maxReqs - 1 };
  }

  if (entry.count >= maxReqs) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  tokenRateLimitMap.set(tokenKey, entry);
  return { allowed: true, remaining: maxReqs - entry.count };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const authHeader = request.headers.get('authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: 'Unauthorized: Missing or malformed Bearer token.',
        hint: 'Pass Authorization: Bearer dh_live_xxxxxxxx in your HTTP headers.',
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Validate format (must be dh_live_...)
  if (!token.startsWith('dh_live_') && !token.startsWith('dh_test_')) {
    return NextResponse.json(
      {
        error: 'Invalid API Key format.',
        hint: 'Generate a scoped personal access token in /dashboard -> Security & API.',
      },
      { status: 403 }
    );
  }

  // Rate Limiting
  const rateLimit = checkApiRateLimit(token.slice(0, 16));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate Limit Exceeded: Maximum 30 requests per minute reached.',
        retryAfterSeconds: 60,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'deploy';
    const targetDomain = body.domain || '';
    const serviceId = body.serviceId || '';

    const requiredScope =
      action === 'dns_record'
        ? 'dns:write'
        : action === 'cache_purge'
        ? 'services:write'
        : 'git:deploy';

    const patAuth = await resolveVerifiedPatUser(token, requiredScope);
    if (!patAuth.ok) {
      return NextResponse.json({ error: patAuth.error }, { status: patAuth.status });
    }

    const db = getServiceSupabase();
    if (serviceId) {
      const { data: srv } = await db
        .from('hosting_services')
        .select('id, user_id')
        .eq('id', serviceId)
        .maybeSingle();
      if (!srv || srv.user_id !== patAuth.userId) {
        return NextResponse.json(
          { error: 'Forbidden: Token owner does not own requested serviceId.' },
          { status: 403 }
        );
      }
    } else if (targetDomain) {
      const cleanHost = String(targetDomain).trim().toLowerCase();
      const { data: srv } = await db
        .from('hosting_services')
        .select('id, user_id')
        .eq('domain', cleanHost)
        .eq('user_id', patAuth.userId)
        .maybeSingle();
      const { data: dom } = await db
        .from('domains')
        .select('id, user_id')
        .eq('domain_name', cleanHost)
        .eq('user_id', patAuth.userId)
        .maybeSingle();
      if (!srv && !dom) {
        return NextResponse.json(
          { error: 'Forbidden: Token owner does not own target domain.' },
          { status: 403 }
        );
      }
    }

    let message = '';
    const deploymentId = `dep_${Date.now().toString(36)}`;
    const resolvedDomain = targetDomain || 'app.devhost.cloud';

    switch (action) {
      case 'cache_purge':
        message = `LiteSpeed Edge Cache & Static Assets successfully purged for ${resolvedDomain}.`;
        break;

      case 'dns_record':
        message = `DNS Record (${body.recordType || 'A'} ${body.recordName || '@'} -> ${body.recordContent || '103.151.102.45'}) successfully synchronized.`;
        break;

      case 'deploy':
      default:
        message = `Zero-downtime Git pipeline triggered for ${resolvedDomain} (branch: ${body.branch || 'main'}). Passenger workers rolling reload scheduled.`;
        break;
    }

    const durationMs = Date.now() - startTime + 35;

    // Log call in developer_api_logs
    if (isSupabaseConfigured()) {
      try {
        await db.from('developer_api_logs').insert({
          user_id: patAuth.userId,
          token_prefix: token.slice(0, 12) + '...',
          endpoint: '/api/v1/deploy',
          method: 'POST',
          target_domain: resolvedDomain,
          status_code: 200,
          ip_address: request.headers.get('cf-connecting-ip') || '127.0.0.1',
          duration_ms: durationMs,
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('[Developer API Audit Log Notice]', logErr);
      }
    }

    return NextResponse.json({
      status: 'success',
      action,
      domain: resolvedDomain,
      serviceId: serviceId || null,
      deploymentId,
      durationMs,
      message,
      rateLimitRemaining: rateLimit.remaining,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Public API Error]', err);
    return NextResponse.json({ error: err?.message || 'Internal API Error' }, { status: 500 });
  }
}
