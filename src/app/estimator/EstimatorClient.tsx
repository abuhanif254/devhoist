'use client';

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Printer,
  Plus,
  Minus,
  CheckCircle2,
  Building,
  FileText,
  ShieldCheck,
  Globe,
  Server,
  ArrowRight,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { usePortal } from '@/context/PortalContext';

interface ServiceItem {
  id: string;
  name: string;
  type: 'hosting' | 'vps' | 'domain' | 'addon';
  priceMonthlyBDT: number;
  priceAnnualBDT?: number;
  isAnnualOnly?: boolean;
  desc: string;
}

const CATALOG_ITEMS: ServiceItem[] = [
  // Hosting
  {
    id: 'starter',
    name: 'Starter Pack Hosting',
    type: 'hosting',
    priceMonthlyBDT: 200,
    desc: '2 GB NVMe, 1 GB RAM, 1 Core, 150K Inodes',
  },
  {
    id: 'developer',
    name: 'Developer Pro Cloud Hosting',
    type: 'hosting',
    priceMonthlyBDT: 450,
    desc: '5 GB NVMe, 2 GB RAM, 2 Cores, 300K Inodes, Git CI/CD',
  },
  {
    id: 'business',
    name: 'Business Max Cloud Hosting',
    type: 'hosting',
    priceMonthlyBDT: 900,
    desc: '10 GB NVMe, 4 GB RAM, 2 Cores High-Freq, 600K Inodes',
  },

  // Cloud VPS
  {
    id: 'kvm1',
    name: 'Cloud KVM-1 VPS Server',
    type: 'vps',
    priceMonthlyBDT: 1450,
    desc: '2 vCPU, 4 GB DDR5 RAM, 60 GB NVMe, 2 TB Bandwidth',
  },
  {
    id: 'kvm2',
    name: 'Cloud KVM-2 VPS Server',
    type: 'vps',
    priceMonthlyBDT: 2750,
    desc: '4 vCPU, 8 GB DDR5 RAM, 120 GB NVMe, 4 TB Bandwidth',
  },
  {
    id: 'kvm4',
    name: 'Cloud KVM-4 VPS Server',
    type: 'vps',
    priceMonthlyBDT: 5200,
    desc: '6 vCPU, 16 GB DDR5 RAM, 240 GB NVMe, 8 TB Bandwidth',
  },
  {
    id: 'kvm8',
    name: 'Cloud KVM-8 VPS Server',
    type: 'vps',
    priceMonthlyBDT: 9800,
    desc: '8 vCPU, 32 GB DDR5 RAM, 480 GB NVMe, 16 TB Bandwidth',
  },

  // Domains
  {
    id: 'dom_com',
    name: '.com Domain Registration',
    type: 'domain',
    priceMonthlyBDT: 0,
    priceAnnualBDT: 1350,
    isAnnualOnly: true,
    desc: 'Standard commercial TLD with free DNS & WHOIS privacy',
  },
  {
    id: 'dom_xyz',
    name: '.xyz Domain Registration',
    type: 'domain',
    priceMonthlyBDT: 0,
    priceAnnualBDT: 290,
    isAnnualOnly: true,
    desc: 'Popular modern web3 / creative tech domain',
  },
  {
    id: 'dom_io',
    name: '.io Domain Registration',
    type: 'domain',
    priceMonthlyBDT: 0,
    priceAnnualBDT: 4800,
    isAnnualOnly: true,
    desc: 'Premier developer and tech startup TLD',
  },
  {
    id: 'dom_ai',
    name: '.ai Domain Registration',
    type: 'domain',
    priceMonthlyBDT: 0,
    priceAnnualBDT: 9500,
    isAnnualOnly: true,
    desc: 'Artificial intelligence & high-growth innovation TLD',
  },

  // Addons
  {
    id: 'addon_ip',
    name: 'Dedicated IPv4 Address',
    type: 'addon',
    priceMonthlyBDT: 350,
    desc: 'Isolated clean IP for custom SSL & high email reputation',
  },
  {
    id: 'addon_backup',
    name: 'Daily 30-Day Offsite S3 Backup',
    type: 'addon',
    priceMonthlyBDT: 150,
    desc: 'Nightly incremental backup retention in AWS S3 Singapore',
  },
  {
    id: 'addon_cpanel',
    name: 'cPanel/WHM Solo License',
    type: 'addon',
    priceMonthlyBDT: 1850,
    desc: 'Official cPanel/WHM root management license for VPS',
  },
];

