import { NextResponse } from 'next/server';
import { EXACT_10_TLD_DATA } from '@/config/domainData';
import { convertBdtToUsd, CurrencyCode } from '@/config/constants';
import { buildDomainOrderUrl } from '@/lib/whmcsRouter';
import { checkRateLimit } from '@/lib/edgeRateLimit';

// Common reserved/high-profile domains for local cache safeguard
const RESERVED_NAMES = new Set([
  'google', 'facebook', 'amazon', 'apple', 'microsoft', 'netflix', 'github',
  'twitter', 'x', 'vercel', 'hostinger', 'cloudflare', 'cpanel', 'wordpress',
  'devhost', 'bkash', 'nagad', 'daraz', 'chaldal', 'pathao',
]);

const DOMAIN_LABEL_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export async function GET(request: Request) {
  // 1. Edge sliding window rate limit (30 requests/minute)
  const rateLimit = checkRateLimit(request, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded (max 30 requests/min). Please try again shortly.',
      },
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
  const rawQuery = searchParams.get('domain') || searchParams.get('query') || '';
  const currency = (searchParams.get('currency')?.toUpperCase() === 'USD' ? 'USD' : 'BDT') as CurrencyCode;

  if (!rawQuery.trim()) {
    return NextResponse.json({ error: 'Domain query parameter is required' }, { status: 400 });
  }

  // 2. Strict sanitization and validation
  let cleaned = rawQuery.toLowerCase().trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '')
    .slice(0, 120);

  let baseLabel = cleaned;
  let targetTld = '';
  const dotIndex = cleaned.lastIndexOf('.');
  if (dotIndex > 0) {
    baseLabel = cleaned.substring(0, dotIndex);
    targetTld = cleaned.substring(dotIndex);
  }

  // Enforce domain label RFC constraints (1-63 chars, alphanumeric + hyphens, cannot start/end with hyphen)
  if (!baseLabel || baseLabel.length > 63 || !DOMAIN_LABEL_REGEX.test(baseLabel)) {
    return NextResponse.json(
      { error: 'Invalid domain name format. Labels must be 1-63 alphanumeric characters and cannot start or end with a hyphen.' },
      { status: 400 }
    );
  }

  // 3. DNS-over-HTTPS (DoH) verification across all 10 TLDs in parallel
  const checks = await Promise.all(
    EXACT_10_TLD_DATA.map(async (tldInfo) => {
      const fullDomain = `${baseLabel}${tldInfo.tld}`;
      let isAvailable = false;

      // Check reserved names first
      if (RESERVED_NAMES.has(baseLabel) || (baseLabel.length <= 2 && tldInfo.tld === '.com')) {
        isAvailable = false;
      } else {
        try {
          const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fullDomain)}&type=NS`;
          const dohRes = await fetch(dohUrl, {
            headers: { Accept: 'application/dns-json' },
            next: { revalidate: 60 },
          });

          if (dohRes.ok) {
            const dohData = await dohRes.json();
            // Status === 3 (NXDOMAIN) -> domain is unregistered & available
            // Status === 0 with Answer -> domain exists & registered
            if (dohData.Status === 3) {
              isAvailable = true;
            } else if (dohData.Status === 0 && dohData.Answer && dohData.Answer.length > 0) {
              isAvailable = false;
            } else if (!dohData.Answer || dohData.Answer.length === 0) {
              isAvailable = true;
            }
          } else {
            isAvailable = baseLabel.length > 4;
          }
        } catch {
          isAvailable = baseLabel.length > 4;
        }
      }

      const registerPriceBDT = tldInfo.registerBDT;
      const renewalPriceBDT = tldInfo.renewalBDT;
      const transferPriceBDT = tldInfo.transferBDT;

      return {
        domain: fullDomain,
        baseLabel,
        tld: tldInfo.tld,
        category: tldInfo.category,
        badge: tldInfo.badge,
        available: isAvailable,
        isPrimaryMatch: targetTld === tldInfo.tld || (!targetTld && tldInfo.tld === '.com'),
        pricing: {
          registerBDT: registerPriceBDT,
          renewalBDT: renewalPriceBDT,
          transferBDT: transferPriceBDT,
          registerUSD: convertBdtToUsd(registerPriceBDT),
          renewalUSD: convertBdtToUsd(renewalPriceBDT),
          transferUSD: convertBdtToUsd(transferPriceBDT),
        },
        cartUrl: buildDomainOrderUrl(fullDomain, currency),
      };
    })
  );

  return NextResponse.json(
    {
      query: cleaned,
      baseLabel,
      currency,
      results: checks,
      directWhmcsUrl: buildDomainOrderUrl(baseLabel, currency),
    },
    {
      headers: {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    }
  );
}
