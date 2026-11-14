import { NextResponse } from 'next/server';
import { whmClient } from '@/lib/whmClient';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/authGuard';
import { resolveServiceComputeTarget, resolveWhmClientForTarget } from '@/lib/computeTargetResolver';

export async function POST(request: Request) {
  // Edge sliding-window rate limit (20 SSO attempts per min)
  const rateLimit = checkRateLimit(request, 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } }
    );
  }

  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { username, service = 'cpaneld' } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'cPanel username is required' },
        { status: 400 }
      );
    }

    let serviceRow: { id?: string; user_id?: string; cpanel_username?: string } | null = null;
    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data: srv } = await db
        .from('hosting_services')
        .select('id, user_id, cpanel_username')
        .eq('cpanel_username', username.trim())
        .maybeSingle();

      serviceRow = srv as { id?: string; user_id?: string; cpanel_username?: string } | null;

      if (auth.role !== 'admin' && (!serviceRow || serviceRow.user_id !== auth.user.id)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You do not own the requested cPanel hosting account.' },
          { status: 403 }
        );
      }
    }

    const ssoService = service === 'webmaild' ? 'webmaild' : 'cpaneld';
    let ssoResult;
    if (serviceRow?.id && isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const target = await resolveServiceComputeTarget(
        db,
        String(serviceRow.id),
        String(serviceRow.user_id || auth.user.id)
      );
      const nodeWhmClient = resolveWhmClientForTarget(target);
      ssoResult = await nodeWhmClient.createSsoSession(target.cpanelUser || username.trim(), ssoService);
    } else {
      ssoResult = await whmClient.createSsoSession(username.trim(), ssoService);
    }

    if (!ssoResult.success || !ssoResult.url) {
      return NextResponse.json(
        {
          success: false,
          error: ssoResult.error || 'WHM SSO service is unavailable or not configured.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      url: ssoResult.url,
      service: ssoResult.service,
      expiresInSeconds: ssoResult.expiresInSeconds || 900,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: 'SSO Generation Failed',
        message: err instanceof Error ? err.message : 'Could not generate SSO session token.',
      },
      { status: 500 }
    );
  }
}
