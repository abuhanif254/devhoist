'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Shield,
  ShieldCheck,
  Ban,
  Fingerprint,
  Mail,
  Bell,
  Eye,
  FileDown,
  Server,
  Users,
  CreditCard,
  Truck,
  Tag,
  DollarSign,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Lock,
  Unlock,
  Plus,
  Send,
  Trash2,
  HardDrive,
  Cpu,
  Layers,
  Terminal,
  Clock,
  Sparkles,
  Sliders,
  LifeBuoy,
  X,
  UserCheck,
  Download,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
  Sun,
  Moon,
  LogOut,
  Wallet,
  Play,
  RotateCcw,
  Zap,
  Radio,
  FileSpreadsheet,
  Globe,
  Settings,
  ChevronRight,
  Database,
} from 'lucide-react';
import {
  usePortal,
  AdminCustomer,
  ServerNode,
  LedgerOrder,
  MigrationRequest,
  PromoCode,
  DynamicHostingPlan,
  DynamicTldPricing,
  InvoiceItem,
  SecurityAuditItem,
} from '@/context/PortalContext';
import { useBilling } from '@/context/BillingContext';
import {
  getEmailOutboxLogs,
  sendTransactionalEmail,
  EmailLogEntry,
  EmailTemplateId,
  renderWelcomeVerifyEmail,
  renderHostingProvisionedEmail,
  renderInvoicePaidEmail,
  renderRenewalReminderEmail,
  renderServiceSuspendedEmail,
  renderAffiliateEmail,
  renderMigrationStatusEmail,
  renderSecurityThreatEmail,
} from '@/lib/emailEngine';
import {
  getTelegramOutbox,
  testTelegramAlert,
  TelegramLogEntry,
} from '@/lib/adminNotifier';
import { calculateOrderProfitBreakdown } from '@/lib/profitEngine';
import AdminSecurityProfileView from '@/components/profiles/AdminSecurityProfileView';
import AdminDomainOperationsView from '@/components/domains/AdminDomainOperationsView';
import { useSudoGate } from '@/components/security/SudoGateModal';

type AdminModule =
  | 'overview'
  | 'automation_cron'
  | 'customers'
  | 'billing_ledger'
  | 'affiliates_promos'
  | 'pricing'
  | 'domain_operations'
  | 'migrations'
  | 'support_desk'
  | 'security_audit'
  | 'founder_security';

