import { NextResponse } from 'next/server';
import { whmClient } from '@/lib/whmClient';
import { checkRateLimit } from '@/lib/edgeRateLimit';

export async function POST(request: Request) {
  // Edge sliding-window rate limit (20 SSO attempts per min)
  const rateLimit = checkRateLimit(request, 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { username, service = 'cpaneld' } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'cPanel username is required' },
        { status: 400 }
      );
    }

    const ssoService = service === 'webmaild' ? 'webmaild' : 'cpaneld';
    const ssoResult = await whmClient.createSsoSession(username, ssoService);

    return NextResponse.json({
      success: true,
      url: ssoResult.url,
      service: ssoResult.service,
      expiresInSeconds: ssoResult.expiresInSeconds || 900,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'SSO Generation Failed',
        message: err?.message || 'Could not generate SSO session token.',
      },
      { status: 500 }
    );
  }
}
