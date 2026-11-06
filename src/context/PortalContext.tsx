'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { HOSTING_PACKAGES } from '@/config/hostingData';
import { TLD_PRICING_LIST } from '@/config/whmcs';

export type UserRole = 'client' | 'admin';

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------

export interface ServiceEnvVar {
  key: string;
  value: string;
}

export interface ServiceRelease {
  id: string;
  commit: string;
  message: string;
  timestamp: string;
  status: 'Active' | 'Success' | 'Failed';
}

export interface CloudService {
  id: string;
  domain: string;
  planName: string;
  status: 'Active' | 'Suspended' | 'Pending';
  datacenter: string;
  ipAddress: string;
  cpanelUser: string;
  diskUsedGB: number;
  diskLimitGB: number;
  inodesUsed: number;
  inodeLimit: number;
  ramUsedMB: number;
  ramLimitMB: number;
  cpuCores: number;
  ioLimitMB: number;
  nodeVersion: string;
  gitRepoUrl: string;
  gitBranch: string;
  webhookUrl: string;
  autoRenew: boolean;
  nextDueDate: string;
  monthlyPriceBDT: number;
  envVars: ServiceEnvVar[];
  releases: ServiceRelease[];
  sshPublicKey?: string;
}

export interface DatabaseItem {
  id: string;
  serviceId: string;
  dbName: string;
  dbUser: string;
  dbHost: string;
  sizeMB: number;
  collation: string;
}

export interface SubdomainItem {
  id: string;
  serviceId: string;
  subdomain: string;
  documentRoot: string;
  sslActive: boolean;
  forceHttps: boolean;
  isStaging: boolean;
}

export interface BackupSnapshot {
  id: string;
  serviceId: string;
  date: string;
  type: 'Full cPanel' | 'Incremental' | 'MySQL Only';
  sizeMB: number;
  destination: string;
  location: string;
}

export interface CronJobItem {
  id: string;
  serviceId: string;
  schedule: string;
  command: string;
  description: string;
  status: 'Active' | 'Paused';
}

export interface ServerLogItem {
  id: string;
  serviceId: string;
  timestamp: string;
  statusCode: number;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  ip: string;
  responseTimeMs: number;
  type: 'access' | 'error' | 'stderr';
  message?: string;
}

export interface DnsRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA';
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  comment?: string;
  isSystemManaged?: boolean;
}

export interface ChildNameserver {
  id: string;
  domainId: string;
  hostname: string;
  ipAddress: string;
}

export interface DomainRedirect {
  id: string;
  domainId: string;
  sourcePath: string;
  targetUrl: string;
  type: '301' | '302';
}

export interface DomainItem {
  id: string;
  domain: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'Active' | 'Expiring Soon' | 'Grace Period';
  registrarLock: boolean;
  whoisPrivacy: boolean;
  autoRenew: boolean;
  nameservers: string[];
  eppCode: string;
  dnsRecords: DnsRecord[];
}

export interface DomainTransferRequest {
  id: string;
  domain: string;
  eppCode: string;
  currentStep: 1 | 2 | 3; // 1: EPP Verified, 2: Registry Approval Pending, 3: Completed
  status: 'Processing' | 'Completed';
  requestDate: string;
}

export interface InvoiceItem {
  desc: string;
  amount: number;
}

export interface Invoice {
  id: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  paymentMethod: string;
  trxID: string;
  plan: string;
  items: InvoiceItem[];
}

export interface WalletTransaction {
  id: string;
  date: string;
  type: 'Top-Up' | 'Debit' | 'Refund' | 'Bonus';
  amount: number;
  method: string;
  balanceAfter: number;
}

export interface TicketMessage {
  id: string;
  sender: 'client' | 'support';
  senderName: string;
  timestamp: string;
  message: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  department: string;
  priority: 'Normal' | 'High' | 'Critical — Production Site Down';
  status: 'Open' | 'Answered' | 'Resolved';
  relatedService: string;
  lastUpdated: string;
  messages: TicketMessage[];
}

export interface AffiliatePayout {
  id: string;
  date: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: 'Completed' | 'Pending';
  trxId: string;
}

export interface AffiliateCommissionItem {
  id: string;
  date: string;
  invoiceId: string;
  customerMasked: string;
  domain: string;
  orderAmountBDT: number;
  commissionBDT: number;
  ratePercent: number;
  subId: string;
  status: 'pending_35d_hold' | 'cleared_available' | 'clawed_back_refunded' | 'flagged_self_referral';
  daysLeftToMature: number;
  clearanceDate: string;
}

export interface CampaignSubIdStat {
  subId: string;
  channelName: string;
  clicks: number;
  signups: number;
  conversionRate: number;
  totalEarningsBDT: number;
}

export interface FraudAlertItem {
  id: string;
  type: 'self_referral_attempt' | 'duplicate_trxid' | 'brute_force_ip' | 'disposable_email' | 'velocity_abuse';
  severity: 'warning' | 'critical';
  title: string;
  target: string;
  details: string;
  status: 'open' | 'blocked' | 'dismissed' | 'whitelisted';
  timestamp: string;
  ipAddress: string;
}

export interface SecurityAuditItem {
  id: string;
  actor: string;
  role: 'client' | 'admin' | 'system';
  action: string;
  target: string;
  ip: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Developer: Git & cPanel Only' | 'Billing Manager: Invoices Only' | 'Full Admin';
  addedDate: string;
  status: 'Active' | 'Invited';
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  permissions: string;
}

export interface LoginSession {
  id: string;
  device: string;
  location: string;
  ip: string;
  current: boolean;
  time: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  servicesCount: number;
  totalSpendBDT: number;
  walletBalanceBDT: number;
  status: 'Active' | 'Suspended' | 'High Resource';
  joinedDate: string;
  primaryServiceId?: string;
}

export interface ServerNode {
  id: string;
  name: string;
  hostname: string;
  location: string;
  totalDiskGB: number;
  allocatedDiskGB: number;
  actualUsedDiskGB: number;
  totalSlots: number;
  usedSlots: number;
  ramTotalGB: number;
  ramUsedGB: number;
  lveLoad: number;
  status: 'Operational' | 'Warning' | 'Maintenance';
}

export interface LedgerOrder {
  id: string;
  invoiceId: string;
  customerName: string;
  gateway: 'bKash' | 'Nagad' | 'Stripe' | 'Wallet';
  trxID: string;
  amountBDT: number;
  provisionStatus: 'Auto-Provisioned' | 'Pending Approval' | 'Refunded';
  timestamp: string;
}

export interface MigrationRequest {
  id: string;
  domain: string;
  customerName: string;
  sourceHost: string;
  backupSizeMB: number;
  currentStep: 1 | 2 | 3 | 4; // 1: Queued, 2: Pulling, 3: Restoring, 4: Completed
  notes: string;
  targetNode: string;
  createdAt: string;
}

export interface PromoCode {
  code: string;
  discountPercent: number;
  usesCount: number;
  maxUses: number;
  expiryDate: string;
  status: 'Active' | 'Expired';
}

export interface DynamicHostingPlan {
  id: string;
  slug?: string;
  pid: number;
  name: string;
  nameBn?: string;
  type: 'shared' | 'developer' | 'vps' | 'enterprise';
  tagline: string;
  priceMonthlyBDT: number;
  unitServerCostBDT: number;
  minOwnerProfitBDT: number;
  maxAffiliatePoolBDT: number;
  storageGB: number;
  ramGB: number;
  cpuCores: number;
  inodes: number;
  features?: string[];
  isPopular?: boolean;
}

export interface DynamicTldPricing {
  tld: string;
  category?: string;
  registerBDT: number;
  renewalBDT: number;
  transferBDT: number;
  registrarCostBDT: number;
  ownerNetProfitRegBDT: number;
  affiliateEligible?: boolean;
  featuredBadge?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'billing' | 'git' | 'domain' | 'support' | 'system';
  read: boolean;
}

export interface SystemBroadcast {
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'urgent';
  dismissible: boolean;
}

export interface DunningRules {
  invoiceDaysBefore: number;
  autoSuspendDaysAfter: number;
  autoTerminateDaysAfter: number;
}

// ---------------------------------------------------------------------------
// PORTAL CONTEXT INTERFACE
// ---------------------------------------------------------------------------

interface PortalContextType {
  currentUser: {
    name: string;
    email: string;
    avatar: string;
    company: string;
  };
  activeRole: UserRole;
  switchRole: (role: UserRole) => void;
  impersonateCustomer: (customerId: string) => void;

  // Real-time Notifications Popover
  notifications: SystemNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Global Announcement Banner
  systemBroadcast: SystemBroadcast;
  updateSystemBroadcast: (updates: Partial<SystemBroadcast>) => void;
  dismissBroadcast: () => void;

  // Client Services & Git
  services: CloudService[];
  activeService: CloudService;
  setActiveServiceId: (id: string) => void;
  cleanServiceCache: (serviceId: string) => Promise<boolean>;
  restartPassengerWorkers: (serviceId: string) => Promise<boolean>;
  flushLiteSpeedCache: (serviceId: string) => Promise<boolean>;
  resetCpanelPassword: (serviceId: string, newPassword: string) => Promise<boolean>;
  triggerManualDeploy: (serviceId: string) => Promise<string[]>;
  rollbackRelease: (serviceId: string, releaseId: string) => void;
  updateServiceRuntime: (serviceId: string, runtime: string) => void;
  addEnvVariable: (serviceId: string, key: string, value: string) => void;
  deleteEnvVariable: (serviceId: string, key: string) => void;
  upgradeServicePlan: (serviceId: string, newPlanName: string, newPrice: number) => void;
  updateServiceSshKey: (serviceId: string, key: string) => void;

  // Databases & Users Manager
  databases: DatabaseItem[];
  createDatabase: (serviceId: string, dbName: string, dbUser: string, dbPass: string) => Promise<boolean>;
  deleteDatabase: (dbId: string) => void;

  // Subdomains, Staging & AutoSSL
  subdomains: SubdomainItem[];
  createSubdomain: (serviceId: string, subdomain: string, documentRoot: string) => Promise<boolean>;
  deleteSubdomain: (subdomainId: string) => void;
  cloneToStaging: (serviceId: string) => Promise<boolean>;
  pushStagingToLive: (serviceId: string) => Promise<boolean>;
  toggleSubdomainForceHttps: (subdomainId: string) => void;
  renewAutoSsl: (subdomainId: string) => Promise<boolean>;

  // JetBackup Snapshots
  backups: BackupSnapshot[];
  restoreBackup: (backupId: string, restoreType: 'files' | 'db' | 'full') => Promise<boolean>;
  generateManualSnapshot: (serviceId: string) => Promise<boolean>;

  // Cron Jobs & Logs
  cronJobs: CronJobItem[];
  createCronJob: (serviceId: string, schedule: string, command: string, description: string) => void;
  deleteCronJob: (jobId: string) => void;
  toggleCronJobStatus: (jobId: string) => void;
  serverLogs: ServerLogItem[];
  clearServerLogs: (serviceId: string) => void;

  // Domains & DNS
  domains: DomainItem[];
  toggleDomainLock: (domainId: string) => void;
  toggleDomainWhoisPrivacy: (domainId: string) => void;
  toggleDomainAutoRenew: (domainId: string) => void;
  bulkToggleAutoRenew: (domainIds: string[], enable: boolean) => void;
  bulkUpdateNameservers: (domainIds: string[], nameservers: string[]) => void;
  updateDomainNameservers: (domainId: string, nameservers: string[]) => void;
  addDnsRecord: (domainId: string, record: Omit<DnsRecord, 'id'>) => void;
  deleteDnsRecord: (domainId: string, recordId: string) => void;
  applyDnsPreset: (domainId: string, preset: 'google' | 'zoho' | 'github_vercel') => void;

  // Child Nameservers & Redirects
  childNameservers: ChildNameserver[];
  createChildNameserver: (domainId: string, hostname: string, ipAddress: string) => void;
  deleteChildNameserver: (id: string) => void;
  domainRedirects: DomainRedirect[];
  createDomainRedirect: (domainId: string, sourcePath: string, targetUrl: string, type: '301' | '302') => void;
  deleteDomainRedirect: (id: string) => void;

  // Domain Transfer-In
  domainTransfers: DomainTransferRequest[];
  initiateDomainTransfer: (domain: string, eppCode: string) => Promise<boolean>;

  // Billing & Wallet
  walletBalanceBDT: number;
  walletTransactions: WalletTransaction[];
  invoices: Invoice[];
  topUpWallet: (amount: number, method: string, trxId?: string) => void;
  payInvoice: (invoiceId: string) => boolean;

  // Support
  tickets: SupportTicket[];
  createSupportTicket: (ticket: {
    subject: string;
    department: string;
    priority: 'Normal' | 'High' | 'Critical — Production Site Down';
    relatedService: string;
    message: string;
  }) => void;
  replyToTicket: (ticketId: string, message: string, sender?: 'client' | 'support') => void;
  resolveTicket: (ticketId: string) => void;

