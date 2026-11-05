/**
 * WHMCS & Pricing Configuration (Single Source of Truth)
 * 
 * Configures WHMCS billing portal URLs, products, pricing matrices,
 * currency conversions, domain TLD rates, and direct checkout link builders.
 */

export interface HostingPlan {
  id: string;
  pid: number;
  name: string;
  tagline: string;
  badge?: string;
  highlighted?: boolean;
  storage: string;
  ram: string;
  cpu: string;
  bandwidth: string;
  websites: string;
  inodes: string;
  entryProcesses: string;
  ioLimit: string;
  subdomains: string;
  emailAccounts: string;
  priceMonthlyBDT: number;
  priceMonthlyUSD: number;
  features: string[];
  specs: {
    storage: string;
    ram: string;
    cpu: string;
    gitDeploy: boolean;
    sshAccess: boolean;
    litespeedCache: boolean;
    jetBackup: boolean;
    sitejetAi: boolean;
    freeSsl: boolean;
    nodejsSupport: boolean;
    pythonSupport: boolean;
    laravelSupport: boolean;
  };
}

export interface TldPricing {
  tld: string;
  registerBDT: number;
  renewalBDT: number;
  transferBDT: number;
  registerUSD: number;
  renewalUSD: number;
  transferUSD: number;
  category: 'Popular' | 'Tech & Dev' | 'Business' | 'Budget';
  popular?: boolean;
  badge?: string;
}

export const WHMCS_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_WHMCS_URL || 'https://billing.yourdomain.com',
  companyName: 'DevHost Cloud',
  supportEmail: 'support@yourdomain.com',
  whatsappNumber: '+8801700000000',
  telegramUser: 'devhostcloud',
  currencies: {
    BDT: {
      id: 1,
      code: 'BDT',
      symbol: '৳',
      prefix: '৳',
      rateToUsd: 0.0083, // ~120 BDT per USD
    },
    USD: {
      id: 2,
      code: 'USD',
      symbol: '$',
      prefix: '$',
      rateToUsd: 1.0,
    },
  },
  yearlyDiscountPercent: 20,
};

