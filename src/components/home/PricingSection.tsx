'use client';

import React, { useState } from 'react';
import { Check, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { HOSTING_PACKAGES } from '@/config/hostingData';
import { calculateBilling } from '@/config/constants';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { BkashBadge, NagadBadge, StripeBadge } from '@/components/visuals/BrandLogos';

export default function PricingSection() {
  const { billingCycle, setBillingCycle, currency, setCurrency, openStackBuilder } = useBilling();
  const [mobileActivePlanId, setMobileActivePlanId] = useState<string>('developer-pro');

  const isAnnual = billingCycle === 'annually';

  return (
    <section id="pricing" className="w-full py-20 relative bg-slate-50/50 dark:bg-zinc-950 overflow-hidden border-b border-slate-200 dark:border-white/[0.07] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Transparent Pricing Matrix</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Predictable Power.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400 mt-1">
              Zero Hidden Traps.
            </span>
          </h2>
          <p className="mt-3 text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto font-normal leading-relaxed">
            High-speed NVMe cloud hosting engineered with isolated CloudLinux resources, automated GitHub webhooks, and local bKash/Nagad checkout.
          </p>

          {/* Billing Cycle Toggle + Currency Switcher Controls */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Monthly / Yearly Switch */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-zinc-900 border border-slate-300/80 dark:border-white/10 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`h-8 px-4 rounded-lg transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annually')}
                className={`flex items-center gap-1.5 h-8 px-4 rounded-lg transition-all cursor-pointer ${
                  billingCycle === 'annually'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-zinc-900 border border-slate-300/80 dark:border-white/10 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCurrency('BDT')}
                className={`h-8 px-3 rounded-lg transition-all cursor-pointer ${
                  currency === 'BDT'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                ৳ BDT
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`h-8 px-3 rounded-lg transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                $ USD
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-First Sticky Plan Selector Tabs */}
        <div className="md:hidden sticky top-20 z-30 mb-6 p-1 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl shadow-lg flex items-center justify-between gap-1">
          {HOSTING_PACKAGES.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setMobileActivePlanId(plan.id)}
              className={`flex-1 py-1.5 px-2 text-center rounded-lg text-xs font-semibold transition-all truncate ${
                mobileActivePlanId === plan.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {plan.name.replace(' Pack', '')}
            </button>
          ))}
        </div>

        {/* Pricing Cards Grid (Desktop: 3 columns, Mobile: selected tab visible) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {HOSTING_PACKAGES.map((plan) => {
            const bill = calculateBilling(plan.baseMonthlyBDT, isAnnual, currency);
            const isHighlighted = plan.highlighted;
            const isMobileVisible = mobileActivePlanId === plan.id;

            return (
              <SpotlightCard
                key={plan.id}
                className={`flex flex-col rounded-2xl p-6 sm:p-7 relative transition-all duration-300 ${
                  isHighlighted
                    ? 'bg-white dark:bg-zinc-900 border-2 border-blue-600 dark:border-blue-500 shadow-xl md:-translate-y-1.5'
                    : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-md hover:border-slate-300 dark:hover:border-white/[0.16]'
                } ${!isMobileVisible ? 'hidden md:flex' : 'flex'}`}
              >
                {/* Most Popular Badge */}
                {isHighlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-mono font-bold shadow-md shadow-blue-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {plan.badge || 'Recommended'}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 min-h-[32px] font-normal leading-relaxed">
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
                    <span className="text-xs text-slate-500 dark:text-zinc-500 font-mono">/mo</span>
                  </div>

                  {isAnnual ? (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 flex items-center gap-1 font-semibold">
                      <span>✓</span>
                      <span>Billed {bill.formattedTotal}/yr (Save {bill.formattedSavings})</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-zinc-500 mt-1.5 font-mono">Monthly flexible billing</div>
                  )}

                  <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                    Renewal at same price • Zero hidden rate hikes
                  </div>
                </div>

                {/* Core Hardware Limits */}
                <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.06] space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-700 dark:text-zinc-300">
                    <span className="text-slate-500 dark:text-zinc-500">NVMe SSD Storage:</span>
                    <strong className="text-slate-900 dark:text-zinc-100">{plan.nvmeStorage}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-zinc-300">
                    <span className="text-slate-500 dark:text-zinc-500">Dedicated RAM:</span>
                    <strong className="text-slate-900 dark:text-zinc-100">{plan.ram}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-zinc-300">
                    <span className="text-slate-500 dark:text-zinc-500">CPU &amp; Disk I/O:</span>
                    <strong className="text-slate-900 dark:text-zinc-100">{plan.cpu} ({plan.ioLimit})</strong>
                  </div>
                </div>

                {/* Feature Bullet Points */}
                <div className="flex-1 space-y-2.5 mb-6">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-semibold">
                    Resource Specifications:
                  </div>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-zinc-300">
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      openStackBuilder({
                        pid: plan.pid,
                        planName: plan.name,
                        basePriceMonthlyBDT: plan.baseMonthlyBDT,
                        basePriceMonthlyUSD: Number((plan.baseMonthlyBDT / 120).toFixed(2)),
                        specs: {
                          ram: plan.ram,
                          cpu: plan.cpu,
                          storage: plan.nvmeStorage,
                          inodes: plan.inodes,
                        },
                      })
                    }
                    className={`w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                      isHighlighted
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/10'
                    }`}
                  >
                    <span>Deploy {plan.name}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>30-Day Money-Back SLA • Instant Setup</span>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Automated Payment Gateway Preview */}
        <div className="mt-12 p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-mono font-semibold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Automated 3-Step WHMCS Provisioning Pipeline</span>
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Zero Human Delays — Instant Account Delivery
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <BkashBadge />
              <NagadBadge />
              <StripeBadge />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-slate-900 dark:text-white font-semibold">Step 1: Instant Gateway</span>
              <p className="text-slate-600 dark:text-zinc-400 text-[11px] font-sans">Choose bKash, Nagad automated merchant PGW or credit card.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Step 2: Instant Webhook</span>
              <p className="text-slate-600 dark:text-zinc-400 text-[11px] font-sans">Payment verification marks WHMCS invoice as PAID in under 2 seconds.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-slate-900 dark:text-white font-semibold">Step 3: Auto-Provisioning</span>
              <p className="text-slate-600 dark:text-zinc-400 text-[11px] font-sans">WHM sets up cPanel, NVMe quotas &amp; SSH keys and emails credentials instantly.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
