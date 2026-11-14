'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Server,
  Layers,
  CheckCircle2,
  ArrowRight,
  Globe,
  Terminal,
  Zap,
  Sparkles,
  CreditCard,
  Wallet,
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
import { convertBdtToUsd } from '@/config/constants';
import {
  UNIVERSAL_MARKETPLACE_STACKS,
  getStackBlueprintBySlug,
  PLAN_SLUG_TO_PID,
  resolveStackSlug,
} from '@/lib/stackProvisioner';

type Region = 'sg' | 'us';
type AppStack = string;
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
  { name: string; slug: string; ram: string; cpu: string; storage: string; inodes: string; monthlyBDT: number; monthlyUSD: number }
> = {
  1: { name: 'Starter Pack', slug: 'starter', ram: '1 GB', cpu: '1 Core', storage: '2 GB NVMe', inodes: '150,000', monthlyBDT: 200, monthlyUSD: 1.67 },
  2: { name: 'Developer Pro', slug: 'developer-pro', ram: '2 GB', cpu: '2 Cores', storage: '5 GB NVMe', inodes: '300,000', monthlyBDT: 450, monthlyUSD: 3.75 },
  3: { name: 'Business Max', slug: 'business-max', ram: '4 GB', cpu: '4 Cores (HF)', storage: '15 GB NVMe', inodes: '600,000', monthlyBDT: 900, monthlyUSD: 7.5 },
  101: { name: 'Cloud KVM-1', slug: 'cloud-kvm-1', ram: '4 GB ECC', cpu: '2 vCPU EPYC', storage: '60 GB NVMe', inodes: '1,000,000', monthlyBDT: 1450, monthlyUSD: 12.08 },
  102: { name: 'Cloud KVM-2', slug: 'cloud-kvm-2', ram: '8 GB ECC', cpu: '4 vCPU EPYC', storage: '120 GB NVMe', inodes: '2,000,000', monthlyBDT: 2750, monthlyUSD: 22.92 },
  103: { name: 'Cloud KVM-4', slug: 'cloud-kvm-4', ram: '16 GB ECC', cpu: '6 vCPU EPYC', storage: '240 GB NVMe', inodes: '5,000,000', monthlyBDT: 5200, monthlyUSD: 43.33 },
  104: { name: 'Cloud KVM-8', slug: 'cloud-kvm-8', ram: '32 GB ECC', cpu: '8 vCPU EPYC', storage: '480 GB NVMe', inodes: '10,000,000', monthlyBDT: 9800, monthlyUSD: 81.67 },
};

