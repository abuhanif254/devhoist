'use client';

import React, { useState } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { EXACT_14_POINT_MATRIX, HOSTING_PACKAGES } from '@/config/hostingData';
import { useBilling } from '@/context/BillingContext';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';

export default function ComparisonMatrix() {
  const { currency, billingCycle, openStackBuilder } = useBilling();
  const [mobileSelectedPlan, setMobileSelectedPlan] = useState<'starter' | 'developer' | 'business'>('developer');

  const isAnnual = billingCycle === 'annually';

  const starterPlan = HOSTING_PACKAGES.find((p) => p.pid === 1)!;
  const devPlan = HOSTING_PACKAGES.find((p) => p.pid === 2)!;
  const businessPlan = HOSTING_PACKAGES.find((p) => p.pid === 3)!;

  const formatPlanPrice = (plan: typeof starterPlan) => {
    const monthlyPrice = isAnnual ? plan.yearlyEffectiveBDT : plan.baseMonthlyBDT;
    if (currency === 'USD') {
      return `$${(monthlyPrice / 120).toFixed(2)}/mo`;
    }
    return `৳${monthlyPrice}/mo`;
  };

  const renderCellContent = (value: string) => {
    if (value.toLowerCase() === 'included') {
      return <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto stroke-[2.5]" />;
    }
    if (value.toLowerCase() === 'not included') {
      return <X className="w-4 h-4 text-slate-300 dark:text-zinc-600 mx-auto" />;
    }
    return <span className="font-mono text-xs text-slate-700 dark:text-zinc-300 font-medium">{value}</span>;
  };

  return (
    <div className="w-full transition-colors duration-200">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
          Exact 14-Point Technical Comparison Matrix
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 font-normal leading-relaxed">
          Transparent breakdown of NVMe storage, dedicated RAM, CPU limits, and developer tooling across all 3 tiers.
        </p>
      </div>

      {/* Mobile Sticky Selector Tabs */}
      <div className="md:hidden sticky top-20 z-30 mb-4 p-1 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-lg shadow-md flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setMobileSelectedPlan('starter')}
          className={`flex-1 py-1.5 px-1 text-center rounded-md text-xs font-semibold transition-all truncate cursor-pointer ${
            mobileSelectedPlan === 'starter'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          Starter ({formatPlanPrice(starterPlan)})
        </button>
        <button
          type="button"
          onClick={() => setMobileSelectedPlan('developer')}
          className={`flex-1 py-1.5 px-1 text-center rounded-md text-xs font-semibold transition-all truncate cursor-pointer ${
            mobileSelectedPlan === 'developer'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          Dev Pro ({formatPlanPrice(devPlan)})
        </button>
        <button
          type="button"
          onClick={() => setMobileSelectedPlan('business')}
          className={`flex-1 py-1.5 px-1 text-center rounded-md text-xs font-semibold transition-all truncate cursor-pointer ${
            mobileSelectedPlan === 'business'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          Biz Max ({formatPlanPrice(businessPlan)})
        </button>
      </div>

      {/* Mobile Single Column View */}
      <div className="md:hidden space-y-2">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
            <div>
              <span className="text-xs font-mono uppercase text-slate-500 dark:text-zinc-400 font-bold">Selected Plan</span>
              <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {mobileSelectedPlan === 'starter'
                  ? starterPlan.name
                  : mobileSelectedPlan === 'developer'
                  ? devPlan.name
                  : businessPlan.name}
              </h4>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-zinc-100">
                {formatPlanPrice(
                  mobileSelectedPlan === 'starter'
                    ? starterPlan
                    : mobileSelectedPlan === 'developer'
                    ? devPlan
                    : businessPlan
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                {isAnnual ? 'annual rate' : 'monthly'}
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06] mt-2">
            {EXACT_14_POINT_MATRIX.map((row) => {
              const val =
                mobileSelectedPlan === 'starter'
                  ? row.starter
                  : mobileSelectedPlan === 'developer'
                  ? row.developer
                  : row.business;

              return (
                <div key={row.feature} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-zinc-400">{row.feature}</span>
                  <div className="text-right">{renderCellContent(val)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                const targetPlan =
                  mobileSelectedPlan === 'starter'
                    ? starterPlan
                    : mobileSelectedPlan === 'developer'
                    ? devPlan
                    : businessPlan;
                openStackBuilder({
                  pid: targetPlan.pid,
                  planName: targetPlan.name,
                  basePriceMonthlyBDT: targetPlan.baseMonthlyBDT,
                  basePriceMonthlyUSD: Number((targetPlan.baseMonthlyBDT / 120).toFixed(2)),
                  specs: {
                    ram: targetPlan.ram,
                    cpu: targetPlan.cpu,
                    storage: targetPlan.nvmeStorage,
                    inodes: targetPlan.inodes,
                  },
                });
              }}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>Instant Deploy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop 4-Column Table */}
      <div className="hidden md:block rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 overflow-hidden shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/60">
              <th className="p-4 sm:p-5 text-xs font-mono font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider w-1/4">
                Feature / Technical Spec
              </th>
              <th className="p-4 sm:p-5 text-center border-l border-slate-200 dark:border-white/[0.08] w-1/4">
                <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">{starterPlan.name}</div>
                <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                  {formatPlanPrice(starterPlan)}
                </div>
              </th>
              <th className="p-4 sm:p-5 text-center border-l border-slate-200 dark:border-white/[0.08] bg-blue-50/50 dark:bg-zinc-900/40 relative w-1/4">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-zinc-800 border border-blue-200 dark:border-white/10 text-[9px] font-mono text-blue-700 dark:text-zinc-300 mb-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Recommended
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">{devPlan.name}</div>
                <div className="text-xs font-mono text-blue-600 dark:text-emerald-400 mt-0.5 font-bold">
                  {formatPlanPrice(devPlan)}
                </div>
              </th>
              <th className="p-4 sm:p-5 text-center border-l border-slate-200 dark:border-white/[0.08] w-1/4">
                <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">{businessPlan.name}</div>
                <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                  {formatPlanPrice(businessPlan)}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
            {EXACT_14_POINT_MATRIX.map((row) => (
              <tr key={row.feature} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors">
                <td className="p-3.5 sm:p-4 font-semibold text-slate-800 dark:text-zinc-300">{row.feature}</td>
                <td className="p-3.5 sm:p-4 text-center border-l border-slate-200 dark:border-white/[0.08]">
                  {renderCellContent(row.starter)}
                </td>
                <td className="p-3.5 sm:p-4 text-center border-l border-slate-200 dark:border-white/[0.08] bg-blue-50/30 dark:bg-zinc-900/20">
                  {renderCellContent(row.developer)}
                </td>
                <td className="p-3.5 sm:p-4 text-center border-l border-slate-200 dark:border-white/[0.08]">
                  {renderCellContent(row.business)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/40">
              <td className="p-4 sm:p-5 font-mono text-xs text-slate-500 dark:text-zinc-400">
                1-Click Provisioning
              </td>
              <td className="p-4 sm:p-5 text-center border-l border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() =>
                    openStackBuilder({
                      pid: starterPlan.pid,
                      planName: starterPlan.name,
                      basePriceMonthlyBDT: starterPlan.baseMonthlyBDT,
                      basePriceMonthlyUSD: Number((starterPlan.baseMonthlyBDT / 120).toFixed(2)),
                      specs: {
                        ram: starterPlan.ram,
                        cpu: starterPlan.cpu,
                        storage: starterPlan.nvmeStorage,
                        inodes: starterPlan.inodes,
                      },
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>Select Starter</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </td>
              <td className="p-4 sm:p-5 text-center border-l border-slate-200 dark:border-white/[0.08] bg-blue-50/50 dark:bg-zinc-900/30">
                <button
                  type="button"
                  onClick={() =>
                    openStackBuilder({
                      pid: devPlan.pid,
                      planName: devPlan.name,
                      basePriceMonthlyBDT: devPlan.baseMonthlyBDT,
                      basePriceMonthlyUSD: Number((devPlan.baseMonthlyBDT / 120).toFixed(2)),
                      specs: {
                        ram: devPlan.ram,
                        cpu: devPlan.cpu,
                        storage: devPlan.nvmeStorage,
                        inodes: devPlan.inodes,
                      },
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <span>Select Developer</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </td>
              <td className="p-4 sm:p-5 text-center border-l border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() =>
                    openStackBuilder({
                      pid: businessPlan.pid,
                      planName: businessPlan.name,
                      basePriceMonthlyBDT: businessPlan.baseMonthlyBDT,
                      basePriceMonthlyUSD: Number((businessPlan.baseMonthlyBDT / 120).toFixed(2)),
                      specs: {
                        ram: businessPlan.ram,
                        cpu: businessPlan.cpu,
                        storage: businessPlan.nvmeStorage,
                        inodes: businessPlan.inodes,
                      },
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>Select Business</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
