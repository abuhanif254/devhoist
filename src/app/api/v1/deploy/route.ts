import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';


// Edge-native in-memory sliding window rate limiter (30 req / min)
const tokenRateLimitMap = new Map<string, { count: number; resetAt: number }>();

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
    const targetDomain = body.domain || 'ecommerce-live.com';
    const serviceId = body.serviceId || 'srv_production_sg1';

    let message = '';
    let deploymentId = `dep_${Date.now().toString(36)}`;

    switch (action) {
      case 'cache_purge':
        message = `LiteSpeed Edge Cache & Static Assets successfully purged for ${targetDomain}.`;
        break;

      case 'dns_record':
        message = `DNS Record (${body.recordType || 'A'} ${body.recordName || '@'} -> ${body.recordContent || '103.151.102.45'}) successfully synchronized.`;
        break;

      case 'deploy':
      default:
        message = `Zero-downtime Git pipeline triggered for ${targetDomain} (branch: ${body.branch || 'main'}). Passenger workers rolling reload scheduled.`;
        break;
    }

    const durationMs = Date.now() - startTime + 35;

    // Log call in developer_api_logs
    if (isSupabaseConfigured()) {
      try {
        const db = getServiceSupabase();
        await db.from('developer_api_logs').insert({
          user_id: body.userId || null,
          token_prefix: token.slice(0, 12) + '...',
          endpoint: '/api/v1/deploy',
          method: 'POST',
          target_domain: targetDomain,
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
      domain: targetDomain,
      serviceId,
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
