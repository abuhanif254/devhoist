'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Server,
  Layers,
  Cpu,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Globe,
  Terminal,
  Zap,
  Sparkles,
  Tag,
  Clock,
  MessageSquare,
  HelpCircle,
  CreditCard,
  Wallet,
  Phone,
  Key,
  Lock,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { usePortal } from '@/context/PortalContext';
import { WHMCS_CONFIG } from '@/config/whmcs';

type Region = 'sg' | 'us';
type AppStack = 'nextjs_git' | 'wordpress_lscache' | 'laravel_php' | 'clean_cpanel';
type Cycle = 'monthly' | 'annually';
type PaymentMethod = 'bKash' | 'Nagad' | 'Wallet' | 'Stripe';

const REGION_OPTIONS = [
  {
    id: 'sg' as Region,
    name: 'Singapore (Equinix SG1)',
    badge: 'Asia & BD Optimized',
    latency: '~35–45 ms to BD',
    desc: 'Direct BDIX peering routing. Lowest latency for South Asia & Bangladesh visitors.',
  },
  {
    id: 'us' as Region,
    name: 'USA East (Ashburn, VA)',
    badge: 'Global Tier-IV',
    latency: '~180 ms Global Reach',
    desc: 'Equinix Ashburn data corridor. Best for North American & global international traffic.',
  },
];

const STACK_OPTIONS = [
  {
    id: 'nextjs_git' as AppStack,
    name: 'Next.js 15 & Node.js 22 LTS',
    subtitle: 'Zero-Bloat GitHub Actions CI/CD',
    icon: Terminal,
    desc: 'Pre-configured passenger reload, standalone build script & jailed SSH terminal.',
  },
  {
    id: 'wordpress_lscache' as AppStack,
    name: 'WordPress 6.x + LiteSpeed Cache',
    subtitle: 'Enterprise LSCache + Sitejet AI',
    icon: Zap,
    desc: 'Sub-30ms TTFB with object cache (Redis), QUIC.cloud CDN & 1-click staging.',
  },
  {
    id: 'laravel_php' as AppStack,
    name: 'Laravel 11 & PHP 8.3 / Composer',
    subtitle: 'Queue workers & artisan scheduler',
    icon: Layers,
    desc: 'OPcache pre-configured, MariaDB 10.11 InnoDB engine & supervisor process daemon.',
  },
  {
    id: 'clean_cpanel' as AppStack,
    name: 'Standard High-Speed cPanel NVMe',
    subtitle: 'Clean state for custom deployments',
    icon: Server,
    desc: 'Complete blank canvas with Python Selector, Node Selector, Git Version Control & SSL.',
  },
];

const PLAN_SPECS: Record<
  number,
  { ram: string; cpu: string; storage: string; inodes: string; monthlyBDT: number; monthlyUSD: number }
> = {
  1: { ram: '1 GB', cpu: '1 Core', storage: '10 GB NVMe', inodes: '150,000', monthlyBDT: 200, monthlyUSD: 1.67 },
  2: { ram: '2 GB', cpu: '2 Cores', storage: '25 GB NVMe', inodes: '300,000', monthlyBDT: 450, monthlyUSD: 3.75 },
  3: { ram: '4 GB', cpu: '2 Cores (HF)', storage: '50 GB NVMe', inodes: '600,000', monthlyBDT: 900, monthlyUSD: 7.5 },
};