export default function EstimatorClient() {
  const { currency } = useBilling();
  const { dynamicPlans, dynamicTlds } = usePortal();
  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';

  // Dynamic Catalog Overrides from Supabase / PortalContext
  const activeCatalog = useMemo(() => {
    return CATALOG_ITEMS.map((item) => {
      if (item.type === 'hosting') {
        const match = dynamicPlans?.find(
          (p) => p.slug === item.id || p.id === item.id || (item.id === 'developer' && p.slug === 'developer-pro') || (item.id === 'business' && p.slug === 'business-max')
        );
        if (match) {
          return {
            ...item,
            priceMonthlyBDT: match.priceMonthlyBDT,
            desc: `${match.storageGB} GB NVMe, ${match.ramGB} GB RAM, ${match.cpuCores} Cores, ${match.inodes.toLocaleString()} Inodes`,
          };
        }
      } else if (item.type === 'vps') {
        const match = dynamicPlans?.find(
          (p) => p.type === 'vps' && (p.slug?.includes(item.id.replace('kvm', '')) || p.id.includes(item.id.replace('kvm', '')))
        );
        if (match) {
          return {
            ...item,
            priceMonthlyBDT: match.priceMonthlyBDT,
          };
        }
      } else if (item.type === 'domain') {
        const tldKey = item.id.replace('dom_', '.');
        const match = dynamicTlds?.find((t) => t.tld === tldKey);
        if (match) {
          return {
            ...item,
            priceAnnualBDT: match.registerBDT,
          };
        }
      }
      return item;
    });
  }, [dynamicPlans, dynamicTlds]);

  // Client Details for PDF Quote
  const [preparedFor, setPreparedFor] = useState('Acme Technologies Ltd.');
  const [projectRef, setProjectRef] = useState('Production Microservice Infrastructure 2026');
  const [billingTerm, setBillingTerm] = useState<'monthly' | 'annually'>('annually');

  // Quantities state
  const [quantities, setQuantities] = useState<Record<string, number>>({
    developer: 2,
    dom_com: 2,
    addon_backup: 2,
  });

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(20, current + delta));
      return { ...prev, [id]: next };
    });
  };

  // Math Calculations
  const calculation = useMemo(() => {
    let monthlyHostingBaseBDT = 0;
    let annualDomainBaseBDT = 0;
    let totalHostingInstances = 0;

    const selectedItems: { item: ServiceItem; qty: number; monthlyBDT: number; annualBDT: number }[] = [];

    for (const item of activeCatalog) {
      const qty = quantities[item.id] || 0;
      if (qty > 0) {
        if (item.type === 'hosting' || item.type === 'vps') {
          totalHostingInstances += qty;
        }

        let mBDT = 0;
        let aBDT = 0;

        if (item.isAnnualOnly) {
          aBDT = (item.priceAnnualBDT || 0) * qty;
          annualDomainBaseBDT += aBDT;
        } else {
          mBDT = item.priceMonthlyBDT * qty;
          aBDT = mBDT * 12;
          monthlyHostingBaseBDT += mBDT;
        }

        selectedItems.push({
          item,
          qty,
          monthlyBDT: mBDT,
          annualBDT: aBDT,
        });
      }
    }

    // Agency Bulk Discount: 10% OFF if 5 or more hosting/vps instances
    const hasAgencyDiscount = totalHostingInstances >= 5;
    const agencyDiscountRate = hasAgencyDiscount ? 0.1 : 0.0;

    // Annual discount: 20% OFF hosting on annual cycle
    const isAnnual = billingTerm === 'annually';
    const termDiscountRate = isAnnual ? 0.2 : 0.0;

    const effectiveMonthlyHostingBDT = Math.round(
      monthlyHostingBaseBDT * (1 - termDiscountRate) * (1 - agencyDiscountRate)
    );

    const annualTotalBilledBDT =
      effectiveMonthlyHostingBDT * (isAnnual ? 12 : 1) + (isAnnual ? annualDomainBaseBDT : 0);

    const totalSavingsBDT =
      monthlyHostingBaseBDT * 12 + annualDomainBaseBDT - (effectiveMonthlyHostingBDT * 12 + annualDomainBaseBDT);

    return {
      selectedItems,
      totalHostingInstances,
      hasAgencyDiscount,
      monthlyHostingBaseBDT,
      effectiveMonthlyHostingBDT,
      annualDomainBaseBDT,
      annualTotalBilledBDT,
      totalSavingsBDT,
      quoteId: 'EST-2026-8941',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    };
  }, [quantities, billingTerm]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-12">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION 1: PROPOSAL DETAILS & TERM CONTROLS (SCREEN VIEW)            */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] space-y-4 print:hidden shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600 dark:text-emerald-400" />
              <span>Commercial Proposal Parameters</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
              Enter your client or organization details to personalize the downloadable PDF invoice.
            </p>
          </div>

          {/* Billing Term Selector */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => setBillingTerm('monthly')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                billingTerm === 'monthly'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Monthly Term
            </button>
            <button
              type="button"
              onClick={() => setBillingTerm('annually')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                billingTerm === 'annually'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Annual Term</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                20% OFF
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="space-y-1">
            <label className="text-slate-700 dark:text-zinc-400 font-medium">Prepared For (Client / Organization Name):</label>
            <input
              type="text"
              value={preparedFor}
              onChange={(e) => setPreparedFor(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-700 dark:text-zinc-400 font-medium">Project Reference Name:</label>
            <input
              type="text"
              value={projectRef}
              onChange={(e) => setProjectRef(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25"
            />
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 2: SERVICE CATALOG ITEMS & QUANTITY ADJUSTERS (SCREEN VIEW) */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:hidden">
        {/* Left: Catalog Selector */}
        <div className="lg:col-span-8 space-y-6">
          <div className="border-b border-slate-200 dark:border-white/[0.08] pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Select Services & Infrastructure Quantities
            </h3>
            <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">
              {calculation.totalHostingInstances} Active Instances
            </span>
          </div>

          <div className="space-y-3">
            {activeCatalog.map((item) => {
              const qty = quantities[item.id] || 0;
              const unitPrice = item.isAnnualOnly
                ? isBDT
                  ? `৳${item.priceAnnualBDT}/yr`
                  : `$${((item.priceAnnualBDT || 0) / 120).toFixed(2)}/yr`
                : isBDT
                ? `৳${item.priceMonthlyBDT}/mo`
                : `$${(item.priceMonthlyBDT / 120).toFixed(2)}/mo`;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    qty > 0
                      ? 'bg-blue-50/60 dark:bg-zinc-900/80 border-blue-400 dark:border-white/20 shadow-xs'
                      : 'bg-white dark:bg-zinc-950/60 border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/10 shadow-xs'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{item.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
                        {unitPrice}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-500 font-mono">{item.desc}</p>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-950 border border-slate-300 dark:border-white/10 rounded-lg p-1 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded bg-white hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-bold text-slate-900 dark:text-zinc-100">{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded bg-white hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                      title="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Financial Summary & Print Button */}
        <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-zinc-900/70 border border-slate-200 dark:border-white/15 space-y-6 shadow-xl sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-emerald-400 font-semibold">
                Commercial Budget
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Live Quote Summary</h3>
            </div>
            {calculation.hasAgencyDiscount && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                10% Agency Bulk
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs font-mono text-slate-700 dark:text-zinc-300">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/[0.04]">
              <span className="text-slate-500 dark:text-zinc-500">Effective Monthly:</span>
              <span className="text-slate-900 dark:text-zinc-100 font-bold">
                {symbol}
                {isBDT
                  ? calculation.effectiveMonthlyHostingBDT.toLocaleString()
                  : (calculation.effectiveMonthlyHostingBDT / 120).toFixed(2)}
                /mo
              </span>
            </div>

            {billingTerm === 'annually' && calculation.annualDomainBaseBDT > 0 && (
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-zinc-500">Domains (Annual):</span>
                <span className="text-zinc-100">
                  {symbol}
                  {isBDT
                    ? calculation.annualDomainBaseBDT.toLocaleString()
                    : (calculation.annualDomainBaseBDT / 120).toFixed(2)}
                </span>
              </div>
            )}

            <div className="pt-2">
              <div className="text-xs text-zinc-400">Total Billed Today:</div>
              <div className="text-3xl font-bold font-mono text-zinc-50 mt-1">
                {symbol}
                {isBDT
                  ? calculation.annualTotalBilledBDT.toLocaleString()
                  : (calculation.annualTotalBilledBDT / 120).toFixed(2)}
                <span className="text-xs font-normal text-zinc-400 ml-1">
                  {billingTerm === 'annually' ? '/year' : '/month'}
                </span>
              </div>
              {billingTerm === 'annually' && calculation.totalSavingsBDT > 0 && (
                <div className="text-[11px] font-mono text-emerald-400 mt-1">
                  Includes {symbol}
                  {isBDT
                    ? calculation.totalSavingsBDT.toLocaleString()
                    : (calculation.totalSavingsBDT / 120).toFixed(2)}{' '}
                  in annual & agency discounts
                </div>
              )}
            </div>
          </div>

          {/* Download / Print PDF CTA */}
          <button
            type="button"
            onClick={handlePrint}
            className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white transition-all shadow-md group cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Download Official PDF Quote</span>
          </button>

          <div className="text-[11px] font-mono text-zinc-500 text-center">
            Triggers clean browser PDF export without web UI headers.
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 3: OFFICIAL PRINTABLE PDF INVOICE / PROPOSAL TEMPLATE       */}
      {/* -------------------------------------------------------------------- */}
      <div className="hidden print:block font-sans text-zinc-900 bg-white p-8 max-w-4xl mx-auto space-y-8">
        {/* Printable Header */}
        <div className="flex items-start justify-between border-b pb-6 border-zinc-200">
          <div>
            <div className="text-2xl font-bold text-zinc-900">DevHost Cloud Inc.</div>
            <div className="text-xs text-zinc-600 mt-1">
              Enterprise Cloud Infrastructure & High-Frequency NVMe Clusters<br />
              Singapore Equinix SG1 • USA Ashburn VA • support@devhostcloud.com
            </div>
          </div>

          <div className="text-right text-xs font-mono">
            <div className="text-sm font-bold text-zinc-900">COMMERCIAL PROPOSAL</div>
            <div className="text-zinc-600">Quote ID: {calculation.quoteId}</div>
            <div className="text-zinc-600">Date: {calculation.date}</div>
            <div className="text-zinc-600">Term: {billingTerm.toUpperCase()}</div>
          </div>
        </div>

        {/* Client Metadata */}
        <div className="grid grid-cols-2 gap-6 text-xs border p-4 rounded-lg border-zinc-200">
          <div>
            <div className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">Prepared For</div>
            <div className="text-sm font-semibold text-zinc-900 mt-1">{preparedFor}</div>
          </div>
          <div>
            <div className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">Project Reference</div>
            <div className="text-sm font-semibold text-zinc-900 mt-1">{projectRef}</div>
          </div>
        </div>

        {/* Itemized Table */}
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-zinc-300 text-zinc-700">
              <th className="py-2">Service Description</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Unit Rate</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {calculation.selectedItems.map(({ item, qty, monthlyBDT, annualBDT }) => {
              const billedSubtotal = billingTerm === 'annually' ? annualBDT : monthlyBDT;
              return (
                <tr key={item.id}>
                  <td className="py-3">
                    <div className="font-semibold text-zinc-900">{item.name}</div>
                    <div className="text-zinc-500 text-[11px]">{item.desc}</div>
                  </td>
                  <td className="py-3 text-center font-mono">{qty}</td>
                  <td className="py-3 text-right font-mono">
                    ৳{item.isAnnualOnly ? item.priceAnnualBDT : item.priceMonthlyBDT}
                  </td>
                  <td className="py-3 text-right font-mono font-bold">৳{billedSubtotal.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-300 font-mono">
              <td colSpan={3} className="py-3 text-right font-bold text-zinc-700">
                Total Estimated Commitment ({billingTerm === 'annually' ? 'Annualized' : 'Monthly'}):
              </td>
              <td className="py-3 text-right font-bold text-base text-zinc-900">
                ৳{calculation.annualTotalBilledBDT.toLocaleString()} BDT
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Commercial Terms & Instructions */}
        <div className="border-t pt-4 border-zinc-200 text-[11px] text-zinc-600 space-y-2">
          <div className="font-bold text-zinc-900 uppercase">Service Level Agreement & Payment Information</div>
          <p>
            1. All hosting services include guaranteed 99.9% Global Uptime SLA with CloudLinux container isolation.<br />
            2. Payment Accepted: Official bKash Merchant, Nagad PGW, Bank EFT / BEFTN, or Corporate Card.<br />
            3. This quotation remains valid for 30 calendar days from the date of issue.
          </p>
        </div>
      </div>
    </div>
  );
}