  // Affiliate
  affiliate: {
    refLink: string;
    referralCode: string;
    clicks: number;
    signups: number;
    activeConversions: number;
    commissionTier: string;
    commissionRate: number;
    tierLevel: 'starter_20' | 'pro_25' | 'agency_30';
    pendingClearanceBDT: number;
    availableBalanceBDT: number;
    totalEarnedBDT: number;
    payouts: AffiliatePayout[];
    commissions: AffiliateCommissionItem[];
    subIdStats: CampaignSubIdStat[];
  };
  requestAffiliatePayout: (amount: number, method: string, accountNumber: string) => boolean;
  approveAffiliatePayout: (payoutId: string) => void;
  clawbackCommission: (commissionId: string) => void;

  // Security, Fraud Radar & Audit
  fraudAlerts: FraudAlertItem[];
  auditLogs: SecurityAuditItem[];
  emergencyLockdown: boolean;
  toggleEmergencyLockdown: (enabled: boolean) => void;
  dismissFraudAlert: (alertId: string) => void;
  blockIpPermanently: (ip: string) => void;
  freezeAffiliate: (userId: string, reason: string) => void;

  // Security & Team
  teamMembers: TeamMember[];
  inviteTeamMember: (name: string, email: string, role: TeamMember['role']) => void;
  removeTeamMember: (id: string) => void;
  apiTokens: ApiToken[];
  generateApiToken: (name: string, permissions: string) => string;
  revokeApiToken: (id: string) => void;
  loginSessions: LoginSession[];
  revokeSession: (id: string) => void;
  revokeAllOtherSessions: () => void;

  // Dynamic Pricing Engine
  dynamicPlans: DynamicHostingPlan[];
  updateHostingPlan: (id: string, updates: Partial<DynamicHostingPlan>) => void;
  dynamicTlds: DynamicTldPricing[];
  updateTldPricing: (tld: string, updates: Partial<DynamicTldPricing>) => void;

  // Founder / Admin Command Center
  customers: AdminCustomer[];
  serverNodes: ServerNode[];
  ordersLedger: LedgerOrder[];
  migrationQueue: MigrationRequest[];
  promoCodes: PromoCode[];
  dunningRules: DunningRules;
  updateDunningRules: (rules: Partial<DunningRules>) => void;
  runAutomationCronManually: () => Promise<string[]>;
  createCustomInvoice: (customerId: string, clientName: string, items: InvoiceItem[], dueDate: string) => void;
  toggleCustomerServiceStatus: (customerId: string, serviceId?: string) => void;
  modifyCustomerQuota: (customerId: string, diskGB: number, ramMB: number, inodes: number) => void;
  addCustomerCredit: (customerId: string, amount: number) => void;
  createAdminCustomerAndService: (customerData: Partial<AdminCustomer>, planId: string, domainName: string) => void;
  createServerNode: (nodeData: Omit<ServerNode, 'id'>) => void;
  approveLedgerOrder: (orderId: string) => void;
  refundLedgerOrder: (orderId: string) => void;
  updateMigrationStatus: (migrationId: string, step: 1 | 2 | 3 | 4, notes?: string) => void;
  createAdminPromo: (code: string, discount: number, maxUses: number, expiry: string) => void;
  deleteAdminPromo: (code: string) => void;
  exportAccountingCsv: () => void;

  // End-to-End Instant Provisioning
  provisionNewOrder: (order: {
    planId: string;
    planName: string;
    domain: string;
    region: 'sg' | 'us';
    appStack: string;
    paymentMethod: 'bKash' | 'Nagad' | 'Wallet' | 'Stripe';
    trxId: string;
    billingCycle: 'monthly' | 'annually';
    priceBDT: number;
  }) => Promise<string>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// INITIAL SEED DATA
// ---------------------------------------------------------------------------

const INITIAL_SERVICES: CloudService[] = [
  {
    id: 'srv_1',
    domain: 'ecommerce-live.com',
    planName: 'Developer Pro Cloud',
    status: 'Active',
    datacenter: 'Singapore SG1 (Equinix)',
    ipAddress: '103.145.22.40',
    cpanelUser: 'dev_hanif',
    diskUsedGB: 1.4,
    diskLimitGB: 5.0,
    inodesUsed: 32450,
    inodeLimit: 250000,
    ramUsedMB: 780,
    ramLimitMB: 2048,
    cpuCores: 2,
    ioLimitMB: 50,
    nodeVersion: 'Node.js 22 LTS',
    gitRepoUrl: 'github.com/hanif/ecommerce-live',
    gitBranch: 'main',
    webhookUrl: 'https://api.devhostcloud.com/webhooks/deploy/wh_9f82d1c3a81',
    autoRenew: true,
    nextDueDate: '2026-12-05',
    monthlyPriceBDT: 450,
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'PORT', value: '3000' },
      { key: 'DATABASE_URL', value: 'mysql://dev_hanif:SecurePass_2026!@127.0.0.1:3306/devhanif_shop' },
      { key: 'NEXT_PUBLIC_API_URL', value: 'https://ecommerce-live.com/api' },
      { key: 'REDIS_CACHE_URL', value: 'redis://127.0.0.1:6379' },
    ],
    releases: [
      { id: 'rel_4', commit: 'e89a12c', message: 'feat: add bkash payment webhook handler', timestamp: '10 mins ago', status: 'Active' },
      { id: 'rel_3', commit: 'b45c99d', message: 'perf: optimize sharp image loaders and tailwind purge', timestamp: 'Yesterday at 11:20 PM', status: 'Success' },
      { id: 'rel_2', commit: 'a12f78b', message: 'fix: passenger worker memory limit configuration', timestamp: '3 days ago', status: 'Success' },
      { id: 'rel_1', commit: 'c34d56e', message: 'chore: initial next.js 15 production scaffolding', timestamp: '7 days ago', status: 'Success' },
    ],
    sshPublicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOmX8b1QJ4R7T9k2M0z8y3W6u1P5n4L7s8E9v0a1B2C3 user@devhost-sg1',
  },
  {
    id: 'srv_2',
    domain: 'bangla-portfolio.dev',
    planName: 'Starter Pack',
    status: 'Active',
    datacenter: 'Singapore SG1 (Equinix)',
    ipAddress: '103.145.22.42',
    cpanelUser: 'dev_bangla',
    diskUsedGB: 0.65,
    diskLimitGB: 2.0,
    inodesUsed: 14200,
    inodeLimit: 150000,
    ramUsedMB: 310,
    ramLimitMB: 1024,
    cpuCores: 1,
    ioLimitMB: 25,
    nodeVersion: 'Node.js 20 LTS',
    gitRepoUrl: 'github.com/hanif/bangla-portfolio',
    gitBranch: 'main',
    webhookUrl: 'https://api.devhostcloud.com/webhooks/deploy/wh_7a18e44b901',
    autoRenew: true,
    nextDueDate: '2026-11-28',
    monthlyPriceBDT: 200,
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'SITE_TITLE', value: 'Portfolio Developer' },
    ],
    releases: [
      { id: 'rel_b1', commit: 'f99c11a', message: 'deploy: updated resume and case study 2026', timestamp: '4 days ago', status: 'Active' },
    ],
  },
];

const INITIAL_DATABASES: DatabaseItem[] = [
  { id: 'db_1', serviceId: 'srv_1', dbName: 'devhanif_shop', dbUser: 'devhanif_dbu', dbHost: 'localhost', sizeMB: 48.5, collation: 'utf8mb4_unicode_ci' },
  { id: 'db_2', serviceId: 'srv_1', dbName: 'devhanif_analytics', dbUser: 'devhanif_stats', dbHost: 'localhost', sizeMB: 12.2, collation: 'utf8mb4_unicode_ci' },
  { id: 'db_3', serviceId: 'srv_2', dbName: 'devbangla_cms', dbUser: 'devbangla_usr', dbHost: 'localhost', sizeMB: 8.4, collation: 'utf8mb4_unicode_ci' },
];

const INITIAL_SUBDOMAINS: SubdomainItem[] = [
  { id: 'sub_1', serviceId: 'srv_1', subdomain: 'api.ecommerce-live.com', documentRoot: '/public_html/api', sslActive: true, forceHttps: true, isStaging: false },
  { id: 'sub_2', serviceId: 'srv_1', subdomain: 'staging.ecommerce-live.com', documentRoot: '/public_html/staging', sslActive: true, forceHttps: true, isStaging: true },
  { id: 'sub_3', serviceId: 'srv_2', subdomain: 'v1.bangla-portfolio.dev', documentRoot: '/public_html/v1', sslActive: true, forceHttps: false, isStaging: false },
];

const INITIAL_BACKUPS: BackupSnapshot[] = [
  { id: 'bk_1', serviceId: 'srv_1', date: 'Today at 03:00 AM (Daily)', type: 'Incremental', sizeMB: 384, destination: 'AWS S3 SG Vault', location: 'Singapore Equinix' },
  { id: 'bk_2', serviceId: 'srv_1', date: 'Yesterday at 03:00 AM', type: 'Full cPanel', sizeMB: 1820, destination: 'Backblaze B2 EU', location: 'Frankfurt Offsite' },
  { id: 'bk_3', serviceId: 'srv_1', date: '3 days ago at 03:00 AM', type: 'Incremental', sizeMB: 360, destination: 'AWS S3 SG Vault', location: 'Singapore Equinix' },
  { id: 'bk_4', serviceId: 'srv_1', date: '5 days ago at 03:00 AM', type: 'Incremental', sizeMB: 345, destination: 'AWS S3 SG Vault', location: 'Singapore Equinix' },
  { id: 'bk_5', serviceId: 'srv_1', date: '7 days ago at 03:00 AM (Weekly)', type: 'Full cPanel', sizeMB: 1790, destination: 'Backblaze B2 EU', location: 'Frankfurt Offsite' },
  { id: 'bk_6', serviceId: 'srv_1', date: '10 days ago at 03:00 AM', type: 'Incremental', sizeMB: 320, destination: 'AWS S3 SG Vault', location: 'Singapore Equinix' },
  { id: 'bk_7', serviceId: 'srv_1', date: '14 days ago at 03:00 AM (Bi-weekly)', type: 'Full cPanel', sizeMB: 1750, destination: 'Backblaze B2 EU', location: 'Frankfurt Offsite' },
];

const INITIAL_CRONS: CronJobItem[] = [
  { id: 'cron_1', serviceId: 'srv_1', schedule: '0 0 * * *', command: 'node /home/dev_hanif/ecommerce-live/scripts/daily-report.js', description: 'Daily midnight sales & telemetry digest', status: 'Active' },
  { id: 'cron_2', serviceId: 'srv_1', schedule: '*/15 * * * *', command: 'node /home/dev_hanif/ecommerce-live/scripts/sync-inventory.js', description: 'bKash/Nagad pending payment reconciler', status: 'Active' },
];

const INITIAL_LOGS: ServerLogItem[] = [
  { id: 'log_1', serviceId: 'srv_1', timestamp: '12:44:02', statusCode: 200, method: 'GET', path: '/api/checkout/verify', ip: '103.112.44.12', responseTimeMs: 18, type: 'access' },
  { id: 'log_2', serviceId: 'srv_1', timestamp: '12:43:55', statusCode: 200, method: 'POST', path: '/api/v1/auth/session', ip: '119.30.34.88', responseTimeMs: 24, type: 'access' },
  { id: 'log_3', serviceId: 'srv_1', timestamp: '12:43:10', statusCode: 404, method: 'GET', path: '/wp-login.php', ip: '185.220.101.5', responseTimeMs: 2, type: 'error', message: 'Target script not found (Automated bot probe blocked)' },
  { id: 'log_4', serviceId: 'srv_1', timestamp: '12:42:01', statusCode: 200, method: 'GET', path: '/', ip: '103.205.71.18', responseTimeMs: 12, type: 'access' },
  { id: 'log_5', serviceId: 'srv_1', timestamp: '12:40:19', statusCode: 500, method: 'POST', path: '/api/webhooks/mock-fail', ip: '103.145.22.40', responseTimeMs: 82, type: 'error', message: 'stderr: Unhandled rejection in worker PID 1842: Connection timed out' },
];

const INITIAL_DOMAINS: DomainItem[] = [
  {
    id: 'dom_1',
    domain: 'ecommerce-live.com',
    expiryDate: '2027-10-14',
    daysRemaining: 708,
    status: 'Active',
    registrarLock: true,
    whoisPrivacy: true,
    autoRenew: true,
    nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
    eppCode: 'EPP-LIVE-98F1-XYZ',
    dnsRecords: [
      { id: 'dns_1', type: 'A', name: '@', content: '103.145.22.40', ttl: 300, proxied: true },
      { id: 'dns_2', type: 'CNAME', name: 'www', content: 'ecommerce-live.com', ttl: 300, proxied: true },
      { id: 'dns_3', type: 'CNAME', name: 'api', content: 'ecommerce-live.com', ttl: 300, proxied: true },
      { id: 'dns_4', type: 'MX', name: '@', content: 'mail.ecommerce-live.com', ttl: 3600, proxied: false, priority: 10 },
      { id: 'dns_5', type: 'TXT', name: '@', content: 'v=spf1 include:_spf.devhostcloud.com ~all', ttl: 3600, proxied: false },
    ],
  },
  {
    id: 'dom_2',
    domain: 'bangla-portfolio.dev',
    expiryDate: '2026-11-20',
    daysRemaining: 15,
    status: 'Expiring Soon',
    registrarLock: true,
    whoisPrivacy: true,
    autoRenew: false,
    nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
    eppCode: 'EPP-DEV-44B2-BD',
    dnsRecords: [
      { id: 'dns_b1', type: 'A', name: '@', content: '103.145.22.42', ttl: 300, proxied: true },
      { id: 'dns_b2', type: 'CNAME', name: 'www', content: 'bangla-portfolio.dev', ttl: 300, proxied: true },
    ],
  },
];

