'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Zap,
  ArrowRight,
  Check,
  Sparkles,
  Layers,
  Terminal,
  Cpu,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { MARKETPLACE_TEMPLATES, MarketplaceTemplate } from '@/config/marketplaceData';
import { useBilling } from '@/context/BillingContext';
import DependencyAnalyzer from '@/components/developer/DependencyAnalyzer';

const CATEGORIES = [
  'All',
  'Full-Stack JS',
  'E-Commerce & CMS',
  'PHP & Laravel',
  'API & Backend',
  'Self-Hosted Tools',
  'AI & No-Code',
];

export default function MarketplaceClient() {
  const { currency, openStackBuilder } = useBilling();
  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return MARKETPLACE_TEMPLATES.filter((tpl) => {
      const matchesCategory =
        activeCategory === 'All' || tpl.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.runtime.toLowerCase().includes(q) ||
        tpl.summary.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="space-y-20">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION 1: SEARCH & CATEGORY FILTER BAR                              */}
      {/* -------------------------------------------------------------------- */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter templates (e.g. Next.js)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25 font-mono"
            />
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => {
            const price = isBDT ? tpl.monthlyBDT : tpl.monthlyUSD;

            return (
              <div
                key={tpl.id}
                className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/70 p-6 flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/20 shadow-xs hover:shadow-md transition-all group relative"
              >
                {tpl.badge && (
                  <span className="absolute top-4 right-4 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    {tpl.badge}
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                      {tpl.category}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mt-1 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">
                      {tpl.name}
                    </h3>
                    <div className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-zinc-300">
                      {tpl.runtime}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-normal leading-relaxed line-clamp-2">
                    {tpl.summary}
                  </p>

                  {/* Feature Checklist */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/[0.06] text-xs text-slate-600 dark:text-zinc-400">
                    {tpl.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-slate-700 dark:text-zinc-300">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-white/[0.06] mt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 dark:text-zinc-500">Min. Plan Required:</span>
                    <span className="text-slate-900 dark:text-zinc-200 font-semibold">
                      {tpl.minPlanName} ({symbol}{price}/mo)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openStackBuilder({
                        pid: tpl.minPlanPid,
                        planName: `${tpl.name} (${tpl.minPlanName})`,
                        basePriceMonthlyBDT: tpl.monthlyBDT,
                        basePriceMonthlyUSD: tpl.monthlyUSD,
                        defaultStack: tpl.defaultStack,
                        specs: {
                          storage: 'Pure PCIe Gen4 NVMe',
                          ram: 'Dedicated Isolated RAM',
                        },
                      })
                    }
                    className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Deploy This Stack</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="py-16 text-center text-xs font-mono text-zinc-500">
            No templates match your search query. Try another keyword or category.
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 2: EMBEDDED DEPENDENCY ARCHITECT                            */}
      {/* -------------------------------------------------------------------- */}
      <section className="pt-10 border-t border-white/[0.08]">
        <DependencyAnalyzer />
      </section>
    </div>
  );
}
