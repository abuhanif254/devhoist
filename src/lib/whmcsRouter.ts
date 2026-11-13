import { CurrencyCode } from '@/config/constants';

// Strict whitelist for product IDs to prevent parameter injection
const ALLOWED_PIDS = new Set([1, 2, 3]);

/**
 * Build native internal checkout URL for hosting plans
 */
export function buildHostingOrderUrl(
  pid: number,
  isAnnual: boolean = false,
  currency: CurrencyCode = 'BDT',
  promoCode?: string
): string {
  const safePid = ALLOWED_PIDS.has(pid) ? pid : 2;
  const billingCycle = isAnnual ? 'annually' : 'monthly';
  let url = `/pricing?pid=${safePid}&billing=${billingCycle}&currency=${currency}`;

  if (promoCode && typeof promoCode === 'string') {
    const safePromo = promoCode.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    if (safePromo) {
      url += `&promo=${encodeURIComponent(safePromo)}`;
    }
  }

  return url;
}

/**
 * Build native internal domain registration URL with sanitization
 */
export function buildDomainOrderUrl(
  domain: string,
  currency: CurrencyCode = 'BDT'
): string {
  const safeDomain = (domain || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .slice(0, 120);

  return `/domains?q=${encodeURIComponent(safeDomain)}&mode=register&currency=${currency}`;
}

/**
 * Build native internal domain transfer URL with sanitization
 */
export function buildDomainTransferUrl(
  domain: string,
  currency: CurrencyCode = 'BDT'
): string {
  const safeDomain = (domain || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .slice(0, 120);

  return `/dashboard?tab=domains&transfer=${encodeURIComponent(safeDomain)}&currency=${currency}`;
}

/**
 * Direct Migration support desk route with sanitized parameters
 */
export function buildMigrationTicketUrl(websiteUrl: string, hostName?: string): string {
  const safeWebsite = (websiteUrl || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .slice(0, 100);

  const safeHost = hostName ? hostName.replace(/[^a-zA-Z0-9\s.-]/g, '').slice(0, 50) : '';
  const subject = `Free Migration Request - ${safeWebsite}${safeHost ? ` (From: ${safeHost})` : ''}`;

  return `/dashboard?tab=support&subject=${encodeURIComponent(subject)}`;
}

/**
 * Automated Provisioning Flow Steps
 */
export const PAYMENT_PROVISIONING_STEPS = [
  {
    step: 1,
    title: 'Instant Gateway Checkout',
    desc: 'Choose Wallet, bKash / Nagad (Automated Merchant Checkout), or Stripe (Visa / Mastercard).',
    time: '30 seconds',
  },
  {
    step: 2,
    title: 'Real-Time Webhook Verification',
    desc: 'Signed payment verification settles your invoice as PAID in under 2 seconds.',
    time: '< 2 seconds',
  },
  {
    step: 3,
    title: 'Automated Account Provisioning',
    desc: 'DevHost auto-provisions your cPanel, CloudLinux jail, NVMe storage & Cloudflare DNS/SSL immediately.',
    time: 'Instant',
  },
];