const INITIAL_CHILD_NS: ChildNameserver[] = [
  { id: 'cns_1', domainId: 'dom_1', hostname: 'ns1.ecommerce-live.com', ipAddress: '103.145.22.40' },
  { id: 'cns_2', domainId: 'dom_1', hostname: 'ns2.ecommerce-live.com', ipAddress: '103.145.22.41' },
];

const INITIAL_REDIRECTS: DomainRedirect[] = [
  { id: 'red_1', domainId: 'dom_1', sourcePath: '/shop', targetUrl: 'https://ecommerce-live.com/#products', type: '301' },
  { id: 'red_2', domainId: 'dom_1', sourcePath: '/fb', targetUrl: 'https://facebook.com/ecommerce-live', type: '302' },
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-2026-8941',
    date: '2026-11-01',
    dueDate: '2026-11-05',
    amount: 450,
    status: 'Paid',
    paymentMethod: 'bKash Instant',
    trxID: 'BKASH_9A8F12X',
    plan: 'Developer Pro Cloud (Monthly)',
    items: [
      { desc: 'Developer Pro Cloud — Singapore SG1 NVMe (Nov 2026)', amount: 450 },
    ],
  },
  {
    id: 'INV-2026-8712',
    date: '2026-10-01',
    dueDate: '2026-10-05',
    amount: 450,
    status: 'Paid',
    paymentMethod: 'bKash Instant',
    trxID: 'BKASH_87B44Q1',
    plan: 'Developer Pro Cloud (Monthly)',
    items: [
      { desc: 'Developer Pro Cloud — Singapore SG1 NVMe (Oct 2026)', amount: 450 },
    ],
  },
  {
    id: 'INV-2026-8550',
    date: '2026-09-01',
    dueDate: '2026-09-05',
    amount: 450,
    status: 'Paid',
    paymentMethod: 'Nagad Merchant',
    trxID: 'NGD_55C89L0',
    plan: 'Developer Pro Cloud (Monthly)',
    items: [
      { desc: 'Developer Pro Cloud — Singapore SG1 NVMe (Sep 2026)', amount: 450 },
    ],
  },
];

const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  { id: 'wtx_1', date: '2026-10-15', type: 'Top-Up', amount: 3000, method: 'bKash Checkout (Trx: BK_99812)', balanceAfter: 3000 },
  { id: 'wtx_2', date: '2026-11-01', type: 'Debit', amount: 500, method: 'Auto-Debit: .dev Domain Renewal', balanceAfter: 2500 },
];

const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'TKT-9941',
    subject: 'Request assistance configuring custom Wildcard SSL for staging subdomain',
    department: 'Technical & DevOps Support',
    priority: 'Normal',
    status: 'Answered',
    relatedService: 'ecommerce-live.com (Developer Pro)',
    lastUpdated: '2 hours ago',
    messages: [
      {
        id: 'msg_1',
        sender: 'client',
        senderName: 'Hanif Khan',
        timestamp: 'Today at 09:15 AM',
        message: 'Hello, I have created staging.ecommerce-live.com and need to verify if AutoSSL certificates will issue automatically or if I need to adjust CNAME records.',
      },
      {
        id: 'msg_2',
        sender: 'support',
        senderName: 'Siam (Senior Cloud Engineer)',
        timestamp: 'Today at 10:30 AM',
        message: 'Hi Hanif! Sectigo AutoSSL runs every 4 hours on our Singapore SG1 node. We have triggered an instant Sectigo renewal for staging.ecommerce-live.com — your wildcard TLS 1.3 is now active and verified.',
      },
    ],
  },
];

const INITIAL_CUSTOMERS: AdminCustomer[] = [
  {
    id: 'cust_1',
    name: 'Hanif Khan',
    email: 'hanif@ecommerce-live.com',
    phone: '+8801712345678',
    company: 'Khan Commerce Ltd',
    servicesCount: 2,
    totalSpendBDT: 4850,
    walletBalanceBDT: 2500,
    status: 'Active',
    joinedDate: '2026-06-12',
    primaryServiceId: 'srv_1',
  },
  {
    id: 'cust_2',
    name: 'Tanvir Ahmed',
    email: 'tanvir@nextdev.bd',
    phone: '+8801819876543',
    company: 'NextDev Studios',
    servicesCount: 4,
    totalSpendBDT: 14200,
    walletBalanceBDT: 1200,
    status: 'Active',
    joinedDate: '2026-03-01',
  },
  {
    id: 'cust_3',
    name: 'Shamim Hossain',
    email: 'shamim@bdhostinger.com',
    phone: '+8801911223344',
    company: 'Apex Media BD',
    servicesCount: 1,
    totalSpendBDT: 1200,
    walletBalanceBDT: 0,
    status: 'High Resource',
    joinedDate: '2026-08-19',
  },
  {
    id: 'cust_4',
    name: 'Fariha Yasmin',
    email: 'fariha@designcraft.xyz',
    phone: '+8801615566778',
    company: 'DesignCraft Global',
    servicesCount: 1,
    totalSpendBDT: 450,
    walletBalanceBDT: 450,
    status: 'Suspended',
    joinedDate: '2026-10-10',
  },
];

const INITIAL_NODES: ServerNode[] = [
  {
    id: 'node_sg1',
    name: 'Singapore SG1 Master Node',
    hostname: 'sg1.devhostcloud.com',
    location: 'Singapore (Equinix SG1)',
    totalDiskGB: 100.0,
    allocatedDiskGB: 68.5,
    actualUsedDiskGB: 29.4,
    totalSlots: 50,
    usedSlots: 38,
    ramTotalGB: 64,
    ramUsedGB: 28.5,
    lveLoad: 0.38,
    status: 'Operational',
  },
  {
    id: 'node_us1',
    name: 'USA East Node',
    hostname: 'us1.devhostcloud.com',
    location: 'Ashburn, VA (Equinix)',
    totalDiskGB: 100.0,
    allocatedDiskGB: 32.0,
    actualUsedDiskGB: 11.2,
    totalSlots: 30,
    usedSlots: 14,
    ramTotalGB: 32,
    ramUsedGB: 10.4,
    lveLoad: 0.22,
    status: 'Operational',
  },
];

const INITIAL_LEDGER: LedgerOrder[] = [
  { id: 'LED-9812', invoiceId: 'INV-2026-8941', customerName: 'Hanif Khan', gateway: 'bKash', trxID: 'BKASH_9A8F12X', amountBDT: 450, provisionStatus: 'Auto-Provisioned', timestamp: '2026-11-01 14:22' },
  { id: 'LED-9811', invoiceId: 'INV-2026-8940', customerName: 'Tanvir Ahmed', gateway: 'Nagad', trxID: 'NGD_77P102M', amountBDT: 900, provisionStatus: 'Auto-Provisioned', timestamp: '2026-11-01 11:10' },
  { id: 'LED-9810', invoiceId: 'INV-2026-8939', customerName: 'Apex Media BD', gateway: 'Stripe', trxID: 'ch_3N82f9H21', amountBDT: 2400, provisionStatus: 'Auto-Provisioned', timestamp: '2026-10-31 19:40' },
  { id: 'LED-9809', invoiceId: 'INV-2026-8938', customerName: 'Rafiqul Islam', gateway: 'bKash', trxID: 'BKASH_MANUAL_1', amountBDT: 450, provisionStatus: 'Pending Approval', timestamp: '2026-10-31 16:15' },
];

const INITIAL_MIGRATIONS: MigrationRequest[] = [
  {
    id: 'mig_1',
    domain: 'bengal-superstore.com',
    customerName: 'Tanvir Ahmed',
    sourceHost: 'Hostinger Singapore',
    backupSizeMB: 1450,
    currentStep: 2, // Pulling
    notes: 'Large WooCommerce database with ~25,000 products. Requires Redis Object Cache configured on SG1.',
    targetNode: 'Singapore SG1 Master Node',
    createdAt: '2026-11-05 08:30 AM',
  },
  {
    id: 'mig_2',
    domain: 'fintech-dhaka.io',
    customerName: 'Sabbir Rahman',
    sourceHost: 'Bluehost USA',
    backupSizeMB: 680,
    currentStep: 3, // Restoring
    notes: 'Next.js 14 app + custom MySQL. Ensure Passenger worker restart script is in place.',
    targetNode: 'Singapore SG1 Master Node',
    createdAt: '2026-11-04 04:15 PM',
  },
  {
    id: 'mig_3',
    domain: 'dailybanglapost.net',
    customerName: 'Nazmul Huda',
    sourceHost: 'Namecheap Shared',
    backupSizeMB: 2800,
    currentStep: 4, // Completed
    notes: 'WordPress high traffic news portal. Fully migrated and DNS flipped to ns1.devhost.cloud.',
    targetNode: 'Singapore SG1 Master Node',
    createdAt: '2026-11-02 10:00 AM',
  },
  {
    id: 'mig_4',
    domain: 'creativestudio.xyz',
    customerName: 'Sadia Jahan',
    sourceHost: 'GoDaddy cPanel',
    backupSizeMB: 420,
    currentStep: 1, // Queued
    notes: 'Static Astro build + PHP contact form. Waiting for cPanel backup link.',
    targetNode: 'USA East Node',
    createdAt: '2026-11-05 11:20 AM',
  },
];

const INITIAL_PROMOS: PromoCode[] = [
  { code: 'DEVPRO20', discountPercent: 20, usesCount: 38, maxUses: 100, expiryDate: '2026-12-31', status: 'Active' },
  { code: 'LAUNCHBDIX', discountPercent: 50, usesCount: 100, maxUses: 100, expiryDate: '2026-10-31', status: 'Expired' },
  { code: 'MIGRATEFREE', discountPercent: 15, usesCount: 14, maxUses: 50, expiryDate: '2027-06-30', status: 'Active' },
];

