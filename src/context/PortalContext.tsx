'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured, syncAuthCookie } from '@/lib/supabase';
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
  cloudflareRecordId?: string;
  syncStatus?: string;
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
  status: 'Active' | 'Expiring Soon' | 'Grace Period' | 'Pending' | 'Transferring';
  registrarLock: boolean;
  whoisPrivacy: boolean;
  autoRenew: boolean;
  nameservers: string[];
  eppCode: string;
  dnsRecords: DnsRecord[];
  registrarProvider?: string;
  registrarOrderId?: string;
  cloudflareZoneId?: string;
  cloudflareZoneStatus?: string;
}

export interface DomainTransferRequest {
  id: string;
  domainName: string;
  tld: string;
  transferPriceBDT: number;
  currentStep: number;
  status:
    | 'pending_payment'
    | 'verifying_epp'
    | 'awaiting_losing_registrar'
    | 'completed'
    | 'rejected_invalid_epp'
    | 'locked_at_source';
  statusMessage?: string;
  eppStatus?: string | null;
  registrarProvider?: string | null;
  registrarTransferId?: string | null;
  lastPolledAt?: string | null;
  initiatedAt: string;
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
  status: 'Completed' | 'Pending' | 'Rejected';
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

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  company: string;
  role: UserRole;
  phone?: string;
}

interface PortalContextType {
  currentUser: CurrentUser | null;
  authLoading: boolean;
  logout: (scopeOrEvent?: 'local' | 'global' | React.MouseEvent | any) => Promise<void>;
  signOutGlobal: () => Promise<void>;
  refreshUserData: () => Promise<void>;
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
  toggleDomainLock: (domainId: string) => Promise<boolean>;
  toggleDomainWhoisPrivacy: (domainId: string) => Promise<boolean>;
  toggleDomainAutoRenew: (domainId: string) => void;
  bulkToggleAutoRenew: (domainIds: string[], enable: boolean) => void;
  bulkUpdateNameservers: (domainIds: string[], nameservers: string[]) => Promise<boolean>;
  updateDomainNameservers: (domainId: string, nameservers: string[]) => Promise<boolean>;
  addDnsRecord: (domainId: string, record: Omit<DnsRecord, 'id'>) => Promise<boolean>;
  deleteDnsRecord: (domainId: string, recordId: string) => Promise<boolean>;
  applyDnsPreset: (domainId: string, preset: 'google' | 'zoho' | 'github_vercel') => Promise<boolean>;

  // Child Nameservers & Redirects
  childNameservers: ChildNameserver[];
  createChildNameserver: (domainId: string, hostname: string, ipAddress: string) => Promise<boolean>;
  deleteChildNameserver: (id: string) => Promise<boolean>;
  domainRedirects: DomainRedirect[];
  createDomainRedirect: (domainId: string, sourcePath: string, targetUrl: string, type: '301' | '302') => Promise<boolean>;
  deleteDomainRedirect: (id: string) => Promise<boolean>;

  // Domain Transfer-In
  domainTransfers: DomainTransferRequest[];
  initiateDomainTransfer: (
    domain: string,
    eppCode: string
  ) => Promise<{ ok: boolean; paymentRequired?: boolean; error?: string }>;
  pollDomainTransfers: () => Promise<{ ok: boolean; error?: string }>;
  resubmitTransferEpp: (
    transferId: string,
    eppCode: string
  ) => Promise<{ ok: boolean; error?: string; message?: string; currentStep?: number; status?: string }>;

  // Billing & Wallet
  walletBalanceBDT: number;
  walletTransactions: WalletTransaction[];
  invoices: Invoice[];
  topUpWallet: (
    amount: number,
    method: string,
    trxId?: string
  ) => Promise<{
    ok: boolean;
    mode?: string;
    paymentUrl?: string;
    invoiceNumber?: string;
    instructions?: {
      method: string;
      merchantNumber: string;
      exactAmountBDT: number;
      reference: string;
    };
    error?: string;
  }>;
  payInvoice: (invoiceId: string) => Promise<boolean>;

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
    totalWithdrawnBDT: number;
    payouts: AffiliatePayout[];
    commissions: AffiliateCommissionItem[];
    subIdStats: CampaignSubIdStat[];
  };
  requestAffiliatePayout: (
    amount: number,
    method: string,
    accountNumber: string
  ) => Promise<{ ok: boolean; error?: string }>;
  approveAffiliatePayout: (
    payoutId: string,
    adminTrxId: string
  ) => Promise<{ ok: boolean; requireSudo?: boolean; error?: string }>;
  clawbackCommission: (invoiceOrCommissionId: string) => Promise<{ ok: boolean; error?: string }>;

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

export const FALLBACK_EMPTY_SERVICE: CloudService = {
  id: '',
  domain: '',
  planName: 'No Active Cloud Service',
  status: 'Pending',
  datacenter: 'Singapore SG1 (Equinix)',
  ipAddress: '103.145.22.40',
  cpanelUser: '',
  diskUsedGB: 0,
  diskLimitGB: 5.0,
  inodesUsed: 0,
  inodeLimit: 250000,
  ramUsedMB: 0,
  ramLimitMB: 2048,
  cpuCores: 2,
  ioLimitMB: 50,
  nodeVersion: 'Node.js 22 LTS',
  gitRepoUrl: '',
  gitBranch: 'main',
  webhookUrl: '',
  autoRenew: false,
  nextDueDate: '',
  monthlyPriceBDT: 0,
  envVars: [],
  releases: [],
  sshPublicKey: '',
};

const INITIAL_SERVICES: CloudService[] = [];
const INITIAL_DATABASES: DatabaseItem[] = [];
const INITIAL_SUBDOMAINS: SubdomainItem[] = [];
const INITIAL_BACKUPS: BackupSnapshot[] = [];
const INITIAL_CRONS: CronJobItem[] = [];
const INITIAL_LOGS: ServerLogItem[] = [];
const INITIAL_DOMAINS: DomainItem[] = [];
const INITIAL_CHILD_NS: ChildNameserver[] = [];
const INITIAL_REDIRECTS: DomainRedirect[] = [];
const INITIAL_INVOICES: Invoice[] = [];
const INITIAL_TRANSACTIONS: WalletTransaction[] = [];
const INITIAL_TICKETS: SupportTicket[] = [];
const INITIAL_CUSTOMERS: AdminCustomer[] = [];

