'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
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
} from '@/context/PortalContext';
import { useBilling } from '@/context/BillingContext';

type AdminModule =
  | 'overview'
  | 'automation_cron'
  | 'customers'
  | 'billing_ledger'
  | 'affiliates_promos'
  | 'pricing'
  | 'migrations'
  | 'support_desk';

export default function AdminCommandCenterPage() {
  const router = useRouter();
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
  } = usePortal();

  const { theme, toggleTheme } = useBilling();

  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'All' | 'Active' | 'Suspended' | 'High Resource'>('All');

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

  const handleSaveDynamicPricing = () => {
    editablePlans.forEach((p) => {
      updateHostingPlan(p.id, p);
    });
    editableTlds.forEach((t) => {
      updateTldPricing(t.tld, t);
    });
    setPricingSavedToast(true);
    setTimeout(() => setPricingSavedToast(false), 3000);
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
                  <span>WHM Automation Cron</span>
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
                  <button
                    type="button"
                    onClick={() => setIsAddNodeModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add New WHM Server Node
                  </button>
                </div>

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-600/10 border border-blue-500/20">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Dynamic Product, Package &amp; TLD Pricing Engine
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                    Edit prices, RAM, CPU &amp; disk limits directly. Publishing updates the frontend website, Stack Builder &amp; checkout instantly!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDynamicPricing}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer whitespace-nowrap"
                >
                  Save &amp; Publish Live Rates
                </button>
              </div>

              {pricingSavedToast && (
                <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-mono text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pricing saved! Synchronized across PortalContext and marketing tables.</span>
                </div>
              )}

              {/* Hosting & VPS Plans Table */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hosting &amp; VPS Compute Plans</h3>
                <div className="space-y-3">
                  {editablePlans.map((plan, idx) => (
                    <div
                      key={plan.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center text-xs font-mono"
                    >
                      <div className="sm:col-span-2">
                        <strong className="text-slate-900 dark:text-white text-sm">{plan.name}</strong>
                        <span className="block text-[11px] text-slate-400 truncate">{plan.tagline}</span>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase">Monthly (BDT):</label>
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
                        <label className="text-[10px] text-slate-400 uppercase">Storage (GB):</label>
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
                        <label className="text-[10px] text-slate-400 uppercase">RAM (GB):</label>
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
                        <label className="text-[10px] text-slate-400 uppercase">CPU Cores:</label>
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
                  ))}
                </div>
              </div>

              {/* Domain TLD Pricing Editor */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top 10 Domain TLD Rates (BDT)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editableTlds.map((tld, idx) => (
                    <div
                      key={tld.tld}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <strong className="text-blue-600 text-sm w-16">{tld.tld}</strong>
                      <div className="flex items-center gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400">Reg:</label>
                          <input
                            type="number"
                            value={tld.registerBDT}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableTlds((prev) =>
                                prev.map((t, i) => (i === idx ? { ...t, registerBDT: val } : t))
                              );
                            }}
                            className="w-20 px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400">Renew:</label>
                          <input
                            type="number"
                            value={tld.renewalBDT}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableTlds((prev) =>
                                prev.map((t, i) => (i === idx ? { ...t, renewalBDT: val } : t))
                              );
                            }}
                            className="w-20 px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-600" />
                    <span>WHMCS / WHM Automation Cron &amp; Dunning Engine</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Automated invoice billing cycles, suspension timers &amp; JetBackup sync triggers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunCron}
                  disabled={isCronRunning}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isCronRunning ? 'Running Cron...' : 'Run System Cron Manually Now'}</span>
                </button>
              </div>

              {/* Dunning Rules Settings */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Dunning &amp; Automation Rules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2">
                    <span className="text-slate-500">Invoice Generation:</span>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{dunningRules.invoiceDaysBefore} Days Before Due</div>
                    <p className="text-[10px] text-slate-400">Generates proforma renewal invoice in portal</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2">
                    <span className="text-slate-500">Auto-Suspension:</span>
                    <div className="text-lg font-bold text-amber-600">{dunningRules.autoSuspendDaysAfter} Days Overdue</div>
                    <p className="text-[10px] text-slate-400">cPanel account locked via WHM API</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2">
                    <span className="text-slate-500">Auto-Termination:</span>
                    <div className="text-lg font-bold text-rose-500">{dunningRules.autoTerminateDaysAfter} Days Overdue</div>
                    <p className="text-[10px] text-slate-400">Frees up 100GB slot after backup snapshot</p>
                  </div>
                </div>
              </div>

              {/* Real-time Terminal Cron Execution Logs */}
              {cronLogs.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 text-emerald-400 font-mono text-xs space-y-1.5 shadow-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-slate-400 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>System Automation Execution Stream</span>
                  </div>
                  {cronLogs.map((log, i) => (
                    <div key={i} className="leading-relaxed">{log}</div>
                  ))}
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
        </main>
      </div>

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
