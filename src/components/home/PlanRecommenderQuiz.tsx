'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  Server,
  Terminal,
  ShoppingBag,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Users,
  Sparkles,
} from 'lucide-react';
import { HOSTING_PACKAGES, HostingPlanData } from '@/config/hostingData';
import { useBilling } from '@/context/BillingContext';

type ProjectType = 'wordpress' | 'custom_code' | 'ecommerce';
type WorkloadScale = 'light' | 'moderate' | 'heavy';

export default function PlanRecommenderQuiz() {
  const { currency, billingCycle, openStackBuilder } = useBilling();
  const [step, setStep] = useState<1 | 2>(1);
  const [projectType, setProjectType] = useState<ProjectType>('custom_code');
  const [workloadScale, setWorkloadScale] = useState<WorkloadScale>('moderate');

  // Exact Deterministic Decision Matrix
  const getRecommendation = (): { plan: HostingPlanData; reason: string } => {
    if (projectType === 'ecommerce' || workloadScale === 'heavy') {
      return {
        plan: HOSTING_PACKAGES.find((p) => p.pid === 3)!,
        reason:
          'Your high-traffic/e-commerce workload requires 4GB DDR5 RAM, 100 MB/s Disk I/O, and Automated Daily Cloud Backups.',
      };
    }
    if (projectType === 'custom_code' || workloadScale === 'moderate') {
      return {
        plan: HOSTING_PACKAGES.find((p) => p.pid === 2)!,
        reason:
          'Best match for modern developers: includes 2GB RAM, 2 CPU Cores, Jailed SSH, and 1-Click GitHub Auto-Deployment.',
      };
    }
    return {
      plan: HOSTING_PACKAGES.find((p) => p.pid === 1)!,
      reason:
        'Perfect entry point with 2GB Pure NVMe storage, 1-Click WordPress installer, and Sitejet AI Builder.',
    };
  };

  const recommendation = getRecommendation();
  const isAnnual = billingCycle === 'annually';
  const effectivePriceBDT = isAnnual
    ? recommendation.plan.yearlyEffectiveBDT
    : recommendation.plan.baseMonthlyBDT;
  const displayPrice =
    currency === 'USD'
      ? `$${(effectivePriceBDT / 120).toFixed(2)}`
      : `৳${effectivePriceBDT}`;

  const resetQuiz = () => {
    setStep(1);
    setProjectType('custom_code');
    setWorkloadScale('moderate');
  };

  return (
    <section className="w-full py-16 sm:py-20 relative bg-slate-50/50 dark:bg-zinc-950 border-b border-slate-200 dark:border-white/[0.07] transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/40 p-6 sm:p-8 shadow-md relative overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/[0.08]">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Deterministic Plan Quiz</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                Find Your Ideal Cloud Plan in 2 Steps
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 font-normal">
                Answer 2 quick questions to calculate your exact RAM, CPU, and Inode requirements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">Step {step} of 2</span>
              <button
                type="button"
                onClick={resetQuiz}
                className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/60 border border-slate-200 dark:border-white/5 transition-colors cursor-pointer"
                title="Restart quiz"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step 1: Project Type */}
          {step === 1 && (
            <div className="pt-6 space-y-4 animate-in fade-in duration-150">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                1. What type of application or website are you launching?
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setProjectType('custom_code')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    projectType === 'custom_code'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Next.js / Node.js / Python</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-normal">
                    Custom stack with Git auto-deploy &amp; Jailed SSH
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProjectType('wordpress')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    projectType === 'wordpress'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2" />
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">WordPress / Blog / Agency</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-normal">
                    LiteSpeed caching &amp; Sitejet AI website builder
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProjectType('ecommerce')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    projectType === 'ecommerce'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">E-Commerce / WooCommerce</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-normal">
                    Online stores, bKash checkout &amp; heavy catalog
                  </div>
                </button>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <span>Continue to Step 2</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Workload Scale */}
          {step === 2 && (
            <div className="pt-6 space-y-4 animate-in fade-in duration-150">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                2. What is your expected visitor volume and database load?
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setWorkloadScale('light')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    workloadScale === 'light'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <Users className="w-4 h-4 text-slate-600 dark:text-zinc-300 mb-2" />
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Light / Starter</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                    Under 20,000 visitors/month • Single project
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkloadScale('moderate')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    workloadScale === 'moderate'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-2" />
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Moderate Growth</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                    20,000 – 100,000 visitors/mo • 1 to 5 sites
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkloadScale('heavy')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    workloadScale === 'heavy'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 mb-2" />
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Heavy Traffic / SaaS</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                    100,000+ visitors/mo • Unlimited websites
                  </div>
                </button>
              </div>

              {/* Instant Calculated Result Card */}
              <div className="mt-6 p-5 rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-zinc-950/90 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-800">
                        Calculated Match
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                        {recommendation.plan.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-xl font-normal">
                      {recommendation.reason}
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 pt-1">
                      Allocated: {recommendation.plan.nvmeStorage} NVMe • {recommendation.plan.ram} RAM • {recommendation.plan.cpu}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 font-mono">
                        {displayPrice}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                        {isAnnual ? 'effective/mo' : 'monthly'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openStackBuilder({
                          pid: recommendation.plan.pid,
                          planName: recommendation.plan.name,
                          basePriceMonthlyBDT: recommendation.plan.baseMonthlyBDT,
                          basePriceMonthlyUSD: Number((recommendation.plan.baseMonthlyBDT / 120).toFixed(2)),
                        })
                      }
                      className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Select Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-start">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  ← Back to Step 1
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