export default function StackBuilderDrawer() {
  const router = useRouter();
  const {
    isStackBuilderOpen,
    closeStackBuilder,
    stackBuilderConfig,
    currency,
  } = useBilling();

  const { walletBalanceBDT, provisionNewOrder } = usePortal();

  const [region, setRegion] = useState<Region>('sg');
  const [appStack, setAppStack] = useState<AppStack>('nextjs_git');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // In-App Checkout Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [customerPhone, setCustomerPhone] = useState('01712345678');
  const [customDomainInput, setCustomDomainInput] = useState('');

  // Live 4-Step Provisioning Simulation State
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionStep, setProvisionStep] = useState(0);
  const [provisionLogs, setProvisionLogs] = useState<string[]>([]);

  if (!isStackBuilderOpen) return null;

  const pid = stackBuilderConfig?.pid || 2;
  const planName = stackBuilderConfig?.planName || 'Developer Pro Cloud';
  const effectiveDomain = customDomainInput.trim() || stackBuilderConfig?.domainName || 'my-new-app.com';
  const specs = PLAN_SPECS[pid] || PLAN_SPECS[2];

  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';
  const baseMonthly = isBDT ? specs.monthlyBDT : specs.monthlyUSD;

  // Billing calculation
  const isAnnual = cycle === 'annually';
  const annualDiscountMultiplier = 0.8; // 20% OFF
  const effectiveMonthly = isAnnual
    ? isBDT
      ? Math.round(baseMonthly * annualDiscountMultiplier)
      : Number((baseMonthly * annualDiscountMultiplier).toFixed(2))
    : baseMonthly;

  const subtotal = isAnnual ? effectiveMonthly * 12 : baseMonthly;
  const finalTotal = promoApplied
    ? isBDT
      ? Math.round(subtotal * 0.8)
      : Number((subtotal * 0.8).toFixed(2))
    : subtotal;

  const handleApplyPromo = () => {
    setPromoError(null);
    const clean = promoInput.trim().toUpperCase();
    if (clean === 'DEVPRO20' || clean === 'LAUNCH20' || clean === 'BDIX50') {
      setPromoApplied(true);
    } else if (clean === '') {
      setPromoError('Please enter a voucher code');
    } else {
      setPromoError('Invalid coupon code. Try DEVPRO20');
    }
  };

  const externalWhmcsCartUrl = `${WHMCS_CONFIG.baseUrl}/cart.php?a=add&pid=${pid}&billingcycle=${cycle}&currency=${currency === 'BDT' ? 1 : 2}`;

  // Execute In-App Payment & 4-Step Live Provisioning
  const handleExecutePayment = async () => {
    setIsProvisioning(true);
    setProvisionStep(1);
    setProvisionLogs([
      `[PROV 00:00:01] Initiating secure gateway handshake with ${paymentMethod}...`,
    ]);

    // Step 1: Verify trxID (1.2s)
    await new Promise((res) => setTimeout(res, 1000));
    const randomTrx = `${paymentMethod.toUpperCase()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    setProvisionStep(2);
    setProvisionLogs((prev) => [
      ...prev,
      `[PROV 00:00:02] Transaction verified: ${randomTrx} (Status: CAPTURED)`,
      `[PROV 00:00:02] Contacting WHM Master node at ${region === 'sg' ? '103.145.22.40 (Singapore SG1)' : '198.51.100.22 (USA East)'}...`,
      `[PROV 00:00:03] Allocating CloudLinux LVE Container: ${specs.ram} RAM, ${specs.cpu} CPU, ${specs.inodes} Inodes.`,
    ]);

    // Step 2: Container allocation (1.2s)
    await new Promise((res) => setTimeout(res, 1200));
    setProvisionStep(3);
    setProvisionLogs((prev) => [
      ...prev,
      `[PROV 00:00:04] LVE Container successfully provisioned. User vhost created: /home/usr_${Math.random().toString(36).substring(2, 8)}`,
      `[PROV 00:00:04] Requesting Sectigo / Let's Encrypt Wildcard TLS 1.3 AutoSSL Certificate...`,
      `[PROV 00:00:05] Generating 4096-bit ED25519 Jailed SSH keypairs...`,
    ]);

    // Step 3: SSL & Keys (1.2s)
    await new Promise((res) => setTimeout(res, 1200));
    setProvisionStep(4);
    setProvisionLogs((prev) => [
      ...prev,
      `[PROV 00:00:06] Wildcard SSL certificate issued & deployed to edge SNI.`,
      `[PROV 00:00:06] Runtime stack initialized: ${appStack.replace('_', ' ').toUpperCase()}`,
      `[PROV 00:00:07] Provisioning Complete! Container ready. Syncing with Dashboard...`,
    ]);

    // Step 4: Inject into Portal Context & Navigate
    await new Promise((res) => setTimeout(res, 1000));
    const newServiceId = await provisionNewOrder({
      planId: pid === 1 ? 'starter' : pid === 2 ? 'developer-pro' : 'business-max',
      planName: `${planName}`,
      domain: effectiveDomain,
      region,
      appStack,
      paymentMethod,
      trxId: randomTrx,
      billingCycle: cycle,
      priceBDT: typeof finalTotal === 'number' ? (isBDT ? finalTotal : Math.round(finalTotal * 120)) : 450,
    });

    setIsProvisioning(false);
    setIsPaymentModalOpen(false);
    closeStackBuilder();

    // Redirect to customer dashboard
    router.push('/dashboard?tab=services');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeStackBuilder}
      />

      {/* Main Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col justify-between">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Custom Stack Builder</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Configure your isolated compute environment before checkout
              </p>
            </div>
            <button
              onClick={closeStackBuilder}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Target Domain Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                <span>Target Domain Name</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 lowercase">can change later</span>
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  placeholder={stackBuilderConfig?.domainName || 'e.g. ecommerce-live.com'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Selected Base Plan Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
                  Selected Base Tier
                </span>
                <div className="text-base font-bold text-slate-900 dark:text-zinc-100">{planName}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                  {specs.ram} Dedicated RAM • {specs.cpu} CPU • {specs.storage} NVMe
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-zinc-50">
                  {symbol}{baseMonthly}
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">/mo</span>
                </div>
              </div>
            </div>

            {/* Region Selector */}
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>1. Datacenter Region (Direct BDIX vs Global)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REGION_OPTIONS.map((reg) => {
                  const isSelected = region === reg.id;
                  return (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => setRegion(reg.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-slate-50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{reg.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {reg.latency}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">{reg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* App Stack Selector */}
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>2. Application Pre-Install Stack</span>
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {STACK_OPTIONS.map((opt) => {
                  const isSelected = appStack === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAppStack(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-slate-50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{opt.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">{opt.subtitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Cycle Selector (Monthly vs Annually) */}
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                <span>3. Billing Cycle</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  20% Off Annual Plans
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    cycle === 'monthly'
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-slate-50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06]'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Monthly Billing</div>
                  <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-1">
                    {symbol}{baseMonthly}/mo
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCycle('annually')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                    cycle === 'annually'
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-slate-50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06]'
                  }`}
                >
                  <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white font-mono">
                    SAVE 20%
                  </span>
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Annual (12 Months)</div>
                  <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    {symbol}{effectiveMonthly}/mo
                    <span className="text-slate-400 font-normal ml-1">({symbol}{effectiveMonthly * 12}/yr)</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Promo / Coupon Code</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="e.g. DEVPRO20"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-zinc-100 uppercase placeholder:normal-case"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoApplied && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Promo DEVPRO20 applied! 20% extra discount included.
                </p>
              )}
              {promoError && (
                <p className="text-xs text-rose-500 font-mono">{promoError}</p>
              )}
            </div>
          </div>

          {/* Drawer Footer / Dual Option Checkout */}
          <div className="p-6 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-950/95 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Total Billed Today</div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-50">
                  {symbol}{finalTotal}
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400 ml-1">
                    {isAnnual ? '/year' : '/month'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> 30-Day Money-Back
                </span>
                <div className="text-[11px] text-slate-500 dark:text-zinc-500">Instant Provision in 2.8s</div>
              </div>
            </div>

            {/* Primary Option A: In-App Checkout & Live Provisioning */}
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-600/20 group cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Instant In-App Checkout &amp; Auto-Provision</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Secondary Option B: External WHMCS Cart Redirect */}
            <div className="text-center">
              <a
                href={externalWhmcsCartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline decoration-slate-300 dark:decoration-zinc-700 transition-colors"
              >
                <span>Or checkout via External WHMCS Cart</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Trust Footer */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-white/[0.04]">
              <a
                href="https://wa.me/8801700000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium hover:underline transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp Live Provisioning Support</span>
              </a>
              <span className="text-slate-300 dark:text-zinc-600">•</span>
              <span>Zero gateway surcharges</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          IN-APP PAYMENT MODAL & 4-STEP LIVE PROVISIONING SIMULATOR
         ===================================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Instant Payment &amp; Auto-Provisioning Gateway</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Deploying {planName} for <span className="font-mono text-slate-900 dark:text-white">{effectiveDomain}</span>
                </p>
              </div>
              {!isProvisioning && (
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {!isProvisioning ? (
                <>
                  {/* Order Spec Snapshot */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-white/5 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Server Node:</span>
                      <strong className="text-slate-900 dark:text-white">
                        {region === 'sg' ? 'Singapore SG1 (Equinix)' : 'USA East (Ashburn VA)'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Pre-installed Stack:</span>
                      <strong className="text-slate-900 dark:text-white">
                        {appStack.replace('_', ' ').toUpperCase()}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Billing Amount:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {symbol}{finalTotal} ({cycle})
                      </strong>
                    </div>
                  </div>

                  {/* Payment Gateway Tabs */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Select Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* bKash */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bKash')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          paymentMethod === 'bKash'
                            ? 'bg-pink-500/10 border-pink-500 ring-1 ring-pink-500 text-pink-600 dark:text-pink-400'
                            : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          bK
                        </div>
                        <div>
                          <div className="text-xs font-bold">bKash Instant</div>
                          <div className="text-[10px] opacity-75">PGW Tokenized API</div>
                        </div>
                      </button>

                      {/* Nagad */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Nagad')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          paymentMethod === 'Nagad'
                            ? 'bg-orange-500/10 border-orange-500 ring-1 ring-orange-500 text-orange-600 dark:text-orange-400'
                            : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          NG
                        </div>
                        <div>
                          <div className="text-xs font-bold">Nagad Merchant</div>
                          <div className="text-[10px] opacity-75">Direct Gateway</div>
                        </div>
                      </button>

                      {/* Cloud Wallet */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Wallet')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          paymentMethod === 'Wallet'
                            ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">Prepaid Wallet</div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                            Balance: ৳{walletBalanceBDT}
                          </div>
                        </div>
                      </button>

                      {/* Stripe Card */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Stripe')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          paymentMethod === 'Stripe'
                            ? 'bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">Visa / Master</div>
                          <div className="text-[10px] opacity-75">Stripe 256-Bit SSL</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Input Fields based on method */}
                  {(paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                        Enter {paymentMethod} Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Instant PIN checkout simulation. No real money deducted in test sandbox.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'Wallet' && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                      Your prepaid cloud wallet will be automatically debited by ৳{finalTotal}. Remaining balance after order: ৳{Math.max(0, walletBalanceBDT - (Number(finalTotal) || 0))}.
                    </div>
                  )}

                  {paymentMethod === 'Stripe' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        readOnly
                        value="4242 •••• •••• 4242"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          readOnly
                          value="12/28"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          readOnly
                          value="CVC: 888"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <span>Complete Payment &amp; Auto-Provision</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </>
              ) : (
                /* LIVE 4-STEP PROVISIONING TRACKER */
                <div className="space-y-6 py-2">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Live Provisioning Engine Active</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Spinning Up Your Container
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Allocating isolated NVMe resources on {region === 'sg' ? 'Equinix SG1' : 'Ashburn VA'}
                    </p>
                  </div>

                  {/* 4 Steps Tracker */}
                  <div className="space-y-3">
                    {/* Step 1 */}
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        provisionStep > 1
                          ? 'bg-emerald-600 text-white'
                          : provisionStep === 1
                          ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                          : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                      }`}>
                        {provisionStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                          1. Verifying Transaction &amp; Gateway Capturing
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {paymentMethod} Tokenized Merchant API
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        provisionStep > 2
                          ? 'bg-emerald-600 text-white'
                          : provisionStep === 2
                          ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                          : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                      }`}>
                        {provisionStep > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                          2. Allocating CloudLinux LVE Container on {region === 'sg' ? 'SG1' : 'USA'} Node
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {specs.ram} RAM, {specs.cpu} CPU, {specs.inodes} Inodes
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        provisionStep > 3
                          ? 'bg-emerald-600 text-white'
                          : provisionStep === 3
                          ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                          : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                      }`}>
                        {provisionStep > 3 ? <CheckCircle2 className="w-4 h-4" /> : '3'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                          3. Generating Wildcard AutoSSL &amp; Jailed SSH Keypairs
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          Sectigo TLS 1.3 + ED25519 Keys
                        </div>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        provisionStep >= 4
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                      }`}>
                        {provisionStep >= 4 ? <CheckCircle2 className="w-4 h-4" /> : '4'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                          4. Provisioning Complete &amp; Syncing with Dashboard
                        </div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                          Redirecting to /dashboard...
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terminal Log Console */}
                  <div className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto border border-white/10">
                    {provisionLogs.map((log, i) => (
                      <div key={i} className="leading-tight">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