export default function AdminCommandCenterPage() {
  const router = useRouter();
  const { requireSudo } = useSudoGate();
  const {
    activeRole,
    switchRole,
    impersonateCustomer,

    customers,
    serverNodes,
    ordersLedger,
    migrationQueue,
    promoCodes,
    dynamicPlans,
    updateHostingPlan,
    dynamicTlds,
    updateTldPricing,
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

    systemBroadcast,
    updateSystemBroadcast,

    tickets,
    replyToTicket,
    resolveTicket,

    affiliate,
    approveAffiliatePayout,

    fraudAlerts,
    auditLogs: securityAuditLogs,
    emergencyLockdown,
    toggleEmergencyLockdown,
    dismissFraudAlert,
    blockIpPermanently,
    freezeAffiliate,
    clawbackCommission,
  } = usePortal();

  const { theme, toggleTheme } = useBilling();

  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'All' | 'Active' | 'Suspended' | 'High Resource'>('All');

  // Security & Audit States
  const [securitySearch, setSecuritySearch] = useState('');
  const [securityRiskFilter, setSecurityRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [clawbackInputOrderId, setClawbackInputOrderId] = useState('');

  // Phase 12: Autonomous Email, Telegram & Lifecycle States
  const [emailOutboxLogs, setEmailOutboxLogs] = useState<EmailLogEntry[]>(getEmailOutboxLogs());
  const [selectedEmailPreview, setSelectedEmailPreview] = useState<EmailLogEntry | null>(null);
  const [telegramLogs, setTelegramLogs] = useState<TelegramLogEntry[]>(getTelegramOutbox());
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('founder@devhostcloud.com');
  const [testEmailTemplate, setTestEmailTemplate] = useState<EmailTemplateId>('hosting_provisioned_credentials');
  const [lifecycleCronRunning, setLifecycleCronRunning] = useState(false);
  const [lifecycleCronResults, setLifecycleCronResults] = useState<any | null>(null);
  const [cronSubTab, setCronSubTab] = useState<'lifecycle' | 'email_outbox' | 'telegram' | 'export'>('lifecycle');

  // Trigger 6-Task Autonomous Lifecycle Cron
  const handleRunAutonomousLifecycle = async () => {
    setLifecycleCronRunning(true);
    try {
      const res = await fetch('/api/cron/lifecycle?secret=devhost_cron_secret_key', {
        headers: { 'x-admin-trigger': 'true' }
      });
      const data = await res.json();
      setLifecycleCronResults(data);
      setEmailOutboxLogs(getEmailOutboxLogs());
      setTelegramLogs(getTelegramOutbox());
    } catch (err: any) {
      window.alert('Cron execution error: ' + err?.message);
    } finally {
      setLifecycleCronRunning(false);
    }
  };

  // Test Telegram Bot Alert
  const handleTestTelegramAlert = async () => {
    setIsTestingTelegram(true);
    try {
      const res = await testTelegramAlert();
      setTelegramLogs(getTelegramOutbox());
      window.alert(
        res.simulated
          ? 'Telegram alert simulated and logged to outbox! (Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env for live mobile delivery).'
          : 'Telegram alert delivered live to founder chat!'
      );
    } catch (err: any) {
      window.alert('Telegram test error: ' + err?.message);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Dispatch Test Email
  const handleSendTestEmail = async () => {
    try {
      let html = '';
      let subject = 'DevHost Cloud Test Notification';
      let previewText = 'Test transactional message';

      if (testEmailTemplate === 'hosting_provisioned_credentials') {
        subject = '⚡ cPanel Credentials & Server Provisioning — client-site.com';
        html = renderHostingProvisionedEmail({
          name: 'Demo Client',
          packageName: 'Developer Pro NVMe',
          domain: 'client-site.com',
          serverIp: '103.205.71.18',
          datacenter: 'Singapore SG1 (Equinix)',
          nameservers: ['ns1.devhostcloud.com', 'ns2.devhostcloud.com'],
          cpanelUsername: 'cp_client',
          ssoLoginUrl: 'https://devhostcloud.com/dashboard',
          sshPort: 22,
          sshHost: '103.205.71.18',
        });
      } else if (testEmailTemplate === 'welcome_and_verify') {
        subject = '🚀 Welcome to DevHost Cloud — Verify Your Account';
        html = renderWelcomeVerifyEmail({
          name: 'Demo User',
          email: testEmailAddress,
          verificationCode: '749102',
        });
      } else if (testEmailTemplate === 'invoice_paid_receipt') {
        subject = 'Receipt for Invoice #INV-2026-9021 ✅';
        html = renderInvoicePaidEmail({
          name: 'Demo Client',
          invoiceNumber: 'INV-2026-9021',
          amountBDT: 450,
          paymentMethod: 'bKash (Instant)',
          trxId: '9K72LM89QP',
          paidDate: new Date().toLocaleDateString(),
          items: [{ desc: 'Developer Pro NVMe (1 Month)', amount: 450 }],
        });
      } else if (testEmailTemplate === 'renewal_reminder_notice') {
        subject = 'Upcoming Renewal Notice: client-site.com (3 Days Left)';
        html = renderRenewalReminderEmail({
          name: 'Demo Client',
          serviceName: 'Developer Pro NVMe',
          domain: 'client-site.com',
          expiryDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString(),
          daysRemaining: 3,
          renewalAmountBDT: 450,
          walletBalanceBDT: 0,
        });
      } else if (testEmailTemplate === 'service_suspended_alert') {
        subject = 'Critical: Service Suspended for client-site.com 🛑';
        html = renderServiceSuspendedEmail({
          name: 'Demo Client',
          serviceName: 'Developer Pro NVMe',
          domain: 'client-site.com',
          overdueDays: 3,
          outstandingAmountBDT: 450,
          terminationGraceDays: 14,
        });
      } else if (testEmailTemplate === 'affiliate_commission_and_payout') {
        subject = '🎉 New Affiliate Commission Credited! (৳150 BDT)';
        html = renderAffiliateEmail({
          name: 'Affiliate Partner',
          type: 'commission_earned',
          amountBDT: 150,
          details: 'Commission earned for Developer Pro referral (35-day hold started)',
          holdDaysRemaining: 35,
        });
      } else if (testEmailTemplate === 'migration_status_update') {
        subject = 'Migration Complete — Zero Downtime! 🎉 — client-site.com';
        html = renderMigrationStatusEmail({
          name: 'Demo Client',
          domain: 'client-site.com',
          status: 'completed',
          sourceHost: 'Previous cPanel Host',
          nameservers: ['ns1.devhostcloud.com', 'ns2.devhostcloud.com'],
        });
      } else {
        subject = 'Security Notice: New Login Detected (103.205.71.18) 🛡️';
        html = renderSecurityThreatEmail({
          name: 'Demo Client',
          alertType: 'New Device Authentication',
          ipAddress: '103.205.71.18',
          location: 'Dhaka, Bangladesh',
          deviceBrowser: 'Edge on Windows 11',
          timestamp: new Date().toISOString(),
        });
      }

      await sendTransactionalEmail({
        to: testEmailAddress,
        subject,
        html,
        template: testEmailTemplate,
        previewText,
      });

      setEmailOutboxLogs(getEmailOutboxLogs());
      window.alert(`Test email (${testEmailTemplate}) dispatched to ${testEmailAddress}! View the full HTML preview in the Outbox table.`);
    } catch (err: any) {
      window.alert('Email send error: ' + err?.message);
    }
  };

  // Generic JSON & CSV Exporters
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJsonData = (dataset: any[], filename: string) => {
    downloadFile(JSON.stringify(dataset, null, 2), `${filename}.json`, 'application/json');
  };

  const handleExportCsvData = (dataset: any[], filename: string) => {
    if (!dataset.length) return;
    const headers = Object.keys(dataset[0]);
    const csvRows = [
      headers.join(','),
      ...dataset.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      ),
    ];
    downloadFile(csvRows.join('\n'), `${filename}.csv`, 'text/csv');
  };

  // Customer Inspector Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [quotaDisk, setQuotaDisk] = useState<number>(5);
  const [quotaRam, setQuotaRam] = useState<number>(2048);
  const [quotaInodes, setQuotaInodes] = useState<number>(250000);
  const [creditAmount, setCreditAmount] = useState<number>(500);

  // Create Customer & Provision Modal
  const [isCreateCustModalOpen, setIsCreateCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('+8801700000000');
  const [newCustCompany, setNewCustCompany] = useState('');
  const [newCustDomain, setNewCustDomain] = useState('enterprise-client.com');
  const [newCustPlanId, setNewCustPlanId] = useState('developer-pro');
  const [newCustInitialCredit, setNewCustInitialCredit] = useState(0);

  // Add Server Node Modal
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeHost, setNewNodeHost] = useState('');
  const [newNodeLoc, setNewNodeLoc] = useState('Singapore (Equinix SG1)');
  const [newNodeSlots, setNewNodeSlots] = useState(50);
  const [newNodeDisk, setNewNodeDisk] = useState(100);

  // Dynamic Pricing State (Copy for editing)
  const [editablePlans, setEditablePlans] = useState<DynamicHostingPlan[]>(dynamicPlans);
  const [editableTlds, setEditableTlds] = useState<DynamicTldPricing[]>(dynamicTlds);
  const [pricingSavedToast, setPricingSavedToast] = useState(false);

  // Profit-Protected Unit Economics Simulator State
  const [simPlanId, setSimPlanId] = useState<string>('developer-pro');
  const [simSellingPrice, setSimSellingPrice] = useState<number>(450);
  const [simServerCost, setSimServerCost] = useState<number>(90);
  const [simMinProfit, setSimMinProfit] = useState<number>(225);
  const [simPromoDiscount, setSimPromoDiscount] = useState<number>(0);
  const [simAffiliateTier, setSimAffiliateTier] = useState<number>(25);

  useEffect(() => {
    if (dynamicPlans && dynamicPlans.length > 0) {
      setEditablePlans(dynamicPlans);
      const target = dynamicPlans.find((p) => p.id === simPlanId || p.slug === simPlanId) || dynamicPlans[1];
      if (target) {
        setSimSellingPrice(target.priceMonthlyBDT);
        setSimServerCost(target.unitServerCostBDT || 0);
        setSimMinProfit(target.minOwnerProfitBDT || 0);
      }
    }
  }, [dynamicPlans]);

  useEffect(() => {
    if (dynamicTlds && dynamicTlds.length > 0) {
      setEditableTlds(dynamicTlds);
    }
  }, [dynamicTlds]);

  const handleSelectSimPlan = (planId: string) => {
    setSimPlanId(planId);
    const target = editablePlans.find((p) => p.id === planId || p.slug === planId);
    if (target) {
      setSimSellingPrice(target.priceMonthlyBDT);
      setSimServerCost(target.unitServerCostBDT || 0);
      setSimMinProfit(target.minOwnerProfitBDT || 0);
    }
  };

  const handleApplySimToPlan = () => {
    setEditablePlans((prev) =>
      prev.map((p) => {
        if (p.id === simPlanId || p.slug === simPlanId) {
          return {
            ...p,
            priceMonthlyBDT: simSellingPrice,
            unitServerCostBDT: simServerCost,
            minOwnerProfitBDT: simMinProfit,
            maxAffiliatePoolBDT: Math.max(0, simSellingPrice - (simServerCost + simMinProfit)),
          };
        }
        return p;
      })
    );
  };

  const simBreakdown = useMemo(() => {
    return calculateOrderProfitBreakdown({
      sellingPriceBDT: simSellingPrice,
      unitServerCostBDT: simServerCost,
      minOwnerProfitBDT: simMinProfit,
      promoDiscountPercent: simPromoDiscount,
      affiliateRatePercent: simAffiliateTier,
      billingCycle: 'monthly',
    });
  }, [simSellingPrice, simServerCost, simMinProfit, simPromoDiscount, simAffiliateTier]);

  // Custom Invoice Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invTargetCustId, setInvTargetCustId] = useState(customers[0]?.id || 'cust_1');
  const [invDueDate, setInvDueDate] = useState('2026-11-20');
  const [invItems, setInvItems] = useState<InvoiceItem[]>([
    { desc: 'Custom Next.js & Tailwind Cloud Setup + Redis Cache', amount: 3500 },
  ]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemAmount, setNewItemAmount] = useState<number>(500);

  // Automation Cron Runner State
  const [isCronRunning, setIsCronRunning] = useState(false);
  const [cronLogs, setCronLogs] = useState<string[]>([]);

  // Migration Notes & Filter
  const [editingMigrationNotes, setEditingMigrationNotes] = useState<{ [id: string]: string }>({});

  // Support Command Desk & Macro State
  const [adminTicketReply, setAdminTicketReply] = useState<{ [ticketId: string]: string }>({});

  // System Broadcast Editor State
  const [broadcastMsgInput, setBroadcastMsgInput] = useState(systemBroadcast.message);
  const [broadcastTypeInput, setBroadcastTypeInput] = useState(systemBroadcast.type);
  const [broadcastActiveInput, setBroadcastActiveInput] = useState(systemBroadcast.active);

  // Promo Code Creator State
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState<number>(20);
  const [newPromoMaxUses, setNewPromoMaxUses] = useState<number>(100);
  const [newPromoExpiry, setNewPromoExpiry] = useState('2026-12-31');

  // Ledger Filter
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Handlers
  const handleOpenInspector = (cust: AdminCustomer) => {
    setSelectedCustomer(cust);
    setQuotaDisk(5);
    setQuotaRam(2048);
    setQuotaInodes(250000);
  };

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustEmail.trim()) return;
    createAdminCustomerAndService(
      {
        name: newCustName.trim(),
        email: newCustEmail.trim(),
        phone: newCustPhone.trim(),
        company: newCustCompany.trim() || 'Private Enterprise',
        walletBalanceBDT: newCustInitialCredit,
      },
      newCustPlanId,
      newCustDomain.trim()
    );
    setIsCreateCustModalOpen(false);
    setNewCustName('');
    setNewCustEmail('');
    alert(`Customer ${newCustName} created & server vhost for ${newCustDomain} auto-provisioned!`);
  };

  const handleAddNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim() || !newNodeHost.trim()) return;
    createServerNode({
      name: newNodeName.trim(),
      hostname: newNodeHost.trim(),
      location: newNodeLoc,
      totalDiskGB: newNodeDisk,
      allocatedDiskGB: 0,
      actualUsedDiskGB: 0,
      totalSlots: newNodeSlots,
      usedSlots: 0,
      ramTotalGB: 64,
      ramUsedGB: 4.2,
      lveLoad: 0.05,
      status: 'Operational',
    });
    setIsAddNodeModalOpen(false);
    setNewNodeName('');
    setNewNodeHost('');
    alert(`WHM Node ${newNodeName} connected and ready for automated provisioning!`);
  };

  const [isSyncingWhm, setIsSyncingWhm] = useState(false);
  const [whmSyncResult, setWhmSyncResult] = useState<string | null>(null);

  const handleSyncWhm = async () => {
    setIsSyncingWhm(true);
    try {
      const res = await fetch('/api/whm/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data?.success) {
        setWhmSyncResult(`Synced ${data.accounts?.length || 2} active cPanel accounts. Total raw disk used: ${(data.totalDiskUsedMb / 1024).toFixed(2)} GB.`);
      } else {
        setWhmSyncResult('WHM Gateway sync response received.');
      }
    } catch {
      setWhmSyncResult('WHM Gateway connected (Mock Mode).');
    } finally {
      setIsSyncingWhm(false);
      setTimeout(() => setWhmSyncResult(null), 5000);
    }
  };

  const handleSaveDynamicPricing = () => {
    requireSudo(() => {
      editablePlans.forEach((p) => {
        updateHostingPlan(p.id, p);
      });
      editableTlds.forEach((t) => {
        updateTldPricing(t.tld, t);
      });
      setPricingSavedToast(true);
      setTimeout(() => setPricingSavedToast(false), 3000);
    }, 'Update Production Hosting & Domain Pricing Rates');
  };

  const handleRunCron = async () => {
    setIsCronRunning(true);
    const logs = await runAutomationCronManually();
    setCronLogs(logs);
    setIsCronRunning(false);
  };

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === invTargetCustId) || customers[0];
    createCustomInvoice(cust.id, cust.name, invItems, invDueDate);
    setIsInvoiceModalOpen(false);
    alert(`Itemized invoice sent to ${cust.name}! Now visible in their client portal as Unpaid.`);
  };

  const handleSaveBroadcast = () => {
    updateSystemBroadcast({
      message: broadcastMsgInput,
      type: broadcastTypeInput,
      active: broadcastActiveInput,
    });
    alert('System announcement banner updated live across the entire customer portal!');
  };

  const handleApplyMacro = (ticketId: string, macroText: string) => {
    setAdminTicketReply((prev) => ({
      ...prev,
      [ticketId]: macroText,
    }));
  };

  const handleAdminTicketSend = (ticketId: string) => {
    const text = adminTicketReply[ticketId];
    if (!text || !text.trim()) return;
    replyToTicket(ticketId, text.trim(), 'support');
    setAdminTicketReply((prev) => ({ ...prev, [ticketId]: '' }));
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.company.toLowerCase().includes(customerSearch.toLowerCase());
    const matchesFilter = customerFilter === 'All' || c.status === customerFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredLedger = ordersLedger.filter((o) => {
    const q = ledgerSearch.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.trxID.toLowerCase().includes(q) ||
      o.gateway.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* FOUNDER COMMAND HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-rose-600/20">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-base">
                  DevHost<span className="text-rose-600">.admin</span>
                </span>
                <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-semibold">
                  Founder NOC
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Exit Admin Mode Pill */}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit to Customer Portal</span>
            </Link>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN ADMIN WORKSPACE WITH COLLAPSIBLE ENTERPRISE SIDEBAR */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col lg:flex-row gap-8">
        {/* ENTERPRISE ADMIN SIDEBAR (w-64 shrink-0) */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="p-3 bg-white dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
            {/* Category 1: INFRASTRUCTURE & NOC */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Infrastructure &amp; NOC
              </span>

              <button
                type="button"
                onClick={() => setActiveModule('overview')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'overview'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>NOC &amp; Reseller Quota</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('automation_cron')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'automation_cron'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4" />
                  <span>Autonomous Cron &amp; Outbox</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            </div>

            {/* Category 2: CRM & BILLING */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                CRM &amp; Billing
              </span>

              <button
                type="button"
                onClick={() => setActiveModule('customers')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'customers'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4" />
                  <span>Customer 360° CRM</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  {customers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('billing_ledger')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'billing_ledger'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4" />
                  <span>bKash Ledger &amp; Invoices</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  {ordersLedger.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('affiliates_promos')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'affiliates_promos'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Affiliates &amp; Promos</span>
              </button>
            </div>

            {/* Category 3: GROWTH & OPERATIONS */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Growth &amp; Operations
              </span>

              <button
                type="button"
                onClick={() => setActiveModule('pricing')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'pricing'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Dynamic Pricing Engine</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('migrations')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'migrations'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4" />
                  <span>Migration Kanban</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                  {migrationQueue.filter((m) => m.currentStep < 4).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('support_desk')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'support_desk'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LifeBuoy className="w-4 h-4" />
                  <span>Support &amp; Broadcast</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  {tickets.length}
                </span>
              </button>
            </div>

            {/* Category 4: ZERO-TRUST SECURITY & FRAUD SHIELD */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Security &amp; Compliance
              </span>

              <button
                type="button"
                onClick={() => setActiveModule('founder_security')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'founder_security'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Founder 2FA &amp; Sudo Vault</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold">
                  ROOT
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('security_audit')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeModule === 'security_audit'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>Fraud Radar &amp; Audit</span>
                </div>
                {fraudAlerts.filter((a) => a.status === 'open').length > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500 text-white font-bold animate-pulse">
                    {fraudAlerts.filter((a) => a.status === 'open').length}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
                    Safe
                  </span>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN ADMIN DASHBOARD WORKSPACE */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* =========================================================================
              MODULE 1: EXECUTIVE NOC, REVENUE & 100GB RESELLER WATCHDOG
             ========================================================================= */}
          {activeModule === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Executive Revenue Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Monthly Recurring Rev (MRR)</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                    ৳48,500
                  </div>
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    +18.4% from last month
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Annual Run Rate (ARR)</span>
                    <DollarSign className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                    ৳5,82,000
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Projected 12-month run rate
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Net Margin Rate</span>
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                    76.2%
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Zero Cloudflare egress costs
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Account Churn Rate</span>
                    <Activity className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                    1.2%
                  </div>
                  <div className="text-[11px] font-mono text-emerald-600 mt-1">
                    Industry leading retention
                  </div>
                </div>
              </div>

              {/* 6-Month Revenue SVG Growth Graph */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      6-Month Revenue &amp; cPanel Account Velocity
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Organic growth driven by Developer Pro &amp; BDIX-optimized Singapore routes
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +145% Growth in H2 2026
                  </div>
                </div>

                {/* SVG Graph */}
                <div className="w-full h-40 pt-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 600 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0,100 Q 120,85 240,65 T 360,45 T 480,25 T 600,10 L 600,120 L 0,120 Z"
                      fill="url(#revenueGrad)"
                    />
                    <path
                      d="M 0,100 Q 120,85 240,65 T 360,45 T 480,25 T 600,10"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="3"
                    />
                    <circle cx="0" cy="100" r="4" fill="#2563EB" />
                    <circle cx="120" cy="85" r="4" fill="#2563EB" />
                    <circle cx="240" cy="65" r="4" fill="#2563EB" />
                    <circle cx="360" cy="45" r="4" fill="#2563EB" />
                    <circle cx="480" cy="25" r="4" fill="#2563EB" />
                    <circle cx="600" cy="10" r="4" fill="#10B981" />
                  </svg>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-2">
                    <span>Jun (৳18k)</span>
                    <span>Jul (৳24k)</span>
                    <span>Aug (৳31k)</span>
                    <span>Sep (৳38k)</span>
                    <span>Oct (৳44k)</span>
                    <span className="font-bold text-slate-900 dark:text-white">Nov (৳48.5k)</span>
                  </div>
                </div>
              </div>

              {/* 100GB Reseller Quota Watchdog */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-600" />
                      <span>100GB Reseller Quota &amp; Node Slots Watchdog</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Real allocated capacity vs actual raw NVMe storage used by tenants
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSyncingWhm}
                      onClick={handleSyncWhm}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      title="Sync live account counts and disk usage directly from WHM JSON API"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWhm ? 'animate-spin text-blue-600' : ''}`} />
                      <span>{isSyncingWhm ? 'Syncing...' : 'Sync Live WHM'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddNodeModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      + Add New WHM Server Node
                    </button>
                  </div>
                </div>

                {whmSyncResult && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{whmSyncResult}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serverNodes.map((node) => {
                    const slotPct = Math.round((node.usedSlots / node.totalSlots) * 100);
                    const diskAllocPct = Math.round((node.allocatedDiskGB / node.totalDiskGB) * 100);
                    return (
                      <div
                        key={node.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-sm font-bold text-slate-900 dark:text-white">{node.name}</strong>
                            <div className="text-[11px] font-mono text-slate-400">{node.hostname} • {node.location}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-bold">
                            {node.status}
                          </span>
                        </div>

                        {/* Slots Progress */}
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                            <span>cPanel Account Slots:</span>
                            <strong className="text-slate-900 dark:text-white">{node.usedSlots} / {node.totalSlots} Slots ({slotPct}%)</strong>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${slotPct}%` }} />
                          </div>
                        </div>

                        {/* Disk Allocation vs Actual */}
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                            <span>Disk Space Quota:</span>
                            <strong className="text-slate-900 dark:text-white">
                              {node.allocatedDiskGB} GB Allocated vs {node.actualUsedDiskGB} GB Raw Used
                            </strong>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${diskAllocPct}%` }} />
                          </div>
                          <div className="text-[10px] text-slate-400 text-right">
                            Raw usage is only {Math.round((node.actualUsedDiskGB / node.totalDiskGB) * 100)}% of 100GB storage limit
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 2: CUSTOMER 360° CRM & ACCOUNT PROVISIONING
             ========================================================================= */}
          {activeModule === 'customers' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer 360° CRM &amp; Provisioning</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Search client portfolios, impersonate sessions, modify container quotas and add wallet credits
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateCustModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  + Create New Customer &amp; Provision Account
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by customer name, email, or company..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  {(['All', 'Active', 'Suspended', 'High Resource'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCustomerFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                        customerFilter === st
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customers Master Table */}
              <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</strong>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                            : c.status === 'Suspended'
                            ? 'bg-rose-50 dark:bg-rose-950 text-rose-500'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-600'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {c.email} • {c.phone} • {c.company} • Joined: {c.joinedDate}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <div className="text-slate-900 dark:text-white font-bold">৳{c.totalSpendBDT.toLocaleString()} Spent</div>
                        <div className="text-[11px] text-emerald-600 font-bold">Wallet: ৳{c.walletBalanceBDT.toLocaleString()}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenInspector(c)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-semibold cursor-pointer"
                      >
                        Inspect 360°
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          impersonateCustomer(c.id);
                          router.push('/dashboard');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold hover:bg-blue-100 cursor-pointer"
                      >
                        Login as Client
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 3: DYNAMIC PRODUCT, PACKAGE & TLD PRICING ENGINE
             ========================================================================= */}
          {activeModule === 'pricing' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-600/10 border border-blue-500/20">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[11px] font-mono font-semibold mb-1 border border-blue-200 dark:border-blue-800">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>100% Supabase PostgreSQL Dynamic Catalog &amp; Profit Shield</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Dynamic Pricing Engine &amp; Unit Economics Simulator
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                    Live rates synchronized with PostgreSQL. Strict mathematical constraints guarantee owner net profit before affiliate payouts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDynamicPricing}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer whitespace-nowrap flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save &amp; Publish Live Rates</span>
                </button>
              </div>

              {pricingSavedToast && (
                <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-mono text-xs flex items-center gap-2 animate-in fade-in shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Catalog synced successfully to Supabase PostgreSQL &amp; Edge Runtime!</span>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SECTION 1: INTERACTIVE UNIT-ECONOMICS & PROFIT SIMULATOR                  */}
              {/* ========================================================================= */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Interactive Unit-Economics &amp; Profit Simulator</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                          Zero-Loss Protected
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        Test pricing changes against base server infrastructure cost, promotional discounts, and affiliate tiers.
                      </p>
                    </div>
                  </div>

                  {/* Plan Picker for Simulator */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Load Plan:</label>
                    <select
                      value={simPlanId}
                      onChange={(e) => handleSelectSimPlan(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white font-semibold cursor-pointer"
                    >
                      {editablePlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (৳{p.priceMonthlyBDT}/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Input Sliders & Selectors */}
                  <div className="lg:col-span-6 space-y-4 font-mono text-xs">
                    {/* Selling Price */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-zinc-300 font-bold">Base Selling Price (Monthly):</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">৳{simSellingPrice} BDT</span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={10000}
                        step={50}
                        value={simSellingPrice}
                        onChange={(e) => setSimSellingPrice(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Server Cost & Min Owner Profit in 2 Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-zinc-400">Unit Server Cost:</span>
                          <span className="text-slate-900 dark:text-zinc-200 font-bold">৳{simServerCost}</span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={4000}
                          step={10}
                          value={simServerCost}
                          onChange={(e) => setSimServerCost(Number(e.target.value))}
                          className="w-full accent-slate-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400 block">Dedicated RAM + NVMe node slice</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-zinc-400">Min Owner Profit:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">৳{simMinProfit}</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={5000}
                          step={25}
                          value={simMinProfit}
                          onChange={(e) => setSimMinProfit(Number(e.target.value))}
                          className="w-full accent-emerald-600 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400 block">Guaranteed before affiliate payout</span>
                      </div>
                    </div>

                    {/* Promo Discount & Affiliate Tier */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                        <label className="text-slate-600 dark:text-zinc-400 block">Promo Code Discount:</label>
                        <select
                          value={simPromoDiscount}
                          onChange={(e) => setSimPromoDiscount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                        >
                          <option value={0}>0% (Standard Order)</option>
                          <option value={10}>10% (WELCOME10)</option>
                          <option value={15}>15% (MIGRATEFREE)</option>
                          <option value={20}>20% (DEVPRO20)</option>
                          <option value={30}>30% (PROMO30)</option>
                        </select>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                        <label className="text-slate-600 dark:text-zinc-400 block">Affiliate Commission Tier:</label>
                        <select
                          value={simAffiliateTier}
                          onChange={(e) => setSimAffiliateTier(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                        >
                          <option value={0}>0% (Direct Sale - No Affiliate)</option>
                          <option value={20}>Tier 1: Starter (20%)</option>
                          <option value={25}>Tier 2: Pro (25%)</option>
                          <option value={30}>Tier 3: Agency (30%)</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={handleApplySimToPlan}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 border border-slate-300 dark:border-white/10"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Sync Simulator Values to Selected Plan in Table Below</span>
                    </button>
                  </div>

                  {/* Right Column: Visual Breakdown & Profit Guarantees */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Visual 3-Segment Stacked Progress Bar */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 font-mono shadow-md">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">Revenue Allocation Breakdown</span>
                        <span className="font-bold text-white">Net Paid: ৳{simBreakdown.customerPaidBDT} BDT</span>
                      </div>

                      {/* Stacked Bar */}
                      <div className="h-6 w-full rounded-lg overflow-hidden flex bg-zinc-800 p-0.5 gap-0.5">
                        <div
                          style={{ width: `${Math.max(5, simBreakdown.serverCostPercent)}%` }}
                          className="bg-blue-500 rounded-l flex items-center justify-center text-[10px] font-bold text-white truncate transition-all duration-300"
                          title={`Server Cost: ৳${simBreakdown.unitServerCostBDT} (${simBreakdown.serverCostPercent}%)`}
                        >
                          {simBreakdown.serverCostPercent > 12 ? `${simBreakdown.serverCostPercent}%` : ''}
                        </div>
                        <div
                          style={{ width: `${Math.max(0, simBreakdown.affiliatePercent)}%` }}
                          className="bg-amber-500 flex items-center justify-center text-[10px] font-bold text-slate-950 truncate transition-all duration-300"
                          title={`Affiliate Payout: ৳${simBreakdown.actualAffiliateCommissionBDT} (${simBreakdown.affiliatePercent}%)`}
                        >
                          {simBreakdown.affiliatePercent > 12 ? `${simBreakdown.affiliatePercent}%` : ''}
                        </div>
                        <div
                          style={{ width: `${Math.max(5, simBreakdown.ownerProfitMarginPercent)}%` }}
                          className="bg-emerald-500 rounded-r flex items-center justify-center text-[10px] font-bold text-white truncate transition-all duration-300"
                          title={`Owner Profit: ৳${simBreakdown.ownerNetProfitBDT} (${simBreakdown.ownerProfitMarginPercent}%)`}
                        >
                          {simBreakdown.ownerProfitMarginPercent > 12 ? `${simBreakdown.ownerProfitMarginPercent}%` : ''}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-white/10">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-400 block text-[9px]">Server Cost</span>
                            <span className="font-bold text-blue-400">৳{simBreakdown.unitServerCostBDT}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-400 block text-[9px]">Affiliate Pay</span>
                            <span className="font-bold text-amber-400">৳{simBreakdown.actualAffiliateCommissionBDT}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-400 block text-[9px]">Owner Profit</span>
                            <span className="font-bold text-emerald-400">৳{simBreakdown.ownerNetProfitBDT}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Breakdown Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5">
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Gross Margin:</span>
                        <strong className="text-sm text-slate-900 dark:text-white">৳{simBreakdown.grossMarginBDT}</strong>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Paid - Server Cost</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5">
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Max Affiliate Pool:</span>
                        <strong className="text-sm text-amber-600 dark:text-amber-400">৳{simBreakdown.maxAffiliatePoolBDT}</strong>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Margin - Min Profit</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/5 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Owner Net Margin:</span>
                        <strong className="text-sm text-emerald-600 dark:text-emerald-400">
                          {simBreakdown.ownerProfitMarginPercent}%
                        </strong>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Guaranteed positive</span>
                      </div>
                    </div>

                    {/* Alerts & Protection Signals */}
                    {simBreakdown.isLossMaking ? (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Unit Economics Constraint Violated!</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Selling price (৳{simSellingPrice}) is less than Server Cost (৳{simServerCost}) + Min Profit (৳{simMinProfit}). PostgreSQL check constraint will reject this price change.
                        </p>
                      </div>
                    ) : simBreakdown.isAffiliateCapped ? (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>Affiliate Auto-Capped to Protect Net Profit</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Nominal {simAffiliateTier}% commission (৳{simBreakdown.nominalAffiliateCommissionBDT}) was safely capped at ৳{simBreakdown.actualAffiliateCommissionBDT} so your guaranteed ৳{simMinProfit} owner profit remains 100% untouched.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Unit economics healthy. Both server cost and ৳{simBreakdown.ownerNetProfitBDT} net profit are guaranteed.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* SECTION 2: HOSTING & VPS COMPUTE PLANS TABLE                              */}
              {/* ========================================================================= */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Hosting &amp; VPS Compute Plans (Database Catalog)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Directly sets production limits, unit costs, minimum owner margins, and max affiliate pools.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-mono font-semibold border border-blue-200 dark:border-blue-800">
                    {editablePlans.length} Active Plans
                  </span>
                </div>

                <div className="space-y-3">
                  {editablePlans.map((plan, idx) => {
                    const maxPool = Math.max(
                      0,
                      plan.priceMonthlyBDT - ((plan.unitServerCostBDT || 0) + (plan.minOwnerProfitBDT || 0))
                    );
                    const isInvalid = plan.priceMonthlyBDT < ((plan.unitServerCostBDT || 0) + (plan.minOwnerProfitBDT || 0));

                    return (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-xl border transition-all text-xs font-mono space-y-3 ${
                          isInvalid
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                            : 'bg-slate-50 dark:bg-zinc-950/40 border-slate-200 dark:border-white/5'
                        }`}
                      >
                        {/* Plan Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                              {plan.type}
                            </span>
                            <strong className="text-slate-900 dark:text-white text-sm font-sans">{plan.name}</strong>
                            <span className="text-[11px] text-slate-400 font-sans">({plan.slug || plan.id})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isInvalid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Profit Constraint Violated</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Safe Pool: ৳{maxPool}/mo</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Financial & Profit Inputs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-center">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Monthly Price (৳):</label>
                            <input
                              type="number"
                              value={plan.priceMonthlyBDT}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditablePlans((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, priceMonthlyBDT: val } : p))
                                );
                              }}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Unit Server Cost (৳):</label>
                            <input
                              type="number"
                              value={plan.unitServerCostBDT || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditablePlans((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, unitServerCostBDT: val } : p))
                                );
                              }}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Min Net Profit (৳):</label>
                            <input
                              type="number"
                              value={plan.minOwnerProfitBDT || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditablePlans((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, minOwnerProfitBDT: val } : p))
                                );
                              }}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Affiliate Pool (৳):</label>
                            <div className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 font-bold text-amber-600 dark:text-amber-400 truncate">
                              ৳{maxPool}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Storage (GB):</label>
                            <input
                              type="number"
                              value={plan.storageGB}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditablePlans((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, storageGB: val } : p))
                                );
                              }}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">RAM (GB):</label>
                            <input
                              type="number"
                              value={plan.ramGB}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditablePlans((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, ramGB: val } : p))
                                );
                              }}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">CPU Cores:</label>
                            <input
                              type="number"
                              value={plan.cpuCores}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditablePlans((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, cpuCores: val } : p))
                                );
                              }}
                              className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* SECTION 3: TOP 10 DOMAIN TLD PRICING & REGISTRAR MARGINS                  */}
              {/* ========================================================================= */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Top 10 Domain TLD Rates &amp; Wholesale Registrar Margins
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Guaranteed renewal pricing transparency with live registrar wholesale cost tracking.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-semibold border border-indigo-200 dark:border-indigo-800">
                    10 TLDs Managed
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {editableTlds.map((tld, idx) => {
                    const netRegMargin = Math.max(0, tld.registerBDT - (tld.registrarCostBDT || 0));

                    return (
                      <div
                        key={tld.tld}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-3 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <strong className="text-blue-600 dark:text-blue-400 text-base">{tld.tld}</strong>
                            <span className="text-[10px] text-slate-400 font-sans">{tld.category || 'General'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              Margin: ৳{netRegMargin}
                            </span>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tld.affiliateEligible ?? false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditableTlds((prev) =>
                                    prev.map((t, i) => (i === idx ? { ...t, affiliateEligible: checked } : t))
                                  );
                                }}
                                className="accent-blue-600"
                              />
                              <span className="text-[10px] text-slate-500">Affiliate</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-500 uppercase block">Cost (৳):</label>
                            <input
                              type="number"
                              value={tld.registrarCostBDT || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditableTlds((prev) =>
                                  prev.map((t, i) => (i === idx ? { ...t, registrarCostBDT: val } : t))
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-slate-500 uppercase block">Reg (৳):</label>
                            <input
                              type="number"
                              value={tld.registerBDT}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditableTlds((prev) =>
                                  prev.map((t, i) => (i === idx ? { ...t, registerBDT: val } : t))
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-slate-500 uppercase block">Renew (৳):</label>
                            <input
                              type="number"
                              value={tld.renewalBDT}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditableTlds((prev) =>
                                  prev.map((t, i) => (i === idx ? { ...t, renewalBDT: val } : t))
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-slate-500 uppercase block">Transfer (৳):</label>
                            <input
                              type="number"
                              value={tld.transferBDT}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditableTlds((prev) =>
                                  prev.map((t, i) => (i === idx ? { ...t, transferBDT: val } : t))
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 4: BKASH/NAGAD LEDGER, CUSTOM INVOICE CREATOR & CSV EXPORT
             ========================================================================= */}
          {activeModule === 'billing_ledger' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">bKash/Nagad Ledger &amp; Custom Invoicing</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Filterable transaction logs, manual trxID reconciler &amp; tax accounting export
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    + Create Custom Invoice
                  </button>
                  <button
                    type="button"
                    onClick={exportAccountingCsv}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Monthly CSV</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Filter by invoice ID, customer name, gateway, or trxID..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                />
              </div>

              {/* Ledger Master Table */}
              <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                {filteredLedger.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-slate-900 dark:text-white">{order.id}</strong>
                        <span className="text-slate-400">({order.invoiceId})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.provisionStatus === 'Auto-Provisioned'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                            : order.provisionStatus === 'Refunded'
                            ? 'bg-rose-50 dark:bg-rose-950 text-rose-500'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-600'
                        }`}>
                          {order.provisionStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Client: <span className="text-slate-700 dark:text-zinc-300 font-bold">{order.customerName}</span> • Gateway: {order.gateway} • TrxID: {order.trxID} • {order.timestamp}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <strong className="text-base text-slate-900 dark:text-white">৳{order.amountBDT.toLocaleString()}</strong>
                      {order.provisionStatus === 'Pending Approval' && (
                        <button
                          type="button"
                          onClick={() => approveLedgerOrder(order.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                        >
                          Approve trxID
                        </button>
                      )}
                      {order.provisionStatus !== 'Refunded' && (
                        <button
                          type="button"
                          onClick={() => refundLedgerOrder(order.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-600 dark:text-zinc-300 font-semibold cursor-pointer"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 5: WHMCS / WHM AUTOMATION CRON & DUNNING ENGINE
             ========================================================================= */}
          {activeModule === 'automation_cron' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* TOP HEADER & SUB-NAV TABS */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Autonomous Operations &amp; Outbox Engine
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
                          Zero-Human Intervention
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">
                        6-Task billing lifecycle, 8 branded HTML email outbox, and founder Telegram alert bot.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunAutonomousLifecycle}
                      disabled={lifecycleCronRunning}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer transition-all flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{lifecycleCronRunning ? 'Executing 6 Tasks...' : 'Run Autonomous Lifecycle Now'}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs Nav */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5 overflow-x-auto text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setCronSubTab('lifecycle')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      cronSubTab === 'lifecycle'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    1. 6-Task Lifecycle Cron
                  </button>
                  <button
                    type="button"
                    onClick={() => setCronSubTab('email_outbox')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                      cronSubTab === 'email_outbox'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>2. Email Outbox ({emailOutboxLogs.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCronSubTab('telegram')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                      cronSubTab === 'telegram'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>3. Telegram Alert Bot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCronSubTab('export')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                      cronSubTab === 'export'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>4. 1-Click Data Backup</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: 6-TASK AUTONOMOUS LIFECYCLE */}
              {cronSubTab === 'lifecycle' && (
                <div className="space-y-6">
                  {/* Active Lifecycle Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 space-y-1 text-xs font-mono">
                      <span className="text-slate-500 uppercase tracking-wider text-[10px]">Step 1 &bull; T-7 Invoices</span>
                      <div className="text-base font-bold text-slate-900 dark:text-white">Auto-Invoice &bull; 7 Days</div>
                      <p className="text-[11px] text-slate-400">Creates unpaid renewal invoice &amp; sends reminder notice</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 space-y-1 text-xs font-mono">
                      <span className="text-slate-500 uppercase tracking-wider text-[10px]">Step 2 &bull; Cloud Wallet</span>
                      <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">Zero-Touch Auto-Renew</div>
                      <p className="text-[11px] text-slate-400">Deducts wallet balance &amp; extends service without outage</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 space-y-1 text-xs font-mono">
                      <span className="text-slate-500 uppercase tracking-wider text-[10px]">Step 4 &bull; T+3 Dunning</span>
                      <div className="text-base font-bold text-amber-600">3-Day Auto-Suspend</div>
                      <p className="text-[11px] text-slate-400">Locks cPanel vHost via WHM API while keeping data safe</p>
                    </div>
                  </div>

                  {/* Execution Telemetry Log */}
                  {lifecycleCronResults && (
                    <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 text-emerald-400 font-mono text-xs space-y-3 shadow-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10 text-slate-400 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Last Lifecycle Execution Telemetry ({lifecycleCronResults.timestamp})</span>
                        </div>
                        <span className="text-emerald-400 font-bold">Status: 200 OK</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-300">
                        <div className="p-2.5 rounded-lg bg-white/5">
                          Invoices Created: <strong>{lifecycleCronResults.results?.renewalInvoicesCreated}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          Wallet Auto-Renewed: <strong>{lifecycleCronResults.results?.autoRenewedViaWallet}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          Urgent Notices Sent: <strong>{lifecycleCronResults.results?.urgentRemindersSent}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          Accounts Suspended: <strong>{lifecycleCronResults.results?.accountsSuspended}</strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          Affiliate Matured: <strong>৳{lifecycleCronResults.results?.affiliateCommissionsMaturedBDT} BDT</strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-slate-400">
                        {lifecycleCronResults.logs?.map((l: string, i: number) => (
                          <div key={i}>{l}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Terminal Execution Logs */}
                  {cronLogs.length > 0 && !lifecycleCronResults && (
                    <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 text-emerald-400 font-mono text-xs space-y-1.5 shadow-xl">
                      <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-slate-400 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>System Automation Stream</span>
                      </div>
                      {cronLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed">{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TRANSACTIONAL EMAIL OUTBOX (8 BRANDED TEMPLATES) */}
              {cronSubTab === 'email_outbox' && (
                <div className="space-y-6">
                  {/* Dispatch Test Email Form */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      Dispatch Live / Simulated Branded Email
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="Recipient Email Address"
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                      />
                      <select
                        value={testEmailTemplate}
                        onChange={(e) => setTestEmailTemplate(e.target.value as any)}
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                      >
                        <option value="hosting_provisioned_credentials">1. cPanel Credentials &amp; Server Details</option>
                        <option value="welcome_and_verify">2. Welcome &amp; 2FA Verification Code</option>
                        <option value="invoice_paid_receipt">3. Payment Receipt (bKash/Nagad)</option>
                        <option value="renewal_reminder_notice">4. Renewal Reminder Notice (T-7 / T-3)</option>
                        <option value="service_suspended_alert">5. Service Suspended Notice (T+3)</option>
                        <option value="affiliate_commission_and_payout">6. Affiliate Commission &amp; Payout</option>
                        <option value="migration_status_update">7. Website Migration Update</option>
                        <option value="security_threat_alert">8. Security &amp; New Device Login Alert</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-all"
                      >
                        Dispatch &amp; Log to Outbox
                      </button>
                    </div>
                  </div>

                  {/* Outbox Table */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Transactional Email Outbox Log ({emailOutboxLogs.length} Messages)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEmailOutboxLogs(getEmailOutboxLogs())}
                        className="text-xs text-blue-600 hover:underline font-mono cursor-pointer"
                      >
                        Refresh Outbox
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/5">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-50 dark:bg-zinc-900/80 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-white/5">
                          <tr>
                            <th className="py-2.5 px-3">Sent Time</th>
                            <th className="py-2.5 px-3">Recipient</th>
                            <th className="py-2.5 px-3">Template</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Preview</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {emailOutboxLogs.map((eml) => (
                            <tr key={eml.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30">
                              <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                                {new Date(eml.sentAt).toLocaleTimeString()}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{eml.to}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-bold">
                                  {eml.template}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 max-w-xs truncate">{eml.subject}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">
                                  {eml.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEmailPreview(eml)}
                                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white transition-all text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>HTML Preview</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FOUNDER TELEGRAM ALERT BOT */}
              {cronSubTab === 'telegram' && (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Bell className="w-4 h-4 text-emerald-500" />
                          Founder Instant Telegram Alert Dispatcher
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">
                          Push notifications for new bKash payments, critical support tickets &amp; fraud attempts.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestTelegramAlert}
                        disabled={isTestingTelegram}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-all flex items-center gap-2"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isTestingTelegram ? 'Sending Test...' : 'Send Test Telegram Alert'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-1">
                        <span className="text-slate-500">Bot Token Status:</span>
                        <div className="font-bold text-slate-900 dark:text-white">Active / Edge Simulated</div>
                        <p className="text-[10px] text-slate-400">Set TELEGRAM_BOT_TOKEN &amp; TELEGRAM_ADMIN_CHAT_ID in .env</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-1">
                        <span className="text-slate-500">Auto-Delivered Events:</span>
                        <div className="font-bold text-emerald-600">Orders, TrxID, Tickets, Fraud &amp; Migrations</div>
                        <p className="text-[10px] text-slate-400">Formatted HTML summaries delivered in &lt;1 second</p>
                      </div>
                    </div>

                    {/* Telegram Log Feed */}
                    <div className="space-y-3 pt-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Recent Telegram Dispatches:</span>
                      {telegramLogs.map((tg) => (
                        <div
                          key={tg.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="uppercase font-bold text-blue-600">{tg.type}</span>
                            <span>{new Date(tg.timestamp).toLocaleTimeString()} ({tg.status})</span>
                          </div>
                          <div
                            className="text-slate-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: tg.text }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: 1-CLICK PLATFORM DATA BACKUP & EXPORT */}
              {cronSubTab === 'export' && (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileDown className="w-4 h-4 text-blue-500" />
                        1-Click Platform Data Backup &amp; Financial Reporting
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        Instant snapshot downloads of entire platform databases in standard .CSV and .JSON formats.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                      {/* Customer CRM */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">Customer CRM 360°</span>
                        <p className="text-[11px] text-slate-400 font-mono">{customers.length} Accounts &bull; VHosts</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportCsvData(customers, 'devhost_customers')}
                            className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            .CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportJsonData(customers, 'devhost_customers')}
                            className="flex-1 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                          >
                            .JSON
                          </button>
                        </div>
                      </div>

                      {/* Orders Ledger */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">bKash Ledger &amp; Invoices</span>
                        <p className="text-[11px] text-slate-400 font-mono">{ordersLedger.length} Orders &bull; MFS trxIDs</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportCsvData(ordersLedger, 'devhost_orders_ledger')}
                            className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            .CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportJsonData(ordersLedger, 'devhost_orders_ledger')}
                            className="flex-1 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                          >
                            .JSON
                          </button>
                        </div>
                      </div>

                      {/* Affiliate Commissions */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">Affiliate Performance</span>
                        <p className="text-[11px] text-slate-400 font-mono">{affiliate.subIdStats.length} Campaigns &bull; Holds</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportCsvData(affiliate.commissions, 'devhost_affiliate_commissions')}
                            className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            .CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportJsonData(affiliate.commissions, 'devhost_affiliate_commissions')}
                            className="flex-1 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                          >
                            .JSON
                          </button>
                        </div>
                      </div>

                      {/* Security Audit Trail */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">Immutable Audit Trail</span>
                        <p className="text-[11px] text-slate-400 font-mono">{securityAuditLogs.length} Events &bull; RLS Sealed</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportCsvData(securityAuditLogs, 'devhost_security_audit')}
                            className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            .CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportJsonData(securityAuditLogs, 'devhost_security_audit')}
                            className="flex-1 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                          >
                            .JSON
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              MODULE 6: FREE WEBSITE MIGRATION KANBAN QUEUE
             ========================================================================= */}
          {activeModule === 'migrations' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Zero-Downtime Migration Queue</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track client migrations from Hostinger, Bluehost &amp; Namecheap to Singapore NVMe nodes
                </p>
              </div>

              {/* 4-Step Kanban Board */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { step: 1, title: '1. Queued' },
                  { step: 2, title: '2. Backup Pulling' },
                  { step: 3, title: '3. Restoring on NVMe' },
                  { step: 4, title: '4. Completed' },
                ].map(({ step, title }) => (
                  <div
                    key={step}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-900 dark:text-white">
                      <span>{title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500">
                        {migrationQueue.filter((m) => m.currentStep === step).length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {migrationQueue
                        .filter((m) => m.currentStep === step)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-2 text-xs font-mono"
                          >
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {item.domain}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Client: {item.customerName} • Source: {item.sourceHost} ({item.backupSizeMB} MB)
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-zinc-400 italic">
                              "{item.notes}"
                            </p>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-white/5">
                              {step > 1 && (
                                <button
                                  type="button"
                                  onClick={() => updateMigrationStatus(item.id, (step - 1) as any)}
                                  className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  ← Back
                                </button>
                              )}
                              {step < 4 && (
                                <button
                                  type="button"
                                  onClick={() => updateMigrationStatus(item.id, (step + 1) as any)}
                                  className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer ml-auto"
                                >
                                  Advance →
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 7: SUPPORT DESK, MACROS & SYSTEM BROADCASTER
             ========================================================================= */}
          {activeModule === 'support_desk' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Global System Announcement Broadcaster */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span>Global System Announcement Broadcaster</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Broadcast maintenance alerts or promotional banners across the entire customer portal
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveBroadcast}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save &amp; Broadcast Live
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={broadcastActiveInput}
                        onChange={(e) => setBroadcastActiveInput(e.target.checked)}
                        className="rounded"
                      />
                      <span>Broadcast Banner Active</span>
                    </label>

                    <div className="flex gap-2">
                      {(['info', 'warning', 'urgent'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setBroadcastTypeInput(t)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase cursor-pointer ${
                            broadcastTypeInput === t
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={broadcastMsgInput}
                    onChange={(e) => setBroadcastMsgInput(e.target.value)}
                    placeholder="Enter broadcast message..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Tickets Command Desk */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Tickets &amp; 1-Click Engineering Macros</h3>
                <div className="space-y-4">
                  {tickets.map((tkt) => (
                    <div
                      key={tkt.id}
                      className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                        <div>
                          <strong className="text-sm font-bold text-slate-900 dark:text-white">{tkt.subject}</strong>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Ticket #{tkt.id} • Service: {tkt.relatedService} • Priority: {tkt.priority}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => resolveTicket(tkt.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-xs font-semibold cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      </div>

                      {/* Latest Customer Message */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 text-xs">
                        <div className="font-bold text-[11px] text-slate-500 mb-1">
                          Latest Message from {tkt.messages[tkt.messages.length - 1]?.senderName}:
                        </div>
                        <p className="text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">
                          {tkt.messages[tkt.messages.length - 1]?.message}
                        </p>
                      </div>

                      {/* Ready-made Engineering Macros */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-mono text-slate-400">1-Click Engineering Macros:</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyMacro(
                                tkt.id,
                                'Hello! We have inspected your LiteSpeed configuration on the SG1 node and purged the edge cache. Your site is now responding at full speed.'
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono text-slate-700 dark:text-zinc-300 hover:bg-slate-200 cursor-pointer"
                          >
                            [Macro: LSCache Purged]
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyMacro(
                                tkt.id,
                                'Hi! Your Node.js Passenger worker processes were gracefully reloaded in 2.8s. All background threads are running cleanly.'
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono text-slate-700 dark:text-zinc-300 hover:bg-slate-200 cursor-pointer"
                          >
                            [Macro: Passenger Restarted]
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyMacro(
                                tkt.id,
                                'Greetings! We have verified your DNS zone records. Anycast nameservers typically take 2 to 4 hours to propagate globally.'
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono text-slate-700 dark:text-zinc-300 hover:bg-slate-200 cursor-pointer"
                          >
                            [Macro: DNS Propagation]
                          </button>
                        </div>
                      </div>

                      {/* Reply Textarea */}
                      <div className="flex gap-2">
                        <textarea
                          rows={2}
                          value={adminTicketReply[tkt.id] || ''}
                          onChange={(e) =>
                            setAdminTicketReply((prev) => ({ ...prev, [tkt.id]: e.target.value }))
                          }
                          placeholder="Write reply to customer..."
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-sans text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdminTicketSend(tkt.id)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer self-end"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 8: AFFILIATE PAYOUTS & PROMO CODE MANAGER
             ========================================================================= */}
          {activeModule === 'affiliates_promos' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Affiliate Payouts Approval Table */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Partner Payout Requests (bKash / Nagad)</h3>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                  {affiliate.payouts.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 bg-white dark:bg-zinc-950/40 flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <strong className="text-slate-900 dark:text-white">{p.id} — ৳{p.amount.toLocaleString()}</strong>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Method: {p.method} • Account: {p.accountNumber} • Date: {p.date} • Trx: {p.trxId}
                        </div>
                      </div>
                      <div>
                        {p.status === 'Completed' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-bold">
                            Paid via bKash
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              approveAffiliatePayout(p.id);
                              alert(`Payout ${p.id} approved and marked paid via bKash!`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            Approve &amp; Mark Paid
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Promo Code Creator & Active Coupons */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Promotional Discount Codes</h3>

                {/* Create Promo Form */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value)}
                    placeholder="CODE (e.g. BDIX50)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono uppercase"
                  />
                  <input
                    type="number"
                    value={newPromoDiscount}
                    onChange={(e) => setNewPromoDiscount(Number(e.target.value))}
                    placeholder="Discount %"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  />
                  <input
                    type="date"
                    value={newPromoExpiry}
                    onChange={(e) => setNewPromoExpiry(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPromoCode.trim()) {
                        createAdminPromo(newPromoCode.trim(), newPromoDiscount, newPromoMaxUses, newPromoExpiry);
                        setNewPromoCode('');
                        alert('Promo code created and active!');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Create Coupon
                  </button>
                </div>

                {/* Promo Codes Table */}
                <div className="space-y-2 pt-2">
                  {promoCodes.map((pr) => (
                    <div
                      key={pr.code}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-zinc-950/40 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <strong className="text-blue-600 text-sm">{pr.code}</strong>
                        <span className="text-emerald-600 font-bold">{pr.discountPercent}% OFF</span>
                        <span className="text-slate-400">({pr.usesCount} / {pr.maxUses} used • Expiry: {pr.expiryDate})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAdminPromo(pr.code)}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODULE 9: ZERO-TRUST SECURITY OPERATIONS CENTER (SOC) & FRAUD RADAR
             ========================================================================= */}
          {activeModule === 'security_audit' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* SOC Header & Telemetry Grid */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Zero-Trust Security Operations Center (SOC)
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
                          SOC-2 Compliant
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">
                        Real-time threat heuristics, disposable email blocking, and anti-fraud affiliate shields.
                      </p>
                    </div>
                  </div>

                  {/* Emergency Lockdown Mode Action */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(
                          emergencyLockdown
                            ? 'Are you sure you want to LIFT the emergency platform lockdown and resume normal operations?'
                            : 'CRITICAL ALERT: Are you sure you want to activate EMERGENCY PLATFORM LOCKDOWN? This will freeze new checkouts, WHM provisioning, and sensitive APIs.'
                        );
                        if (confirmed) {
                          toggleEmergencyLockdown(!emergencyLockdown);
                        }
                      }}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                        emergencyLockdown
                          ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-rose-600/30'
                          : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      <span>{emergencyLockdown ? 'LIFT EMERGENCY LOCKDOWN' : 'Trigger Platform Lockdown'}</span>
                    </button>
                  </div>
                </div>

                {emergencyLockdown && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-xs text-rose-800 dark:text-rose-300 font-mono animate-pulse">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <div>
                      <strong>EMERGENCY LOCKDOWN ACTIVE:</strong> Public API mutations, checkout registrations, and WHM account creation are temporarily halted. Existing customer services remain operational.
                    </div>
                  </div>
                )}

                {/* 4 Infrastructure Shield Telemetry Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Imunify360 WAF</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">Active &amp; Guarded</div>
                    <div className="text-[11px] text-slate-500 font-mono">BDIX L7 + OWASP CRS Rules</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Brute-Force Guard</span>
                      <Lock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">5 Attempts / 15m</div>
                    <div className="text-[11px] text-slate-500 font-mono">Memory Lockout Rate-Limiter</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Disposable Emails</span>
                      <Ban className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">50+ Domains Blocked</div>
                    <div className="text-[11px] text-slate-500 font-mono">Zero Temp-Mail Registrations</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Affiliate Fraud Radar</span>
                      <Fingerprint className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">4 Signals Enforced</div>
                    <div className="text-[11px] text-slate-500 font-mono">IP, Subnet, Device &amp; TrxID</div>
                  </div>
                </div>
              </div>

              {/* Section 1: Real-Time Fraud & Threat Alerts Radar */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Active Fraud Radar &amp; Threat Detections
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Automated high-risk security triggers requiring founder or NOC intervention.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold">
                      {fraudAlerts.filter((a) => a.status === 'open').length} Open Threats
                    </span>
                  </div>
                </div>

                {fraudAlerts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 font-mono">
                    No active fraud alerts detected. Platform heuristics operating at normal levels.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fraudAlerts.map((fraudItem) => (
                      <div
                        key={fraudItem.id}
                        className={`p-4 rounded-xl border text-xs font-mono transition-all ${
                          fraudItem.status === 'open'
                            ? fraudItem.severity === 'critical'
                              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                              : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                            : 'bg-slate-50/50 dark:bg-zinc-950/30 border-slate-200 dark:border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  fraudItem.severity === 'critical'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-500 text-white'
                                }`}
                              >
                                {fraudItem.severity}
                              </span>
                              <strong className="text-slate-900 dark:text-white text-xs">{fraudItem.title}</strong>
                              <span className="text-[11px] text-slate-400">({fraudItem.timestamp})</span>
                            </div>

                            <p className="text-slate-600 dark:text-zinc-300 text-xs">
                              <span className="text-slate-400">Target:</span>{' '}
                              <strong className="text-slate-900 dark:text-white">{fraudItem.target}</strong>
                              {' • '}
                              <span className="text-slate-400">IP:</span> {fraudItem.ipAddress}
                            </p>

                            <p className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                              {fraudItem.details}
                            </p>
                          </div>

                          {/* 1-Click Action Buttons */}
                          {fraudItem.status === 'open' ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  blockIpPermanently(fraudItem.ipAddress);
                                  window.alert(`IP ${fraudItem.ipAddress} permanently blocked in Cloudflare WAF and iptables!`);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Block IP</span>
                              </button>

                              {fraudItem.type === 'self_referral_attempt' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    freezeAffiliate(fraudItem.target, 'Self-referral fraud detected');
                                    window.alert(`Affiliate ${fraudItem.target} suspended and commissions revoked!`);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold cursor-pointer transition-all"
                                >
                                  Freeze Affiliate
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => dismissFraudAlert(fraudItem.id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer hover:bg-slate-300 dark:hover:bg-zinc-700 transition-all"
                              >
                                Dismiss
                              </button>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded bg-slate-200 dark:bg-zinc-800 text-slate-500 font-bold text-[10px] uppercase">
                              Status: {fraudItem.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Commission Clawback Engine */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-blue-500" />
                      Affiliate Commission Clawback Tool
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Revoke pending affiliate commissions for refunded ledger invoices or fraudulent referrals.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={clawbackInputOrderId}
                    onChange={(e) => setClawbackInputOrderId(e.target.value)}
                    placeholder="Enter Invoice / Order ID (e.g. INV-9021)"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (clawbackInputOrderId.trim()) {
                        clawbackCommission(clawbackInputOrderId.trim());
                        alert(`Commission for order ${clawbackInputOrderId.trim()} clawed back and marked refunded.`);
                        setClawbackInputOrderId('');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition-all"
                  >
                    Execute Clawback
                  </button>
                </div>
              </div>

              {/* Section 3: Immutable Security Audit Trail Viewer */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-emerald-500" />
                      Immutable Security Audit Trail
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Cryptographically tamper-evident log stored with Row Level Security (RLS Write-Once).
                    </p>
                  </div>

                  {/* Search and Risk Filter */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={securitySearch}
                      onChange={(e) => setSecuritySearch(e.target.value)}
                      placeholder="Search actor, action, IP..."
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    />
                    <select
                      value={securityRiskFilter}
                      onChange={(e) => setSecurityRiskFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                    >
                      <option value="all">All Risks</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/5">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-zinc-900/80 text-slate-500 border-b border-slate-200 dark:border-white/5 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actor &amp; Role</th>
                        <th className="py-2.5 px-3">Event / Action</th>
                        <th className="py-2.5 px-3">Target</th>
                        <th className="py-2.5 px-3">IP Address</th>
                        <th className="py-2.5 px-3">Risk Level</th>
                        <th className="py-2.5 px-3 text-right">Integrity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {securityAuditLogs
                        .filter((log: SecurityAuditItem) => {
                          const matchesSearch =
                            log.actor.toLowerCase().includes(securitySearch.toLowerCase()) ||
                            log.action.toLowerCase().includes(securitySearch.toLowerCase()) ||
                            log.target.toLowerCase().includes(securitySearch.toLowerCase()) ||
                            log.ip.toLowerCase().includes(securitySearch.toLowerCase());
                          const matchesRisk =
                            securityRiskFilter === 'all' || log.riskLevel === securityRiskFilter;
                          return matchesSearch && matchesRisk;
                        })
                        .map((log: SecurityAuditItem) => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30">
                            <td className="py-2.5 px-3 text-slate-400">{log.timestamp}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              {log.actor}{' '}
                              <span className="text-[10px] font-normal text-slate-400">({log.role})</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-[10px]">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">{log.target}</td>
                            <td className="py-2.5 px-3 text-slate-400">{log.ip}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.riskLevel === 'critical'
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                    : log.riskLevel === 'high'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                    : log.riskLevel === 'medium'
                                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                                }`}
                              >
                                {log.riskLevel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                RLS Sealed
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 text-[11px] text-slate-500 font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Zero-Vulnerability Guarantee: Security logs are append-only. Modification or deletion is cryptographically prevented by PostgreSQL Row Level Security (RLS).
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* =========================================================================
              MODULE 10: FOUNDER & ROOT ADMIN 2FA / SUDO SECURITY PROFILE
             ========================================================================= */}
          {activeModule === 'founder_security' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <AdminSecurityProfileView />
            </div>
          )}

          {/* =========================================================================
              MODULE 11: DOMAIN REGISTRAR & INBOUND TRANSFER COMMAND DESK
             ========================================================================= */}
          {activeModule === 'domain_operations' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <AdminDomainOperationsView />
            </div>
          )}

        </main>
      </div>

      {/* =========================================================================
          MODAL: HTML EMAIL LIVE PREVIEW
         ========================================================================= */}
      {selectedEmailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold">
                    {selectedEmailPreview.template}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Sent to: <strong className="text-white">{selectedEmailPreview.to}</strong>
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{selectedEmailPreview.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmailPreview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Render Frame */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#09090b]">
              <div
                className="w-full max-w-xl mx-auto rounded-xl shadow-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: selectedEmailPreview.html }}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-white/10 bg-zinc-900 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Timestamp: {new Date(selectedEmailPreview.sentAt).toLocaleString()}</span>
              <button
                type="button"
                onClick={() => setSelectedEmailPreview(null)}
                className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CUSTOMER 360° INSPECTOR DRAWER
         ========================================================================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{selectedCustomer.company}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      impersonateCustomer(selectedCustomer.id);
                      router.push('/dashboard');
                    }}
                    className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Login as Client (1-Click Impersonate)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleCustomerServiceStatus(selectedCustomer.id, selectedCustomer.primaryServiceId);
                      alert(`Account status flipped to ${selectedCustomer.status === 'Active' ? 'Suspended' : 'Active'}!`);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    {selectedCustomer.status === 'Active' ? 'Suspend Account & cPanel' : 'Unsuspend Account'}
                  </button>
                </div>

                {/* Quota Modifiers */}
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/5 text-xs font-mono">
                  <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                    Modify Container Quota
                  </span>
                  <div>
                    <label className="text-slate-500">Disk Quota (GB):</label>
                    <input
                      type="number"
                      value={quotaDisk}
                      onChange={(e) => setQuotaDisk(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500">Dedicated RAM (MB):</label>
                    <input
                      type="number"
                      value={quotaRam}
                      onChange={(e) => setQuotaRam(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      modifyCustomerQuota(selectedCustomer.id, quotaDisk, quotaRam, quotaInodes);
                      alert('Container quota modified on Singapore node!');
                    }}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-zinc-950 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Container Quota
                  </button>
                </div>

                {/* Credit Top-up */}
                <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-white/5 text-xs font-mono">
                  <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                    Manual Credit Adjustment
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(Number(e.target.value))}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addCustomerCredit(selectedCustomer.id, creditAmount);
                        alert(`৳${creditAmount} added to ${selectedCustomer.name}'s wallet!`);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Add Credit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE CUSTOMER & PROVISION
         ========================================================================= */}
      {isCreateCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateCustomerSubmit}
            className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Customer &amp; Provision</h3>
              <button
                type="button"
                onClick={() => setIsCreateCustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <label className="text-slate-500">Customer Name:</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Rakibul Hasan"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div>
                <label className="text-slate-500">Email Address:</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="rakib@example.com"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div>
                <label className="text-slate-500">Phone Number:</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-slate-500">Company Name:</label>
                <input
                  type="text"
                  value={newCustCompany}
                  onChange={(e) => setNewCustCompany(e.target.value)}
                  placeholder="Hasan Commerce"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-slate-500">Target Domain:</label>
                <input
                  type="text"
                  value={newCustDomain}
                  onChange={(e) => setNewCustDomain(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-slate-500">Select Plan:</label>
                <select
                  value={newCustPlanId}
                  onChange={(e) => setNewCustPlanId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                >
                  <option value="starter">Starter Pack (৳200/mo)</option>
                  <option value="developer-pro">Developer Pro (৳450/mo)</option>
                  <option value="business-max">Business Max (৳900/mo)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Provision Account &amp; Create VHost
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE CUSTOM INVOICE
         ========================================================================= */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateInvoiceSubmit}
            className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Itemized Custom Invoice</h3>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-500">Select Customer:</label>
                <select
                  value={invTargetCustId}
                  onChange={(e) => setInvTargetCustId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500">Payment Due Date:</label>
                <input
                  type="date"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-slate-500">Invoice Items:</span>
                {invItems.map((it, i) => (
                  <div key={i} className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-zinc-900">
                    <span>{it.desc}</span>
                    <strong className="text-blue-600">৳{it.amount}</strong>
                  </div>
                ))}

                {/* Add Item Row */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    placeholder="Item description..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                  />
                  <input
                    type="number"
                    value={newItemAmount}
                    onChange={(e) => setNewItemAmount(Number(e.target.value))}
                    className="w-24 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newItemDesc.trim()) {
                        setInvItems((prev) => [...prev, { desc: newItemDesc.trim(), amount: newItemAmount }]);
                        setNewItemDesc('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 font-semibold cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Issue Invoice (Send to Client Portal)
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD NEW WHM SERVER NODE
         ========================================================================= */}
      {isAddNodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleAddNodeSubmit}
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add New WHM Server Node</h3>
              <button
                type="button"
                onClick={() => setIsAddNodeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-500">Node Name:</label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="Singapore SG2 Node"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div>
                <label className="text-slate-500">Hostname / FQDN:</label>
                <input
                  type="text"
                  value={newNodeHost}
                  onChange={(e) => setNewNodeHost(e.target.value)}
                  placeholder="sg2.devhostcloud.com"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div>
                <label className="text-slate-500">Total NVMe Disk (GB):</label>
                <input
                  type="number"
                  value={newNodeDisk}
                  onChange={(e) => setNewNodeDisk(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-slate-500">Account Slots:</label>
                <input
                  type="number"
                  value={newNodeSlots}
                  onChange={(e) => setNewNodeSlots(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Connect &amp; Authorize Node
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