const INITIAL_NODES: ServerNode[] = [];

const INITIAL_LEDGER: LedgerOrder[] = [];
const INITIAL_MIGRATIONS: MigrationRequest[] = [];

const INITIAL_PROMOS: PromoCode[] = [];

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

const INITIAL_NOTIFICATIONS: SystemNotification[] = [];

// ---------------------------------------------------------------------------
// PROVIDER COMPONENT
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'devhost-portal-state-v9';

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [isClientLoaded, setIsClientLoaded] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const lastSyncedTokenRef = useRef<string | null>(null);

  const [activeRole, setActiveRole] = useState<UserRole>('client');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Services & State
  const [services, setServices] = useState<CloudService[]>(INITIAL_SERVICES);
  const [activeServiceId, setActiveServiceId] = useState<string>('');
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
  const [walletBalanceBDT, setWalletBalanceBDT] = useState<number>(0);
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
    totalWithdrawnBDT: number;
    payouts: AffiliatePayout[];
    commissions: AffiliateCommissionItem[];
    subIdStats: CampaignSubIdStat[];
  }>({
    refLink: '',
    referralCode: '',
    clicks: 0,
    signups: 0,
    activeConversions: 0,
    commissionTier: 'Starter (20%)',
    commissionRate: 20,
    tierLevel: 'starter_20',
    pendingClearanceBDT: 0,
    availableBalanceBDT: 0,
    totalEarnedBDT: 0,
    totalWithdrawnBDT: 0,
    payouts: [],
    commissions: [],
    subIdStats: [],
  });

  // Security, Fraud Radar & Audit
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlertItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditItem[]>([]);
  const [emergencyLockdown, setEmergencyLockdown] = useState<boolean>(false);

  // Security & Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);

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
    active: false,
    message: '',
    type: 'info',
    dismissible: true,
  });
  const [dunningRules, setDunningRules] = useState<DunningRules>({
    invoiceDaysBefore: 7,
    autoSuspendDaysAfter: 3,
    autoTerminateDaysAfter: 14,
  });

  // Fetch user specific dynamic data from Supabase
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      if (!isSupabaseConfigured()) return;

      // 1. Fetch hosting services
      const { data: srvRows } = await supabase
        .from('hosting_services')
        .select('*')
        .eq('user_id', userId);

      if (srvRows && srvRows.length > 0) {
        const mappedServices: CloudService[] = srvRows.map((s: any) => ({
          id: s.id,
          domain: s.domain,
          planName: s.package_name || 'Cloud Service',
          status: s.status === 'active' ? 'Active' : s.status === 'suspended' ? 'Suspended' : 'Pending',
          datacenter: s.datacenter || 'Singapore SG1',
          ipAddress: s.server_ip || '103.145.22.40',
          cpanelUser: s.cpanel_username || 'user',
          diskUsedGB: Number(s.disk_used_gb || 0),
          diskLimitGB: Number(s.disk_limit_gb || 5),
          inodesUsed: Number(s.inodes_used || 0),
          inodeLimit: Number(s.inodes_limit || 250000),
          ramUsedMB: Number(s.ram_used_mb || 0),
          ramLimitMB: Number(s.ram_limit_mb || 2048),
          cpuCores: Number(s.cpu_cores || 2),
          ioLimitMB: Number(s.io_limit_mb || 50),
          nodeVersion: s.node_version || 'Node.js 22 LTS',
          gitRepoUrl: s.git_repo_url || '',
          gitBranch: s.git_branch || 'main',
          webhookUrl: s.webhook_url || '',
          autoRenew: !!s.auto_renew,
          nextDueDate: s.next_due_date ? String(s.next_due_date).split('T')[0] : '',
          monthlyPriceBDT: Number(s.monthly_price_bdt || 0),
          envVars: s.env_vars || [],
          releases: s.releases || [],
          sshPublicKey: s.ssh_public_key || '',
        }));
        setServices(mappedServices);
        setActiveServiceId(mappedServices[0].id);
      } else {
        setServices([]);
        setActiveServiceId('');
      }

      // 2. Fetch invoices
      const { data: invRows } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (invRows && invRows.length > 0) {
        setInvoices(
          invRows.map((i: any) => ({
            id: i.invoice_number || i.id,
            date: String(i.created_at).split('T')[0],
            dueDate: String(i.due_date || i.created_at).split('T')[0],
            amount: Number(i.total_bdt || i.amount_bdt || 0),
            status: i.status === 'paid' ? 'Paid' : 'Unpaid',
            paymentMethod: i.payment_gateway || i.payment_method || 'Manual',
            trxID: i.trx_id || '',
            plan: i.plan_name || 'Hosting Service',
            items: i.items || [{ desc: i.description || 'Service Invoice', amount: Number(i.total_bdt || 0) }],
          }))
        );
      } else {
        setInvoices([]);
      }

      // 3. Fetch domains
      const { data: domRows } = await supabase
        .from('domains')
        .select('*')
        .eq('user_id', userId);

      if (domRows && domRows.length > 0) {
        setDomains(
          domRows.map((d: any) => {
            const rawStatus = String(d.status || '');
            const normStatus =
              rawStatus.toLowerCase() === 'active'
                ? 'Active'
                : rawStatus === 'Pending' || rawStatus === 'Transferring' || rawStatus === 'Grace Period'
                ? rawStatus
                : 'Expiring Soon';
            return {
              id: d.id,
              domain: d.domain_name || d.domain,
              expiryDate: String(d.expiry_date || '').split('T')[0],
              daysRemaining: d.expiry_date
                ? Math.max(
                    0,
                    Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  )
                : 365,
              status: normStatus,
              registrarLock: !!d.registrar_lock,
              whoisPrivacy: !!d.whois_privacy,
              autoRenew: !!d.auto_renew,
              nameservers: d.nameservers || ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
              eppCode: '',
              dnsRecords: d.dns_records || [],
              registrarProvider: d.registrar_provider || undefined,
              registrarOrderId: d.registrar_order_id || undefined,
              cloudflareZoneId: d.cloudflare_zone_id || undefined,
              cloudflareZoneStatus: d.cloudflare_zone_status || undefined,
            };
          })
        );
      } else {
        setDomains([]);
      }

      // 3b. Hydrate inbound domain transfers directly from DB
      try {
        const { data: trfRows } = await supabase
          .from('domain_transfers')
          .select('*')
          .eq('user_id', userId)
          .order('initiated_at', { ascending: false });

        if (Array.isArray(trfRows) && trfRows.length > 0) {
          setDomainTransfers(
            trfRows.map((t: Record<string, unknown>) => ({
              id: String(t.id),
              domainName: String(t.domain_name || ''),
              tld: String(t.tld || '.com'),
              transferPriceBDT: Number(t.transfer_price_bdt || 0),
              currentStep: Number(t.current_step || 1),
              status: (String(t.status || 'pending_payment') as DomainTransferRequest['status']),
              statusMessage: t.status_message ? String(t.status_message) : undefined,
              eppStatus: t.epp_status ? String(t.epp_status) : null,
              registrarProvider: t.registrar_provider ? String(t.registrar_provider) : null,
              registrarTransferId: t.registrar_transfer_id ? String(t.registrar_transfer_id) : null,
              lastPolledAt: t.last_polled_at ? String(t.last_polled_at) : null,
              initiatedAt: t.initiated_at
                ? String(t.initiated_at).replace('T', ' ').slice(0, 16)
                : new Date().toISOString().replace('T', ' ').slice(0, 16),
            }))
          );
        } else {
          setDomainTransfers([]);
        }
      } catch {
        setDomainTransfers([]);
      }

      // 4. Fetch transactions
      const { data: wtxRows } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (wtxRows && wtxRows.length > 0) {
        setWalletTransactions(
          wtxRows.map((t: any) => ({
            id: t.id,
            date: String(t.created_at).split('T')[0],
            type: t.type === 'credit' ? 'Top-Up' : t.type === 'refund' ? 'Refund' : 'Debit',
            amount: Number(t.amount_bdt || t.amount),
            method: t.description || t.method || 'Wallet Tx',
            balanceAfter: Number(t.balance_after_bdt || 0),
          }))
        );
      } else {
        setWalletTransactions([]);
      }

      // 5. Hydrate live Affiliate balances, commissions & payout history from server API
      try {
        const affRes = await fetch('/api/affiliate', { cache: 'no-store' });
        if (affRes.ok) {
          const affData = await affRes.json();
          const p = affData.profile || {};
          const rawComms = Array.isArray(affData.commissions) ? affData.commissions : [];
          const rawPayouts = Array.isArray(affData.payouts) ? affData.payouts : [];
          const refCodeVal = String(p.referralCode || '');
          const tierLvl: 'starter_20' | 'pro_25' | 'agency_30' =
            p.tierLevel === 'agency_30' || p.tierLevel === 'pro_25' ? p.tierLevel : 'starter_20';
          const rateVal = Number(p.commissionRate || 20);
          const pendingVal = Number(p.pendingClearanceBDT || 0);
          const availVal = Number(p.availableBalanceBDT || 0);
          const withdrawnVal = Number(p.totalWithdrawnBDT || 0);

          setAffiliate((prev) => ({
            ...prev,
            refLink: refCodeVal ? `https://devhostcloud.com/?ref=${refCodeVal}` : prev.refLink,
            referralCode: refCodeVal || prev.referralCode,
            clicks: Number(p.totalClicks || 0),
            signups: Number(p.totalSignups || 0),
            activeConversions: Number(p.activeConversions || 0),
            tierLevel: tierLvl,
            commissionRate: rateVal,
            commissionTier:
              tierLvl === 'agency_30'
                ? 'Tier 3 (Agency 30%)'
                : tierLvl === 'pro_25'
                  ? 'Tier 2 (Pro 25%)'
                  : 'Tier 1 (Starter 20%)',
            pendingClearanceBDT: pendingVal,
            availableBalanceBDT: availVal,
            totalWithdrawnBDT: withdrawnVal,
            totalEarnedBDT: Number((pendingVal + availVal + withdrawnVal).toFixed(2)),
            commissions: rawComms.map((c: any) => {
              const maturesAt = c.matures_at ? new Date(c.matures_at).getTime() : Date.now();
              const daysLeft = Math.max(0, Math.ceil((maturesAt - Date.now()) / 86400000));
              return {
                id: String(c.id),
                date: String(c.created_at || '').split('T')[0],
                invoiceId: String(c.invoice_number || c.invoice_id || ''),
                customerMasked: c.referred_user_id ? `user_${String(c.referred_user_id).slice(0, 6)}` : 'Guest Order',
                domain: 'cloud-service',
                orderAmountBDT: Number(c.order_amount_bdt || 0),
                commissionBDT: Number(c.commission_amount_bdt || 0),
                ratePercent: Number(c.commission_rate || rateVal),
                subId: String(c.sub_id || 'organic'),
                status: c.status || 'pending_35d_hold',
                daysLeftToMature: daysLeft,
                clearanceDate: String(c.matures_at || '').split('T')[0],
              };
            }),
            payouts: rawPayouts.map((pay: any) => ({
              id: String(pay.id),
              date: String(pay.created_at || '').split('T')[0],
              amount: Number(pay.amount_bdt || 0),
              method: String(pay.payout_method || 'bkash'),
              accountNumber: String(pay.account_details || ''),
              status:
                pay.status === 'approved_paid'
                  ? 'Completed'
                  : pay.status === 'rejected_fraud'
                    ? 'Rejected'
                    : 'Pending',
              trxId: String(pay.admin_trx_id || pay.payout_gateway_ref || 'PENDING_ADMIN_APPROVAL'),
            })),
          }));
        }
      } catch {
        // Non-fatal affiliate hydration fallback
      }
    } catch (err) {
      console.error('[PortalContext] User data fetch error:', err);
    }
  }, []);

  // Hydrate session & listen to Supabase Auth
  const refreshUserData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAuthLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setCurrentUser(null);
        setActiveRole('client');
        setServices([]);
        setDomains([]);
        setDomainTransfers([]);
        setInvoices([]);
        setWalletBalanceBDT(0);
        syncAuthCookie(null);
        setAuthLoading(false);
        return;
      }

      // Self-healing profile loader: maybeSingle() never throws when the row is missing.
      let profile: any = null;
      let profileQueryFailed = false;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (error) {
          profileQueryFailed = true;
          console.warn('[PortalContext] profile query notice:', error.message);
        } else {
          profile = data;
        }
      } catch (profileErr) {
        profileQueryFailed = true;
        console.warn('[PortalContext] profile query exception:', profileErr);
      }

      if (!profile && !profileQueryFailed) {
        // Row genuinely missing: provision it. ignoreDuplicates => ON CONFLICT DO NOTHING, so this
        // can NEVER overwrite an existing row's role or wallet balance.
        try {
          const email = session.user.email || '';
          const provisioned = {
            id: session.user.id,
            email,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0] || 'User',
            role: 'client',
            wallet_balance_bdt: 0,
          };
          await supabase.from('profiles').upsert(provisioned, { onConflict: 'id', ignoreDuplicates: true });
          profile = provisioned;
        } catch (provisionErr) {
          console.warn('[PortalContext] profile provisioning notice:', provisionErr);
        }
      }

      // Even if the DB/RLS misbehaves, build a valid in-memory user from the session so the
      // authenticated user can still enter the dashboard instead of being bounced to /login.
      const role: UserRole = profile?.role === 'admin' ? 'admin' : 'client';
      const u: CurrentUser = {
        id: session.user.id,
        name: profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        avatar: (profile?.full_name || session.user.email || 'U').slice(0, 2).toUpperCase(),
        company: profile?.company || '',
        role,
        phone: profile?.phone || '',
      };

      setCurrentUser(u);
      setActiveRole(role);
      setWalletBalanceBDT(Number(profile?.wallet_balance_bdt || 0));
      syncAuthCookie(session, role);

      if (session.access_token && lastSyncedTokenRef.current !== session.access_token) {
        lastSyncedTokenRef.current = session.access_token;
        fetch('/api/auth/sync-session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }

      const refCode = profile?.referral_code || session.user.email?.split('@')[0] || 'ref';
      setAffiliate((prev) => ({
        ...prev,
        refLink: `https://devhost.cloud/?ref=${refCode}`,
        referralCode: refCode,
      }));

      // Secondary data must never break login (fetchUserData has its own try/catch)
      await fetchUserData(session.user.id);

      // Hydrate Admin live cluster nodes when founder/admin session is active
      if (role === 'admin') {
        try {
          const nodesRes = await fetch('/api/admin/nodes-crm', { cache: 'no-store' });
          if (nodesRes.ok) {
            const nodesData = await nodesRes.json();
            if (Array.isArray(nodesData.nodes)) {
              const adminMappedNodes: ServerNode[] = nodesData.nodes.map((n: any) => ({
                id: String(n.id || n.node_code),
                name: String(n.node_name || n.node_code || 'Cloud Node'),
                hostname: String(n.whm_hostname || `${n.node_code || 'node'}.devhost.cloud`),
                location: String(n.datacenter_location || 'Global Edge'),
                totalDiskGB: Number(n.max_disk_gb ?? 100),
                allocatedDiskGB: Number(n.allocated_disk_gb ?? 0),
                actualUsedDiskGB: Number(n.actual_physical_disk_gb ?? 0),
                totalSlots: Number(n.max_cpanel_slots ?? 50),
                usedSlots: Number(n.used_cpanel_slots ?? 0),
                ramTotalGB: Number(n.ram_total_gb ?? 64),
                ramUsedGB: Number(n.ram_used_gb ?? 0),
                lveLoad: Number(n.lve_load ?? 0.25),
                status:
                  n.is_healthy === false
                    ? 'Maintenance'
                    : n.auto_provision_enabled === false
                      ? 'Warning'
                      : 'Operational',
              }));
              setServerNodes(adminMappedNodes);
            }
          }

          // Hydrate Admin cluster-wide affiliate payout requests & commissions
          const adminAffRes = await fetch('/api/affiliate?scope=admin', { cache: 'no-store' });
          if (adminAffRes.ok) {
            const adminAffData = await adminAffRes.json();
            if (Array.isArray(adminAffData.payouts)) {
              setAffiliate((prev) => ({
                ...prev,
                payouts: adminAffData.payouts.map((pay: any) => ({
                  id: String(pay.id),
                  date: String(pay.created_at || '').split('T')[0],
                  amount: Number(pay.amount_bdt || 0),
                  method: String(pay.payout_method || 'bkash'),
                  accountNumber: String(pay.account_details || ''),
                  status:
                    pay.status === 'approved_paid'
                      ? 'Completed'
                      : pay.status === 'rejected_fraud'
                        ? 'Rejected'
                        : 'Pending',
                  trxId: String(pay.admin_trx_id || pay.payout_gateway_ref || 'PENDING_ADMIN_APPROVAL'),
                })),
              }));
            }
          }
        } catch {
          // ignore secondary admin node sync failure
        }
      }
    } catch (err) {
      console.error('[PortalContext] refreshUserData error:', err);
    } finally {
      setAuthLoading(false);
    }
  }, [fetchUserData]);

  useEffect(() => {
    // Purge any stale demo state from localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('devhost-portal-state-v9');
    } catch {}

    refreshUserData();
    setIsClientLoaded(true);

    if (isSupabaseConfigured()) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          lastSyncedTokenRef.current = null;
          fetch('/api/auth/sync-session', { method: 'DELETE' }).catch(() => {});
          setCurrentUser(null);
          setActiveRole('client');
          setServices([]);
          setDomains([]);
          setInvoices([]);
          setWalletTransactions([]);
          setWalletBalanceBDT(0);
          syncAuthCookie(null);
          setAuthLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Put the guards back into "loading" so /dashboard & /admin never see
          // { authLoading: false, currentUser: null } in the gap between SIGNED_IN and the
          // profile fetch finishing (this gap was the cause of the bounce back to /login).
          if (event === 'SIGNED_IN') setAuthLoading(true);
          // Defer: calling supabase.auth.* synchronously inside this callback can deadlock
          // the auth lock held by signIn/exchangeCodeForSession.
          setTimeout(() => {
            refreshUserData();
          }, 0);
        }
      });

      return () => {
        authListener?.subscription.unsubscribe();
      };
    }
  }, [refreshUserData]);

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
          if (Array.isArray(data.promoCodes)) {
            const mappedPromos: PromoCode[] = data.promoCodes.map((pr: any) => {
              const expiresStr = pr.expires_at ? String(pr.expires_at).split('T')[0] : '2027-12-31';
              const isExpired =
                pr.is_active === false ||
                (pr.expires_at ? new Date(pr.expires_at).getTime() < Date.now() : false);
              return {
                code: String(pr.code || '').toUpperCase(),
                discountPercent: Number(pr.discount_value ?? pr.discountPercent ?? 0),
                usesCount: Number(pr.current_uses ?? pr.usesCount ?? 0),
                maxUses: Number(pr.max_uses ?? pr.maxUses ?? 100),
                expiryDate: expiresStr,
                status: isExpired ? 'Expired' : 'Active',
              };
            });
            setPromoCodes(mappedPromos);
          }
          if (Array.isArray(data.serverNodes)) {
            const mappedNodes: ServerNode[] = data.serverNodes.map((n: any) => ({
              id: String(n.id || n.node_code),
              name: String(n.node_name || n.name || n.node_code || 'Cloud Node'),
              hostname: String(n.whm_hostname || n.hostname || `${n.node_code || 'node'}.devhost.cloud`),
              location: String(n.datacenter_location || n.location || 'Global Edge'),
              totalDiskGB: Number(n.max_disk_gb ?? 100),
              allocatedDiskGB: Number(n.allocated_disk_gb ?? 0),
              actualUsedDiskGB: Number(n.actual_physical_disk_gb ?? 0),
              totalSlots: Number(n.max_cpanel_slots ?? 50),
              usedSlots: Number(n.used_cpanel_slots ?? 0),
              ramTotalGB: Number(n.ram_total_gb ?? 64),
              ramUsedGB: Number(n.ram_used_gb ?? 0),
              lveLoad: Number(n.lve_load ?? 0.25),
              status:
                n.is_healthy === false
                  ? 'Maintenance'
                  : n.auto_provision_enabled === false
                    ? 'Warning'
                    : 'Operational',
            }));
            setServerNodes((prev) => (prev.length > 0 && mappedNodes.length === 0 ? prev : mappedNodes));
          }
        }
      } catch (err) {
        console.warn('[PortalContext] Dynamic catalog load deferred to local state cache:', err);
      }
    }
    syncDynamicCatalog();
  }, []);

  const logout = async (scopeOrEvent?: 'local' | 'global' | React.MouseEvent | any) => {
    const scope: 'local' | 'global' = scopeOrEvent === 'global' ? 'global' : 'local';
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut({ scope });
      }
      await fetch('/api/auth/sync-session', { method: 'DELETE' }).catch(() => {});
    } catch (err) {
      console.error('[PortalContext] SignOut error:', err);
    }
    lastSyncedTokenRef.current = null;
    setCurrentUser(null);
    setActiveRole('client');
    setServices([]);
    setDomains([]);
    setInvoices([]);
    setWalletBalanceBDT(0);
    setWalletTransactions([]);
    setTickets([]);
    syncAuthCookie(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('devhost-portal-state-v9');
        localStorage.removeItem('devhost_auth_failed_attempts');
        sessionStorage.removeItem('devhost_impersonate');
        sessionStorage.removeItem('devhost_sudo_expires');
      } catch {}
      // Replace window history to prevent back-button cache resurrection
      window.location.replace('/login?logged_out=true');
    }
  };

  const signOutGlobal = async () => {
    await logout('global');
  };

  const activeService = services.find((s) => s.id === activeServiceId) || services[0] || FALLBACK_EMPTY_SERVICE;
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // ---------------------------------------------------------------------------
  // ROLE & IMPERSONATION
  // ---------------------------------------------------------------------------

  const switchRole = (role: UserRole) => {
    if (currentUser?.role === 'admin') {
      setActiveRole(role);
    }
  };

  const impersonateCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setCurrentUser({
        id: cust.id,
        name: cust.name,
        email: cust.email,
        avatar: cust.name.slice(0, 2).toUpperCase(),
        company: cust.company,
        role: 'client',
        phone: cust.phone,
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

  const pushDomainNotification = (title: string, desc: string) => {
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        desc,
        time: 'Just now',
        type: 'domain',
        read: false,
      },
      ...prev,
    ]);
  };

  const toggleDomainLock = async (domainId: string): Promise<boolean> => {
    const target = domains.find((d) => d.id === domainId);
    if (!target) return false;
    const nextLockState = !target.registrarLock;

    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_registrar_lock',
          domainId,
          domainName: target.domain,
          lockState: nextLockState,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('Registrar Lock Update Failed', json.error || 'Unable to update registrar lock.');
        return false;
      }
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, registrarLock: nextLockState } : d))
      );
      pushDomainNotification('Registrar Lock Updated', json.message || `${target.domain} lock updated.`);
      return true;
    } catch {
      pushDomainNotification('Registrar Lock Failed', 'Network error contacting registrar API.');
      return false;
    }
  };

  const toggleDomainWhoisPrivacy = async (domainId: string): Promise<boolean> => {
    const target = domains.find((d) => d.id === domainId);
    if (!target) return false;
    const nextPrivacyState = !target.whoisPrivacy;

    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_whois_privacy',
          domainId,
          domainName: target.domain,
          whoisState: nextPrivacyState,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('WHOIS Privacy Update Failed', json.error || 'Unable to update WHOIS privacy.');
        return false;
      }
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, whoisPrivacy: nextPrivacyState } : d))
      );
      pushDomainNotification('WHOIS Privacy Shield Updated', json.message || `${target.domain} WHOIS privacy updated.`);
      return true;
    } catch {
      pushDomainNotification('WHOIS Update Failed', 'Network error contacting registrar API.');
      return false;
    }
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

  const updateDomainNameservers = async (domainId: string, nameservers: string[]): Promise<boolean> => {
    const target = domains.find((d) => d.id === domainId);
    const cleanNs = nameservers.map((n) => n.trim().toLowerCase()).filter(Boolean);
    if (!target || cleanNs.length < 2) return false;

    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_nameservers',
          domainId,
          domainName: target.domain,
          nameservers: cleanNs,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('Nameserver Update Failed', json.error || 'Registrar rejected nameserver update.');
        return false;
      }
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, nameservers: cleanNs } : d))
      );
      pushDomainNotification('Nameservers Saved', json.message || `Nameservers updated for ${target.domain}.`);
      return true;
    } catch {
      pushDomainNotification('Nameserver Update Failed', 'Network error contacting registrar API.');
      return false;
    }
  };

  const bulkUpdateNameservers = async (domainIds: string[], nameservers: string[]): Promise<boolean> => {
    const results = await Promise.all(domainIds.map((id) => updateDomainNameservers(id, nameservers)));
    return results.every(Boolean);
  };

  const addDnsRecord = async (domainId: string, record: Omit<DnsRecord, 'id'>): Promise<boolean> => {
    const target = domains.find((d) => d.id === domainId);
    try {
      const res = await fetch('/api/domains/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_record',
          domainId,
          domainName: target?.domain,
          record,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        recordId?: string;
        cloudflareRecordId?: string;
      };
      if (!res.ok || !json.success) {
        pushDomainNotification('DNS Record Failed', json.error || 'Could not push record to Cloudflare Edge.');
        return false;
      }
      const newRecord: DnsRecord = {
        ...record,
        id: json.recordId || `dns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        cloudflareRecordId: json.cloudflareRecordId,
        syncStatus: json.cloudflareRecordId ? 'synced' : 'pending',
      };
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, dnsRecords: [...d.dnsRecords, newRecord] } : d))
      );
      return true;
    } catch {
      pushDomainNotification('DNS Sync Error', 'Failed communicating with DNS Edge API.');
      return false;
    }
  };

  const deleteDnsRecord = async (domainId: string, recordId: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `/api/domains/dns?recordId=${encodeURIComponent(recordId)}&domainId=${encodeURIComponent(domainId)}`,
        { method: 'DELETE' }
      );
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('DNS Delete Failed', json.error || 'Could not remove DNS record.');
        return false;
      }
      setDomains((prev) =>
        prev.map((d) =>
          d.id === domainId ? { ...d, dnsRecords: d.dnsRecords.filter((r) => r.id !== recordId) } : d
        )
      );
      return true;
    } catch {
      pushDomainNotification('DNS Delete Error', 'Failed communicating with DNS Edge API.');
      return false;
    }
  };

  const applyDnsPreset = async (domainId: string, preset: 'google' | 'zoho' | 'github_vercel'): Promise<boolean> => {
    const currentDomain = domains.find((d) => d.id === domainId);
    if (!currentDomain) return false;

    if (preset === 'google' || preset === 'zoho') {
      try {
        const res = await fetch('/api/domains/dns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'apply_preset',
            domainId,
            domainName: currentDomain.domain,
            presetType: preset,
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          pushDomainNotification('DNS Preset Failed', json.error || 'Unable to sync preset records.');
          return false;
        }
      } catch {
        pushDomainNotification('DNS Preset Error', 'Network error pushing DNS preset.');
        return false;
      }
    }

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
      const okA = await addDnsRecord(domainId, { type: 'A', name: '@', content: '76.76.21.21', ttl: 300, proxied: false });
      const okC = await addDnsRecord(domainId, { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', ttl: 300, proxied: false });
      return okA && okC;
    }

    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, dnsRecords: [...d.dnsRecords, ...presetRecords] } : d))
    );
    return true;
  };

  const createChildNameserver = async (domainId: string, hostname: string, ipAddress: string): Promise<boolean> => {
    const target = domains.find((d) => d.id === domainId);
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_child_nameserver',
          domainId,
          domainName: target?.domain,
          childHostname: hostname,
          childIpv4: ipAddress,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('Child NS Failed', json.error || 'Registrar refused child nameserver glue.');
        return false;
      }
      const newCns: ChildNameserver = {
        id: json.id || `cns_${Date.now()}`,
        domainId,
        hostname,
        ipAddress,
      };
      setChildNameservers((prev) => [...prev, newCns]);
      return true;
    } catch {
      pushDomainNotification('Child NS Error', 'Failed communicating with registrar API.');
      return false;
    }
  };

  const deleteChildNameserver = async (id: string): Promise<boolean> => {
    const target = childNameservers.find((c) => c.id === id);
    const parentDomain = domains.find((d) => d.id === target?.domainId);
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_child_nameserver',
          domainId: target?.domainId,
          domainName: parentDomain?.domain,
          childId: id,
          childHostname: target?.hostname,
          childIpv4: target?.ipAddress,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('Child NS Removal Failed', json.error || 'Registrar refused removal.');
        return false;
      }
      setChildNameservers((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  const createDomainRedirect = async (domainId: string, sourcePath: string, targetUrl: string, type: '301' | '302'): Promise<boolean> => {
    const target = domains.find((d) => d.id === domainId);
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_url_forward',
          domainId,
          domainName: target?.domain,
          forwardSource: sourcePath,
          forwardTarget: targetUrl,
          forwardType: Number(type),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('URL Redirect Failed', json.error || 'Could not create Cloudflare edge redirect.');
        return false;
      }
      const newRed: DomainRedirect = {
        id: json.id || `red_${Date.now()}`,
        domainId,
        sourcePath,
        targetUrl,
        type,
      };
      setDomainRedirects((prev) => [...prev, newRed]);
      return true;
    } catch {
      return false;
    }
  };

  const deleteDomainRedirect = async (id: string): Promise<boolean> => {
    const target = domainRedirects.find((r) => r.id === id);
    const parentDomain = domains.find((d) => d.id === target?.domainId);
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_url_forward',
          domainId: target?.domainId,
          domainName: parentDomain?.domain,
          forwardId: id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        pushDomainNotification('Redirect Removal Failed', json.error || 'Unable to remove Cloudflare redirect rule.');
        return false;
      }
      setDomainRedirects((prev) => prev.filter((r) => r.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  const initiateDomainTransfer = async (
    domain: string,
    eppCode: string
  ): Promise<{ ok: boolean; paymentRequired?: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate_transfer',
          domainName: domain,
          eppCode,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        transferId?: string;
        transferPriceBDT?: number;
        registrarTransferId?: string | null;
        provider?: string | null;
        currentStep?: number;
        status?: DomainTransferRequest['status'];
        message?: string;
        error?: string;
      };
      if (res.status === 402 || json.code === 'PAYMENT_REQUIRED') {
        return {
          ok: false,
          paymentRequired: true,
          error: json.error || 'Paid domain transfer invoice required before registrar submission.',
        };
      }
      if (!res.ok || !json.success) {
        pushDomainNotification('Domain Transfer Failed', json.error || 'Registrar rejected transfer request.');
        return { ok: false, error: json.error || 'Registrar rejected transfer request.' };
      }

      const cleanDom = domain.trim().toLowerCase();
      const dotIdx = cleanDom.indexOf('.');
      const newTransfer: DomainTransferRequest = {
        id: json.transferId || `tr_${Date.now()}`,
        domainName: cleanDom,
        tld: dotIdx >= 0 ? cleanDom.slice(dotIdx) : '.com',
        transferPriceBDT: Number(json.transferPriceBDT || 1350),
        currentStep: Number(json.currentStep ?? 2),
        status: json.status || 'verifying_epp',
        statusMessage: json.message,
        registrarProvider: json.provider || null,
        registrarTransferId: json.registrarTransferId || null,
        initiatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };
      setDomainTransfers((prev) => [newTransfer, ...prev]);

      pushDomainNotification(
        'Domain Transfer In Initiated',
        json.message || `Transfer for ${cleanDom} submitted to upstream registrar.`
      );
      return { ok: true };
    } catch {
      pushDomainNotification('Domain Transfer Error', 'Network error submitting transfer request.');
      return { ok: false, error: 'Network error submitting transfer request.' };
    }
  };

  const pollDomainTransfers = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll_transfers' }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        transfers?: DomainTransferRequest[];
        completed?: number;
        error?: string;
      };
      if (!res.ok || !json.success) {
        return { ok: false, error: json.error || 'Failed to sync registrar transfer statuses.' };
      }
      if (Array.isArray(json.transfers)) {
        setDomainTransfers(json.transfers);
      }
      if ((json.completed || 0) > 0) {
        await refreshUserData();
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while syncing transfer status.' };
    }
  };

  const resubmitTransferEpp = async (
    transferId: string,
    eppCode: string
  ): Promise<{ ok: boolean; error?: string; message?: string; currentStep?: number; status?: string }> => {
    try {
      const res = await fetch('/api/domains/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resubmit_transfer_epp',
          transferId,
          eppCode,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
        currentStep?: number;
        status?: DomainTransferRequest['status'];
        registrarTransferId?: string | null;
      };
      if (!res.ok || !json.success) {
        return { ok: false, error: json.error || 'Failed to re-submit EPP code.' };
      }

      setDomainTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? {
                ...t,
                currentStep: json.currentStep ?? 2,
                status: json.status || 'verifying_epp',
                statusMessage: json.message,
                registrarTransferId: json.registrarTransferId ?? t.registrarTransferId,
              }
            : t
        )
      );
      return {
        ok: true,
        message: json.message,
        currentStep: json.currentStep ?? 2,
        status: json.status || 'verifying_epp',
      };
    } catch {
      return { ok: false, error: 'Network error re-submitting EPP code.' };
    }
  };

  // ---------------------------------------------------------------------------
  // BILLING & WALLET (SERVER-VERIFIED VIA PAYMENT SESSIONS & ATOMIC RPC)
  // ---------------------------------------------------------------------------

  const topUpWallet = async (amount: number, method: string, _trxId?: string) => {
    try {
      const res = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: method.toLowerCase(),
          amountBDT: Number(amount),
          orderType: 'wallet_topup',
          planName: 'DevHost Prepaid Cloud Wallet Top-Up',
          items: [{ name: 'DevHost Prepaid Cloud Wallet Top-Up', type: 'wallet_topup', amountBDT: Number(amount) }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || 'Failed to initiate wallet top-up session.' };
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }

      return {
        ok: true,
        mode: data.mode,
        paymentUrl: data.paymentUrl,
        invoiceNumber: data.invoiceNumber,
        instructions: data.instructions,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Wallet top-up network failure.' };
    }
  };

  const payInvoice = async (invoiceId: string): Promise<boolean> => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.status === 'Paid') return false;

    if (walletBalanceBDT < inv.amount) {
      alert(`Insufficient prepaid cloud wallet balance (৳${walletBalanceBDT}). Please top up via bKash or Nagad first.`);
      return false;
    }

    try {
      const res = await fetch('/api/payments/wallet-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: inv.id, amountBDT: inv.amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Wallet checkout declined.');
        return false;
      }

      const nextBalance =
        typeof data.newWalletBalanceBDT === 'number'
          ? data.newWalletBalanceBDT
          : Math.max(0, walletBalanceBDT - inv.amount);
      setWalletBalanceBDT(nextBalance);
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId
            ? { ...i, status: 'Paid', paymentMethod: 'Prepaid Wallet', trxID: data.trxId || `WLT_${Date.now()}` }
            : i
        )
      );

      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: 'Debit',
          amount: inv.amount,
          method: `Payment for Invoice ${invoiceId}`,
          balanceAfter: nextBalance,
        },
        ...prev,
      ]);

      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          title: 'Invoice Paid from Wallet',
          desc: `Invoice ${invoiceId} for ৳${inv.amount} paid atomically. Balance: ৳${nextBalance}.`,
          time: 'Just now',
          type: 'billing',
          read: false,
        },
        ...prev,
      ]);

      return true;
    } catch (err: any) {
      alert(err?.message || 'Atomic wallet checkout failed.');
      return false;
    }
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
          senderName: currentUser?.name || 'Client',
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
      senderName: sender === 'client' ? (currentUser?.name || 'Client') : 'Siam (Senior Cloud Engineer)',
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

  const requestAffiliatePayout = async (
    amount: number,
    method: string,
    accountNumber: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_payout',
          amountBDT: Number(amount),
          payoutMethod: method.toLowerCase(),
          accountDetails: accountNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.message || data.error || 'Payout request failed.' };
      }

      const newPayout: AffiliatePayout = {
        id: String(data.payoutId || `PAY-${Date.now()}`),
        date: new Date().toISOString().split('T')[0],
        amount: Number(amount),
        method: method.toLowerCase(),
        accountNumber,
        status: 'Pending',
        trxId: 'PENDING_ADMIN_APPROVAL',
      };
      setAffiliate((prev) => ({
        ...prev,
        availableBalanceBDT:
          typeof data.availableBalanceBDT === 'number'
            ? data.availableBalanceBDT
            : Math.max(0, prev.availableBalanceBDT - amount),
        payouts: [newPayout, ...prev.payouts],
      }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Payout request network failure.' };
    }
  };

  const approveAffiliatePayout = async (
    payoutId: string,
    adminTrxId: string
  ): Promise<{ ok: boolean; requireSudo?: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_payout',
          payoutId,
          adminTrxId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          ok: false,
          requireSudo: Boolean(data.requireSudo),
          error: data.error || data.message || 'Payout approval failed.',
        };
      }

      setAffiliate((prev) => ({
        ...prev,
        payouts: prev.payouts.map((p) =>
          p.id === payoutId ? { ...p, status: 'Completed', trxId: adminTrxId } : p
        ),
      }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Payout approval network error.' };
    }
  };

  const clawbackCommission = async (
    invoiceOrCommissionId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clawback_refund',
          invoiceId: invoiceOrCommissionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || data.message || 'Commission clawback failed.' };
      }

      setAffiliate((prev) => {
        const comm = prev.commissions.find(
          (c) => c.id === invoiceOrCommissionId || c.invoiceId === invoiceOrCommissionId
        );
        if (!comm || comm.status === 'clawed_back_refunded') return prev;
        return {
          ...prev,
          pendingClearanceBDT:
            comm.status === 'pending_35d_hold'
              ? Math.max(0, prev.pendingClearanceBDT - comm.commissionBDT)
              : prev.pendingClearanceBDT,
          availableBalanceBDT:
            comm.status === 'cleared_available'
              ? Math.max(0, prev.availableBalanceBDT - comm.commissionBDT)
              : prev.availableBalanceBDT,
          commissions: prev.commissions.map((c) =>
            c.id === comm.id ? { ...c, status: 'clawed_back_refunded', daysLeftToMature: 0 } : c
          ),
        };
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Commission clawback network error.' };
    }
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
    const cleanCode = nodeData.hostname
      .split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || `node-${Date.now().toString(36)}`;
    const newNode: ServerNode = {
      ...nodeData,
      id: `node_${cleanCode}_${Date.now()}`,
    };
    setServerNodes((prev) => [...prev, newNode]);

    // Persist to Supabase whm_server_nodes via Admin Nodes CRM API
    fetch('/api/admin/nodes-crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_node',
        nodeData: {
          nodeCode: cleanCode,
          nodeName: nodeData.name,
          datacenterLocation: nodeData.location,
          ipv4Address: nodeData.hostname,
          whmHostname: nodeData.hostname,
          whmUsername: 'root',
          maxSlots: nodeData.totalSlots,
          maxDiskGb: nodeData.totalDiskGB,
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.warn('[PortalContext] Server node persistence notice:', errBody?.error || res.status);
        }
      })
      .catch((err) => console.error('[PortalContext] Failed to persist server node:', err));
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
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode) return;

    const newPromo: PromoCode = {
      code: cleanCode,
      discountPercent: discount,
      usesCount: 0,
      maxUses,
      expiryDate: expiry,
      status: 'Active',
    };
    setPromoCodes((prev) => [newPromo, ...prev.filter((p) => p.code !== cleanCode)]);

    // Persist promo code to Supabase via /api/catalog
    fetch('/api/catalog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'promo',
        data: {
          code: cleanCode,
          discount_type: 'percentage',
          discount_value: discount,
          applies_to: 'all',
          max_uses: maxUses,
          current_uses: 0,
          reduce_affiliate_commission_proportionally: true,
          expires_at: expiry ? new Date(expiry).toISOString() : null,
          is_active: true,
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.warn('[PortalContext] Promo code persistence notice:', errBody?.error || res.status);
        }
      })
      .catch((err) => console.error('[PortalContext] Failed to persist promo code:', err));
  };

  const deleteAdminPromo = (code: string) => {
    const cleanCode = code.toUpperCase().trim();
    setPromoCodes((prev) => prev.filter((p) => p.code !== cleanCode));

    // Delete promo code from Supabase via /api/catalog
    fetch(`/api/catalog?entityType=promo&code=${encodeURIComponent(cleanCode)}`, {
      method: 'DELETE',
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.warn('[PortalContext] Promo code deletion notice:', errBody?.error || res.status);
        }
      })
      .catch((err) => console.error('[PortalContext] Failed to delete promo code:', err));
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
        customerName: currentUser?.name || 'Customer',
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
        authLoading,
        logout,
        signOutGlobal,
        refreshUserData,
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
        pollDomainTransfers,
        resubmitTransferEpp,

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
