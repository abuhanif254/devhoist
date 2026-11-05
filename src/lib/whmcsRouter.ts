import { WHMCS_CONFIG, CurrencyCode } from '@/config/constants';

// Strict whitelist for product IDs to prevent parameter injection
const ALLOWED_PIDS = new Set([1, 2, 3]);

/**
 * Build direct WHMCS order URL for hosting plans
 * Follows the strict 3-Click Rule with whitelisted parameters
 */
export function buildHostingOrderUrl(
  pid: number,
  isAnnual: boolean = false,
  currency: CurrencyCode = 'BDT',
  promoCode?: string
): string {
  // Enforce PID whitelist
  const safePid = ALLOWED_PIDS.has(pid) ? pid : 2;
  const billingCycle = isAnnual ? 'annually' : 'monthly';
  const currencyId = currency === 'USD' ? WHMCS_CONFIG.CURRENCY_ID_USD : WHMCS_CONFIG.CURRENCY_ID_BDT;

  let url = `${WHMCS_CONFIG.WHMCS_URL}/cart.php?a=add&pid=${safePid}&billingcycle=${billingCycle}&currency=${currencyId}`;

  if (promoCode && typeof promoCode === 'string') {
    // Sanitize promo code to alphanumeric, hyphens and underscores
    const safePromo = promoCode.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    if (safePromo) {
      url += `&promocode=${encodeURIComponent(safePromo)}`;
    }
  }

  return url;
}

/**
 * Build direct WHMCS domain registration order URL with sanitization
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

  const currencyId = currency === 'USD' ? WHMCS_CONFIG.CURRENCY_ID_USD : WHMCS_CONFIG.CURRENCY_ID_BDT;
  return `${WHMCS_CONFIG.WHMCS_URL}/cart.php?a=add&domain=register&query=${encodeURIComponent(safeDomain)}&currency=${currencyId}`;
}

/**
 * Build WHMCS domain transfer order URL with sanitization
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

  const currencyId = currency === 'USD' ? WHMCS_CONFIG.CURRENCY_ID_USD : WHMCS_CONFIG.CURRENCY_ID_BDT;
  return `${WHMCS_CONFIG.WHMCS_URL}/cart.php?a=add&domain=transfer&query=${encodeURIComponent(safeDomain)}&currency=${currencyId}`;
}

/**
 * Direct Migration ticket URL with sanitized parameters
 */
export function buildMigrationTicketUrl(websiteUrl: string, hostName?: string): string {
  const safeWebsite = (websiteUrl || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .slice(0, 100);

  const safeHost = hostName ? hostName.replace(/[^a-zA-Z0-9\s.-]/g, '').slice(0, 50) : '';
  const subject = `Free Migration Request - ${safeWebsite}${safeHost ? ` (From: ${safeHost})` : ''}`;

  return `${WHMCS_CONFIG.WHMCS_URL}/submitticket.php?step=2&deptid=2&subject=${encodeURIComponent(subject)}`;
}

/**
 * Automated Provisioning Flow Steps
 */
export const PAYMENT_PROVISIONING_STEPS = [
  {
    step: 1,
    title: 'Instant Gateway Checkout',
    desc: 'Choose bKash / Nagad (Instant Automated Merchant Checkout) or Stripe (Visa / Mastercard).',
    time: '30 seconds',
  },
  {
    step: 2,
    title: 'Real-Time Webhook Verification',
    desc: 'Instant gateway callback marks WHMCS invoice as PAID in under 2 seconds.',
    time: '< 2 seconds',
  },
  {
    step: 3,
    title: 'Automated Account Provisioning',
    desc: 'WHM auto-provisions your cPanel, CloudLinux jail, NVMe storage & SSH keys, and emails credentials immediately.',
    time: 'Instant',
  },
];