export const HOSTING_PLANS: HostingPlan[] = [
  {
    id: 'starter',
    pid: 1,
    name: 'Starter Pack',
    tagline: 'Ideal for portfolios, small blogs & personal websites',
    storage: '2 GB NVMe SSD',
    ram: '1 GB RAM',
    cpu: '1 Core CPU',
    bandwidth: 'Unlimited Unmetered',
    websites: '1 Website',
    inodes: '150,000 Inodes',
    entryProcesses: '20 EP',
    ioLimit: '5 MB/s',
    subdomains: '5 Subdomains',
    emailAccounts: '5 Professional Inboxes',
    priceMonthlyBDT: 200,
    priceMonthlyUSD: 2.0,
    features: [
      '2 GB Ultra-Fast NVMe SSD',
      '1 GB RAM | 1 Core CloudLinux CPU',
      '1-Click WordPress (Softaculous)',
      'Sitejet AI Website Builder Included',
      'Free Automated Wildcard SSL',
      'cPanel File Manager & PHP 8.x Selector',
      'Unmetered Bandwidth',
      'Daily Server Snapshots',
    ],
    specs: {
      storage: '2 GB NVMe',
      ram: '1 GB RAM',
      cpu: '1 vCPU',
      gitDeploy: false,
      sshAccess: false,
      litespeedCache: true,
      jetBackup: false,
      sitejetAi: true,
      freeSsl: true,
      nodejsSupport: false,
      pythonSupport: false,
      laravelSupport: true,
    },
  },
  {
    id: 'developer-pro',
    pid: 2,
    name: 'Developer Pro',
    tagline: 'Engineered for full-stack developers, Next.js & Node.js apps',
    badge: 'Most Popular / Developer Choice',
    highlighted: true,
    storage: '5 GB NVMe SSD',
    ram: '2 GB RAM',
    cpu: '2 Core CPU',
    bandwidth: 'Unlimited Unmetered',
    websites: '3 Websites',
    inodes: '300,000 Inodes',
    entryProcesses: '40 EP',
    ioLimit: '10 MB/s',
    subdomains: 'Unlimited',
    emailAccounts: 'Unlimited Professional Inboxes',
    priceMonthlyBDT: 450,
    priceMonthlyUSD: 4.5,
    features: [
      '5 GB Ultra-Fast NVMe SSD',
      '2 GB RAM | 2 Core Isolated CPU',
      'GitHub Auto-Deployment (Webhook + Git)',
      'Node.js, Next.js, Python & Laravel Support',
      'Jailed SSH & Terminal Access',
      'Smart In-Place Overwrite Pipeline',
      'Free Auto-Renewing SSL',
      'Zero-Downtime Releases',
    ],
    specs: {
      storage: '5 GB NVMe',
      ram: '2 GB RAM',
      cpu: '2 vCPU',
      gitDeploy: true,
      sshAccess: true,
      litespeedCache: true,
      jetBackup: true,
      sitejetAi: true,
      freeSsl: true,
      nodejsSupport: true,
      pythonSupport: true,
      laravelSupport: true,
    },
  },
  {
    id: 'business-max',
    pid: 3,
    name: 'Business Max',
    tagline: 'High-throughput power for WooCommerce & high-traffic apps',
    storage: '10 GB NVMe SSD',
    ram: '4 GB RAM',
    cpu: '2 Core CPU',
    bandwidth: 'Unlimited Unmetered',
    websites: 'Unlimited Websites',
    inodes: '600,000 Inodes',
    entryProcesses: '60 EP',
    ioLimit: '20 MB/s',
    subdomains: 'Unlimited',
    emailAccounts: 'Unlimited Business Inboxes',
    priceMonthlyBDT: 900,
    priceMonthlyUSD: 9.0,
    features: [
      '10 GB Enterprise NVMe SSD',
      '4 GB RAM | 2 High-Frequency Cores',
      'High-Traffic E-commerce & WooCommerce Ready',
      'LiteSpeed Enterprise Web Server + LSCache',
      'Automated Daily External Cloud Backups (JetBackup)',
      'VIP Priority 24/7 Support Escalation',
      'Free SSL, Jailed SSH & Redis Object Cache',
      'Offsite Backup Storage (0 MB local quota loss)',
    ],
    specs: {
      storage: '10 GB NVMe',
      ram: '4 GB RAM',
      cpu: '2 vCPU',
      gitDeploy: true,
      sshAccess: true,
      litespeedCache: true,
      jetBackup: true,
      sitejetAi: true,
      freeSsl: true,
      nodejsSupport: true,
      pythonSupport: true,
      laravelSupport: true,
    },
  },
];

