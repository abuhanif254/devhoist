'use client';

import React, { useState } from 'react';
import { Check, ArrowRight, ShieldCheck, Sparkles, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { usePortal } from '@/context/PortalContext';
import { useLanguage } from '@/context/LanguageContext';
import { HOSTING_PACKAGES } from '@/config/hostingData';
import { calculateBilling, convertBdtToUsd } from '@/config/constants';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import SpotlightCard from '@/components/ui/SpotlightCard';
import PlanRecommenderQuiz from '@/components/home/PlanRecommenderQuiz';
import { BkashBadge, NagadBadge, StripeBadge } from '@/components/visuals/BrandLogos';

export default function PricingSection() {
  const { billingCycle, setBillingCycle, currency, setCurrency, openStackBuilder } = useBilling();
  const { dynamicPlans } = usePortal();
  const { t } = useLanguage();
  const [mobileActivePlanId, setMobileActivePlanId] = useState<string>('developer-pro');
  const [showPlanFinder, setShowPlanFinder] = useState(false);

  const isAnnual = billingCycle === 'annually';

  return (
    <section id="pricing" className="w-full py-16 sm:py-20 relative bg-slate-50/50 dark:bg-[#090D16] border-b border-slate-200 dark:border-white/[0.07] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{t('pricing_badge')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('pricing_title_1')}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400 mt-1">
              {t('pricing_title_2')}
            </span>
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-2xl mx-auto font-normal leading-relaxed">
            High-speed NVMe cloud hosting engineered with isolated CloudLinux resources, automated GitHub &amp; ZIP deploys, and instant bKash/Nagad checkout.
          </p>

          {/* Billing Cycle Toggle + Currency Switcher + Inline Plan Finder Trigger */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {/* Monthly / Yearly Switch */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-white/10 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`h-8 px-3.5 sm:px-4 rounded-lg transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annually')}
                className={`flex items-center gap-1.5 h-8 px-3.5 sm:px-4 rounded-lg transition-all cursor-pointer ${
                  billingCycle === 'annually'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>Yearly</span>
                <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-white/10 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCurrency('BDT')}
                className={`h-8 px-3 rounded-lg transition-all cursor-pointer ${
                  currency === 'BDT'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                ৳ BDT
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`h-8 px-3 rounded-lg transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                $ USD
              </button>
            </div>

            {/* Inline Smart Plan Finder Toggle (Replaces distant Quiz section) */}
            <button
              type="button"
              onClick={() => setShowPlanFinder((prev) => !prev)}
              aria-expanded={showPlanFinder}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                showPlanFinder
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-blue-400/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Need help choosing? Plan Finder</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPlanFinder ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showPlanFinder && (
            <div className="max-w-4xl mx-auto mt-6 text-left animate-in fade-in slide-in-from-top-2 duration-200">
              <PlanRecommenderQuiz compact onPlanSelected={() => setShowPlanFinder(false)} />
            </div>
          )}
        </div>

        {/* Mobile Sticky Plan Selector Tabs (top-[104px] clears 100px dual-tier Navbar) */}
        <div className="md:hidden sticky top-[104px] z-30 mb-6 p-1 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl shadow-lg flex items-center justify-between gap-1">
          {HOSTING_PACKAGES.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setMobileActivePlanId(plan.id)}
              className={`flex-1 py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all truncate cursor-pointer ${
                mobileActivePlanId === plan.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {plan.name.replace(' Pack', '')}
            </button>
          ))}
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-3">
          {HOSTING_PACKAGES.map((plan) => {
            const override = dynamicPlans?.find((dp) => dp.id === plan.id || dp.slug === plan.id);
            const monthlyBDT = override ? override.priceMonthlyBDT : plan.baseMonthlyBDT;
            const storageText = override ? `${override.storageGB} GB NVMe SSD` : plan.nvmeStorage;
            const ramText = override ? `${override.ramGB} GB RAM` : plan.ram;
            const cpuText = override ? `${override.cpuCores} Core vCPU` : plan.cpu;
            const inodesText = override ? `${override.inodes.toLocaleString()} Inodes` : plan.inodes;
            const bill = calculateBilling(monthlyBDT, isAnnual, currency);
            const isHighlighted = plan.highlighted;
            const isMobileVisible = mobileActivePlanId === plan.id;

            const dynamicTopBullets = [
              `${storageText} Pure NVMe SSD`,
              `${ramText} Dedicated CloudLinux RAM`,
              `${cpuText} | ${plan.ioLimit} Disk I/O`,
            ];

            const nonHardwareFeatures = plan.features.filter(
              (f) =>
                !f.toLowerCase().includes('nvme') &&
                !f.toLowerCase().includes('ram') &&
                !f.toLowerCase().includes('cpu') &&
                !f.toLowerCase().includes('disk i/o') &&
                !f.toLowerCase().includes('core')
            );

            const finalDisplayFeatures = [...dynamicTopBullets, ...nonHardwareFeatures];

            return (
              <SpotlightCard
                key={plan.id}
                className={`flex flex-col rounded-2xl relative transition-all duration-300 ${
                  isHighlighted
                    ? 'bg-white dark:bg-slate-900/95 border-2 border-blue-600 dark:border-blue-500 shadow-xl md:-translate-y-1.5 p-6 sm:p-7 pt-8 sm:pt-9'
                    : 'bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/[0.08] shadow-md hover:border-slate-300 dark:hover:border-white/[0.16] p-6 sm:p-7'
                } ${!isMobileVisible ? 'hidden md:flex' : 'flex'}`}
              >
                {/* Floating "Most Popular" Pill (No longer clipped by SpotlightCard!) */}
                {isHighlighted && (
                  <div className="absolute -top-9 sm:-top-10 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {plan.badge || 'Most Popular / Developer Choice'}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 min-h-[32px] font-normal leading-relaxed">
                    {plan.tagline}
                  </p>
                </div>

                {/* Price Display */}
                <div className="mb-5 pb-5 border-b border-slate-100 dark:border-white/[0.08]">
                  <div className="flex items-baseline gap-1">
                    <AnimatedPrice
                      amount={bill.monthlyEffectivePrice}
                      currencySymbol={bill.symbol}
                      suffix=""
                      className="text-4xl font-extrabold text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/mo</span>
                  </div>

                  {isAnnual ? (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 flex items-center gap-1 font-semibold">
                      <span>✓</span>
                      <span>Billed {bill.formattedTotal}/yr (Save {bill.formattedSavings})</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono">Monthly flexible billing</div>
                  )}

                  {isAnnual ? (
                    <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                      <span className="text-sm shrink-0">🎁</span>
                      <span className="leading-tight">
                        {plan.id === 'starter'
                          ? 'Includes 1st-Year FREE .xyz or .shop Domain (Save ৳290)'
                          : 'Includes 1st-Year FREE .com Domain (Save ৳1,350)'}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annually')}
                      className="mt-2.5 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors group cursor-pointer text-left"
                    >
                      <span>Switch to Yearly billing to claim a 1st-Year FREE Domain</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  )}

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Renewal at same price • Zero hidden rate hikes
                  </div>
                </div>

                {/* Core Hardware Limits */}
                <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/[0.06] space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">NVMe SSD Storage:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{storageText}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Dedicated RAM:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{ramText}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">CPU &amp; Disk I/O:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{cpuText} ({plan.ioLimit})</strong>
                  </div>
                </div>

                {/* Feature Bullet Points */}
                <div className="flex-1 space-y-2.5 mb-6">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    Resource Specifications:
                  </div>
                  {finalDisplayFeatures.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div className="mt-auto">
                  <button
                    type="button"
                    onClick={() =>
                      openStackBuilder({
                        pid: plan.pid,
                        planName: plan.name,
                        basePriceMonthlyBDT: monthlyBDT,
                        basePriceMonthlyUSD: convertBdtToUsd(monthlyBDT),
                        specs: {
                          ram: ramText,
                          cpu: cpuText,
                          storage: storageText,
                          inodes: inodesText,
                        },
                      })
                    }
                    className={`w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                      isHighlighted
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/10'
                    }`}
                  >
                    <span>Deploy {plan.name}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>30-Day Money-Back SLA • Instant Setup</span>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Consolidated Instant Payment & Autonomous Wallet Trust Bar */}
        <div className="mt-10 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-mono font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Zero-Touch Atomic Activation &amp; Auto-Renew</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Verified merchant webhooks credit your wallet or provision servers immediately with predictable renewal rates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <BkashBadge />
            <NagadBadge />
            <StripeBadge />
            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300 font-semibold">
              Atomic Credit Wallet
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