export default function StackBuilderDrawer() {
  const router = useRouter();
  const { isStackBuilderOpen, closeStackBuilder, stackBuilderConfig, currency } = useBilling();
  const { walletBalanceBDT, currentUser, promoCodes, dynamicPlans, dynamicTlds, refreshUserData } = usePortal();

  const [region, setRegion] = useState<Region>('sg');
  const [appStack, setAppStack] = useState<AppStack>('nextjs-15-standalone');
  const [selectedPidOverride, setSelectedPidOverride] = useState<number | null>(null);
  const [cycleOverride, setCycleOverride] = useState<{ cfg: unknown; value: Cycle } | null>(null);
  const cycle: Cycle =
    cycleOverride && cycleOverride.cfg === stackBuilderConfig
      ? cycleOverride.value
      : stackBuilderConfig?.defaultBillingCycle || 'monthly';
  const setCycle = (val: Cycle) => setCycleOverride({ cfg: stackBuilderConfig, value: val });
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(20);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Sync incoming stackBuilderConfig when opened
  React.useEffect(() => {
    if (stackBuilderConfig) {
      const timer = window.setTimeout(() => {
        const incomingSlug =
          stackBuilderConfig.selectedStackSlug ||
          (stackBuilderConfig.defaultStack ? resolveStackSlug(stackBuilderConfig.defaultStack) : 'nextjs-15-standalone');
        setAppStack(incomingSlug);
        setSelectedPidOverride(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [stackBuilderConfig]);

  // Real Payment Flow State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [domainOverride, setDomainOverride] = useState<{ cfg: unknown; value: string } | null>(null);
  const [yearsOverride, setYearsOverride] = useState<{ cfg: unknown; value: number } | null>(null);
  const [eppOverride, setEppOverride] = useState<{ cfg: unknown; value: string } | null>(null);
  const [drawerFormError, setDrawerFormError] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'select' | 'manual_verification' | 'submitted'>('select');

  const customDomainInput =
    domainOverride && domainOverride.cfg === stackBuilderConfig
      ? domainOverride.value
      : stackBuilderConfig?.domainName || '';
  const setCustomDomainInput = (val: string) =>
    setDomainOverride({ cfg: stackBuilderConfig, value: val });

  const domainYears =
    yearsOverride && yearsOverride.cfg === stackBuilderConfig
      ? yearsOverride.value
      : stackBuilderConfig?.domainYears || 1;
  const setDomainYears = (val: number) =>
    setYearsOverride({ cfg: stackBuilderConfig, value: val });

  const eppCodeInput =
    eppOverride && eppOverride.cfg === stackBuilderConfig
      ? eppOverride.value
      : stackBuilderConfig?.eppCode || '';
  const setEppCodeInput = (val: string) =>
    setEppOverride({ cfg: stackBuilderConfig, value: val });

  // Free Domain Bundle on Annual Plans
  const [freeDomainQuery, setFreeDomainQuery] = useState('');
  const [selectedFreeTld, setSelectedFreeTld] = useState('.com');
  const [isSearchingDomain, setIsSearchingDomain] = useState(false);
  const [domainCheckResult, setDomainCheckResult] = useState<{
    domain: string;
    available: boolean;
    tld: string;
    checked: boolean;
    error?: string;
  } | null>(null);
  const [claimedFreeDomain, setClaimedFreeDomain] = useState<string | null>(null);

  // Manual Verification Inputs
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string>('');
  const [manualMerchantNumber, setManualMerchantNumber] = useState<string>('');
  const [senderNumber, setSenderNumber] = useState<string>('');
  const [trxId, setTrxId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  if (!isStackBuilderOpen) return null;

  const orderMode = stackBuilderConfig?.orderMode || 'hosting_order';
  const isDomainOrder =
    orderMode === 'domain_registration' ||
    orderMode === 'domain_renewal' ||
    orderMode === 'domain_transfer';

  const activeBlueprint =
    getStackBlueprintBySlug(appStack) || UNIVERSAL_MARKETPLACE_STACKS[0];
  const minRequiredPid =
    stackBuilderConfig?.minPlanPid ||
    PLAN_SLUG_TO_PID[activeBlueprint.recommended_plan_slug]?.pid ||
    1;
  const livePlanMap: Record<number, (typeof PLAN_SPECS)[number]> = { ...PLAN_SPECS };
  for (const dyn of dynamicPlans || []) {
    const matchedPid =
      dyn?.pid && livePlanMap[dyn.pid]
        ? dyn.pid
        : Number(
            Object.entries(livePlanMap).find(
              ([, spec]) => spec.slug === dyn?.slug || spec.slug === dyn?.id
            )?.[0]
          );
    if (matchedPid && livePlanMap[matchedPid]) {
      const mBdt = Number(dyn.priceMonthlyBDT || livePlanMap[matchedPid].monthlyBDT);
      livePlanMap[matchedPid] = {
        ...livePlanMap[matchedPid],
        name: dyn.name || livePlanMap[matchedPid].name,
        ram: dyn.ramGB ? `${dyn.ramGB} GB` : livePlanMap[matchedPid].ram,
        cpu: dyn.cpuCores ? `${dyn.cpuCores} Core${dyn.cpuCores > 1 ? 's' : ''}` : livePlanMap[matchedPid].cpu,
        storage: dyn.storageGB ? `${dyn.storageGB} GB NVMe` : livePlanMap[matchedPid].storage,
        monthlyBDT: mBdt,
        monthlyUSD: convertBdtToUsd(mBdt),
      };
    }
  }

  const rawConfigPid =
    selectedPidOverride ||
    stackBuilderConfig?.pid ||
    stackBuilderConfig?.defaultPlanId ||
    minRequiredPid;
  const pid = Math.max(rawConfigPid, minRequiredPid);
  const selectedPlanSpec = livePlanMap[pid] || livePlanMap[2];
  const hostingPlanName = `${selectedPlanSpec.name} Cloud`;
  const effectiveDomain = (
    customDomainInput.trim() ||
    stackBuilderConfig?.domainName ||
    (isDomainOrder ? '' : 'my-new-app.com')
  ).toLowerCase();

  const matchedTldEntry = [...dynamicTlds]
    .sort((a, b) => b.tld.length - a.tld.length)
    .find((item) => effectiveDomain.endsWith(item.tld.toLowerCase()));
  const unitDomainPriceBDT = matchedTldEntry
    ? orderMode === 'domain_renewal'
      ? matchedTldEntry.renewalBDT
      : orderMode === 'domain_transfer'
      ? matchedTldEntry.transferBDT
      : matchedTldEntry.registerBDT
    : stackBuilderConfig?.basePriceBDT || 1350;
  const effectiveDomainYears = orderMode === 'domain_transfer' ? 1 : Math.max(1, Math.min(3, domainYears));

  const domainOrderTitle =
    orderMode === 'domain_transfer'
      ? `Domain Transfer: ${effectiveDomain || 'domain'}`
      : orderMode === 'domain_renewal'
      ? `Domain Renewal: ${effectiveDomain || 'domain'} (${effectiveDomainYears} Yr)`
      : `Domain Registration: ${effectiveDomain || 'domain'} (${effectiveDomainYears} Yr)`;
  const planName = isDomainOrder ? domainOrderTitle : hostingPlanName;
  const specs = selectedPlanSpec;

  const eligibleFreeTlds = pid === 1 ? ['.xyz', '.shop'] : ['.com', '.net', '.org', '.xyz', '.shop'];

  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';
  const baseMonthly = isBDT ? specs.monthlyBDT : specs.monthlyUSD;

  // Billing calculation
  const isAnnual = !isDomainOrder && cycle === 'annually';
  const annualDiscountMultiplier = 0.8; // 20% OFF
  const effectiveMonthly = isAnnual
    ? isBDT
      ? Math.round(baseMonthly * annualDiscountMultiplier)
      : Number((baseMonthly * annualDiscountMultiplier).toFixed(2))
    : baseMonthly;

  const hostingSubtotal = isAnnual ? effectiveMonthly * 12 : baseMonthly;
  const discountMultiplier = promoApplied ? Math.max(0.1, 1 - appliedDiscountPercent / 100) : 1;
  const domainTotalBDT = Math.round(unitDomainPriceBDT * effectiveDomainYears);
  const finalTotal = isDomainOrder
    ? isBDT
      ? domainTotalBDT
      : convertBdtToUsd(domainTotalBDT)
    : promoApplied
    ? isBDT
      ? Math.round(hostingSubtotal * discountMultiplier)
      : Number((hostingSubtotal * discountMultiplier).toFixed(2))
    : hostingSubtotal;

  const finalAmountBDT = isDomainOrder
    ? domainTotalBDT
    : isBDT
    ? Number(finalTotal)
    : Math.round(Number(finalTotal) * 120);

  const handleApplyPromo = () => {
    setPromoError(null);
    const clean = promoInput.trim().toUpperCase();
    if (!clean) {
      setPromoError('Please enter a voucher code');
      return;
    }

    const activeMatch = promoCodes.find(
      (p) => p.code.toUpperCase() === clean && p.status === 'Active' && p.usesCount < p.maxUses
    );

    if (activeMatch) {
      setAppliedDiscountPercent(activeMatch.discountPercent);
      setPromoApplied(true);
      return;
    }

    const fallbackPromos: Record<string, number> = {
      DEVHOST20: 20,
      DEVPRO20: 20,
      LAUNCH20: 20,
      BDIX50: 50,
      WELCOME10: 10,
    };

    if (fallbackPromos[clean]) {
      setAppliedDiscountPercent(fallbackPromos[clean]);
      setPromoApplied(true);
    } else {
      setPromoApplied(false);
      setPromoError('Invalid, expired, or usage-exhausted coupon code.');
    }
  };

  const handleCheckFreeDomain = async () => {
    if (!freeDomainQuery.trim()) return;
    setIsSearchingDomain(true);
    setDomainCheckResult(null);

    const baseName = freeDomainQuery
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/\..*$/, '');
    const targetTld = eligibleFreeTlds.includes(selectedFreeTld) ? selectedFreeTld : eligibleFreeTlds[0];
    const fullDomain = `${baseName}${targetTld}`;

    try {
      const res = await fetch(`/api/domain-check?domain=${encodeURIComponent(fullDomain)}`);
      const data = await res.json();
      if (!res.ok) {
        setDomainCheckResult({
          domain: fullDomain,
          available: false,
          tld: targetTld,
          checked: true,
          error: data?.error || 'Could not verify live domain availability.',
        });
        return;
      }
      const isAvailable = data.results
        ? Boolean(data.results.find((r: { domain?: string; available?: boolean }) => r.domain === fullDomain)?.available)
        : data.registered === false;
      setDomainCheckResult({
        domain: fullDomain,
        available: isAvailable,
        tld: targetTld,
        checked: true,
      });
    } catch {
      setDomainCheckResult({
        domain: fullDomain,
        available: false,
        tld: targetTld,
        checked: true,
        error: 'Network error while verifying live domain availability. Please retry.',
      });
    } finally {
      setIsSearchingDomain(false);
    }
  };

  const handleClaimFreeDomain = (domainToClaim: string) => {
    setClaimedFreeDomain(domainToClaim);
    setCustomDomainInput(domainToClaim);
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

    const checkoutPayloadBase = isDomainOrder
      ? {
          orderType: orderMode,
          amountBDT: finalAmountBDT,
          currency: 'BDT',
          domain: effectiveDomain,
          years: effectiveDomainYears,
          eppCode: orderMode === 'domain_transfer' ? eppCodeInput.trim() : undefined,
          planName,
          userId: currentUser?.id,
          customerEmail: currentUser?.email,
          customerName: currentUser?.name,
        }
      : {
          orderType: 'hosting_order',
          amountBDT: finalAmountBDT,
          currency: 'BDT',
          domain: effectiveDomain,
          planId: String(pid),
          planName,
          promoCode: promoApplied ? promoInput.trim().toUpperCase() : undefined,
          userId: currentUser?.id,
          customerEmail: currentUser?.email,
          customerName: currentUser?.name,
          billingCycle: cycle,
          freeDomainBundleApplied: Boolean(isAnnual && claimedFreeDomain),
          bundledDomainName: claimedFreeDomain || effectiveDomain,
          appStack: appStack,
        };

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
            ...checkoutPayloadBase,
            gateway: 'wallet',
          }),
        });
        const invData = await invRes.json();
        if (!invRes.ok || !invData.success || !invData.invoiceNumber) {
          throw new Error(invData.error || 'Failed to prepare wallet checkout invoice.');
        }

        const payRes = await fetch('/api/payments/wallet-pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...checkoutPayloadBase,
            invoiceNumber: invData.invoiceNumber,
            amountBDT: invData.amountBDT ?? finalAmountBDT,
          }),
        });

        const payData = await payRes.json();
        if (payRes.ok && payData.success) {
          await refreshUserData();
          setIsPaymentModalOpen(false);
          closeStackBuilder();
          router.push(isDomainOrder ? '/dashboard?tab=domains&paid=1' : '/dashboard?tab=services&paid=1');
        } else {
          setVerificationError(payData.error || 'Wallet payment failed');
        }
      } catch (err: unknown) {
        setVerificationError(err instanceof Error ? err.message : 'Payment failed');
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
          ...checkoutPayloadBase,
          gateway: paymentMethod.toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize payment session');
      }

      // If official gateway redirect URL exists (UddoktaPay, bKash, Nagad, or Stripe Checkout)
      if (
        data.paymentUrl &&
        (data.mode === 'live_uddoktapay' ||
          data.mode === 'live_stripe' ||
          data.mode === 'live_bkash' ||
          data.mode === 'live_nagad')
      ) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Real Merchant bKash/Nagad verification queue
      setCreatedInvoiceNumber(data.invoiceNumber);
      setManualMerchantNumber(data.instructions?.merchantNumber || '');
      setPaymentStep('manual_verification');
    } catch (err: unknown) {
      setVerificationError(err instanceof Error ? err.message : 'Failed to start payment');
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
    } catch (err: unknown) {
      setVerificationError(err instanceof Error ? err.message : 'Failed to submit transaction ID');
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
                  {orderMode === 'domain_transfer'
                    ? 'Transfer Domain to DevHost'
                    : orderMode === 'domain_renewal'
                    ? 'Renew Domain Registration'
                    : isDomainOrder
                    ? 'Register Domain Name'
                    : 'Configure Your Cloud Server'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {isDomainOrder
                    ? 'Includes Anycast Cloudflare DNS, DNSSEC protection & WHOIS Privacy.'
                    : 'Select your datacenter node, runtime stack, and billing cycle.'}
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
            {drawerFormError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{drawerFormError}</span>
              </div>
            )}

            {/* Primary Domain Input */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 dark:text-zinc-200">
                {isDomainOrder ? 'Target Domain Name (FQDN)' : 'Primary Domain or Subdomain'}
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. myapp.com"
                  value={customDomainInput}
                  disabled={orderMode === 'domain_renewal'}
                  onChange={(e) => {
                    setDrawerFormError(null);
                    setCustomDomainInput(e.target.value);
                  }}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 font-mono text-slate-900 dark:text-white disabled:opacity-70"
                />
              </div>
            </div>

            {isDomainOrder ? (
              <div className="space-y-4">
                {orderMode !== 'domain_transfer' ? (
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-800 dark:text-zinc-200">
                      {orderMode === 'domain_renewal' ? 'Renewal Term' : 'Registration Term'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((yrs) => (
                        <button
                          key={yrs}
                          type="button"
                          onClick={() => setDomainYears(yrs)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            effectiveDomainYears === yrs
                              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 font-bold text-blue-600'
                              : 'border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <div className="font-bold">
                            {yrs} {yrs === 1 ? 'Year' : 'Years'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            ৳{(unitDomainPriceBDT * yrs).toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-600" />
                      <span>EPP / Authorization Code (Required from Current Registrar)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Paste unlocked domain EPP / Auth code"
                      value={eppCodeInput}
                      onChange={(e) => {
                        setDrawerFormError(null);
                        setEppCodeInput(e.target.value);
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 font-mono text-slate-900 dark:text-white"
                    />
                    <p className="text-[11px] text-slate-500">
                      AES-256-GCM encrypted before storage. Includes mandatory +1 year ICANN expiry extension upon completion.
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-950 dark:text-emerald-300">
                    <span>Authoritative TLD Checkout Summary</span>
                    <span className="font-mono">
                      ৳{unitDomainPriceBDT.toLocaleString()}/yr
                    </span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-emerald-800/90 dark:text-emerald-300/90">
                    <li>✓ Real-time Registrar API Fulfillment after verified settlement</li>
                    <li>✓ Zero-Cost Cloudflare Anycast DNS Zone &amp; DNSSEC auto-activated</li>
                    <li>✓ Full Registrar Lock, WHOIS Privacy &amp; EPP self-service control</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
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

            {/* Universal 16-Stack Blueprint Selector & Hardware Guard */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800 dark:text-zinc-200">
                  Universal Application Stack Blueprint (16 Stacks)
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                  {activeBlueprint.default_runtime_version}
                </span>
              </div>

              <select
                value={activeBlueprint.slug}
                onChange={(e) => setAppStack(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 font-semibold text-slate-900 dark:text-white"
              >
                {UNIVERSAL_MARKETPLACE_STACKS.map((stk) => (
                  <option key={stk.slug} value={stk.slug}>
                    {stk.name} — [{stk.category}] (Min {stk.min_ram_mb / 1024} GB RAM)
                  </option>
                ))}
              </select>

              <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    {activeBlueprint.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Entry: {activeBlueprint.startup_entry_file}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                  {activeBlueprint.tagline_en}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-[10px] font-mono">
                    DB: {activeBlueprint.requires_database}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-[10px] font-mono">
                    .env Keys: {activeBlueprint.default_env_schema.length} encrypted
                  </span>
                  {activeBlueprint.requires_redis && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                      Redis Socket Ready
                    </span>
                  )}
                  {activeBlueprint.requires_websocket_proxy && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-mono font-bold">
                      WSS Tunnel Enabled
                    </span>
                  )}
                </div>
              </div>

              {/* Hardware Tier Guard Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center justify-between">
                  <span>CloudLinux Hardware Tier (OOM-Protected)</span>
                  {minRequiredPid > 1 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                      Requires ≥ {activeBlueprint.min_ram_mb / 1024} GB RAM
                    </span>
                  )}
                </label>
                <div className={pid >= 100 ? 'grid grid-cols-2 sm:grid-cols-4 gap-2' : 'grid grid-cols-3 gap-2'}>
                  {(pid >= 100 ? [101, 102, 103, 104] : [1, 2, 3]).map((tierId) => {
                    const spec = livePlanMap[tierId];
                    const isLocked = tierId < minRequiredPid;
                    const isSelected = pid === tierId;
                    const displayTierPrice = isBDT ? `৳${spec.monthlyBDT}/mo` : `$${spec.monthlyUSD}/mo`;
                    return (
                      <button
                        key={tierId}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setSelectedPidOverride(tierId)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isLocked
                            ? 'opacity-45 cursor-not-allowed border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-zinc-900/40'
                            : isSelected
                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-600 cursor-pointer'
                            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer'
                        }`}
                      >
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                          <span>{spec.name}</span>
                          {isLocked && <Lock className="w-3 h-3 text-rose-500" />}
                        </div>
                        <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                          {spec.ram} RAM • {displayTierPrice}
                        </div>
                      </button>
                    );
                  })}
                </div>
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

            {/* 1ST-YEAR FREE DOMAIN BUNDLE (UNLOCKED ON ANNUAL BILLING) */}
            {isAnnual && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 dark:border-emerald-500/20 shadow-xs space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
                      🎁
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-300">
                        1st-Year FREE Domain Bundle Unlocked!
                      </h4>
                      <p className="text-[10px] text-emerald-800/80 dark:text-emerald-400">
                        {pid === 1 ? 'Eligible: .xyz, .shop (Wholesale ৳0 Promo)' : 'Eligible: .com, .net, .org, .xyz, .shop (Wholesale ৳0 Promo)'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    ৳0 / 1st Year
                  </span>
                </div>

                {claimedFreeDomain ? (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-mono font-bold text-xs text-emerald-950 dark:text-white">
                        {claimedFreeDomain}
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                        (Attached at ৳0)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClaimedFreeDomain(null)}
                      className="text-[11px] text-slate-500 hover:text-rose-500 underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* TLD Selection Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {eligibleFreeTlds.map((tld) => (
                        <button
                          key={tld}
                          type="button"
                          onClick={() => {
                            setSelectedFreeTld(tld);
                            setDomainCheckResult(null);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                            selectedFreeTld === tld
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:border-emerald-500'
                          }`}
                        >
                          {tld}
                        </button>
                      ))}
                    </div>

                    {/* Domain Search & Check */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder={`Enter name (e.g. mybrand)`}
                          value={freeDomainQuery}
                          onChange={(e) => {
                            setFreeDomainQuery(e.target.value);
                            setDomainCheckResult(null);
                          }}
                          className="w-full h-9 pl-3 pr-14 rounded-xl border border-emerald-500/30 dark:border-emerald-500/20 bg-white dark:bg-zinc-900 font-mono text-slate-900 dark:text-white text-xs"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedFreeTld}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCheckFreeDomain}
                        disabled={isSearchingDomain || !freeDomainQuery.trim()}
                        className="px-3 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isSearchingDomain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Check</span>
                      </button>
                    </div>

                    {/* Domain Check Feedback */}
                    {domainCheckResult && (
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        domainCheckResult.available
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-200'
                      }`}>
                        <div className="flex items-center gap-2 font-mono">
                          {domainCheckResult.available ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span>
                            {domainCheckResult.error ? (
                              domainCheckResult.error
                            ) : (
                              <>
                                <strong>{domainCheckResult.domain}</strong> is{' '}
                                {domainCheckResult.available ? 'available!' : 'already taken.'}
                              </>
                            )}
                          </span>
                        </div>

                        {domainCheckResult.available && !domainCheckResult.error && (
                          <button
                            type="button"
                            onClick={() => handleClaimFreeDomain(domainCheckResult.domain)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                          >
                            Claim ({isBDT ? '৳0' : '$0'})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Mandatory Renewal Transparency Note */}
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed font-sans border-t border-emerald-500/20 pt-2">
                  ℹ️ <strong>Renewal Transparency:</strong> 1st Year Domain Registration is 100% FREE (৳0). Starting Year 2, standard annual domain renewal rate applies.
                </p>
              </div>
            )}

            {/* INSTANT ZERO-TOUCH ACTIVATION BADGE */}
            <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-500/20 text-slate-700 dark:text-zinc-300 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                ⚡
              </div>
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Instant Zero-Touch Activation</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[9px] font-mono font-bold">
                    &lt; 3 Seconds
                  </span>
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                  Paying via Automated bKash/Nagad Gateway, Card, or Wallet activates your cPanel, AutoSSL, and Git CI/CD pipeline in 2 seconds without waiting for manual admin approval.
                </p>
              </div>
            </div>

            {/* Promo Code Input (Hosting Orders Only) */}
            {!isDomainOrder && (
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
            )}
              </>
            )}
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
                if (isDomainOrder) {
                  if (!effectiveDomain || !effectiveDomain.includes('.')) {
                    setDrawerFormError('Please enter a valid domain name (e.g. example.com).');
                    return;
                  }
                  if (orderMode === 'domain_transfer' && !eppCodeInput.trim()) {
                    setDrawerFormError('Please paste the EPP / Authorization code from your current registrar.');
                    return;
                  }
                }
                setDrawerFormError(null);
                setVerificationError(null);
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

                  {!currentUser ? (
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3 text-center">
                      <p className="text-xs font-semibold text-blue-950 dark:text-blue-200">
                        Sign in or create a free DevHost account to complete your verified checkout.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nextPath = typeof window !== 'undefined' ? window.location.pathname : '/cheap-domain-registration-bd';
                            setIsPaymentModalOpen(false);
                            closeStackBuilder();
                            router.push(`/login?next=${encodeURIComponent(nextPath)}`);
                          }}
                          className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Sign In
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextPath = typeof window !== 'undefined' ? window.location.pathname : '/cheap-domain-registration-bd';
                            setIsPaymentModalOpen(false);
                            closeStackBuilder();
                            router.push(`/register?next=${encodeURIComponent(nextPath)}`);
                          }}
                          className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                        >
                          Create Account
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
                          {manualMerchantNumber || (paymentMethod === 'bKash' ? '01700-000000' : '01800-000000')}
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
