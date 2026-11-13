import { NextResponse } from 'next/server';
import { EXACT_10_TLD_DATA } from '@/config/domainData';
import { convertBdtToUsd, CurrencyCode } from '@/config/constants';
import { buildDomainOrderUrl } from '@/lib/whmcsRouter';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { checkDomainsAvailability, isBdManualTld } from '@/lib/registrarClient';

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
  const cleaned = rawQuery.toLowerCase().trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '')
    .slice(0, 120);

  let baseLabel = cleaned;
  let targetTld = '';
  const extraMultiLevelSuffixes = [
    '.com.bd',
    '.net.bd',
    '.org.bd',
    '.edu.bd',
    '.ac.bd',
    '.gov.bd',
    '.info.bd',
    '.co.uk',
    '.org.uk',
    '.com.au',
    '.bd',
  ];
  const knownTldsByLength = Array.from(
    new Set([...EXACT_10_TLD_DATA.map((item) => item.tld.toLowerCase()), ...extraMultiLevelSuffixes])
  ).sort((a, b) => b.length - a.length);
  const matchedSuffix = knownTldsByLength.find((tld) => cleaned.endsWith(tld) && cleaned.length > tld.length);
  if (matchedSuffix) {
    baseLabel = cleaned.slice(0, -matchedSuffix.length);
    targetTld = matchedSuffix;
  } else {
    const dotIndex = cleaned.lastIndexOf('.');
    if (dotIndex > 0) {
      baseLabel = cleaned.substring(0, dotIndex);
      targetTld = cleaned.substring(dotIndex);
    }
  }

  // Enforce domain label RFC constraints (1-63 chars, alphanumeric + hyphens, cannot start/end with hyphen)
  if (!baseLabel || baseLabel.length > 63 || !DOMAIN_LABEL_REGEX.test(baseLabel)) {
    return NextResponse.json(
      { error: 'Invalid domain name format. Labels must be 1-63 alphanumeric characters and cannot start or end with a hyphen.' },
      { status: 400 }
    );
  }

  // 3. Query wholesale Registrar availability first (excluding manual .bd registry TLDs)
  const tldsToEvaluate =
    targetTld && !EXACT_10_TLD_DATA.some((t) => t.tld.toLowerCase() === targetTld)
      ? [
          {
            tld: targetTld,
            category: 'Business' as const,
            registerBDT: isBdManualTld(`${baseLabel}${targetTld}`) ? 1500 : 1850,
            renewalBDT: isBdManualTld(`${baseLabel}${targetTld}`) ? 1500 : 1950,
            transferBDT: 1500,
            badge: isBdManualTld(`${baseLabel}${targetTld}`) ? 'BTCL Registry' : 'Direct Match',
          },
          ...EXACT_10_TLD_DATA,
        ]
      : EXACT_10_TLD_DATA;

  const candidateDomains = tldsToEvaluate.map((tldInfo) => `${baseLabel}${tldInfo.tld}`);
  const wholesaleCandidates = candidateDomains.filter((d) => !isBdManualTld(d));
  const registrarLookup = await checkDomainsAvailability(wholesaleCandidates);

  // 4. Verify each TLD via Registrar result or DNS-over-HTTPS (never fake availability on error)
  const checks = await Promise.all(
    tldsToEvaluate.map(async (tldInfo) => {
      const fullDomain = `${baseLabel}${tldInfo.tld}`;
      const manualBd = isBdManualTld(fullDomain);
      let isAvailable = false;
      let isPremium = false;
      let premiumPriceUSD: number | undefined;
      let source: string = 'doh';
      let verificationStatus: 'verified' | 'unverified' | 'manual_registry' = manualBd
        ? 'manual_registry'
        : 'verified';

      // Check reserved names first
      if (RESERVED_NAMES.has(baseLabel) || (baseLabel.length <= 2 && tldInfo.tld === '.com')) {
        isAvailable = false;
        source = 'reserved';
      } else if (!manualBd && registrarLookup?.results?.[fullDomain]) {
        const regResult = registrarLookup.results[fullDomain];
        isAvailable = regResult.available;
        isPremium = Boolean(regResult.isPremium);
        premiumPriceUSD = regResult.premiumPriceUSD;
        source = regResult.source;
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
            isAvailable = false;
            verificationStatus = 'unverified';
            source = 'doh_error';
          }
        } catch {
          isAvailable = false;
          verificationStatus = 'unverified';
          source = 'doh_error';
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
        isPremium,
        premiumPriceUSD,
        manualProvisioning: manualBd,
        manualNote: manualBd ? 'BTCL Manual Provisioning' : undefined,
        verificationStatus,
        source,
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
      registrarConfigured: Boolean(registrarLookup?.configured),
      registrarProvider: registrarLookup?.provider || null,
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
