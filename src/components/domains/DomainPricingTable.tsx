'use client';

import React, { useState, useMemo } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { EXACT_10_TLD_DATA, getFormattedDomainPrice } from '@/config/domainData';
import { useBilling } from '@/context/BillingContext';
import { usePortal } from '@/context/PortalContext';

export default function DomainPricingTable() {
  const { currency, openStackBuilder } = useBilling();
  const { dynamicTlds } = usePortal();
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['All', 'Popular', 'Budget', 'Developer', 'Business', 'Organization', 'Personal'];

  const filteredTlds = useMemo(() => {
    return EXACT_10_TLD_DATA.map((item) => {
      const override = dynamicTlds?.find((dt) => dt.tld === item.tld);
      return {
        ...item,
        registerBDT: override ? override.registerBDT : item.registerBDT,
        renewalBDT: override ? override.renewalBDT : item.renewalBDT,
        transferBDT: override ? override.transferBDT : item.transferBDT,
      };
    }).filter((item) => {
      const matchCat = filterCategory === 'All' || item.category === filterCategory;
      const matchSearch = item.tld.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchCat && matchSearch;
    });
  }, [filterCategory, searchQuery, dynamicTlds]);

  return (
    <div id="pricing-table" className="w-full transition-colors duration-200">
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 overflow-hidden shadow-sm">
        {/* Table Controls Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono mb-2 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>100% Transparent — Zero Hidden Renewal Traps</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
                Exact 10-TLD Domain Pricing Matrix
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 font-normal">
                The renewal price you see is the exact locked-in renewal rate you pay next year. No bait-and-switch.
              </p>
            </div>

            {/* Category Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter TLD (e.g. .io, .xyz)..."
                  className="pl-8 pr-3 py-1.5 rounded-md bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-semibold overflow-x-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`h-7 px-2.5 rounded text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                      filterCategory === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filtered TLD Pricing Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-900/60 text-xs font-mono text-slate-700 dark:text-zinc-400 uppercase font-bold">
                <th className="p-3.5 sm:p-4">TLD Extension</th>
                <th className="p-3.5 sm:p-4">Category</th>
                <th className="p-3.5 sm:p-4">Registration</th>
                <th className="p-3.5 sm:p-4">Renewal Rate</th>
                <th className="p-3.5 sm:p-4">Transfer</th>
                <th className="p-3.5 sm:p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
              {filteredTlds.map((item) => (
                <tr key={item.tld} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="p-3.5 sm:p-4 font-mono font-bold text-slate-900 dark:text-zinc-100 text-sm">
                    {item.tld}
                    {item.badge && (
                      <span className="ml-2 text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-white/5 font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 sm:p-4 text-slate-600 dark:text-zinc-400">{item.category}</td>
                  <td className="p-3.5 sm:p-4 font-mono font-bold text-slate-900 dark:text-zinc-100">
                    {getFormattedDomainPrice(item.registerBDT, currency)}/yr
                  </td>
                  <td className="p-3.5 sm:p-4 font-mono text-slate-700 dark:text-zinc-300 font-semibold">
                    {getFormattedDomainPrice(item.renewalBDT, currency)}/yr
                  </td>
                  <td className="p-3.5 sm:p-4 font-mono text-slate-500 dark:text-zinc-400">
                    {getFormattedDomainPrice(item.transferBDT, currency)}/yr
                  </td>
                  <td className="p-3.5 sm:p-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        openStackBuilder({
                          orderMode: 'domain_registration',
                          planName: `Domain Registration (${item.tld})`,
                          domainName: `mybrand${item.tld}`,
                          domainYears: 1,
                          basePriceBDT: item.registerBDT,
                        })
                      }
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <span>Register</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