export const TLD_PRICING_LIST: TldPricing[] = [
  {
    tld: '.com',
    registerBDT: 1350,
    renewalBDT: 1550,
    transferBDT: 1350,
    registerUSD: 11.5,
    renewalUSD: 13.0,
    transferUSD: 11.5,
    category: 'Popular',
    popular: true,
    badge: 'Global Standard',
  },
  {
    tld: '.net',
    registerBDT: 1450,
    renewalBDT: 1650,
    transferBDT: 1450,
    registerUSD: 12.0,
    renewalUSD: 14.0,
    transferUSD: 12.0,
    category: 'Popular',
  },
  {
    tld: '.org',
    registerBDT: 1400,
    renewalBDT: 1600,
    transferBDT: 1400,
    registerUSD: 11.8,
    renewalUSD: 13.5,
    transferUSD: 11.8,
    category: 'Popular',
  },
  {
    tld: '.xyz',
    registerBDT: 350,
    renewalBDT: 1450,
    transferBDT: 1250,
    registerUSD: 2.9,
    renewalUSD: 12.0,
    transferUSD: 10.5,
    category: 'Budget',
    popular: true,
    badge: 'Super Low Cost',
  },
  {
    tld: '.tech',
    registerBDT: 650,
    renewalBDT: 2450,
    transferBDT: 2200,
    registerUSD: 5.5,
    renewalUSD: 20.0,
    transferUSD: 18.0,
    category: 'Tech & Dev',
    badge: 'For Developers',
  },
  {
    tld: '.io',
    registerBDT: 4200,
    renewalBDT: 4600,
    transferBDT: 4200,
    registerUSD: 35.0,
    renewalUSD: 38.0,
    transferUSD: 35.0,
    category: 'Tech & Dev',
    popular: true,
    badge: 'SaaS Favorite',
  },
  {
    tld: '.ai',
    registerBDT: 8500,
    renewalBDT: 8500,
    transferBDT: 8500,
    registerUSD: 70.0,
    renewalUSD: 70.0,
    transferUSD: 70.0,
    category: 'Tech & Dev',
    badge: 'Artificial Intelligence',
  },
  {
    tld: '.shop',
    registerBDT: 450,
    renewalBDT: 2600,
    transferBDT: 2400,
    registerUSD: 3.8,
    renewalUSD: 22.0,
    transferUSD: 20.0,
    category: 'Business',
    badge: 'Ecommerce',
  },
  {
    tld: '.co',
    registerBDT: 1550,
    renewalBDT: 3100,
    transferBDT: 2800,
    registerUSD: 13.0,
    renewalUSD: 26.0,
    transferUSD: 23.5,
    category: 'Business',
  },
  {
    tld: '.me',
    registerBDT: 950,
    renewalBDT: 2200,
    transferBDT: 1950,
    registerUSD: 8.0,
    renewalUSD: 18.5,
    transferUSD: 16.0,
    category: 'Popular',
    badge: 'Personal Portfolios',
  },
];

/**
 * Generate Direct WHMCS Cart URL
 * Follows the mandatory 3-Click rule to direct checkout
 */
export function getWhmcsCartUrl(
  pid: number,
  cycle: 'monthly' | 'annually' = 'monthly',
  currency: 'BDT' | 'USD' = 'BDT',
  domain?: string
): string {
  const currencyId = currency === 'BDT' ? 1 : 2;
  const billingCycle = cycle === 'annually' ? 'annually' : 'monthly';
  let url = `${WHMCS_CONFIG.baseUrl}/cart.php?a=add&pid=${pid}&billingcycle=${billingCycle}&currency=${currencyId}`;
  
  if (domain) {
    url += `&domain=register&query=${encodeURIComponent(domain)}`;
  }
  return url;
}

/**
 * Generate WHMCS Domain Registration URL
 */
export function getWhmcsDomainRegisterUrl(domain: string, currency: 'BDT' | 'USD' = 'BDT'): string {
  const currencyId = currency === 'BDT' ? 1 : 2;
  return `${WHMCS_CONFIG.baseUrl}/cart.php?a=add&domain=register&query=${encodeURIComponent(domain)}&currency=${currencyId}`;
}

/**
 * Generate WHMCS Domain Transfer URL
 */
export function getWhmcsDomainTransferUrl(domain: string): string {
  return `${WHMCS_CONFIG.baseUrl}/cart.php?a=add&domain=transfer&query=${encodeURIComponent(domain)}`;
}

/**
 * Common WHMCS Portal Links
 */
export function getWhmcsClientAreaUrl(): string {
  return `${WHMCS_CONFIG.baseUrl}/clientarea.php`;
}

export function getWhmcsSupportTicketUrl(): string {
  return `${WHMCS_CONFIG.baseUrl}/submitticket.php`;
}

export function getWhmcsMigrationUrl(platform?: string): string {
  const customField = platform ? `&deptid=2&subject=${encodeURIComponent(`Free Migration Request (${platform})`)}` : '';
  return `${WHMCS_CONFIG.baseUrl}/submitticket.php?step=2${customField}`;
}
