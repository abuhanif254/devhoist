import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/edgeRateLimit';

export async function GET(request: Request) {
  // Edge sliding window rate limit (30 requests/minute)
  const rateLimit = checkRateLimit(request, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.reset),
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawRegion = searchParams.get('region') || searchParams.get('node');
  const region = rawRegion === 'us' ? 'us' : 'sg';

  const datacenterName =
    region === 'sg'
      ? 'Singapore (Equinix SG1 Tier-IV)'
      : 'USA East (Ashburn VA Tier-IV)';

  return new NextResponse(
    JSON.stringify({
      ok: true,
      region,
      serverTime: Date.now(),
      datacenter: datacenterName,
      status: 'operational',
      asn: region === 'sg' ? 'AS13335 (Singapore Internet Exchange)' : 'AS13335 (Equinix Ashburn)',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'CDN-Cache-Control': 'no-store',
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    }
  );
}