const INITIAL_DYNAMIC_PLANS: DynamicHostingPlan[] = [
  {
    id: 'starter',
    slug: 'starter',
    pid: 1,
    name: 'Starter Pack',
    nameBn: 'স্টার্টার প্যাক',
    type: 'shared',
    tagline: 'Ideal for small blogs & personal websites',
    priceMonthlyBDT: 200,
    unitServerCostBDT: 45,
    minOwnerProfitBDT: 95,
    maxAffiliatePoolBDT: 60,
    storageGB: 2,
    ramGB: 1,
    cpuCores: 1,
    inodes: 150000,
    isPopular: false,
    features: [
      '2 GB Pure NVMe SSD',
      '1 GB Dedicated CloudLinux RAM',
      '1 Core CPU | 25 MB/s Disk I/O',
      '1-Click WordPress (Softaculous)',
      'Free Automated Wildcard SSL',
      'Sitejet AI Website Builder Included',
      'Weekly Automated Backups',
    ],
  },
  {
    id: 'developer-pro',
    slug: 'developer-pro',
    pid: 2,
    name: 'Developer Pro',
    nameBn: 'ডেভেলপার প্রো',
    type: 'developer',
    tagline: 'Engineered for full-stack developers & Next.js',
    priceMonthlyBDT: 450,
    unitServerCostBDT: 90,
    minOwnerProfitBDT: 225,
    maxAffiliatePoolBDT: 135,
    storageGB: 5,
    ramGB: 2,
    cpuCores: 2,
    inodes: 300000,
    isPopular: true,
    features: [
      '5 GB Pure NVMe SSD',
      '2 GB Dedicated CloudLinux RAM',
      '2 Cores CPU | 50 MB/s Disk I/O',
      'Node.js (v18-v22), Next.js & Python',
      '1-Click GitHub Webhook Auto-Deploy',
      'Jailed SSH & WP-CLI Access',
      'Backups Shipped Every 3 Days',
    ],
  },
  {
    id: 'business-max',
    slug: 'business-max',
    pid: 3,
    name: 'Business Max',
    nameBn: 'বিজনেস ম্যাক্স',
    type: 'shared',
    tagline: 'High-throughput power for WooCommerce & high traffic',
    priceMonthlyBDT: 900,
    unitServerCostBDT: 180,
    minOwnerProfitBDT: 450,
    maxAffiliatePoolBDT: 270,
    storageGB: 15,
    ramGB: 4,
    cpuCores: 4,
    inodes: 600000,
    isPopular: false,
    features: [
      '15 GB Pure NVMe SSD',
      '4 GB Dedicated CloudLinux RAM',
      '4 Cores CPU | 100 MB/s Disk I/O',
      'Enterprise Redis & Object Cache 100/100',
      'WooCommerce High-Concurrency Engine',
      'Priority Tier-1 VIP NOC Routing',
      'Daily Automated Offsite Snapshots',
    ],
  },
  {
    id: 'cloud-kvm-1',
    slug: 'cloud-kvm-1',
    pid: 101,
    name: 'Cloud KVM-1',
    nameBn: 'ক্লাউড কেভিএম-১',
    type: 'vps',
    tagline: 'Dedicated KVM compute with dedicated IPv4',
    priceMonthlyBDT: 1450,
    unitServerCostBDT: 500,
    minOwnerProfitBDT: 650,
    maxAffiliatePoolBDT: 300,
    storageGB: 60,
    ramGB: 4,
    cpuCores: 2,
    inodes: 1000000,
    isPopular: false,
    features: ['2 vCPU Cores AMD EPYC', '4 GB DDR5 ECC RAM', '60 GB Pure NVMe Gen4', '2 TB Bandwidth', '1 Dedicated IPv4'],
  },
  {
    id: 'cloud-kvm-2',
    slug: 'cloud-kvm-2',
    pid: 102,
    name: 'Cloud KVM-2',
    nameBn: 'ক্লাউড কেভিএম-২',
    type: 'vps',
    tagline: 'Production grade performance for growing startups',
    priceMonthlyBDT: 2750,
    unitServerCostBDT: 950,
    minOwnerProfitBDT: 1250,
    maxAffiliatePoolBDT: 550,
    storageGB: 120,
    ramGB: 8,
    cpuCores: 4,
    inodes: 2000000,
    isPopular: true,
    features: ['4 vCPU Cores AMD EPYC', '8 GB DDR5 ECC RAM', '120 GB Pure NVMe Gen4', '4 TB Bandwidth', '1 Dedicated IPv4'],
  },
  {
    id: 'cloud-kvm-4',
    slug: 'cloud-kvm-4',
    pid: 103,
    name: 'Cloud KVM-4',
    nameBn: 'ক্লাউড কেভিএম-৪',
    type: 'vps',
    tagline: 'High concurrency cluster for agencies',
    priceMonthlyBDT: 5200,
    unitServerCostBDT: 1800,
    minOwnerProfitBDT: 2400,
    maxAffiliatePoolBDT: 1000,
    storageGB: 240,
    ramGB: 16,
    cpuCores: 6,
    inodes: 5000000,
    isPopular: false,
    features: ['6 vCPU Cores AMD EPYC', '16 GB DDR5 ECC RAM', '240 GB Pure NVMe Gen4', '8 TB Bandwidth', '1 Dedicated IPv4'],
  },
  {
    id: 'cloud-kvm-8',
    slug: 'cloud-kvm-8',
    pid: 104,
    name: 'Cloud KVM-8',
    nameBn: 'ক্লাউড কেভিএম-৮',
    type: 'vps',
    tagline: 'Enterprise powerhouse with high NVMe I/O',
    priceMonthlyBDT: 9800,
    unitServerCostBDT: 3400,
    minOwnerProfitBDT: 4600,
    maxAffiliatePoolBDT: 1800,
    storageGB: 480,
    ramGB: 32,
    cpuCores: 8,
    inodes: 10000000,
    isPopular: false,
    features: ['8 vCPU Cores AMD EPYC', '32 GB DDR5 ECC RAM', '480 GB Pure NVMe Gen4', '16 TB Bandwidth', '1 Dedicated IPv4'],
  },
];

const INITIAL_DYNAMIC_TLDS: DynamicTldPricing[] = [
  { tld: '.com', category: 'General', registerBDT: 1350, renewalBDT: 1650, transferBDT: 1350, registrarCostBDT: 1150, ownerNetProfitRegBDT: 200, affiliateEligible: false, featuredBadge: 'Most Popular' },
  { tld: '.net', category: 'General', registerBDT: 1650, renewalBDT: 1850, transferBDT: 1650, registrarCostBDT: 1450, ownerNetProfitRegBDT: 200, affiliateEligible: false },
  { tld: '.org', category: 'Non-Profit', registerBDT: 1550, renewalBDT: 1750, transferBDT: 1550, registrarCostBDT: 1350, ownerNetProfitRegBDT: 200, affiliateEligible: false },
  { tld: '.xyz', category: 'Web3 / Tech', registerBDT: 350, renewalBDT: 1450, transferBDT: 1350, registrarCostBDT: 250, ownerNetProfitRegBDT: 100, affiliateEligible: false, featuredBadge: 'Lowest Price' },
  { tld: '.io', category: 'Tech / SaaS', registerBDT: 4800, renewalBDT: 5200, transferBDT: 4800, registrarCostBDT: 4200, ownerNetProfitRegBDT: 600, affiliateEligible: false, featuredBadge: 'Dev Choice' },
  { tld: '.tech', category: 'Tech', registerBDT: 450, renewalBDT: 2600, transferBDT: 2400, registrarCostBDT: 350, ownerNetProfitRegBDT: 100, affiliateEligible: false },
  { tld: '.shop', category: 'E-Commerce', registerBDT: 350, renewalBDT: 3600, transferBDT: 3400, registrarCostBDT: 250, ownerNetProfitRegBDT: 100, affiliateEligible: false },
  { tld: '.ai', category: 'AI / Future', registerBDT: 8900, renewalBDT: 9500, transferBDT: 8900, registrarCostBDT: 7900, ownerNetProfitRegBDT: 1000, affiliateEligible: false },
  { tld: '.co', category: 'Startups', registerBDT: 1450, renewalBDT: 3200, transferBDT: 2900, registrarCostBDT: 1250, ownerNetProfitRegBDT: 200, affiliateEligible: false },
  { tld: '.info', category: 'Information', registerBDT: 650, renewalBDT: 2450, transferBDT: 2200, registrarCostBDT: 500, ownerNetProfitRegBDT: 150, affiliateEligible: false },
];

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  { id: 'notif_1', title: 'Invoice Paid Successfully', desc: 'INV-2026-8941 (৳450) via bKash. Service renewed to Dec 05.', time: '2 hours ago', type: 'billing', read: false },
  { id: 'notif_2', title: 'Git Auto-Deploy Succeeded', desc: 'Commit e89a12c (feat: add bkash webhook) deployed on SG1 node in 2.8s.', time: '5 hours ago', type: 'git', read: false },
  { id: 'notif_3', title: 'Domain Renewal Reminder', desc: 'bangla-portfolio.dev expires in 15 days. Auto-renew is currently OFF.', time: '1 day ago', type: 'domain', read: false },
  { id: 'notif_4', title: 'Senior Engineer Replied to Ticket', desc: 'Siam replied to Ticket #TKT-9941 regarding Wildcard SSL on staging.', time: '2 days ago', type: 'support', read: true },
];

