'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { convertBdtToUsd, formatCurrency } from '@/config/constants';

export default function SavingsCalculator() {
  const { currency } = useBilling();

  // Input 1: currentAnnualRenewalBDT (Slider from ৳3,000 to ৳25,000, default ৳8,500)
  const [currentAnnualRenewalBDT, setCurrentAnnualRenewalBDT] = useState<number>(8500);

  // Input 2: selectedTargetPlan (Starter = ৳1,920/yr, Developer Pro = ৳4,320/yr, Business Max = ৳8,640/yr)
  const [selectedPlanCostBDT, setSelectedPlanCostBDT] = useState<number>(4320); // Default Developer Pro

  // Exact Mathematical Formulas:
  const yearlySavingsBDT = Math.max(0, currentAnnualRenewalBDT - selectedPlanCostBDT);
  const threeYearSavingsBDT = yearlySavingsBDT * 3;

  const isUSD = currency === 'USD';
  const displayCurrent = formatCurrency(currentAnnualRenewalBDT, currency);
  const displayYearlySavings = formatCurrency(yearlySavingsBDT, currency);
  const displayThreeYearSavings = formatCurrency(threeYearSavingsBDT, currency);

  const planOptions = [
    { name: 'Starter Pack', annualCostBDT: 1920, label: `৳1,920/yr ($${convertBdtToUsd(1920)})` },
    { name: 'Developer Pro', annualCostBDT: 4320, label: `৳4,320/yr ($${convertBdtToUsd(4320)})` },
    { name: 'Business Max', annualCostBDT: 8640, label: `৳8,640/yr ($${convertBdtToUsd(8640)})` },
  ];

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/40 p-6 sm:p-8 shadow-sm glass-card relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Calculator Inputs */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Renewal Cost Savings Calculator</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-zinc-100">
              Stop Paying Extortionate Renewal Hikes
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal leading-relaxed">
              Did your previous host triple their renewal price? Slide your current annual bill below and pick a DevHost Cloud plan to see your real cash savings.
            </p>

            {/* Input 1: Current Annual Renewal Slider */}
            <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Your Current Host Renewal Bill:
                </label>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-3 py-1 rounded-md border border-slate-300 dark:border-white/10 shadow-xs">
                  {displayCurrent} /yr
                </span>
              </div>
              <input
                type="range"
                min="3000"
                max="25000"
                step="500"
                value={currentAnnualRenewalBDT}
                onChange={(e) => setCurrentAnnualRenewalBDT(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-zinc-100"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                <span>{isUSD ? `$${convertBdtToUsd(3000)}` : '৳3,000'}</span>
                <span>{isUSD ? `$${convertBdtToUsd(14000)}` : '৳14,000'}</span>
                <span>{isUSD ? `$${convertBdtToUsd(25000)}/yr` : '৳25,000/yr'}</span>
              </div>
            </div>

            {/* Input 2: Target DevHost Cloud Plan */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Choose Target DevHost Cloud Plan:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {planOptions.map((opt) => (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setSelectedPlanCostBDT(opt.annualCostBDT)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedPlanCostBDT === opt.annualCostBDT
                        ? 'border-blue-500 dark:border-white/30 bg-blue-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                        : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">{opt.name}</div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 mt-0.5">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Calculated Savings Display */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-7 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-950 shadow-md space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08]">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                  Your Net Calculated Savings
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                  Locked-In Pricing
                </span>
              </div>

              {/* 1 Year Savings */}
              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Instant 1-Year Cash Kept in Pocket:</div>
                <div className="text-3xl sm:text-4xl font-semibold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  +{displayYearlySavings}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 font-mono">
                  From 1st renewal forward vs your current host
                </div>
              </div>

              {/* 3 Years Savings */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/[0.06]">
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">3-Year Cumulative Savings:</div>
                <div className="text-2xl sm:text-3xl font-semibold font-mono text-slate-900 dark:text-zinc-100 mt-1">
                  +{displayThreeYearSavings}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 font-mono">
                  Zero price increases upon subsequent year renewals
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-zinc-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="font-normal leading-relaxed">
                  DevHost Cloud guarantees locked-in renewal pricing. The price you pay when you sign up remains your transparent renewal price forever.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
