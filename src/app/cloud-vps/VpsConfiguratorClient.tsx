'use client';

import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  ShieldCheck,
  Check,
  ArrowRight,
  Sliders,
  Sparkles,
  Layers,
  Server,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { usePortal } from '@/context/PortalContext';
import {
  VPS_PRECONFIGURED_TIERS,
  VPS_CONTROL_PANELS,
  VPS_CONFIGURATOR_RANGES,
  calculateCustomVpsPrice,
} from '@/config/vpsData';
import { WHMCS_CONFIG } from '@/config/whmcs';
import { convertBdtToUsd, formatCurrency } from '@/config/constants';

export default function VpsConfiguratorClient() {
  const { currency, openStackBuilder } = useBilling();
  const { dynamicPlans } = usePortal();
  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';

  // State for pre-configured plans
  const [preconfiguredCycle, setPreconfiguredCycle] = useState<'monthly' | 'annually'>('annually');

  // State for custom VPS configurator
  const [cpuCores, setCpuCores] = useState<number>(4);
  const [ramGB, setRamGB] = useState<number>(8);
  const [storageGB, setStorageGB] = useState<number>(120);
  const [panelId, setPanelId] = useState<string>('free_panel');
  const [customCycle, setCustomCycle] = useState<'monthly' | 'annually'>('annually');

  // Calculate dynamic custom price
  const customPricing = calculateCustomVpsPrice({
    cpuCores,
    ramGB,
    storageGB,
    panelId,
    isAnnual: customCycle === 'annually',
  });

  return (
    <div className="space-y-20 transition-colors duration-200">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION A: PRE-CONFIGURED KVM VPS TIERS                              */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
              Pre-Configured Production VPS
            </h2>
            <p className="text-slate-600 dark:text-zinc-400 text-xs sm:text-sm mt-1 font-normal">
              Pre-tuned KVM instances deployed in under 55 seconds with dedicated hardware pinning.
            </p>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs">
            <button
              onClick={() => setPreconfiguredCycle('monthly')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                preconfiguredCycle === 'monthly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPreconfiguredCycle('annually')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                preconfiguredCycle === 'annually'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                15% OFF
              </span>
            </button>
          </div>
        </div>

        {/* 4 Tier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {VPS_PRECONFIGURED_TIERS.map((tier) => {
            const dynamicTier = dynamicPlans?.find(
              (dp) => dp.type === 'vps' && (dp.slug === tier.id || dp.id === tier.id)
            );
            const tierMonthlyBDT = dynamicTier ? dynamicTier.priceMonthlyBDT : tier.monthlyBDT;
            const tierMonthlyUSD = dynamicTier ? convertBdtToUsd(dynamicTier.priceMonthlyBDT) : tier.monthlyUSD;
            const isAnnual = preconfiguredCycle === 'annually';
            const baseMonthly = isBDT ? tierMonthlyBDT : tierMonthlyUSD;
            const effectiveMonthly = isAnnual
              ? isBDT
                ? Math.round(baseMonthly * 0.85)
                : Number((baseMonthly * 0.85).toFixed(2))
              : baseMonthly;

            return (
              <div
                key={tier.id}
                className={`rounded-xl border p-6 flex flex-col justify-between transition-all relative ${
                  tier.popular
                    ? 'bg-blue-50/40 dark:bg-zinc-900/80 border-blue-400 dark:border-white/25 ring-1 ring-blue-400 dark:ring-white/15 shadow-xl'
                    : 'bg-white dark:bg-zinc-950/70 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-600 dark:bg-emerald-500/20 text-white dark:text-emerald-300 border border-blue-700 dark:border-emerald-500/40 shadow-xs">
                    Most Popular for Apps
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">{tier.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1 font-mono">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-zinc-50">
                        {symbol}{effectiveMonthly}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-500">/mo</span>
                    </div>
                    {isAnnual && (
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
                        Billed annually (15% discount applied)
                      </div>
                    )}
                  </div>

                  {/* Core Specs Bar */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1.5 text-xs font-mono text-slate-700 dark:text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-zinc-500">vCPU:</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-200">{tier.cpu}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-zinc-500">RAM:</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-200">{tier.ram}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-zinc-500">NVMe:</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-200">{tier.storage}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-zinc-500">Traffic:</span>
                      <span className="text-slate-700 dark:text-zinc-300 font-semibold">{tier.bandwidth}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-zinc-400">
                    {tier.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() =>
                      openStackBuilder({
                        pid: tier.pid,
                        planName: tier.name,
                        basePriceMonthlyBDT: tierMonthlyBDT,
                        basePriceMonthlyUSD: tierMonthlyUSD,
                        specs: {
                          ram: tier.ram,
                          cpu: tier.cpu,
                          storage: tier.storage,
                          bandwidth: tier.bandwidth,
                        },
                      })
                    }
                    className={`w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      tier.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Deploy {tier.name}</span>
                    <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION B: INTERACTIVE CUSTOM RESOURCE BUILDER SLIDERS                */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 mb-3 font-semibold">
            <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
            <span>Interactive Hardware Slider</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            Build Your Custom Cloud VPS
          </h2>
          <p className="text-slate-600 dark:text-zinc-400 text-xs sm:text-sm mt-1 font-normal max-w-2xl">
            Choose your exact vCPU cores, DDR5 memory, PCIe NVMe storage, and software stack. Transparent hourly and monthly pricing with zero surprise bandwidth charges.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sliders Container (Left) */}
          <div className="lg:col-span-7 space-y-7 p-6 sm:p-7 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-sm">
            {/* 1. vCPU Cores Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400 font-bold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-zinc-300" />
                  <span>Dedicated vCPU Cores</span>
                </label>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-2.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                  {cpuCores} Cores ({formatCurrency(cpuCores * 350, currency)}/mo)
                </span>
              </div>
              <input
                type="range"
                min={VPS_CONFIGURATOR_RANGES.cpu.min}
                max={VPS_CONFIGURATOR_RANGES.cpu.max}
                step={VPS_CONFIGURATOR_RANGES.cpu.step}
                value={cpuCores}
                onChange={(e) => setCpuCores(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                <span>2 Cores (Dev)</span>
                <span>8 Cores (Production)</span>
                <span>16 Cores (Max Cluster)</span>
              </div>
            </div>

            {/* 2. RAM Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400 font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600 dark:text-zinc-300" />
                  <span>DDR5 ECC RAM</span>
                </label>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-2.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                  {ramGB} GB RAM ({formatCurrency(ramGB * 150, currency)}/mo)
                </span>
              </div>
              <input
                type="range"
                min={VPS_CONFIGURATOR_RANGES.ram.min}
                max={VPS_CONFIGURATOR_RANGES.ram.max}
                step={VPS_CONFIGURATOR_RANGES.ram.step}
                value={ramGB}
                onChange={(e) => setRamGB(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                <span>4 GB</span>
                <span>16 GB</span>
                <span>32 GB</span>
                <span>64 GB High-RAM</span>
              </div>
            </div>

            {/* 3. NVMe Storage Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400 font-bold flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-600 dark:text-zinc-300" />
                  <span>Pure PCIe Gen4 NVMe Storage</span>
                </label>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-2.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                  {storageGB} GB Pure NVMe ({formatCurrency((storageGB / 10) * 50, currency)}/mo)
                </span>
              </div>
              <input
                type="range"
                min={VPS_CONFIGURATOR_RANGES.storage.min}
                max={VPS_CONFIGURATOR_RANGES.storage.max}
                step={VPS_CONFIGURATOR_RANGES.storage.step}
                value={storageGB}
                onChange={(e) => setStorageGB(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                <span>60 GB</span>
                <span>240 GB</span>
                <span>500 GB Pure NVMe</span>
              </div>
            </div>

            {/* 4. Control Panel Selector */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-400 block font-bold">
                Select Pre-installed OS &amp; Management Panel
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VPS_CONTROL_PANELS.map((panel) => {
                  const isSelected = panelId === panel.id;
                  const panelCost = isBDT ? panel.monthlyCostBDT : panel.monthlyCostUSD;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => setPanelId(panel.id)}
                      className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-zinc-900 border-blue-400 dark:border-white/30 ring-1 ring-blue-400 dark:ring-white/20'
                          : 'bg-slate-50/50 dark:bg-zinc-950/60 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {panel.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold border border-slate-200 dark:border-white/5">
                          {panelCost === 0 ? 'Free' : `+${symbol}${panelCost}/mo`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2">
                        {panel.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Real-time Order Summary Card (Right) */}
          <div className="lg:col-span-5 p-6 sm:p-7 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-white/15 space-y-6 shadow-xl sticky top-24">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-emerald-400 font-bold">
                  Custom KVM Configuration
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Your Tailored Server</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 font-semibold">
                Tier-IV KVM
              </span>
            </div>

            {/* Hardware Breakdown */}
            <div className="space-y-2.5 text-xs font-mono text-slate-700 dark:text-zinc-300">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/[0.04]">
                <span className="text-slate-500 dark:text-zinc-400">vCPU Performance:</span>
                <span className="text-slate-900 dark:text-zinc-100 font-bold">{cpuCores} Dedicated Cores</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/[0.04]">
                <span className="text-slate-500 dark:text-zinc-400">DDR5 Memory:</span>
                <span className="text-slate-900 dark:text-zinc-100 font-bold">{ramGB} GB RAM</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/[0.04]">
                <span className="text-slate-500 dark:text-zinc-400">Gen4 NVMe Disk:</span>
                <span className="text-slate-900 dark:text-zinc-100 font-bold">{storageGB} GB NVMe</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/[0.04]">
                <span className="text-slate-500 dark:text-zinc-400">Panel License:</span>
                <span className="text-slate-900 dark:text-zinc-100 font-bold">{customPricing.panel.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/[0.04]">
                <span className="text-slate-500 dark:text-zinc-400">Redundant Network:</span>
                <span className="text-slate-900 dark:text-zinc-100 font-bold">10 Gbps Uplink (BDIX ~42ms)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-zinc-400">Automated Backup:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Weekly Snapshot Free</span>
              </div>
            </div>

            {/* Cycle Selector in Summary */}
            <div className="p-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 flex text-xs">
              <button
                type="button"
                onClick={() => setCustomCycle('monthly')}
                className={`flex-1 py-1.5 rounded-md font-semibold text-center transition-all cursor-pointer ${
                  customCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCustomCycle('annually')}
                className={`flex-1 py-1.5 rounded-md font-semibold text-center transition-all cursor-pointer ${
                  customCycle === 'annually'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Annual (15% OFF)
              </button>
            </div>

            {/* Pricing Total */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Calculated Rate:</span>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-50">
                    {symbol}
                    {isBDT
                      ? customPricing.effectiveMonthlyBDT
                      : customPricing.effectiveMonthlyUSD}
                    <span className="text-xs font-normal text-slate-500 dark:text-zinc-400"> /mo</span>
                  </div>
                  {customCycle === 'annually' && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Save {symbol}
                      {isBDT
                        ? customPricing.annualSavingsBDT
                        : (customPricing.baseMonthlyUSD * 12 - customPricing.annualTotalUSD).toFixed(2)}
                      /yr
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Deploy Button */}
            <button
              type="button"
              onClick={() =>
                openStackBuilder({
                  pid: 102,
                  planName: `Custom KVM (${cpuCores} Core, ${ramGB}GB RAM)`,
                  basePriceMonthlyBDT: customPricing.baseMonthlyBDT,
                  basePriceMonthlyUSD: customPricing.baseMonthlyUSD,
                  specs: {
                    ram: `${ramGB} GB DDR5 RAM`,
                    cpu: `${cpuCores} vCPU Cores`,
                    storage: `${storageGB} GB PCIe Gen4 NVMe`,
                    bandwidth: 'Unlimited Burstable Traffic',
                  },
                })
              }
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-600/20 group cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Deploy Custom VPS</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-slate-500 dark:text-zinc-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Instant Setup • bKash, Nagad &amp; Stripe Accepted</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
