/**
 * Exact 14-Point Feature Comparison Matrix & Hosting Plan Data
 * Single source of truth for all hosting plans and comparison tables.
 */

export interface HostingPlanData {
  id: string;
  pid: number;
  name: string;
  tagline: string;
  badge?: string;
  highlighted?: boolean;
  baseMonthlyBDT: number;
  yearlyEffectiveBDT: number;
  annualTotalBilledBDT: number;
  nvmeStorage: string;
  ram: string;
  cpu: string;
  ioLimit: string;
  entryProcesses: number;
  inodes: string;
  websites: string;
  subdomainsAndDb: string;
  nodejsPythonSupport: string;
  gitAutoDeploy: string;
  jailedSsh: string;
  externalBackups: string;
  features: string[];
}

export const HOSTING_PACKAGES: HostingPlanData[] = [
  {
    id: 'starter',
    pid: 1,
    name: 'Starter Pack',
    tagline: 'Ideal for small blogs, portfolios & personal websites',
    baseMonthlyBDT: 200,
    yearlyEffectiveBDT: 160,
    annualTotalBilledBDT: 1920,
    nvmeStorage: '2 GB Pure NVMe',
    ram: '1 GB DDR4/DDR5',
    cpu: '1 Core',
    ioLimit: '25 MB/s',
    entryProcesses: 20,
    inodes: '150,000 Inodes',
    websites: '1 Website',
    subdomainsAndDb: '10 Each',
    nodejsPythonSupport: 'Not Included',
    gitAutoDeploy: 'Not Included',
    jailedSsh: 'Not Included',
    externalBackups: 'Weekly Backup',
    features: [
      '2 GB Pure NVMe SSD',
      '1 GB Dedicated CloudLinux RAM',
      '1 Core CPU | 25 MB/s Disk I/O',
      '1-Click WordPress (Softaculous)',
      'Free Automated Wildcard SSL',
      'Sitejet AI Website Builder Included',
      'cPanel File Manager & PHP Selector',
      'Weekly Automated Backups',
    ],
  },
  {
    id: 'developer-pro',
    pid: 2,
    name: 'Developer Pro',
    tagline: 'Engineered for full-stack developers, Next.js & Node.js apps',
    badge: 'Most Popular / Developer Choice',
    highlighted: true,
    baseMonthlyBDT: 450,
    yearlyEffectiveBDT: 360,
    annualTotalBilledBDT: 4320,
    nvmeStorage: '5 GB Pure NVMe',
    ram: '2 GB DDR4/DDR5',
    cpu: '2 Cores',
    ioLimit: '50 MB/s',
    entryProcesses: 40,
    inodes: '300,000 Inodes',
    websites: '5 Websites',
    subdomainsAndDb: 'Unlimited',
    nodejsPythonSupport: 'Included (Up to v22)',
    gitAutoDeploy: 'Included (1-Click)',
    jailedSsh: 'Included',
    externalBackups: 'Every 3 Days',
    features: [
      '5 GB Pure NVMe SSD',
      '2 GB Dedicated CloudLinux RAM',
      '2 Cores CPU | 50 MB/s Disk I/O',
      'Node.js (v18-v22), Next.js & Python',
      '1-Click GitHub Webhook Auto-Deploy',
      'Jailed SSH & WP-CLI Access',
      'Smart In-Place Overwrite Pipeline',
      'Backups Shipped Every 3 Days',
    ],
  },
  {
    id: 'business-max',
    pid: 3,
    name: 'Business Max',
    tagline: 'High-throughput power for WooCommerce & high-traffic apps',
    baseMonthlyBDT: 900,
    yearlyEffectiveBDT: 720,
    annualTotalBilledBDT: 8640,
    nvmeStorage: '10 GB Pure NVMe',
    ram: '4 GB DDR4/DDR5',
    cpu: '2 Cores (High Frequency)',
    ioLimit: '100 MB/s',
    entryProcesses: 80,
    inodes: '600,000 Inodes',
    websites: 'Unlimited Websites',
    subdomainsAndDb: 'Unlimited',
    nodejsPythonSupport: 'Included (High Memory)',
    gitAutoDeploy: 'Included (1-Click)',
    jailedSsh: 'Included',
    externalBackups: 'Daily Offsite Backup',
    features: [
      '10 GB Pure NVMe SSD',
      '4 GB Dedicated CloudLinux RAM',
      '2 Cores (High Frequency) | 100 MB/s I/O',
      'High-Traffic WooCommerce & E-Commerce',
      'LiteSpeed Enterprise Web Server + LSCache',
      'Redis Object Cache & Jailed SSH',
      'Automated Daily Offsite Cloud Backups',
      'VIP Priority 24/7 Support Escalation',
    ],
  },
];

