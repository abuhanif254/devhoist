'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/navigation';
import {
  BookOpen,
  Search,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Terminal,
  Server,
  LifeBuoy,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { EXACT_DOCS_ARTICLES, DocArticle } from '@/config/docsData';
import { useBilling } from '@/context/BillingContext';
import { usePortal, CloudService } from '@/context/PortalContext';
import { HOSTING_PACKAGES } from '@/config/hostingData';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';

export interface CmsArticle {
  id: string | number;
  slug: string;
  title_en: string;
  title_bn?: string;
  category: string;
  summary_en: string;
  summary_bn?: string;
  read_time_minutes?: number;
  difficulty_level?: string;
  recommended_plan_slug?: string;
  steps_json: Array<{
    stepNumber: number;
    heading_en: string;
    explanation_en: string;
    codeSnippet?: string;
    codeLanguage?: string;
    warningNote?: string;
  }>;
  views_count?: number;
  helpful_yes_count?: number;
  helpful_no_count?: number;
}

export default function DocsViewer({ initialSlug }: { initialSlug?: string } = {}) {
  const searchParams = useSearchParams();
  const { setIsCommandPaletteOpen, currency, billingCycle } = useBilling();
  const { services } = usePortal();

  // Articles & FAQs state
  const [articles, setArticles] = useState<DocArticle[]>(EXACT_DOCS_ARTICLES);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string>(
    initialSlug || searchParams.get('article') || EXACT_DOCS_ARTICLES[0].slug
  );

  // Active Personalized Service Injection
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services.length > 0 ? services[0].id : 'sample'
  );
  const [customParams, setCustomParams] = useState({
    cpanelUser: 'client_user',
    domain: 'client-site.com',
    ipAddress: '103.151.102.45',
    sshPort: '22',
  });

  // Step Completion State
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // Helpfulness Vote State
  const [userVote, setUserVote] = useState<'yes' | 'no' | null>(null);
  const [voteStats, setVoteStats] = useState<{ yes: number; no: number }>({ yes: 48, no: 1 });

  // 1. Fetch Dynamic Articles from /api/docs
  useEffect(() => {
    let isMounted = true;
    async function loadArticles() {
      try {
        const res = await fetch('/api/docs?type=articles');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.articles) && json.articles.length > 0) {
            // Map CMS database shape to standard DocsArticle
            const mapped: DocArticle[] = json.articles.map((item: any) => ({
              id: String(item.id),
              slug: item.slug,
              title: item.title_en || item.title,
              category: item.category,
              readTime: item.read_time_minutes ? `${item.read_time_minutes} min read` : '5 min read',
              summary: item.summary_en || item.summary,
              recommendedPlanId: 2,
              steps: (item.steps_json || []).map((s: any) => ({
                heading: s.heading_en || s.heading || `Step ${s.stepNumber}`,
                explanation: s.explanation_en || s.explanation || '',
                codeSnippet: s.codeSnippet
                  ? {
                      code: s.codeSnippet,
                      language: s.codeLanguage || 'bash',
                      filename: s.filename || undefined,
                    }
                  : undefined,
                callout: s.warningNote
                  ? {
                      type: 'warning' as const,
                      text: s.warningNote,
                    }
                  : undefined,
              })),
            }));

            if (isMounted) {
              setArticles(mapped);
            }
          }
        }
      } catch (err) {
        console.warn('[DocsViewer] Failed to fetch dynamic docs, using production defaults:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadArticles();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync when searchParams change
  useEffect(() => {
    const slug = searchParams.get('article');
    if (slug) {
      setSelectedArticleSlug(slug);
    }
  }, [searchParams]);

  // Sync selected service if services list updates
  useEffect(() => {
    if (services.length > 0 && selectedServiceId === 'sample') {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  // Determine active personalization credentials
  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId);
  }, [services, selectedServiceId]);

  const activeCredentials = useMemo(() => {
    if (activeService) {
      return {
        cpanelUser: activeService.cpanelUser || 'client_user',
        domain: activeService.domain || 'client-site.com',
        ipAddress: activeService.ipAddress || '103.151.102.45',
        sshPort: '22',
      };
    }
    return customParams;
  }, [activeService, customParams]);

  const currentArticle = useMemo(() => {
    return articles.find((a) => a.slug === selectedArticleSlug) || articles[0] || EXACT_DOCS_ARTICLES[0];
  }, [articles, selectedArticleSlug]);

  // View Counter Trigger
  useEffect(() => {
    if (currentArticle?.id) {
      fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'increment_view',
          article_id: currentArticle.id,
        }),
      }).catch(() => {});
      setUserVote(null);
    }
  }, [currentArticle?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    articles.forEach((a) => set.add(a.category));
    return Array.from(set);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchCat = selectedCategory === 'All' || a.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [articles, selectedCategory, searchQuery]);

  // Dynamic Variable Inserter: replaces {{CPANEL_USER}}, {{PRIMARY_DOMAIN}}, {{SERVER_IP}}, {{SSH_PORT}}
  const injectVariables = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/{{CPANEL_USER}}|{cpanel_username}|\$USER\b/g, activeCredentials.cpanelUser)
      .replace(/{{PRIMARY_DOMAIN}}|{domain}/g, activeCredentials.domain)
      .replace(/{{SERVER_IP}}|{server_ip}/g, activeCredentials.ipAddress)
      .replace(/{{SSH_PORT}}|{ssh_port}/g, activeCredentials.sshPort);
  };

  const copyCode = (rawCode: string, id: string) => {
    const personalized = injectVariables(rawCode);
    navigator.clipboard.writeText(personalized);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const toggleStepCompleted = (stepIdx: number) => {
    const key = `${currentArticle.slug}-step-${stepIdx}`;
    setCompletedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Step Progress Calculation
  const totalSteps = currentArticle.steps?.length || 1;
  const completedCount = (currentArticle.steps || []).reduce((acc: number, _: any, idx: number) => {
    return acc + (completedSteps[`${currentArticle.slug}-step-${idx}`] ? 1 : 0);
  }, 0);
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const handleHelpfulVote = async (vote: 'yes' | 'no') => {
    if (userVote) return;
    setUserVote(vote);
    if (vote === 'yes') {
      setVoteStats((prev) => ({ ...prev, yes: prev.yes + 1 }));
    } else {
      setVoteStats((prev) => ({ ...prev, no: prev.no + 1 }));
    }
    try {
      await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote_helpful',
          article_id: currentArticle.id,
          vote,
        }),
      });
    } catch (err) {
      console.warn('Failed to record vote:', err);
    }
  };

  const isAnnual = billingCycle === 'annually';
  const recPlan =
    HOSTING_PACKAGES.find((p) => p.pid === currentArticle.recommendedPlanId) ||
    HOSTING_PACKAGES.find((p) => p.pid === 2)!;

  const planPriceMonthly = isAnnual ? recPlan.yearlyEffectiveBDT : recPlan.baseMonthlyBDT;
  const displayPlanPrice =
    currency === 'USD' ? `$${(planPriceMonthly / 120).toFixed(2)}` : `৳${planPriceMonthly}`;

  return (
    <div className="w-full transition-colors duration-200">
      {/* Search Header Bar with Ctrl+K trigger */}
      <div className="mb-6 p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-zinc-300 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              Developer Knowledge Base &amp; Runbooks
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 font-normal">
              Context-aware terminal scripts, zero-downtime Git CI/CD, and live server variable injection.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tutorials &amp; commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-200 transition-all cursor-pointer shadow-xs shrink-0"
          >
            <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded font-mono text-slate-600 dark:text-zinc-300">
              Ctrl+K
            </kbd>
          </button>
        </div>
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
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-2 font-bold">
            <span>Guides ({filteredArticles.length})</span>
            {loading && <span className="text-[10px] text-blue-500 animate-pulse">Syncing CMS...</span>}
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredArticles.map((article) => {
              const isSelected = article.slug === currentArticle.slug;
              return (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticleSlug(article.slug)}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 dark:border-blue-500/50 bg-blue-50/70 dark:bg-blue-950/20 text-blue-950 dark:text-zinc-100 shadow-xs ring-1 ring-blue-500'
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
          <div className="pt-2">
            <div className="p-4 rounded-xl border border-blue-200 dark:border-white/20 bg-white dark:bg-zinc-950 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-emerald-500/20 text-blue-700 dark:text-emerald-400 border border-blue-200 dark:border-emerald-500/30 font-bold">
                  Recommended Stack
                </span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {displayPlanPrice}/mo
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{recPlan.name}</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                  Engineered with isolated CloudLinux LVE resources, LiteSpeed Enterprise &amp; Jailed SSH.
                </p>
              </div>
              <a
                href={buildHostingOrderUrl(recPlan.pid, isAnnual, currency)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
              >
                <span>Deploy with One Click</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Context-Aware Article Reader */}
        <div className="lg:col-span-8 w-full space-y-6">
          {/* Personalized Credentials Injector Bar */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Personalize Commands for My Account:
                </span>
              </div>

              {/* Service Selector Dropdown */}
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="h-7 px-2 text-xs font-mono rounded border border-blue-300 dark:border-blue-500/40 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none"
                >
                  {services.length > 0 ? (
                    services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.domain} ({srv.cpanelUser})
                      </option>
                    ))
                  ) : (
                    <option value="sample">Sample Project (demo account)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Injected Variables Preview Pill Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
              <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                <span className="text-slate-400 text-[10px] block">cPanel User:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 truncate block">
                  {activeCredentials.cpanelUser}
                </span>
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                <span className="text-slate-400 text-[10px] block">Primary Domain:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                  {activeCredentials.domain}
                </span>
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                <span className="text-slate-400 text-[10px] block">Server IP:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400 truncate block">
                  {activeCredentials.ipAddress}
                </span>
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                <span className="text-slate-400 text-[10px] block">SSH Port:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 truncate block">
                  {activeCredentials.sshPort}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400">
              Terminal scripts, paths, and config blocks below automatically reflect your real project
              credentials. Copy and run directly in your terminal.
            </p>
          </div>

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
                {injectVariables(currentArticle.summary)}
              </p>

              {/* Step Completion Progress Bar */}
              <div className="pt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-zinc-400">
                    Runbook Progress: {completedCount} of {totalSteps} steps completed
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Article Step-by-Step Sections */}
            <div className="space-y-8">
              {(currentArticle.steps || []).map((step: any, idx: number) => {
                const snippetId = `${currentArticle.id}-step-${idx}`;
                const isCopied = copiedSnippetId === snippetId;
                const isStepDone = !!completedSteps[`${currentArticle.slug}-step-${idx}`];
                const injectedExplanation = injectVariables(step.explanation);
                const injectedCode = step.codeSnippet?.code ? injectVariables(step.codeSnippet.code) : '';

                return (
                  <div
                    key={idx}
                    className={`space-y-3 p-4 rounded-xl border transition-all ${
                      isStepDone
                        ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10'
                        : 'border-slate-100 dark:border-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          0{idx + 1}.
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                          {injectVariables(step.heading)}
                        </h3>
                      </div>

                      <button
                        onClick={() => toggleStepCompleted(idx)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          isStepDone
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 border border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${isStepDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                        />
                        <span>{isStepDone ? 'Completed' : 'Mark Done'}</span>
                      </button>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal pl-6">
                      {injectedExplanation}
                    </p>

                    {step.callout && (
                      <div className="ml-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{injectVariables(step.callout.text)}</span>
                      </div>
                    )}

                    {injectedCode && (
                      <div className="pl-6 pt-1">
                        <div className="rounded-lg border border-slate-800 dark:border-white/[0.08] bg-slate-900 dark:bg-zinc-950 overflow-hidden shadow-sm">
                          <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/80 dark:bg-zinc-900/60 border-b border-slate-700/80 dark:border-white/[0.08]">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-[10px] font-mono text-slate-300 dark:text-zinc-400">
                                {step.codeSnippet?.filename || step.codeSnippet?.language || 'bash'}
                              </span>
                            </div>
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
                                  <span>Copy Personalized Code</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="p-3.5 font-mono text-xs text-slate-200 dark:text-zinc-300 overflow-x-auto leading-relaxed">
                            <pre className="text-slate-200">{injectedCode}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Feedback & Support Escalation Box */}
            <div className="pt-6 border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Was this tutorial helpful?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleHelpfulVote('yes')}
                    disabled={!!userVote}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-all cursor-pointer ${
                      userVote === 'yes'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:border-emerald-500'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>Yes ({voteStats.yes})</span>
                  </button>
                  <button
                    onClick={() => handleHelpfulVote('no')}
                    disabled={!!userVote}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-all cursor-pointer ${
                      userVote === 'no'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:border-rose-500'
                    }`}
                  >
                    <ThumbsDown className="w-3 h-3" />
                    <span>No ({voteStats.no})</span>
                  </button>
                </div>
              </div>

              {/* Pre-Filled Engineering Ticket Escalation */}
              <a
                href={`/dashboard?tab=support&subject=${encodeURIComponent(
                  `Docs Help: ${currentArticle.title}`
                )}&service=${activeService?.id || ''}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-zinc-200 transition-all cursor-pointer shadow-xs"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Still Stuck? Open Pre-Filled Ticket</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
