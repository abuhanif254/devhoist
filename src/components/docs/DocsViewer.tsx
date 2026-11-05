'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Search,
  Copy,
  Check,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { EXACT_DOCS_ARTICLES } from '@/config/docsData';
import { useBilling } from '@/context/BillingContext';
import { HOSTING_PACKAGES } from '@/config/hostingData';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';

export default function DocsViewer() {
  const searchParams = useSearchParams();
  const { setIsCommandPaletteOpen, currency, billingCycle } = useBilling();

  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string>(
    searchParams.get('article') || EXACT_DOCS_ARTICLES[0].slug
  );
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Sync when searchParams change
  useEffect(() => {
    const slug = searchParams.get('article');
    if (slug) {
      setSelectedArticleSlug(slug);
    }
  }, [searchParams]);

  const currentArticle =
    EXACT_DOCS_ARTICLES.find((a) => a.slug === selectedArticleSlug) || EXACT_DOCS_ARTICLES[0];

  const categories = [
    'All',
    'Git & CI/CD Deployment',
    'Node.js & Custom Apps',
    'Troubleshooting',
    'Domains & DNS',
    'WordPress & E-Commerce',
    'AI Website Builder',
  ];

  const filteredArticles =
    selectedCategory === 'All'
      ? EXACT_DOCS_ARTICLES
      : EXACT_DOCS_ARTICLES.filter((a) => a.category === selectedCategory);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const isAnnual = billingCycle === 'annually';
  const recPlan =
    HOSTING_PACKAGES.find((p) => p.pid === currentArticle.recommendedPlanId) ||
    HOSTING_PACKAGES.find((p) => p.pid === 2)!;

  const planPriceMonthly = isAnnual ? recPlan.yearlyEffectiveBDT : recPlan.baseMonthlyBDT;
  const displayPlanPrice =
    currency === 'USD'
      ? `$${(planPriceMonthly / 120).toFixed(2)}`
      : `৳${planPriceMonthly}`;

  return (
    <div className="w-full transition-colors duration-200">
      {/* Search Header Bar with Ctrl+K trigger */}
      <div className="mb-8 p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-zinc-300 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Developer Knowledge Base</h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 font-normal">
              Copy-paste deployment workflows, SSH commands, and configuration scripts.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-3 h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-200 hover:border-blue-400 dark:hover:border-white/20 transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search docs &amp; commands...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded font-mono text-slate-600 dark:text-zinc-300">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 pb-6 overflow-x-auto border-b border-slate-200 dark:border-white/[0.08]">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main 2-Column Documentation Viewer Layout */}
      <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Article Navigation Index */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-2 mb-2 font-bold">
            Guides in this category ({filteredArticles.length})
          </div>

          <div className="space-y-1">
            {filteredArticles.map((article) => {
              const isSelected = article.slug === currentArticle.slug;
              return (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticleSlug(article.slug)}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-400 dark:border-white/20 bg-blue-50/70 dark:bg-zinc-900 text-blue-950 dark:text-zinc-100 shadow-xs ring-1 ring-blue-400'
                      : 'border-slate-200 dark:border-white/[0.06] bg-white dark:bg-zinc-950/40 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-zinc-500 mb-1">
                    <span>{article.category}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.readTime}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 line-clamp-2">
                    {article.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sticky Recommended Hosting Plan Card */}
          <div className="pt-4">
            <div className="p-4 rounded-xl border border-blue-200 dark:border-white/20 bg-white dark:bg-zinc-950 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-emerald-500/20 text-blue-700 dark:text-emerald-400 border border-blue-200 dark:border-emerald-500/30 font-bold">
                  Recommended Plan
                </span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {displayPlanPrice}/mo
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{recPlan.name}</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                  Engineered with isolated CloudLinux resources, Git hooks, and Jailed SSH.
                </p>
              </div>
              <a
                href={buildHostingOrderUrl(recPlan.pid, isAnnual, currency)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
              >
                <span>Deploy Now</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Full Article Reader */}
        <div className="lg:col-span-8 w-full">
          <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/80 shadow-sm space-y-6">
            {/* Article Header */}
            <div className="pb-6 border-b border-slate-200 dark:border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400 font-medium">
                <span>{currentArticle.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {currentArticle.readTime}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">
                {currentArticle.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                {currentArticle.summary}
              </p>
            </div>

            {/* Article Step-by-Step Sections */}
            <div className="space-y-8">
              {currentArticle.steps.map((step, idx) => {
                const snippetId = `${currentArticle.id}-step-${idx}`;
                const isCopied = copiedSnippetId === snippetId;

                return (
                  <div key={idx} className="space-y-3">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-zinc-400">
                        0{idx + 1}.
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">{step.heading}</h3>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal pl-6">
                      {step.explanation}
                    </p>

                    {step.codeSnippet?.code && (
                      <div className="pl-6 pt-1">
                        <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-900 dark:bg-zinc-950 overflow-hidden shadow-sm">
                          <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800 dark:bg-zinc-900/60 border-b border-slate-700 dark:border-white/[0.08]">
                            <span className="text-[10px] font-mono text-slate-300 dark:text-zinc-400">
                              {step.codeSnippet.filename || step.codeSnippet.language || 'bash'}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyCode(step.codeSnippet!.code, snippetId)}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300 hover:text-white dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="p-3.5 font-mono text-xs text-slate-200 dark:text-zinc-300 overflow-x-auto leading-relaxed">
                            <pre className="text-slate-200">{step.codeSnippet.code}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