// ---------------------------------------------------------------------------
// PROVIDER COMPONENT
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'devhost-portal-state-v9';

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  const [activeRole, setActiveRole] = useState<UserRole>('client');
  const [currentUser, setCurrentUser] = useState({
    name: 'Hanif Khan',
    email: 'hanif@ecommerce-live.com',
    avatar: 'HK',
    company: 'Khan Commerce Ltd',
  });

  // Services & State
  const [services, setServices] = useState<CloudService[]>(INITIAL_SERVICES);
  const [activeServiceId, setActiveServiceId] = useState<string>('srv_1');
  const [databases, setDatabases] = useState<DatabaseItem[]>(INITIAL_DATABASES);
  const [subdomains, setSubdomains] = useState<SubdomainItem[]>(INITIAL_SUBDOMAINS);
  const [backups, setBackups] = useState<BackupSnapshot[]>(INITIAL_BACKUPS);
  const [cronJobs, setCronJobs] = useState<CronJobItem[]>(INITIAL_CRONS);
  const [serverLogs, setServerLogs] = useState<ServerLogItem[]>(INITIAL_LOGS);

  // Domains & State
  const [domains, setDomains] = useState<DomainItem[]>(INITIAL_DOMAINS);
  const [childNameservers, setChildNameservers] = useState<ChildNameserver[]>(INITIAL_CHILD_NS);
  const [domainRedirects, setDomainRedirects] = useState<DomainRedirect[]>(INITIAL_REDIRECTS);
  const [domainTransfers, setDomainTransfers] = useState<DomainTransferRequest[]>([]);

  // Billing
  const [walletBalanceBDT, setWalletBalanceBDT] = useState<number>(2500);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(INITIAL_TRANSACTIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);

  // Support & Affiliate
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [affiliate, setAffiliate] = useState<{
    refLink: string;
    referralCode: string;
    clicks: number;
    signups: number;
    activeConversions: number;
    commissionTier: string;
    commissionRate: number;
    tierLevel: 'starter_20' | 'pro_25' | 'agency_30';
    pendingClearanceBDT: number;
    availableBalanceBDT: number;
    totalEarnedBDT: number;
    payouts: AffiliatePayout[];
    commissions: AffiliateCommissionItem[];
    subIdStats: CampaignSubIdStat[];
  }>({
    refLink: 'https://devhost.cloud/?ref=hanif2026',
    referralCode: 'hanif2026',
    clicks: 412,
    signups: 14,
    activeConversions: 11,
    commissionTier: 'Tier 2 (25% Commission)',
    commissionRate: 25,
    tierLevel: 'pro_25',
    pendingClearanceBDT: 1575,
    availableBalanceBDT: 2450,
    totalEarnedBDT: 9800,
    payouts: [
      { id: 'PAY-101', date: '2026-10-15', amount: 3500, method: 'bKash Merchant', accountNumber: '01712345678', status: 'Completed', trxId: 'BK_PAY_981' },
      { id: 'PAY-102', date: '2026-09-01', amount: 2500, method: 'Nagad Personal', accountNumber: '01819876543', status: 'Completed', trxId: 'NG_PAY_442' },
    ],
    commissions: [
      {
        id: 'COMM-109',
        date: '2026-11-04',
        invoiceId: 'INV-2026-8941',
        customerMasked: 'r***m@gmail.com',
        domain: 'dhakabazaar.com.bd',
        orderAmountBDT: 1800,
        commissionBDT: 450,
        ratePercent: 25,
        subId: 'youtube_bio',
        status: 'pending_35d_hold',
        daysLeftToMature: 33,
        clearanceDate: '2026-12-09',
      },
      {
        id: 'COMM-108',
        date: '2026-10-28',
        invoiceId: 'INV-2026-8812',
        customerMasked: 's***n@techbd.org',
        domain: 'nextpos.cloud',
        orderAmountBDT: 4500,
        commissionBDT: 1125,
        ratePercent: 25,
        subId: 'fb_group',
        status: 'pending_35d_hold',
        daysLeftToMature: 26,
        clearanceDate: '2026-12-02',
      },
      {
        id: 'COMM-107',
        date: '2026-09-22',
        invoiceId: 'INV-2026-7241',
        customerMasked: 'k***r@banglamail.net',
        domain: 'ecombd.shop',
        orderAmountBDT: 1400,
        commissionBDT: 280,
        ratePercent: 20,
        subId: 'blog_review',
        status: 'cleared_available',
        daysLeftToMature: 0,
        clearanceDate: '2026-10-27 (Cleared)',
      },
    ],
    subIdStats: [
      { subId: 'youtube_bio', channelName: 'YouTube Description', clicks: 184, signups: 7, conversionRate: 3.8, totalEarningsBDT: 3450 },
      { subId: 'fb_group', channelName: 'Facebook Developers BD', clicks: 142, signups: 5, conversionRate: 3.5, totalEarningsBDT: 4200 },
      { subId: 'blog_review', channelName: 'Personal Tech Blog', clicks: 86, signups: 2, conversionRate: 2.3, totalEarningsBDT: 2150 },
    ],
  });

  // Security, Fraud Radar & Audit
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlertItem[]>([
    {
      id: 'FRAUD-101',
      type: 'self_referral_attempt',
      severity: 'critical',
      title: 'Self-Referral Blocked (Account & IP Match)',
      target: 'Referral: tanvir99 -> Buyer: tanvir99@gmail.com',
      details: 'Buyer email and checkout IP 103.112.44.18 matched affiliate registration credentials. Commission zeroed.',
      status: 'blocked',
      timestamp: '2 hours ago',
      ipAddress: '103.112.44.18',
    },
    {
      id: 'FRAUD-102',
      type: 'brute_force_ip',
      severity: 'warning',
      title: 'Brute-Force Lockout (5 Failed Admin PIN Attempts)',
      target: 'IP: 185.220.101.4 (Tor Exit Node)',
      details: 'Submitting rapid login attempts on /admin. Temporarily locked out for 15 minutes by Edge Rate Limiter.',
      status: 'blocked',
      timestamp: 'Yesterday at 11:20 PM',
      ipAddress: '185.220.101.4',
    },
    {
      id: 'FRAUD-103',
      type: 'duplicate_trxid',
      severity: 'critical',
      title: 'Duplicate bKash trxID Replay Attempt',
      target: 'trxID: BKASH_9A8F12X (Already Claimed in INV-2026-8941)',
      details: 'User tried submitting an already confirmed transaction ID. Payment flagged for review.',
      status: 'open',
      timestamp: 'Today at 09:14 AM',
      ipAddress: '103.151.102.8',
    },
  ]);

  const [auditLogs, setAuditLogs] = useState<SecurityAuditItem[]>([
    { id: 'LOG-891', actor: 'Admin (Founder)', role: 'admin', action: 'Dunning Rules Updated', target: 'Grace Period -> 3 Days', ip: '103.145.22.40', riskLevel: 'low', timestamp: 'Today at 10:15 AM' },
    { id: 'LOG-890', actor: 'System Auto-Engine', role: 'system', action: 'Self-Referral Detected', target: 'tanvir99 (COMM-104 Flagged)', ip: '103.112.44.18', riskLevel: 'critical', timestamp: '2 hours ago' },
    { id: 'LOG-889', actor: 'System Auto-Engine', role: 'system', action: 'Brute-Force IP Auto-Blocked', target: '185.220.101.4 -> 15 min lock', ip: '185.220.101.4', riskLevel: 'high', timestamp: 'Yesterday at 11:20 PM' },
    { id: 'LOG-888', actor: 'Admin (Founder)', role: 'admin', action: 'cPanel Manual Suspend', target: 'User: dev_test2', ip: '103.145.22.40', riskLevel: 'medium', timestamp: '2 days ago' },
  ]);

  const [emergencyLockdown, setEmergencyLockdown] = useState<boolean>(false);

  // Security & Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: 'tm_1', name: 'Tanvir Ahmed', email: 'tanvir@nextdev.bd', role: 'Developer: Git & cPanel Only', addedDate: '2026-09-12', status: 'Active' },
    { id: 'tm_2', name: 'Rahim Ullah', email: 'billing@khancommerce.com', role: 'Billing Manager: Invoices Only', addedDate: '2026-10-01', status: 'Active' },
  ]);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([
    { id: 'tok_1', name: 'GitHub Actions Auto-Deploy Runner', prefix: 'dhc_live_9f82d...', created: '2026-08-10', lastUsed: '10 mins ago', permissions: 'Deploy & Restart Only' },
    { id: 'tok_2', name: 'Staging CI Sync', prefix: 'dhc_live_34a11...', created: '2026-10-02', lastUsed: '3 days ago', permissions: 'Read & Deploy' },
  ]);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([
    { id: 'ses_1', device: 'Chrome on macOS (M3 Pro)', location: 'Dhaka, Bangladesh', ip: '103.145.22.18', current: true, time: 'Active now' },
    { id: 'ses_2', device: 'Firefox on Windows 11', location: 'Chittagong, Bangladesh', ip: '119.30.34.88', current: false, time: 'Yesterday at 04:30 PM' },
  ]);

  // Founder / Admin Systems
  const [customers, setCustomers] = useState<AdminCustomer[]>(INITIAL_CUSTOMERS);
  const [serverNodes, setServerNodes] = useState<ServerNode[]>(INITIAL_NODES);
  const [ordersLedger, setOrdersLedger] = useState<LedgerOrder[]>(INITIAL_LEDGER);
  const [migrationQueue, setMigrationQueue] = useState<MigrationRequest[]>(INITIAL_MIGRATIONS);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(INITIAL_PROMOS);
  const [dynamicPlans, setDynamicPlans] = useState<DynamicHostingPlan[]>(INITIAL_DYNAMIC_PLANS);
  const [dynamicTlds, setDynamicTlds] = useState<DynamicTldPricing[]>(INITIAL_DYNAMIC_TLDS);
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  const [systemBroadcast, setSystemBroadcast] = useState<SystemBroadcast>({
    active: true,
    message: 'Scheduled LiteSpeed Kernel Upgrade on SG1 Node — Zero Downtime Expected',
    type: 'info',
    dismissible: true,
  });
  const [dunningRules, setDunningRules] = useState<DunningRules>({
    invoiceDaysBefore: 7,
    autoSuspendDaysAfter: 3,
    autoTerminateDaysAfter: 14,
  });

  // LocalStorage Hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.services) setServices(parsed.services);
        if (parsed.activeServiceId) setActiveServiceId(parsed.activeServiceId);
        if (parsed.databases) setDatabases(parsed.databases);
        if (parsed.subdomains) setSubdomains(parsed.subdomains);
        if (parsed.backups) setBackups(parsed.backups);
        if (parsed.cronJobs) setCronJobs(parsed.cronJobs);
        if (parsed.domains) setDomains(parsed.domains);
        if (parsed.childNameservers) setChildNameservers(parsed.childNameservers);
        if (parsed.domainRedirects) setDomainRedirects(parsed.domainRedirects);
        if (parsed.domainTransfers) setDomainTransfers(parsed.domainTransfers);
        if (parsed.walletBalanceBDT !== undefined) setWalletBalanceBDT(parsed.walletBalanceBDT);
        if (parsed.invoices) setInvoices(parsed.invoices);
        if (parsed.tickets) setTickets(parsed.tickets);
        if (parsed.customers) setCustomers(parsed.customers);
        if (parsed.serverNodes) setServerNodes(parsed.serverNodes);
        if (parsed.ordersLedger) setOrdersLedger(parsed.ordersLedger);
        if (parsed.migrationQueue) setMigrationQueue(parsed.migrationQueue);
        if (parsed.promoCodes) setPromoCodes(parsed.promoCodes);
        if (parsed.dynamicPlans) {
          const mergedPlans = parsed.dynamicPlans.map((p: DynamicHostingPlan) => {
            const defP = INITIAL_DYNAMIC_PLANS.find((dp) => dp.id === p.id || dp.slug === p.slug);
            return {
              ...defP,
              ...p,
              unitServerCostBDT: p.unitServerCostBDT ?? defP?.unitServerCostBDT ?? 0,
              minOwnerProfitBDT: p.minOwnerProfitBDT ?? defP?.minOwnerProfitBDT ?? 0,
              maxAffiliatePoolBDT: p.maxAffiliatePoolBDT ?? defP?.maxAffiliatePoolBDT ?? 0,
            };
          });
          setDynamicPlans(mergedPlans);
        }
        if (parsed.dynamicTlds) {
          const mergedTlds = parsed.dynamicTlds.map((t: DynamicTldPricing) => {
            const defT = INITIAL_DYNAMIC_TLDS.find((dt) => dt.tld === t.tld);
            return {
              ...defT,
              ...t,
              registrarCostBDT: t.registrarCostBDT ?? defT?.registrarCostBDT ?? 0,
              ownerNetProfitRegBDT: t.ownerNetProfitRegBDT ?? defT?.ownerNetProfitRegBDT ?? 0,
            };
          });
          setDynamicTlds(mergedTlds);
        }
        if (parsed.notifications) setNotifications(parsed.notifications);
        if (parsed.systemBroadcast) setSystemBroadcast(parsed.systemBroadcast);
        if (parsed.dunningRules) setDunningRules(parsed.dunningRules);
      }
    } catch {
      // Fallback to seeds
    }
    setIsClientLoaded(true);
  }, []);

  // Fetch dynamic catalog from /api/catalog (Supabase Postgres)
  useEffect(() => {
    async function syncDynamicCatalog() {
      try {
        const res = await fetch('/api/catalog');
        if (res.ok) {
          const data = await res.json();
          if (data.allPlans && data.allPlans.length > 0) {
            const mappedPlans: DynamicHostingPlan[] = data.allPlans.map((p: any) => ({
              id: p.slug,
              slug: p.slug,
              pid: p.id,
              name: p.name_en,
              nameBn: p.name_bn,
              type: p.category,
              tagline:
                p.category === 'vps'
                  ? 'Dedicated KVM compute with dedicated IPv4'
                  : 'Engineered for high performance',
              priceMonthlyBDT: Number(p.selling_price_monthly_bdt),
              unitServerCostBDT: Number(p.unit_server_cost_bdt || 0),
              minOwnerProfitBDT: Number(p.min_owner_profit_bdt || 0),
              maxAffiliatePoolBDT: Number(p.max_affiliate_pool_bdt || 0),
              storageGB: Number(p.storage_gb),
              ramGB: Math.round(Number(p.ram_mb) / 1024),
              cpuCores: Number(p.cpu_cores),
              inodes: Number(p.inode_limit),
              features: p.features_json || [],
              isPopular: !!p.is_popular,
            }));
            setDynamicPlans(mappedPlans);
          }
          if (data.domainTlds && data.domainTlds.length > 0) {
            const mappedTlds: DynamicTldPricing[] = data.domainTlds.map((t: any) => ({
              tld: t.tld,
              category: t.category,
              registerBDT: Number(t.reg_price_bdt),
              renewalBDT: Number(t.renew_price_bdt),
              transferBDT: Number(t.transfer_price_bdt),
              registrarCostBDT: Number(t.registrar_cost_bdt || 0),
              ownerNetProfitRegBDT: Number(t.owner_net_profit_reg_bdt || 0),
              affiliateEligible: !!t.affiliate_eligible,
              featuredBadge: t.featured_badge,
            }));
            setDynamicTlds(mappedTlds);
          }
        }
      } catch (err) {
        console.warn('[PortalContext] Dynamic catalog load deferred to local state cache:', err);
      }
    }
    syncDynamicCatalog();
  }, []);

  // Save to LocalStorage on state updates
  useEffect(() => {
    if (!isClientLoaded) return;
    try {
      const stateToPersist = {
        services,
        activeServiceId,
        databases,
        subdomains,
        backups,
        cronJobs,
        domains,
        childNameservers,
        domainRedirects,
        domainTransfers,
        walletBalanceBDT,
        invoices,
        tickets,
        customers,
        serverNodes,
        ordersLedger,
        migrationQueue,
        promoCodes,
        dynamicPlans,
        dynamicTlds,
        notifications,
        systemBroadcast,
        dunningRules,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch {
      // Ignore quota storage errors
    }
  }, [
    isClientLoaded,
    services,
    activeServiceId,
    databases,
    subdomains,
    backups,
    cronJobs,
    domains,
    childNameservers,
    domainRedirects,
    domainTransfers,
    walletBalanceBDT,
    invoices,
    tickets,
    customers,
    serverNodes,
    ordersLedger,
    migrationQueue,
    promoCodes,
    dynamicPlans,
    dynamicTlds,
    notifications,
    systemBroadcast,
    dunningRules,
  ]);

  const activeService = services.find((s) => s.id === activeServiceId) || services[0];
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // ---------------------------------------------------------------------------
  // ROLE & IMPERSONATION
  // ---------------------------------------------------------------------------

  const switchRole = (role: UserRole) => {
    setActiveRole(role);
  };

  const impersonateCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setCurrentUser({
        name: cust.name,
        email: cust.email,
        avatar: cust.name.slice(0, 2).toUpperCase(),
        company: cust.company,
      });
      if (cust.primaryServiceId && services.some((s) => s.id === cust.primaryServiceId)) {
        setActiveServiceId(cust.primaryServiceId);
      }
      setActiveRole('client');
    }
  };

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS & BROADCAST
  // ---------------------------------------------------------------------------

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const updateSystemBroadcast = (updates: Partial<SystemBroadcast>) => {
    setSystemBroadcast((prev) => ({ ...prev, ...updates }));
  };

  const dismissBroadcast = () => {
    setSystemBroadcast((prev) => ({ ...prev, active: false }));
  };

  // ---------------------------------------------------------------------------
  // HOSTING SERVICE POWER & WORKSPACE CONTROLS
  // ---------------------------------------------------------------------------

  const cleanServiceCache = async (serviceId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 900));
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, diskUsedGB: Math.max(0.2, Number((s.diskUsedGB - 0.25).toFixed(2))) } : s))
    );
    return true;
  };

  const restartPassengerWorkers = async (serviceId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1200));
    setServerLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        serviceId,
        timestamp: new Date().toLocaleTimeString(),
        statusCode: 200,
        method: 'POST',
        path: '/passenger/restart',
        ip: '127.0.0.1',
        responseTimeMs: 2840,
        type: 'access',
        message: 'SIGUSR2 signal sent to Passenger supervisor. Workers gracefully reloaded.',
      },
      ...prev,
    ]);
    return true;
  };

  const flushLiteSpeedCache = async (serviceId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 800));
    setServerLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        serviceId,
        timestamp: new Date().toLocaleTimeString(),
        statusCode: 200,
        method: 'POST',
        path: '/lscache/purge-all',
        ip: '127.0.0.1',
        responseTimeMs: 120,
        type: 'access',
        message: 'LiteSpeed Edge Cache purged successfully for all vhosts.',
      },
      ...prev,
    ]);
    return true;
  };

  const resetCpanelPassword = async (serviceId: string, newPassword: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1000));
    return true;
  };

  const triggerManualDeploy = async (serviceId: string): Promise<string[]> => {
    await new Promise((res) => setTimeout(res, 1400));
    const newCommit = Math.random().toString(16).substring(2, 9);
    const newRelease: ServiceRelease = {
      id: `rel_${Date.now()}`,
      commit: newCommit,
      message: 'manual: trigger instant git build from dashboard',
      timestamp: 'Just now',
      status: 'Active',
    };

    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        return {
          ...s,
          releases: [newRelease, ...s.releases.map((r) => ({ ...r, status: 'Success' as const }))],
        };
      })
    );

    const buildLogs = [
      `[00:00:01] Fetching latest commit origin/${activeService.gitBranch || 'main'}...`,
      `[00:00:02] Verified signature: ${newCommit}`,
      `[00:00:03] Executing in-place overwrite: rsync --archive --exclude=.git ./ /home/${activeService.cpanelUser}/public_html/`,
      `[00:00:04] Running npm ci --production (cached: 98% hit rate)...`,
      `[00:00:05] Touching tmp/restart.txt to signal Phusion Passenger...`,
      `[00:00:06] Reload complete! Next.js 15 app active with zero dropped requests (2.8s total).`,
    ];

    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        title: 'Git Build & Deploy Successful',
        desc: `Commit ${newCommit} deployed to ${activeService.domain} in 2.8s.`,
        time: 'Just now',
        type: 'git',
        read: false,
      },
      ...prev,
    ]);

    return buildLogs;
  };

  const rollbackRelease = (serviceId: string, releaseId: string) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        return {
          ...s,
          releases: s.releases.map((r) => (r.id === releaseId ? { ...r, status: 'Active' } : { ...r, status: 'Success' })),
        };
      })
    );
  };

  const updateServiceRuntime = (serviceId: string, runtime: string) => {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, nodeVersion: runtime } : s)));
  };

  const addEnvVariable = (serviceId: string, key: string, value: string) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const filtered = s.envVars.filter((e) => e.key !== key);
        return { ...s, envVars: [...filtered, { key, value }] };
      })
    );
  };

  const deleteEnvVariable = (serviceId: string, key: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, envVars: s.envVars.filter((e) => e.key !== key) } : s))
    );
  };

  const upgradeServicePlan = (serviceId: string, newPlanName: string, newPrice: number) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              planName: newPlanName,
              monthlyPriceBDT: newPrice,
              diskLimitGB: s.diskLimitGB * 2,
              inodeLimit: s.inodeLimit * 2,
              ramLimitMB: s.ramLimitMB * 2,
            }
          : s
      )
    );
  };

  const updateServiceSshKey = (serviceId: string, key: string) => {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, sshPublicKey: key } : s)));
  };

  // ---------------------------------------------------------------------------
  // DATABASES & USERS
  // ---------------------------------------------------------------------------

  const createDatabase = async (serviceId: string, dbName: string, dbUser: string, dbPass: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 800));
    const newDb: DatabaseItem = {
      id: `db_${Date.now()}`,
      serviceId,
      dbName,
      dbUser,
      dbHost: 'localhost',
      sizeMB: 0.1,
      collation: 'utf8mb4_unicode_ci',
    };
    setDatabases((prev) => [...prev, newDb]);
    return true;
  };

  const deleteDatabase = (dbId: string) => {
    setDatabases((prev) => prev.filter((d) => d.id !== dbId));
  };

  // ---------------------------------------------------------------------------
  // SUBDOMAINS, STAGING & AUTOSSL
  // ---------------------------------------------------------------------------

  const createSubdomain = async (serviceId: string, subdomain: string, documentRoot: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 900));
    const newSub: SubdomainItem = {
      id: `sub_${Date.now()}`,
      serviceId,
      subdomain,
      documentRoot,
      sslActive: true,
      forceHttps: true,
      isStaging: subdomain.startsWith('staging.'),
    };
    setSubdomains((prev) => [...prev, newSub]);
    return true;
  };

  const deleteSubdomain = (subdomainId: string) => {
    setSubdomains((prev) => prev.filter((s) => s.id !== subdomainId));
  };

  const cloneToStaging = async (serviceId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1800));
    const srv = services.find((s) => s.id === serviceId);
    if (!srv) return false;
    const stagingDomain = `staging.${srv.domain}`;
    if (!subdomains.some((sub) => sub.subdomain === stagingDomain)) {
      setSubdomains((prev) => [
        ...prev,
        {
          id: `sub_${Date.now()}`,
          serviceId,
          subdomain: stagingDomain,
          documentRoot: `/public_html/staging`,
          sslActive: true,
          forceHttps: true,
          isStaging: true,
        },
      ]);
    }
    return true;
  };

  const pushStagingToLive = async (serviceId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 2000));
    return true;
  };

  const toggleSubdomainForceHttps = (subdomainId: string) => {
    setSubdomains((prev) =>
      prev.map((s) => (s.id === subdomainId ? { ...s, forceHttps: !s.forceHttps } : s))
    );
  };

  const renewAutoSsl = async (subdomainId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1200));
    setSubdomains((prev) =>
      prev.map((s) => (s.id === subdomainId ? { ...s, sslActive: true } : s))
    );
    return true;
  };

  // ---------------------------------------------------------------------------
  // JETBACKUP RESTORES & SNAPSHOTS
  // ---------------------------------------------------------------------------

  const restoreBackup = async (backupId: string, restoreType: 'files' | 'db' | 'full'): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 2200));
    return true;
  };

  const generateManualSnapshot = async (serviceId: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1500));
    const newSnapshot: BackupSnapshot = {
      id: `bk_${Date.now()}`,
      serviceId,
      date: 'Just now (Manual Snapshot)',
      type: 'Full cPanel',
      sizeMB: 1840,
      destination: 'AWS S3 SG Vault',
      location: 'Singapore Equinix',
    };
    setBackups((prev) => [newSnapshot, ...prev]);
    return true;
  };

  // ---------------------------------------------------------------------------
  // CRON JOBS & LOGS
  // ---------------------------------------------------------------------------

  const createCronJob = (serviceId: string, schedule: string, command: string, description: string) => {
    const newJob: CronJobItem = {
      id: `cron_${Date.now()}`,
      serviceId,
      schedule,
      command,
      description: description || 'User scheduled task',
      status: 'Active',
    };
    setCronJobs((prev) => [...prev, newJob]);
  };

  const deleteCronJob = (jobId: string) => {
    setCronJobs((prev) => prev.filter((c) => c.id !== jobId));
  };

  const toggleCronJobStatus = (jobId: string) => {
    setCronJobs((prev) =>
      prev.map((c) => (c.id === jobId ? { ...c, status: c.status === 'Active' ? 'Paused' : 'Active' } : c))
    );
  };

  const clearServerLogs = (serviceId: string) => {
    setServerLogs((prev) => prev.filter((l) => l.serviceId !== serviceId));
  };

  // ---------------------------------------------------------------------------
  // DOMAIN MANAGEMENT
  // ---------------------------------------------------------------------------

  const toggleDomainLock = (domainId: string) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, registrarLock: !d.registrarLock } : d))
    );
  };

  const toggleDomainWhoisPrivacy = (domainId: string) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, whoisPrivacy: !d.whoisPrivacy } : d))
    );
  };

  const toggleDomainAutoRenew = (domainId: string) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, autoRenew: !d.autoRenew } : d))
    );
  };

  const bulkToggleAutoRenew = (domainIds: string[], enable: boolean) => {
    setDomains((prev) =>
      prev.map((d) => (domainIds.includes(d.id) ? { ...d, autoRenew: enable } : d))
    );
  };

  const bulkUpdateNameservers = (domainIds: string[], nameservers: string[]) => {
    setDomains((prev) =>
      prev.map((d) => (domainIds.includes(d.id) ? { ...d, nameservers } : d))
    );
  };

  const updateDomainNameservers = (domainId: string, nameservers: string[]) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, nameservers } : d))
    );
  };

  const addDnsRecord = (domainId: string, record: Omit<DnsRecord, 'id'>) => {
    const newRecord: DnsRecord = {
      ...record,
      id: `dns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, dnsRecords: [...d.dnsRecords, newRecord] } : d))
    );
  };

  const deleteDnsRecord = (domainId: string, recordId: string) => {
    setDomains((prev) =>
      prev.map((d) =>
        d.id === domainId ? { ...d, dnsRecords: d.dnsRecords.filter((r) => r.id !== recordId) } : d
      )
    );
  };

  const applyDnsPreset = (domainId: string, preset: 'google' | 'zoho' | 'github_vercel') => {
    const currentDomain = domains.find((d) => d.id === domainId);
    if (!currentDomain) return;

    let presetRecords: DnsRecord[] = [];
    if (preset === 'google') {
      presetRecords = [
        { id: `g_1_${Date.now()}`, type: 'MX', name: '@', content: 'aspmx.l.google.com', ttl: 3600, proxied: false, priority: 1 },
        { id: `g_2_${Date.now()}`, type: 'MX', name: '@', content: 'alt1.aspmx.l.google.com', ttl: 3600, proxied: false, priority: 5 },
        { id: `g_3_${Date.now()}`, type: 'MX', name: '@', content: 'alt2.aspmx.l.google.com', ttl: 3600, proxied: false, priority: 5 },
        { id: `g_4_${Date.now()}`, type: 'TXT', name: '@', content: 'v=spf1 include:_spf.google.com ~all', ttl: 3600, proxied: false },
      ];
    } else if (preset === 'zoho') {
      presetRecords = [
        { id: `z_1_${Date.now()}`, type: 'MX', name: '@', content: 'mx.zoho.com', ttl: 3600, proxied: false, priority: 10 },
        { id: `z_2_${Date.now()}`, type: 'MX', name: '@', content: 'mx2.zoho.com', ttl: 3600, proxied: false, priority: 20 },
        { id: `z_3_${Date.now()}`, type: 'TXT', name: '@', content: 'v=spf1 include:zoho.com ~all', ttl: 3600, proxied: false },
      ];
    } else if (preset === 'github_vercel') {
      presetRecords = [
        { id: `gv_1_${Date.now()}`, type: 'A', name: '@', content: '76.76.21.21', ttl: 300, proxied: false },
        { id: `gv_2_${Date.now()}`, type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', ttl: 300, proxied: false },
      ];
    }

    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, dnsRecords: [...d.dnsRecords, ...presetRecords] } : d))
    );
  };

  const createChildNameserver = (domainId: string, hostname: string, ipAddress: string) => {
    const newCns: ChildNameserver = {
      id: `cns_${Date.now()}`,
      domainId,
      hostname,
      ipAddress,
    };
    setChildNameservers((prev) => [...prev, newCns]);
  };

  const deleteChildNameserver = (id: string) => {
    setChildNameservers((prev) => prev.filter((c) => c.id !== id));
  };

  const createDomainRedirect = (domainId: string, sourcePath: string, targetUrl: string, type: '301' | '302') => {
    const newRed: DomainRedirect = {
      id: `red_${Date.now()}`,
      domainId,
      sourcePath,
      targetUrl,
      type,
    };
    setDomainRedirects((prev) => [...prev, newRed]);
  };

  const deleteDomainRedirect = (id: string) => {
    setDomainRedirects((prev) => prev.filter((r) => r.id !== id));
  };

  const initiateDomainTransfer = async (domain: string, eppCode: string): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 1200));
    const newTransfer: DomainTransferRequest = {
      id: `tr_${Date.now()}`,
      domain,
      eppCode,
      currentStep: 1, // EPP Verified
      status: 'Processing',
      requestDate: new Date().toISOString().split('T')[0],
    };
    setDomainTransfers((prev) => [newTransfer, ...prev]);

    // Also add to domains list as pending
    setDomains((prev) => [
      ...prev,
      {
        id: `dom_${Date.now()}`,
        domain,
        expiryDate: 'Pending Transfer (+1 Yr)',
        daysRemaining: 365,
        status: 'Active',
        registrarLock: true,
        whoisPrivacy: true,
        autoRenew: true,
        nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
        eppCode,
        dnsRecords: [{ id: `dns_init_${Date.now()}`, type: 'A', name: '@', content: '103.145.22.40', ttl: 300, proxied: true }],
      },
    ]);

    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        title: 'Domain Transfer In Initiated',
        desc: `Transfer for ${domain} started with verified EPP code. 1-year free extension pending registry ack.`,
        time: 'Just now',
        type: 'domain',
        read: false,
      },
      ...prev,
    ]);

    return true;
  };

  // ---------------------------------------------------------------------------
  // BILLING & WALLET
  // ---------------------------------------------------------------------------

  const topUpWallet = (amount: number, method: string, trxId?: string) => {
    const newBalance = walletBalanceBDT + amount;
    setWalletBalanceBDT(newBalance);
    const newTx: WalletTransaction = {
      id: `wtx_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'Top-Up',
      amount,
      method: `${method} (${trxId || 'Instant'})`,
      balanceAfter: newBalance,
    };
    setWalletTransactions((prev) => [newTx, ...prev]);
  };

  const payInvoice = (invoiceId: string): boolean => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.status === 'Paid') return false;

    if (walletBalanceBDT < inv.amount) {
      alert(`Insufficient prepaid cloud wallet balance (৳${walletBalanceBDT}). Please top up via bKash or Nagad first.`);
      return false;
    }

    const newBalance = walletBalanceBDT - inv.amount;
    setWalletBalanceBDT(newBalance);
    setInvoices((prev) =>
      prev.map((i) => (i.id === invoiceId ? { ...i, status: 'Paid', paymentMethod: 'Prepaid Wallet', trxID: `WLT_${Date.now()}` } : i))
    );

    setWalletTransactions((prev) => [
      {
        id: `wtx_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'Debit',
        amount: inv.amount,
        method: `Payment for Invoice ${invoiceId}`,
        balanceAfter: newBalance,
      },
      ...prev,
    ]);

    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        title: 'Invoice Paid from Wallet',
        desc: `Invoice ${invoiceId} for ৳${inv.amount} paid instantly. Balance: ৳${newBalance}.`,
        time: 'Just now',
        type: 'billing',
        read: false,
      },
      ...prev,
    ]);

    return true;
  };

  // ---------------------------------------------------------------------------
  // SUPPORT & AFFILIATE
  // ---------------------------------------------------------------------------

  const createSupportTicket = (ticket: {
    subject: string;
    department: string;
    priority: 'Normal' | 'High' | 'Critical — Production Site Down';
    relatedService: string;
    message: string;
  }) => {
    const newTkt: SupportTicket = {
      id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: ticket.subject,
      department: ticket.department,
      priority: ticket.priority,
      status: 'Open',
      relatedService: ticket.relatedService,
      lastUpdated: 'Just now',
      messages: [
        {
          id: `msg_${Date.now()}`,
          sender: 'client',
          senderName: currentUser.name,
          timestamp: 'Just now',
          message: ticket.message,
        },
      ],
    };
    setTickets((prev) => [newTkt, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        title: 'Support Ticket Created',
        desc: `Ticket #${newTkt.id} submitted to ${ticket.department}. Priority: ${ticket.priority}.`,
        time: 'Just now',
        type: 'support',
        read: false,
      },
      ...prev,
    ]);
  };

  const replyToTicket = (ticketId: string, message: string, sender: 'client' | 'support' = 'client') => {
    const newMsg: TicketMessage = {
      id: `msg_${Date.now()}`,
      sender,
      senderName: sender === 'client' ? currentUser.name : 'Siam (Senior Cloud Engineer)',
      timestamp: 'Just now',
      message,
    };

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        return {
          ...t,
          status: sender === 'client' ? 'Open' : 'Answered',
          lastUpdated: 'Just now',
          messages: [...t.messages, newMsg],
        };
      })
    );

    if (sender === 'support') {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          title: `Reply to Ticket #${ticketId}`,
          desc: message.slice(0, 75) + '...',
          time: 'Just now',
          type: 'support',
          read: false,
        },
        ...prev,
      ]);
    }
  };

  const resolveTicket = (ticketId: string) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: 'Resolved', lastUpdated: 'Just now' } : t)));
  };

  const requestAffiliatePayout = (amount: number, method: string, accountNumber: string): boolean => {
    if (amount > affiliate.availableBalanceBDT) return false;
    const newPayout: AffiliatePayout = {
      id: `PAY-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split('T')[0],
      amount,
      method,
      accountNumber,
      status: 'Pending',
      trxId: 'PENDING_ADMIN_APPROVAL',
    };
    setAffiliate((prev) => ({
      ...prev,
      availableBalanceBDT: prev.availableBalanceBDT - amount,
      payouts: [newPayout, ...prev.payouts],
    }));
    return true;
  };

  const approveAffiliatePayout = (payoutId: string) => {
    setAffiliate((prev) => ({
      ...prev,
      payouts: prev.payouts.map((p) =>
        p.id === payoutId ? { ...p, status: 'Completed', trxId: `BK_${Math.random().toString(36).substring(2, 9).toUpperCase()}` } : p
      ),
    }));
  };

  const clawbackCommission = (commissionId: string) => {
    setAffiliate((prev) => {
      const comm = prev.commissions.find((c) => c.id === commissionId);
      if (!comm || comm.status === 'clawed_back_refunded') return prev;
      return {
        ...prev,
        pendingClearanceBDT: comm.status === 'pending_35d_hold' ? Math.max(0, prev.pendingClearanceBDT - comm.commissionBDT) : prev.pendingClearanceBDT,
        availableBalanceBDT: comm.status === 'cleared_available' ? Math.max(0, prev.availableBalanceBDT - comm.commissionBDT) : prev.availableBalanceBDT,
        commissions: prev.commissions.map((c) => (c.id === commissionId ? { ...c, status: 'clawed_back_refunded', daysLeftToMature: 0 } : c)),
      };
    });
  };

  const toggleEmergencyLockdown = (enabled: boolean) => {
    setEmergencyLockdown(enabled);
  };

  const dismissFraudAlert = (alertId: string) => {
    setFraudAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'dismissed' } : a)));
  };

  const blockIpPermanently = (ip: string) => {
    setFraudAlerts((prev) =>
      prev.map((a) => (a.ipAddress === ip ? { ...a, status: 'blocked', details: a.details + ' [IP PERMANENTLY BLOCKED]' } : a))
    );
  };

  const freezeAffiliate = (userId: string, reason: string) => {
    setAffiliate((prev) => ({
      ...prev,
      commissionTier: 'FROZEN FOR FRAUD INVESTIGATION',
    }));
    alert(`Affiliate ${userId} has been frozen. Reason: ${reason}`);
  };

  // ---------------------------------------------------------------------------
  // SECURITY & TEAM
  // ---------------------------------------------------------------------------

  const inviteTeamMember = (name: string, email: string, role: TeamMember['role']) => {
    const newMember: TeamMember = {
      id: `tm_${Date.now()}`,
      name,
      email,
      role,
      addedDate: new Date().toISOString().split('T')[0],
      status: 'Invited',
    };
    setTeamMembers((prev) => [...prev, newMember]);
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const generateApiToken = (name: string, permissions: string): string => {
    const token = `dhc_live_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
    const newToken: ApiToken = {
      id: `tok_${Date.now()}`,
      name,
      prefix: token.substring(0, 14) + '...',
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      permissions,
    };
    setApiTokens((prev) => [newToken, ...prev]);
    return token;
  };

  const revokeApiToken = (id: string) => {
    setApiTokens((prev) => prev.filter((t) => t.id !== id));
  };

  const revokeSession = (id: string) => {
    setLoginSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const revokeAllOtherSessions = () => {
    setLoginSessions((prev) => prev.filter((s) => s.current));
  };

  // ---------------------------------------------------------------------------
  // DYNAMIC PRICING ENGINE
  // ---------------------------------------------------------------------------

  const updateHostingPlan = (id: string, updates: Partial<DynamicHostingPlan>) => {
    setDynamicPlans((prev) =>
      prev.map((p) => {
        if (p.id === id || p.slug === id) {
          const updated = { ...p, ...updates };
          const netPool = Math.max(0, updated.priceMonthlyBDT - (updated.unitServerCostBDT + updated.minOwnerProfitBDT));
          updated.maxAffiliatePoolBDT = netPool;
          return updated;
        }
        return p;
      })
    );

    // Sync to Supabase via Edge API
    const target = dynamicPlans.find((p) => p.id === id || p.slug === id);
    if (target) {
      const merged = { ...target, ...updates };
      fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'plan',
          data: {
            slug: merged.slug || merged.id,
            selling_price_monthly_bdt: merged.priceMonthlyBDT,
            unit_server_cost_bdt: merged.unitServerCostBDT,
            min_owner_profit_bdt: merged.minOwnerProfitBDT,
            storage_gb: merged.storageGB,
            ram_mb: merged.ramGB * 1024,
            cpu_cores: merged.cpuCores,
          },
        }),
      }).catch((err) => console.error('[PortalContext] Failed to persist plan to backend:', err));
    }
  };

  const updateTldPricing = (tld: string, updates: Partial<DynamicTldPricing>) => {
    setDynamicTlds((prev) =>
      prev.map((t) => {
        if (t.tld === tld) {
          const updated = { ...t, ...updates };
          updated.ownerNetProfitRegBDT = Math.max(0, updated.registerBDT - updated.registrarCostBDT);
          return updated;
        }
        return t;
      })
    );

    // Sync to Supabase via Edge API
    const target = dynamicTlds.find((t) => t.tld === tld);
    if (target) {
      const merged = { ...target, ...updates };
      fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'tld',
          data: {
            tld: merged.tld,
            registrar_cost_bdt: merged.registrarCostBDT,
            reg_price_bdt: merged.registerBDT,
            renew_price_bdt: merged.renewalBDT,
            transfer_price_bdt: merged.transferBDT,
            affiliate_eligible: merged.affiliateEligible ?? false,
          },
        }),
      }).catch((err) => console.error('[PortalContext] Failed to persist TLD to backend:', err));
    }
  };

  // ---------------------------------------------------------------------------
  // FOUNDER / ADMIN COMMAND CENTER
  // ---------------------------------------------------------------------------

  const updateDunningRules = (rules: Partial<DunningRules>) => {
    setDunningRules((prev) => ({ ...prev, ...rules }));
  };

  const runAutomationCronManually = async (): Promise<string[]> => {
    await new Promise((res) => setTimeout(res, 1800));
    return [
      `[${new Date().toLocaleTimeString()}] Initializing DevHost WHMCS/WHM Dunning Engine...`,
      `[${new Date().toLocaleTimeString()}] Connecting to WHM Node SG1 (103.145.22.40) & US East...`,
      `[${new Date().toLocaleTimeString()}] Checking ${customers.length * 16} active cPanel and VPS accounts...`,
      `[${new Date().toLocaleTimeString()}] Rule (7 Days): 2 renewal invoices generated for upcoming billing cycle.`,
      `[${new Date().toLocaleTimeString()}] Rule (3 Days): Checked overdue invoices. 0 accounts suspended (all accounts in good standing).`,
      `[${new Date().toLocaleTimeString()}] Rule (14 Days): Zero terminations required.`,
      `[${new Date().toLocaleTimeString()}] JetBackup Cloud Snapshot Sync verified with AWS S3 Vault.`,
      `[${new Date().toLocaleTimeString()}] System Cron execution completed successfully in 2.84s (0 errors).`,
    ];
  };

  const createCustomInvoice = (customerId: string, clientName: string, items: InvoiceItem[], dueDate: string) => {
    const totalAmount = items.reduce((acc, it) => acc + it.amount, 0);
    const newInvId = `INV-2026-${Math.floor(9000 + Math.random() * 1000)}`;
    const newInv: Invoice = {
      id: newInvId,
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      amount: totalAmount,
      status: 'Unpaid',
      paymentMethod: 'bKash / Nagad / Wallet',
      trxID: 'UNPAID',
      plan: items[0]?.desc || 'Custom Web Development & Cloud Services',
      items,
    };
    setInvoices((prev) => [newInv, ...prev]);

    setOrdersLedger((prev) => [
      {
        id: `LED-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceId: newInvId,
        customerName: clientName,
        gateway: 'bKash',
        trxID: 'PENDING_PAYMENT',
        amountBDT: totalAmount,
        provisionStatus: 'Pending Approval',
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);

    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        title: 'Custom Invoice Issued',
        desc: `Invoice ${newInvId} for ৳${totalAmount} generated for ${clientName}. Due date: ${newInv.dueDate}.`,
        time: 'Just now',
        type: 'billing',
        read: false,
      },
      ...prev,
    ]);
  };

  const toggleCustomerServiceStatus = (customerId: string, serviceId?: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, status: c.status === 'Active' ? 'Suspended' : 'Active' } : c))
    );
    if (serviceId) {
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, status: s.status === 'Active' ? 'Suspended' : 'Active' } : s))
      );
    }
  };

  const modifyCustomerQuota = (customerId: string, diskGB: number, ramMB: number, inodes: number) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust || !cust.primaryServiceId) return;
    setServices((prev) =>
      prev.map((s) =>
        s.id === cust.primaryServiceId
          ? {
              ...s,
              diskLimitGB: diskGB,
              ramLimitMB: ramMB,
              inodeLimit: inodes,
            }
          : s
      )
    );
  };

  const addCustomerCredit = (customerId: string, amount: number) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, walletBalanceBDT: c.walletBalanceBDT + amount } : c))
    );
    if (customerId === 'cust_1') {
      setWalletBalanceBDT((prev) => prev + amount);
    }
  };

  const createAdminCustomerAndService = (customerData: Partial<AdminCustomer>, planId: string, domainName: string) => {
    const newCustId = `cust_${Date.now()}`;
    const newServiceId = `srv_${Date.now()}`;
    const selectedPlan = dynamicPlans.find((p) => p.id === planId) || dynamicPlans[1];

    const newCustomer: AdminCustomer = {
      id: newCustId,
      name: customerData.name || 'New Client',
      email: customerData.email || 'client@example.com',
      phone: customerData.phone || '+8801700000000',
      company: customerData.company || 'Enterprise LLC',
      servicesCount: 1,
      totalSpendBDT: selectedPlan.priceMonthlyBDT,
      walletBalanceBDT: customerData.walletBalanceBDT || 0,
      status: 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
      primaryServiceId: newServiceId,
    };

    const newService: CloudService = {
      id: newServiceId,
      domain: domainName || 'new-client-site.com',
      planName: selectedPlan.name,
      status: 'Active',
      datacenter: 'Singapore SG1 (Equinix)',
      ipAddress: '103.145.22.45',
      cpanelUser: `usr_${Math.random().toString(36).substring(2, 8)}`,
      diskUsedGB: 0.1,
      diskLimitGB: selectedPlan.storageGB,
      inodesUsed: 2100,
      inodeLimit: selectedPlan.inodes,
      ramUsedMB: 256,
      ramLimitMB: selectedPlan.ramGB * 1024,
      cpuCores: selectedPlan.cpuCores,
      ioLimitMB: 50,
      nodeVersion: 'Node.js 22 LTS',
      gitRepoUrl: `github.com/${(customerData.name || 'client').toLowerCase().replace(/\s+/g, '')}/repo`,
      gitBranch: 'main',
      webhookUrl: `https://api.devhostcloud.com/webhooks/deploy/wh_${Math.random().toString(36).substring(2, 10)}`,
      autoRenew: true,
      nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      monthlyPriceBDT: selectedPlan.priceMonthlyBDT,
      envVars: [{ key: 'NODE_ENV', value: 'production' }],
      releases: [{ id: `rel_${Date.now()}`, commit: 'init123', message: 'Initial provisioning release', timestamp: 'Just now', status: 'Active' }],
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    setServices((prev) => [newService, ...prev]);

    setOrdersLedger((prev) => [
      {
        id: `LED-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceId: `INV-2026-${Math.floor(9000 + Math.random() * 1000)}`,
        customerName: newCustomer.name,
        gateway: 'bKash',
        trxID: `MANUAL_PROVISION_${Date.now()}`,
        amountBDT: selectedPlan.priceMonthlyBDT,
        provisionStatus: 'Auto-Provisioned',
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);
  };

  const createServerNode = (nodeData: Omit<ServerNode, 'id'>) => {
    const newNode: ServerNode = {
      ...nodeData,
      id: `node_${Date.now()}`,
    };
    setServerNodes((prev) => [...prev, newNode]);
  };

  const approveLedgerOrder = (orderId: string) => {
    setOrdersLedger((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, provisionStatus: 'Auto-Provisioned' } : o))
    );
  };

  const refundLedgerOrder = (orderId: string) => {
    setOrdersLedger((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, provisionStatus: 'Refunded' } : o))
    );
    const order = ordersLedger.find((o) => o.id === orderId);
    if (order) {
      setAffiliate((prev) => {
        const comm = prev.commissions.find((c) => c.invoiceId === order.invoiceId);
        if (!comm || comm.status === 'clawed_back_refunded') return prev;
        return {
          ...prev,
          pendingClearanceBDT: comm.status === 'pending_35d_hold' ? Math.max(0, prev.pendingClearanceBDT - comm.commissionBDT) : prev.pendingClearanceBDT,
          availableBalanceBDT: comm.status === 'cleared_available' ? Math.max(0, prev.availableBalanceBDT - comm.commissionBDT) : prev.availableBalanceBDT,
          commissions: prev.commissions.map((c) => (c.id === comm.id ? { ...c, status: 'clawed_back_refunded', daysLeftToMature: 0 } : c)),
        };
      });
    }
  };

  const updateMigrationStatus = (migrationId: string, step: 1 | 2 | 3 | 4, notes?: string) => {
    setMigrationQueue((prev) =>
      prev.map((m) =>
        m.id === migrationId
          ? {
              ...m,
              currentStep: step,
              notes: notes !== undefined ? notes : m.notes,
            }
          : m
      )
    );
  };

  const createAdminPromo = (code: string, discount: number, maxUses: number, expiry: string) => {
    const newPromo: PromoCode = {
      code: code.toUpperCase().trim(),
      discountPercent: discount,
      usesCount: 0,
      maxUses,
      expiryDate: expiry,
      status: 'Active',
    };
    setPromoCodes((prev) => [newPromo, ...prev]);
  };

  const deleteAdminPromo = (code: string) => {
    setPromoCodes((prev) => prev.filter((p) => p.code !== code));
  };

  const exportAccountingCsv = () => {
    const headers = ['Order ID', 'Invoice ID', 'Customer Name', 'Gateway', 'Transaction ID', 'Amount (BDT)', 'Provision Status', 'Timestamp'];
    const rows = ordersLedger.map((o) => [
      o.id,
      o.invoiceId,
      `"${o.customerName}"`,
      o.gateway,
      o.trxID,
      o.amountBDT,
      o.provisionStatus,
      `"${o.timestamp}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DevHost_Accounting_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------------------------------------------------------------------------
  // END-TO-END INSTANT PROVISIONING ENGINE
  // ---------------------------------------------------------------------------

  const provisionNewOrder = async (order: {
    planId: string;
    planName: string;
    domain: string;
    region: 'sg' | 'us';
    appStack: string;
    paymentMethod: 'bKash' | 'Nagad' | 'Wallet' | 'Stripe';
    trxId: string;
    billingCycle: 'monthly' | 'annually';
    priceBDT: number;
  }): Promise<string> => {
    // 1. Deduct wallet if wallet selected
    if (order.paymentMethod === 'Wallet') {
      setWalletBalanceBDT((prev) => Math.max(0, prev - order.priceBDT));
      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: 'Debit',
          amount: order.priceBDT,
          method: `Provision ${order.planName} (${order.domain})`,
          balanceAfter: Math.max(0, walletBalanceBDT - order.priceBDT),
        },
        ...prev,
      ]);
    }

    // 2. Generate new CloudService
    const newServiceId = `srv_${Date.now()}`;
    const dynamicPlan = dynamicPlans.find((p) => p.id === order.planId) || dynamicPlans[1];
    const isSg = order.region === 'sg';

    const newService: CloudService = {
      id: newServiceId,
      domain: order.domain,
      planName: order.planName || dynamicPlan.name,
      status: 'Active',
      datacenter: isSg ? 'Singapore SG1 (Equinix)' : 'USA East (Ashburn, VA)',
      ipAddress: isSg ? '103.145.22.48' : '198.51.100.22',
      cpanelUser: `usr_${Math.random().toString(36).substring(2, 8)}`,
      diskUsedGB: 0.2,
      diskLimitGB: dynamicPlan.storageGB,
      inodesUsed: 2800,
      inodeLimit: dynamicPlan.inodes,
      ramUsedMB: 340,
      ramLimitMB: dynamicPlan.ramGB * 1024,
      cpuCores: dynamicPlan.cpuCores,
      ioLimitMB: 50,
      nodeVersion: order.appStack.includes('nextjs') ? 'Node.js 22 LTS' : 'PHP 8.3 / Node.js 20',
      gitRepoUrl: `github.com/developer/${order.domain.replace(/\.[a-z]+$/, '')}`,
      gitBranch: 'main',
      webhookUrl: `https://api.devhostcloud.com/webhooks/deploy/wh_${Math.random().toString(36).substring(2, 12)}`,
      autoRenew: true,
      nextDueDate: order.billingCycle === 'annually'
        ? new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      monthlyPriceBDT: order.priceBDT,
      envVars: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'PORT', value: '3000' },
        { key: 'APP_NAME', value: order.domain },
      ],
      releases: [
        {
          id: `rel_${Date.now()}`,
          commit: 'init101',
          message: `Auto-provisioned container for ${order.domain} via ${order.paymentMethod}`,
          timestamp: 'Just now',
          status: 'Active',
        },
      ],
      sshPublicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOmX8b1QJ4R7T9k2M0z8y3W6u1P5n4L7s8E9v0a1B2C3 user@devhost-new',
    };

    setServices((prev) => [newService, ...prev]);
    setActiveServiceId(newServiceId);

    // 3. Add Domain if not exists
    if (!domains.some((d) => d.domain.toLowerCase() === order.domain.toLowerCase())) {
      setDomains((prev) => [
        {
          id: `dom_${Date.now()}`,
          domain: order.domain,
          expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
          daysRemaining: 365,
          status: 'Active',
          registrarLock: true,
          whoisPrivacy: true,
          autoRenew: true,
          nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
          eppCode: `EPP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          dnsRecords: [
            { id: `dns_1_${Date.now()}`, type: 'A', name: '@', content: newService.ipAddress, ttl: 300, proxied: true },
            { id: `dns_2_${Date.now()}`, type: 'CNAME', name: 'www', content: order.domain, ttl: 300, proxied: true },
          ],
        },
        ...prev,
      ]);
    }

    // 4. Create Paid Invoice
    const invId = `INV-2026-${Math.floor(9000 + Math.random() * 1000)}`;
    const newInvoice: Invoice = {
      id: invId,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      amount: order.priceBDT,
      status: 'Paid',
      paymentMethod: order.paymentMethod,
      trxID: order.trxId,
      plan: `${order.planName} (${order.billingCycle})`,
      items: [
        {
          desc: `${order.planName} Container on ${isSg ? 'Equinix SG1' : 'Ashburn VA'} (${order.domain})`,
          amount: order.priceBDT,
        },
      ],
    };
    setInvoices((prev) => [newInvoice, ...prev]);

    // 5. Add to Ledger
    setOrdersLedger((prev) => [
      {
        id: `LED-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceId: invId,
        customerName: currentUser.name,
        gateway: order.paymentMethod,
        trxID: order.trxId,
        amountBDT: order.priceBDT,
        provisionStatus: 'Auto-Provisioned',
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);

    // 6. Notify
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        title: 'Cloud Container Auto-Provisioned!',
        desc: `${order.planName} for ${order.domain} deployed to ${isSg ? 'Equinix SG1' : 'Ashburn VA'} with AutoSSL.`,
        time: 'Just now',
        type: 'git',
        read: false,
      },
      ...prev,
    ]);

    return newServiceId;
  };

  return (
    <PortalContext.Provider
      value={{
        currentUser,
        activeRole,
        switchRole,
        impersonateCustomer,

        notifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,

        systemBroadcast,
        updateSystemBroadcast,
        dismissBroadcast,

        services,
        activeService,
        setActiveServiceId,
        cleanServiceCache,
        restartPassengerWorkers,
        flushLiteSpeedCache,
        resetCpanelPassword,
        triggerManualDeploy,
        rollbackRelease,
        updateServiceRuntime,
        addEnvVariable,
        deleteEnvVariable,
        upgradeServicePlan,
        updateServiceSshKey,

        databases,
        createDatabase,
        deleteDatabase,

        subdomains,
        createSubdomain,
        deleteSubdomain,
        cloneToStaging,
        pushStagingToLive,
        toggleSubdomainForceHttps,
        renewAutoSsl,

        backups,
        restoreBackup,
        generateManualSnapshot,

        cronJobs,
        createCronJob,
        deleteCronJob,
        toggleCronJobStatus,
        serverLogs,
        clearServerLogs,

        domains,
        toggleDomainLock,
        toggleDomainWhoisPrivacy,
        toggleDomainAutoRenew,
        bulkToggleAutoRenew,
        bulkUpdateNameservers,
        updateDomainNameservers,
        addDnsRecord,
        deleteDnsRecord,
        applyDnsPreset,

        childNameservers,
        createChildNameserver,
        deleteChildNameserver,
        domainRedirects,
        createDomainRedirect,
        deleteDomainRedirect,

        domainTransfers,
        initiateDomainTransfer,

        walletBalanceBDT,
        walletTransactions,
        invoices,
        topUpWallet,
        payInvoice,

        tickets,
        createSupportTicket,
        replyToTicket,
        resolveTicket,

        affiliate,
        requestAffiliatePayout,
        approveAffiliatePayout,
        clawbackCommission,

        fraudAlerts,
        auditLogs,
        emergencyLockdown,
        toggleEmergencyLockdown,
        dismissFraudAlert,
        blockIpPermanently,
        freezeAffiliate,

        teamMembers,
        inviteTeamMember,
        removeTeamMember,
        apiTokens,
        generateApiToken,
        revokeApiToken,
        loginSessions,
        revokeSession,
        revokeAllOtherSessions,

        dynamicPlans,
        updateHostingPlan,
        dynamicTlds,
        updateTldPricing,

        customers,
        serverNodes,
        ordersLedger,
        migrationQueue,
        promoCodes,
        dunningRules,
        updateDunningRules,
        runAutomationCronManually,
        createCustomInvoice,
        toggleCustomerServiceStatus,
        modifyCustomerQuota,
        addCustomerCredit,
        createAdminCustomerAndService,
        createServerNode,
        approveLedgerOrder,
        refundLedgerOrder,
        updateMigrationStatus,
        createAdminPromo,
        deleteAdminPromo,
        exportAccountingCsv,

        provisionNewOrder,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}
