import { convertBdtToUsd, CurrencyCode } from './constants';

export interface ExactDomainPricing {
  tld: string;
  category: 'Popular' | 'Organization' | 'Budget' | 'Developer' | 'Business' | 'Personal';
  registerBDT: number;
  renewalBDT: number;
  transferBDT: number;
  badge: string;
}

export const EXACT_10_TLD_DATA: ExactDomainPricing[] = [
  {
    tld: '.com',
    category: 'Popular',
    registerBDT: 1350,
    renewalBDT: 1450,
    transferBDT: 1350,
    badge: 'Most Popular',
  },
  {
    tld: '.net',
    category: 'Popular',
    registerBDT: 1650,
    renewalBDT: 1750,
    transferBDT: 1650,
    badge: 'Network Standard',
  },
  {
    tld: '.org',
    category: 'Organization',
    registerBDT: 1500,
    renewalBDT: 1600,
    transferBDT: 1500,
    badge: 'Trusted',
  },
  {
    tld: '.xyz',
    category: 'Budget',
    registerBDT: 290,
    renewalBDT: 1400,
    transferBDT: 1300,
    badge: 'Best Starter',
  },
  {
    tld: '.io',
    category: 'Developer',
    registerBDT: 4800,
    renewalBDT: 5200,
    transferBDT: 4800,
    badge: 'Startup Favorite',
  },
  {
    tld: '.ai',
    category: 'Developer',
    registerBDT: 9500,
    renewalBDT: 9800,
    transferBDT: 9500,
    badge: 'AI & SaaS',
  },
  {
    tld: '.shop',
    category: 'Business',
    registerBDT: 450,
    renewalBDT: 3200,
    transferBDT: 3000,
    badge: 'E-Commerce',
  },
  {
    tld: '.tech',
    category: 'Developer',
    registerBDT: 650,
    renewalBDT: 4200,
    transferBDT: 3900,
    badge: 'Tech Brand',
  },
  {
    tld: '.co',
    category: 'Business',
    registerBDT: 3100,
    renewalBDT: 3400,
    transferBDT: 3100,
    badge: 'Global Corp',
  },
  {
    tld: '.me',
    category: 'Personal',
    registerBDT: 1900,
    renewalBDT: 2200,
    transferBDT: 1900,
    badge: 'Portfolio',
  },
];

/**
 * Format domain pricing based on selected currency (BDT or USD)
 * In USD: value divided by 120 formatted to 2 decimals
 */
export function getFormattedDomainPrice(bdtAmount: number, currency: CurrencyCode = 'BDT') {
  if (currency === 'USD') {
    const usd = convertBdtToUsd(bdtAmount);
    return `$${usd.toFixed(2)}`;
  }
  return `৳${bdtAmount.toLocaleString()}`;
}
