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
  CreditCard,
  Wallet,
  Phone,
  Key,
  Lock,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Info,
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
  const { isStackBuilderOpen, closeStackBuilder, stackBuilderConfig, currency } = useBilling();
  const { walletBalanceBDT, currentUser } = usePortal();

  const [region, setRegion] = useState<Region>('sg');
  const [appStack, setAppStack] = useState<AppStack>('nextjs_git');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Real Payment Flow State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [paymentStep, setPaymentStep] = useState<'select' | 'manual_verification' | 'submitted'>('select');

  // Manual Verification Inputs
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string>('');
  const [senderNumber, setSenderNumber] = useState<string>('');
  const [trxId, setTrxId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

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

  const finalAmountBDT = isBDT ? Number(finalTotal) : Math.round(Number(finalTotal) * 120);

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

  const copyInvoiceNumber = () => {
    if (createdInvoiceNumber) {
      navigator.clipboard.writeText(createdInvoiceNumber);
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2000);
    }
  };

  // Step A: Initiate Payment Session
  const handleProceedToPayment = async () => {
    setIsSubmitting(true);
    setVerificationError(null);

    // If User chooses Wallet Checkout
    if (paymentMethod === 'Wallet') {
      if (walletBalanceBDT < finalAmountBDT) {
        setVerificationError(
          `Insufficient Wallet Balance. Current: ৳${walletBalanceBDT}, Required: ৳${finalAmountBDT}. Please top up your wallet first.`
        );
        setIsSubmitting(false);
        return;
      }

      try {
        const invRes = await fetch('/api/payments/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: finalAmountBDT,
            currency: 'BDT',
            method: 'wallet',
            domain: effectiveDomain,
            planId: String(pid),
            userId: currentUser?.id,
            customerEmail: currentUser?.email,
            customerName: currentUser?.name,
          }),
        });
        const invData = await invRes.json();
        const invoiceNum = invData.invoiceNumber;

        const payRes = await fetch('/api/payments/wallet-pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id,
            invoiceNumber: invoiceNum,
            amount: finalAmountBDT,
            domain: effectiveDomain,
            planName: planName,
          }),
        });

        const payData = await payRes.json();
        if (payData.success) {
          setIsPaymentModalOpen(false);
          closeStackBuilder();
          router.push('/dashboard?tab=services&paid=1');
        } else {
          setVerificationError(payData.error || 'Wallet payment failed');
        }
      } catch (err: any) {
        setVerificationError(err.message || 'Payment failed');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If User chooses bKash / Nagad / Stripe
    try {
      const res = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmountBDT,
          currency: 'BDT',
          method: paymentMethod.toLowerCase(),
          domain: effectiveDomain,
          planId: String(pid),
          userId: currentUser?.id,
          customerEmail: currentUser?.email,
          customerName: currentUser?.name,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize payment session');
      }

      // If official gateway redirect URL exists (e.g. live UddoktaPay or Stripe checkout)
      if (data.paymentUrl && (data.mode === 'live_uddoktapay' || data.mode === 'live_stripe' || data.mode === 'live_bkash')) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Real Merchant bKash/Nagad verification queue
      setCreatedInvoiceNumber(data.invoiceNumber);
      setPaymentStep('manual_verification');
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to start payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step B: Submit Real trxID for Admin Verification
  const handleSubmitTrxId = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;
    const TRX_REGEX = /^[A-Z0-9]{8,12}$/i;

    if (!BD_PHONE_REGEX.test(senderNumber.trim())) {
      setVerificationError('Please enter a valid 11-digit Bangladesh mobile number (e.g. 01712345678).');
      return;
    }

    if (!TRX_REGEX.test(trxId.trim())) {
      setVerificationError('Transaction ID (trxID) must be 8 to 12 alphanumeric characters (e.g. 9K72LM89QP).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payments/submit-trxid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: createdInvoiceNumber,
          senderNumber: senderNumber.trim(),
          trxId: trxId.trim().toUpperCase(),
          gateway: paymentMethod,
          amount: finalAmountBDT,
          customerName: currentUser?.name || 'Customer',
          userId: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit transaction ID');
      }

      setPaymentStep('submitted');
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to submit transaction ID');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={closeStackBuilder}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Configure Your Cloud Server
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Select your datacenter node, runtime stack, and billing cycle.
                </p>
              </div>
            </div>
            <button
              onClick={closeStackBuilder}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            {/* Primary Domain Input */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 dark:text-zinc-200">
                Primary Domain or Subdomain
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. myapp.com or staging.myapp.com"
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Region Selection */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-800 dark:text-zinc-200">
                Datacenter Location
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REGION_OPTIONS.map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setRegion(reg.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      region === reg.id
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                      <span>{reg.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {reg.latency}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{reg.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* App Stack Selection */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-800 dark:text-zinc-200">
                Runtime Stack &amp; Framework
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STACK_OPTIONS.map((stk) => {
                  const Icon = stk.icon;
                  return (
                    <button
                      key={stk.id}
                      type="button"
                      onClick={() => setAppStack(stk.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        appStack === stk.id
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600'
                          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <Icon className="w-4 h-4 text-blue-600" />
                        <span>{stk.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{stk.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Cycle */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-800 dark:text-zinc-200">
                Billing Cycle
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    cycle === 'monthly'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 font-bold text-blue-600'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  Monthly ({symbol}{baseMonthly}/mo)
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('annually')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    cycle === 'annually'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 font-bold text-blue-600'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  Annually (Save 20% — {symbol}{effectiveMonthly}/mo)
                </button>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Voucher code (e.g. DEVPRO20)"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-3 h-9 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoError && <p className="text-[11px] text-rose-500">{promoError}</p>}
              {promoApplied && (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  ✓ Coupon applied: 20% discount activated!
                </p>
              )}
            </div>
          </div>

          {/* Footer Checkout Bar */}
          <div className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-mono">
                Total Payable:
              </span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                {symbol}{finalTotal}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setPaymentStep('select');
                setIsPaymentModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Proceed to Real Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          GENUINE PAYMENT MODAL (ZERO MOCK TIMERS!)
         ===================================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {paymentStep === 'submitted'
                    ? 'Payment Submitted for Verification'
                    : 'Real-Time Payment & Activation'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {verificationError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{verificationError}</span>
                </div>
              )}

              {/* STEP 1: SELECT METHOD */}
              {paymentStep === 'select' && (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Service:</span>
                      <strong className="text-slate-900 dark:text-white">{planName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Domain:</span>
                      <strong className="text-slate-900 dark:text-white">{effectiveDomain}</strong>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-slate-200 dark:border-white/10">
                      <span className="text-slate-500">Amount:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ৳{finalAmountBDT} BDT
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">
                      Choose Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bKash')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer ${
                          paymentMethod === 'bKash'
                            ? 'bg-pink-500/10 border-pink-500 text-pink-600 font-bold ring-1 ring-pink-500'
                            : 'border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="w-7 h-7 rounded bg-pink-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          bK
                        </div>
                        <div>
                          <div className="text-xs font-bold">bKash</div>
                          <div className="text-[10px] opacity-75">Merchant Verification</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Nagad')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer ${
                          paymentMethod === 'Nagad'
                            ? 'bg-orange-500/10 border-orange-500 text-orange-600 font-bold ring-1 ring-orange-500'
                            : 'border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="w-7 h-7 rounded bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          NG
                        </div>
                        <div>
                          <div className="text-xs font-bold">Nagad</div>
                          <div className="text-[10px] opacity-75">Merchant Verification</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Wallet')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer ${
                          paymentMethod === 'Wallet'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold ring-1 ring-emerald-500'
                            : 'border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">Prepaid Wallet</div>
                          <div className="text-[10px] font-mono text-emerald-600 font-bold">
                            Balance: ৳{walletBalanceBDT}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Stripe')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer ${
                          paymentMethod === 'Stripe'
                            ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 font-bold ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">Credit/Debit Card</div>
                          <div className="text-[10px] opacity-75">Stripe 256-Bit SSL</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'Wallet' && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 text-emerald-800 dark:text-emerald-300">
                      Prepaid balance will be automatically debited by ৳{finalAmountBDT}.
                      {walletBalanceBDT < finalAmountBDT && (
                        <p className="mt-1 font-bold text-rose-600">
                          ⚠️ Insufficient balance! Please top up your wallet first.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Initializing Payment...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {paymentMethod === 'Wallet'
                            ? `Pay ৳${finalAmountBDT} with Wallet`
                            : 'Proceed to Payment Verification'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}

              {/* STEP 2: MANUAL MERCHANT VERIFICATION (bKash/Nagad) */}
              {paymentStep === 'manual_verification' && (
                <form onSubmit={handleSubmitTrxId} className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-mono">Invoice Number:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-blue-600">{createdInvoiceNumber}</span>
                        <button
                          type="button"
                          onClick={copyInvoiceNumber}
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Copy Invoice"
                        >
                          {copiedInvoice ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-mono">Payable Amount:</span>
                      <strong className="text-base text-emerald-600 font-mono font-bold">
                        ৳{finalAmountBDT} BDT
                      </strong>
                    </div>
                  </div>

                  {/* Payment Instructions Box */}
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-950 dark:text-blue-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{paymentMethod} Payment Instructions</span>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                      <li>Open your <strong>{paymentMethod} app</strong> on your mobile phone.</li>
                      <li>
                        Choose <strong>Send Money</strong> or <strong>Payment</strong> to official number:{' '}
                        <strong className="font-mono font-bold underline">
                          {paymentMethod === 'bKash' ? '01789-234567' : '01889-234567'}
                        </strong>
                      </li>
                      <li>Enter exact amount: <strong>৳{finalAmountBDT}</strong></li>
                      <li>Use reference: <strong>{createdInvoiceNumber}</strong></li>
                      <li>Complete payment and copy the <strong>Transaction ID (trxID)</strong>.</li>
                    </ol>
                  </div>

                  {/* Mandatory Verification Inputs */}
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block font-semibold mb-1">
                        1. Sender {paymentMethod} Mobile Number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 01712345678"
                        value={senderNumber}
                        onChange={(e) => setSenderNumber(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">
                        2. Transaction ID (trxID from {paymentMethod} SMS)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 9K72LM89QP"
                        value={trxId}
                        onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 font-mono text-xs uppercase text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 font-mono">
                    Zero-Mock Security Policy: Orders are verified against real bank ledger records. Fake transaction IDs are automatically blocked and logged.
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentStep('select')}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !senderNumber.trim() || !trxId.trim()}
                      className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/20"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting for Verification...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Payment for Verification</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: SUBMISSION COMPLETE */}
              {paymentStep === 'submitted' && (
                <div className="py-4 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Payment Submitted to Verification Queue!
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Invoice <strong className="font-mono text-slate-900 dark:text-white">{createdInvoiceNumber}</strong> with trxID{' '}
                      <strong className="font-mono text-slate-900 dark:text-white">{trxId}</strong> has been routed to our financial control desk.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                    Status: <span className="text-amber-600 font-bold">Pending Admin Verification</span>
                    <br />
                    Server deployment activates automatically once verified.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      closeStackBuilder();
                      router.push('/dashboard?tab=billing');
                    }}
                    className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    View Invoices in Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