export interface ComparisonRowData {
  feature: string;
  starter: string;
  developer: string;
  business: string;
  category: 'Pricing' | 'Hardware & Compute' | 'Limits & Storage' | 'Developer & Runtime' | 'Reliability';
}

export const EXACT_14_POINT_MATRIX: ComparisonRowData[] = [
  {
    feature: 'Monthly Base Price (BDT)',
    category: 'Pricing',
    starter: '৳200 /mo',
    developer: '৳450 /mo',
    business: '৳900 /mo',
  },
  {
    feature: 'Yearly Effective Price (20% Off)',
    category: 'Pricing',
    starter: '৳160 /mo (৳1,920/yr)',
    developer: '৳360 /mo (৳4,320/yr)',
    business: '৳720 /mo (৳8,640/yr)',
  },
  {
    feature: 'NVMe SSD Storage',
    category: 'Hardware & Compute',
    starter: '2 GB Pure NVMe',
    developer: '5 GB Pure NVMe',
    business: '10 GB Pure NVMe',
  },
  {
    feature: 'Dedicated CloudLinux RAM',
    category: 'Hardware & Compute',
    starter: '1 GB DDR4/DDR5',
    developer: '2 GB DDR4/DDR5',
    business: '4 GB DDR4/DDR5',
  },
  {
    feature: 'CPU Cores',
    category: 'Hardware & Compute',
    starter: '1 Core',
    developer: '2 Cores',
    business: '2 Cores (High Frequency)',
  },
  {
    feature: 'Disk I/O Speed Limit',
    category: 'Hardware & Compute',
    starter: '25 MB/s',
    developer: '50 MB/s',
    business: '100 MB/s',
  },
  {
    feature: 'Concurrent Entry Processes (EP)',
    category: 'Limits & Storage',
    starter: '20',
    developer: '40',
    business: '80',
  },
  {
    feature: 'Inode Limit (File Count Quota)',
    category: 'Limits & Storage',
    starter: '150,000 Inodes',
    developer: '300,000 Inodes',
    business: '600,000 Inodes',
  },
  {
    feature: 'Hosted Websites / Addon Domains',
    category: 'Limits & Storage',
    starter: '1 Website',
    developer: '5 Websites',
    business: 'Unlimited Websites',
  },
  {
    feature: 'Subdomains & MySQL Databases',
    category: 'Limits & Storage',
    starter: '10 Each',
    developer: 'Unlimited',
    business: 'Unlimited',
  },
  {
    feature: 'Node.js, Next.js & Python Support',
    category: 'Developer & Runtime',
    starter: 'Not Included',
    developer: 'Included (Up to v22)',
    business: 'Included (High Memory)',
  },
  {
    feature: 'Git Auto-Deploy & Webhook',
    category: 'Developer & Runtime',
    starter: 'Not Included',
    developer: 'Included (1-Click)',
    business: 'Included (1-Click)',
  },
  {
    feature: 'Jailed SSH & WP-CLI Access',
    category: 'Developer & Runtime',
    starter: 'Not Included',
    developer: 'Included',
    business: 'Included',
  },
  {
    feature: 'Automated External Cloud Backups',
    category: 'Reliability',
    starter: 'Weekly Backup',
    developer: 'Every 3 Days',
    business: 'Daily Offsite Backup',
  },
];
