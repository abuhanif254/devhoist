'use client';

import React, { useState } from 'react';
import {
  Check,
  X,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { usePortal } from '@/context/PortalContext';

export default function ComparePageClient() {
  const { currency, openStackBuilder } = useBilling();
  const { dynamicPlans } = usePortal();
  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';

  const [selectedTier, setSelectedTier] = useState<'developer' | 'business'>('developer');

  // Math for 3-Year TCO Calculation
  const isDev = selectedTier === 'developer';
  const devPlan = dynamicPlans?.find((p) => p.slug === 'developer-pro' || p.id === 'developer-pro');
  const bizPlan = dynamicPlans?.find((p) => p.slug === 'business-max' || p.id === 'business-max');
  const devRate = devPlan ? Math.round(devPlan.priceMonthlyBDT * 12 * 0.8) : 4320;
  const bizRate = bizPlan ? Math.round(bizPlan.priceMonthlyBDT * 12 * 0.8) : 8640;

  // DevHost Cloud: Locked price, zero hike, 0% VAT
  const devHostYear1 = isDev ? devRate : bizRate;
  const devHostYear2 = isDev ? devRate : bizRate;
  const devHostYear3 = isDev ? devRate : bizRate;
  const devHost3YearTotal = devHostYear1 + devHostYear2 + devHostYear3;

  // International Shared Hosting (Hostinger / Namecheap):
  // Bait introductory rate Year 1, 300% renewal spikes for Years 2 and 3 + 15% Foreign VAT
  const intlYear1 = isDev ? 3500 : 6500;
  const intlYear2 = isDev ? 11500 : 21000;
  const intlYear3 = isDev ? 11500 : 21000;
  const intlSubtotal = intlYear1 + intlYear2 + intlYear3;
  const intlVat = Math.round(intlSubtotal * 0.15); // 15% Foreign Digital VAT
  const intl3YearTotal = intlSubtotal + intlVat;

  // Vercel Pro / PaaS: $20/seat/mo = $240/yr = ৳28,800/yr + 15% VAT
  const vercelYear1 = isDev ? 28800 : 57600;
  const vercelYear2 = isDev ? 28800 : 57600;
  const vercelYear3 = isDev ? 28800 : 57600;
  const vercelSubtotal = vercelYear1 + vercelYear2 + vercelYear3;
  const vercelVat = Math.round(vercelSubtotal * 0.15);
  const vercel3YearTotal = vercelSubtotal + vercelVat;

  const savingsVsIntl = intl3YearTotal - devHost3YearTotal;
  const savingsVsVercel = vercel3YearTotal - devHost3YearTotal;

  const comparisonRows = [
    {
      feature: 'GitHub Push Auto-Deploy',
      devhost: 'Native Actions Runner + Passenger Reload (2.8s)',
      traditional: 'Manual FTP / Complex cPanel Git with build bloat',
      vercel: 'Proprietary Serverless Build Pipeline',
      devStatus: true,
      tradStatus: false,
      vercelStatus: true,
    },
    {
      feature: 'In-Place Overwrite (80% Disk Saved)',
      devhost: 'Zero duplicate node_modules; traces standalone build',
      traditional: 'Inode exhaustion; builds crash shared cPanel quotas',
      vercel: 'Serverless output zipped with 250MB limit',
      devStatus: true,
      tradStatus: false,
      vercelStatus: true,
    },
    {
      feature: 'Included MySQL & PostgreSQL DB',
      devhost: 'Unlimited local databases included on pure NVMe',
      traditional: 'Slow spinning SATA disks; no PostgreSQL',
      vercel: 'None included; requires $20/mo paid DB addons',
      devStatus: true,
      tradStatus: false,
      vercelStatus: false,
    },
    {
      feature: 'Professional Business Webmail',
      devhost: 'Unlimited webmail with automated SPF/DKIM records',
      traditional: 'Often throttled, blacklisted IP ranges',
      vercel: 'None; requires Google Workspace ($7/seat/mo)',
      devStatus: true,
      tradStatus: false,
      vercelStatus: false,
    },
    {
      feature: 'Full cPanel & File Manager Access',
      devhost: 'Full GUI + phpMyAdmin + Cron + SSL Manager',
      traditional: 'Standard cPanel available',
      vercel: 'No GUI file manager or raw disk access',
      devStatus: true,
      tradStatus: true,
      vercelStatus: false,
    },
    {
      feature: 'Jailed SSH & WP-CLI Terminal',
      devhost: 'Pre-activated Jailed SSH, Composer, npm & WP-CLI',
      traditional: 'Disabled by default; requires passport verification',
      vercel: 'No SSH terminal access',
      devStatus: true,
      tradStatus: false,
      vercelStatus: false,
    },
    {
      feature: 'Predictable Flat Pricing (No Bandwidth Shock)',
      devhost: 'Locked renewal rate forever; zero surprise overages',
      traditional: 'Introductory bait; 300% renewal price spikes',
      vercel: 'High bandwidth risk ($40 per 100GB overage)',
      devStatus: true,
      tradStatus: false,
      vercelStatus: false,
    },
    {
      feature: 'Native bKash & Nagad Checkout (0% VAT)',
      devhost: 'Instant activation via merchant PGW; 0% foreign tax',
      traditional: 'Requires dual-currency card + 15% digital bank VAT',
      vercel: 'International USD credit card only + 15% VAT',
      devStatus: true,
      tradStatus: false,
      vercelStatus: false,
    },
    {
      feature: 'LiteSpeed Enterprise + LSCache',
      devhost: 'Sub-30ms TTFB with QUIC.cloud HTTP/3',
      traditional: 'Legacy Apache or budget Nginx proxy',
      vercel: 'Edge CDN caching',
      devStatus: true,
      tradStatus: false,
      vercelStatus: true,
    },
    {
      feature: 'Free Engineer-Handled Migration',
      devhost: '100% Free zero-downtime transfer by Linux engineers',
      traditional: 'Automated generic plugins or paid ticket service',
      vercel: 'Manual rewrite required for serverless migration',
      devStatus: true,
      tradStatus: false,
      vercelStatus: false,
    },
  ];

  return (
    <div className="space-y-16 transition-colors duration-200">
      {/* -------------------------------------------------------------------- */}
      {/* PART A: 3-YEAR TCO & FOREIGN VAT CALCULATOR                          */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
              3-Year Total Cost of Ownership (TCO) Calculator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
              Real mathematical comparison including bait renewal price hikes and Bangladesh Bank 15% Foreign Digital VAT.
            </p>
          </div>

          {/* Tier Selector */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-semibold">
            <button
              onClick={() => setSelectedTier('developer')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                selectedTier === 'developer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Developer Pro Plan
            </button>
            <button
              onClick={() => setSelectedTier('business')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                selectedTier === 'business'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Business Max Plan
            </button>
          </div>
        </div>

        {/* 3 Cards Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. DevHost Cloud Card */}
          <div className="rounded-xl border border-blue-300 dark:border-emerald-500/30 bg-blue-50/50 dark:bg-zinc-900/90 p-6 flex flex-col justify-between relative shadow-xl ring-1 ring-blue-300 dark:ring-emerald-500/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-blue-700 dark:text-emerald-400 font-bold">
                  DevHost Cloud (Our Platform)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-emerald-500/20 text-blue-800 dark:text-emerald-300 border border-blue-200 dark:border-emerald-500/30 font-bold">
                  Locked Price
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono font-medium">3-Year Total Cost:</div>
                <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-zinc-50 mt-1">
                  {symbol}{devHost3YearTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono mt-1 font-semibold">
                  {symbol}{devHostYear1.toLocaleString()}/yr locked for 3 years
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-700 dark:text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-500">Year 1:</span>
                  <span className="font-semibold">{symbol}{devHostYear1.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-500">Year 2 Renewal:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{symbol}{devHostYear2.toLocaleString()} (0% Hike)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-500">Year 3 Renewal:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{symbol}{devHostYear3.toLocaleString()} (0% Hike)</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>Foreign Digital VAT:</span>
                  <span>{symbol}0 (Direct bKash/Nagad)</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() =>
                  openStackBuilder({
                    pid: isDev ? 2 : 3,
                    planName: isDev ? 'Developer Pro Cloud' : 'Business Max',
                    basePriceMonthlyBDT: isDev ? 450 : 900,
                    basePriceMonthlyUSD: isDev ? 3.75 : 7.5,
                    specs: {
                      ram: isDev ? '2 GB DDR4/DDR5' : '4 GB DDR4/DDR5',
                      cpu: isDev ? '2 vCPU Cores' : '2 Cores (High Freq)',
                      storage: isDev ? '25 GB NVMe' : '50 GB NVMe',
                      inodes: isDev ? '300,000 Inodes' : '600,000 Inodes',
                    },
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Lock In Renewal Rate</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* 2. International Shared Host Card */}
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/70 p-6 flex flex-col justify-between space-y-4 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  Hostinger / Namecheap
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-bold">
                  Renewal Trap
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono font-medium">3-Year Total Cost:</div>
                <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-zinc-300 mt-1">
                  {symbol}{intl3YearTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-red-600 dark:text-red-400 font-mono mt-1 font-semibold">
                  + {symbol}{intlVat.toLocaleString()} in 15% Foreign Card VAT
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span className="text-slate-500">Year 1 (Bait Price):</span>
                  <span>{symbol}{intlYear1.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Year 2 Renewal:</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">{symbol}{intlYear2.toLocaleString()} (+320%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Year 3 Renewal:</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">{symbol}{intlYear3.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-amber-700 dark:text-amber-400 font-bold">
                  <span>15% Digital VAT:</span>
                  <span>+{symbol}{intlVat.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-zinc-900/50 border border-emerald-200 dark:border-white/[0.06] text-[11px] font-mono text-emerald-800 dark:text-emerald-400 text-center font-bold">
              You save {symbol}{savingsVsIntl.toLocaleString()} with DevHost
            </div>
          </div>

          {/* 3. Vercel / Cloud Platforms Card */}
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/70 p-6 flex flex-col justify-between space-y-4 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                  Vercel Pro / Netlify
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 dark:bg-zinc-800 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 font-bold">
                  PaaS Model
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono font-medium">3-Year Total Cost:</div>
                <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-zinc-300 mt-1">
                  {symbol}{vercel3YearTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-purple-700 dark:text-purple-400 font-mono mt-1 font-semibold">
                  $20/seat/mo + Bandwidth risk
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subscription:</span>
                  <span>{symbol}{vercelYear1.toLocaleString()}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Database Add-on:</span>
                  <span>Not Included ($20/mo)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Business Email:</span>
                  <span>Google Workspace Req.</span>
                </div>
                <div className="flex justify-between text-purple-700 dark:text-purple-400 font-bold">
                  <span>15% Foreign Card Tax:</span>
                  <span>+{symbol}{vercelVat.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-zinc-900/50 border border-emerald-200 dark:border-white/[0.06] text-[11px] font-mono text-emerald-800 dark:text-emerald-400 text-center font-bold">
              You save {symbol}{savingsVsVercel.toLocaleString()} with DevHost
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* PART B: 10-POINT ARCHITECTURAL COMPARISON MATRIX                     */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            10-Point Architectural &amp; Developer Experience Matrix
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            Zero-omission technical breakdown comparing developer agility, storage limits, and database accessibility.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/80 shadow-sm">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 text-slate-700 dark:text-zinc-300 font-bold">
                <th className="py-3 px-4 w-1/4">Feature / Requirement</th>
                <th className="py-3 px-4 w-1/3 bg-blue-50/70 dark:bg-zinc-900/90 text-blue-900 dark:text-emerald-400 border-x border-slate-200 dark:border-white/[0.08]">
                  DevHost Cloud (Our Engine)
                </th>
                <th className="py-3 px-4 w-1/4 text-slate-500 dark:text-zinc-400">Traditional Shared Hosts</th>
                <th className="py-3 px-4 w-1/6 text-slate-500 dark:text-zinc-400">Vercel / PaaS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4 text-slate-800 dark:text-zinc-200 font-semibold">
                    {idx + 1}. {row.feature}
                  </td>
                  <td className="py-3 px-4 bg-blue-50/30 dark:bg-zinc-900/40 border-x border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 font-medium">{row.devhost}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                    <div className="flex items-start gap-2">
                      {row.tradStatus ? (
                        <Check className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                      <span className="font-sans text-[11px] text-slate-600 dark:text-zinc-400">{row.traditional}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                    <div className="flex items-start gap-2">
                      {row.vercelStatus ? (
                        <Check className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                      <span className="font-sans text-[11px] text-slate-600 dark:text-zinc-400">{row.vercel}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
