// ==============================================================================
// DEVHOST CLOUD - CANONICAL SITE URL HELPER
// Single source of truth for canonical links across affiliate URLs,
// lifecycle emails, onboarding invites, and worker self-references.
// ==============================================================================

export const CANONICAL_SITE_URL_FALLBACK = 'https://devhostcloud.com';

export function getCanonicalSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    CANONICAL_SITE_URL_FALLBACK;

  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return CANONICAL_SITE_URL_FALLBACK;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildPortalUrl(path: string = '/'): string {
  const base = getCanonicalSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function buildDashboardUrl(tab?: string): string {
  const base = getCanonicalSiteUrl();
  if (!tab) return `${base}/dashboard`;
  return `${base}/dashboard?tab=${encodeURIComponent(tab)}`;
}

export function buildAffiliateReferralUrl(
  referralCode: string,
  landingPath: string = '/',
  subId?: string
): string {
  const base = getCanonicalSiteUrl();
  const cleanPath = landingPath.startsWith('/') ? landingPath : `/${landingPath}`;
  const cleanCode = encodeURIComponent(String(referralCode || '').trim());
  const params = new URLSearchParams();
  if (cleanCode) params.set('ref', String(referralCode || '').trim());
  const trimmedSub = String(subId || '').trim();
  if (trimmedSub) params.set('subid', trimmedSub);
  const query = params.toString();
  return `${base}${cleanPath}${query ? `?${query}` : ''}`;
}
