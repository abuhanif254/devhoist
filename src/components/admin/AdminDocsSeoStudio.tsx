'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  HelpCircle,
  Globe,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Eye,
  RefreshCw,
  Search,
  Sparkles,
  Layers,
  Code2,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';

export interface SeoRouteItem {
  route_path: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  canonical_path: string;
  og_title: string;
  og_subtitle: string;
  schema_type: 'Product' | 'WebApplication' | 'FAQPage' | 'TechArticle' | 'Organization';
  is_active?: boolean;
}

export interface DocsArticleItem {
  id?: string | number;
  slug: string;
  title_en: string;
  title_bn?: string;
  category: string;
  summary_en: string;
  summary_bn?: string;
  difficulty_level: string;
  read_time_minutes: number;
  recommended_plan_slug: string;
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
  is_published?: boolean;
}

export interface FaqItem {
  id?: string;
  target_page: string;
  question_en: string;
  question_bn?: string;
  answer_en: string;
  answer_bn?: string;
  sort_order: number;
  is_active?: boolean;
}

export default function AdminDocsSeoStudio() {
  const [activeTab, setActiveTab] = useState<'articles' | 'faqs' | 'seo'>('seo');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [articles, setArticles] = useState<DocsArticleItem[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [seoRoutes, setSeoRoutes] = useState<SeoRouteItem[]>([]);

  // Sudo Elevation State
  const { requireSudo } = useSudoGate();

  // Selected for Editing
  const [selectedSeoRoute, setSelectedSeoRoute] = useState<SeoRouteItem | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<DocsArticleItem | null>(null);
  const [selectedFaq, setSelectedFaq] = useState<FaqItem | null>(null);

  // Modal open states
  const [isArticleModalOpen, setIsArticleModalOpen] = useState<boolean>(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState<boolean>(false);

  // Fetch all CMS, Docs & SEO data
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs?type=all');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setArticles(data.articles || []);
          setFaqs(data.faqs || []);
          setSeoRoutes(data.seoRoutes || []);
          if (data.seoRoutes && data.seoRoutes.length > 0 && !selectedSeoRoute) {
            setSelectedSeoRoute(data.seoRoutes[0]);
          }
        }
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: 'Failed to load CMS & SEO data: ' + (err instanceof Error ? err.message : 'Unknown error'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSudoAction = (action: () => Promise<void>) => {
    requireSudo(action, 'Documentation & SEO Mutation');
  };

  // -------------------------------------------------------------------------
  // SEO ROUTE SAVE HANDLER
  // -------------------------------------------------------------------------
  const handleSaveSeoRoute = () => {
    if (!selectedSeoRoute) return;
    triggerSudoAction(async () => {
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_seo_route',
            seoRouteData: selectedSeoRoute,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
          loadData();
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to save SEO route' });
        }
      } catch (err: unknown) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save SEO route' });
      } finally {
        setSaving(false);
      }
    });
  };

  // -------------------------------------------------------------------------
  // ARTICLE SAVE / DELETE HANDLERS
  // -------------------------------------------------------------------------
  const handleSaveArticle = () => {
    if (!selectedArticle) return;
    triggerSudoAction(async () => {
      setSaving(true);
      try {
        const res = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_article',
            articleData: selectedArticle,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
          setIsArticleModalOpen(false);
          loadData();
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to save article' });
        }
      } catch (err: unknown) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save article' });
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDeleteArticle = (slug: string) => {
    triggerSudoAction(async () => {
      try {
        const res = await fetch(`/api/docs?type=article&slug=${encodeURIComponent(slug)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
          loadData();
        }
      } catch (err: unknown) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete article' });
      }
    });
  };

  // -------------------------------------------------------------------------
  // FAQ SAVE / DELETE HANDLERS
  // -------------------------------------------------------------------------
  const handleSaveFaq = () => {
    if (!selectedFaq) return;
    triggerSudoAction(async () => {
      setSaving(true);
      try {
        const res = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_faq',
            faqData: selectedFaq,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
          setIsFaqModalOpen(false);
          loadData();
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to save FAQ' });
        }
      } catch (err: unknown) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save FAQ' });
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDeleteFaq = (id: string) => {
    triggerSudoAction(async () => {
      try {
        const res = await fetch(`/api/docs?type=faq&id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
          loadData();
        }
      } catch (err: unknown) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete FAQ' });
      }
    });
  };

  return (
    <div className="space-y-6">

      {/* Top Banner and Sub-Navigation */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              Documentation, FAQ &amp; Dynamic SEO Studio
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Dynamic database-driven SEO metadata with live Google SERP preview, context-aware runbooks,
            and platform FAQ management.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('seo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'seo'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Dynamic SEO &amp; SERP</span>
          </button>
          <button
            onClick={() => setActiveTab('articles')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'articles'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Runbooks &amp; Docs ({articles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('faqs')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'faqs'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Platform FAQs ({faqs.length})</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 text-rose-800 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: DYNAMIC SEO & GOOGLE SERP STUDIO                               */}
      {/* ===================================================================== */}
      {activeTab === 'seo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Route Selector List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 uppercase px-1">
              <span>Indexed Routes ({seoRoutes.length})</span>
              <button
                onClick={() => {
                  const newRoute: SeoRouteItem = {
                    route_path: '/custom-page',
                    meta_title: 'Custom Page Title | DevHost',
                    meta_description: 'Custom meta description for search engine ranking in Bangladesh.',
                    keywords: ['cloud hosting', 'devhost'],
                    canonical_path: 'https://devhostcloud.com/custom-page',
                    og_title: 'Custom Page Title',
                    og_subtitle: 'Sub-40ms cloud infrastructure in Singapore and Bangladesh.',
                    schema_type: 'WebApplication',
                  };
                  setSelectedSeoRoute(newRoute);
                }}
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Route</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {seoRoutes.map((route) => {
                const isSelected = selectedSeoRoute?.route_path === route.route_path;
                return (
                  <button
                    key={route.route_path}
                    onClick={() => setSelectedSeoRoute(route)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/20 text-blue-900 dark:text-zinc-100 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span className="truncate">{route.route_path}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500">
                        {route.schema_type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-1">
                      {route.meta_title}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: SEO Metadata Editor & Live Google SERP Preview */}
          <div className="lg:col-span-8 space-y-6">
            {selectedSeoRoute ? (
              <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                      Edit SEO: {selectedSeoRoute.route_path}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Changes persist dynamically to Supabase <code className="font-mono">cms_seo_routes</code>.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveSeoRoute}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Live SEO'}</span>
                  </button>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Route Path
                    </label>
                    <input
                      type="text"
                      value={selectedSeoRoute.route_path}
                      onChange={(e) =>
                        setSelectedSeoRoute({ ...selectedSeoRoute, route_path: e.target.value })
                      }
                      className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-zinc-300">
                        Meta Title (Google SERP Header)
                      </label>
                      <span
                        className={`text-[10px] font-mono ${
                          (selectedSeoRoute.meta_title || '').length > 60 ? 'text-amber-500 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {(selectedSeoRoute.meta_title || '').length}/60 chars recommended
                      </span>
                    </div>
                    <input
                      type="text"
                      value={selectedSeoRoute.meta_title}
                      onChange={(e) =>
                        setSelectedSeoRoute({ ...selectedSeoRoute, meta_title: e.target.value })
                      }
                      className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-zinc-300">
                        Meta Description (Search Snippet)
                      </label>
                      <span
                        className={`text-[10px] font-mono ${
                          (selectedSeoRoute.meta_description || '').length > 160
                            ? 'text-amber-500 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {(selectedSeoRoute.meta_description || '').length}/160 chars recommended
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={selectedSeoRoute.meta_description}
                      onChange={(e) =>
                        setSelectedSeoRoute({ ...selectedSeoRoute, meta_description: e.target.value })
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      OpenGraph Title (Social Share)
                    </label>
                    <input
                      type="text"
                      value={selectedSeoRoute.og_title}
                      onChange={(e) =>
                        setSelectedSeoRoute({ ...selectedSeoRoute, og_title: e.target.value })
                      }
                      className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Schema.org Structured Type
                    </label>
                    <select
                      value={selectedSeoRoute.schema_type}
                      onChange={(e) =>
                        setSelectedSeoRoute({
                          ...selectedSeoRoute,
                          schema_type: e.target.value as SeoRouteItem['schema_type'],
                        })
                      }
                      className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-mono"
                    >
                      <option value="WebApplication">WebApplication</option>
                      <option value="Product">Product</option>
                      <option value="TechArticle">TechArticle</option>
                      <option value="FAQPage">FAQPage</option>
                      <option value="Organization">Organization</option>
                    </select>
                  </div>
                </div>

                {/* Real-Time Google SERP Preview Box */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Live Google Search Engine Result Page (SERP) Preview</span>
                  </span>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 max-w-xl font-sans">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold">
                        D
                      </div>
                      <div className="text-xs text-slate-700 dark:text-zinc-400 leading-none">
                        <span>devhostcloud.com</span>
                        <span className="text-slate-400 mx-1">›</span>
                        <span className="text-slate-500">{selectedSeoRoute.route_path.replace(/^\//, '')}</span>
                      </div>
                    </div>

                    <h4 className="text-base text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer font-medium leading-snug truncate">
                      {selectedSeoRoute.meta_title || 'DevHost Cloud — Vercel Experience on cPanel'}
                    </h4>

                    <p className="text-xs text-[#4d5156] dark:text-[#bdc1c6] mt-1 line-clamp-2 leading-relaxed">
                      {selectedSeoRoute.meta_description ||
                        'Next-generation NVMe hosting in Bangladesh. Auto-deploy Git repos to LiteSpeed cPanel with instant bKash checkout.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">Select a route to edit its SEO parameters.</div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ARTICLES & RUNBOOKS                                            */}
      {/* ===================================================================== */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase">
              All Technical Documentation Articles ({articles.length})
            </span>
            <button
              onClick={() => {
                setSelectedArticle({
                  slug: 'new-runbook-guide',
                  title_en: 'New Technical Runbook Guide',
                  category: 'Git & CI/CD Deployment',
                  summary_en: 'Step by step deployment guide with real-time cPanel variables.',
                  difficulty_level: 'Intermediate',
                  read_time_minutes: 5,
                  recommended_plan_slug: 'developer-pro',
                  steps_json: [
                    {
                      stepNumber: 1,
                      heading_en: 'Configure SSH Access',
                      explanation_en: 'Connect to your server using Jailed SSH terminal.',
                      codeSnippet: 'ssh -p {{SSH_PORT}} {{CPANEL_USER}}@{{SERVER_IP}}',
                      codeLanguage: 'bash',
                    },
                  ],
                  is_published: true,
                });
                setIsArticleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Article</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-white/10 text-slate-500 font-mono uppercase">
                <tr>
                  <th className="p-3">Title &amp; Slug</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Read Time</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Helpful %</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {articles.map((art) => {
                  const totalVotes = (art.helpful_yes_count || 0) + (art.helpful_no_count || 0);
                  const helpfulPercent =
                    totalVotes > 0 ? Math.round(((art.helpful_yes_count || 0) / totalVotes) * 100) : 100;

                  return (
                    <tr key={art.slug} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-zinc-100">{art.title_en}</div>
                        <div className="font-mono text-[11px] text-slate-400">/docs?article={art.slug}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[10px]">
                          {art.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{art.read_time_minutes}m</td>
                      <td className="p-3 font-mono text-slate-700 dark:text-zinc-300">{art.views_count || 0}</td>
                      <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {helpfulPercent}% ({art.helpful_yes_count || 0}/{totalVotes})
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedArticle(art);
                            setIsArticleModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteArticle(art.slug)}
                          className="text-rose-500 hover:text-rose-600 cursor-pointer font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PLATFORM FAQS                                                  */}
      {/* ===================================================================== */}
      {activeTab === 'faqs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase">
              Platform FAQ Entries ({faqs.length})
            </span>
            <button
              onClick={() => {
                setSelectedFaq({
                  target_page: 'home',
                  question_en: 'New Frequently Asked Question',
                  answer_en: 'Detailed answer explaining the technical architecture and features.',
                  sort_order: faqs.length + 1,
                  is_active: true,
                });
                setIsFaqModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New FAQ</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-white/10 text-slate-500 font-mono uppercase">
                <tr>
                  <th className="p-3">Page</th>
                  <th className="p-3">Question</th>
                  <th className="p-3">Answer Snippet</th>
                  <th className="p-3">Sort</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {faqs.map((faq, idx) => (
                  <tr key={faq.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono text-[10px]">
                        {faq.target_page}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-zinc-100 max-w-xs truncate">
                      {faq.question_en}
                    </td>
                    <td className="p-3 text-slate-500 max-w-sm truncate">{faq.answer_en}</td>
                    <td className="p-3 font-mono text-slate-400">{faq.sort_order}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedFaq(faq);
                          setIsFaqModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => faq.id && handleDeleteFaq(faq.id)}
                        className="text-rose-500 hover:text-rose-600 cursor-pointer font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ARTICLE EDIT MODAL */}
      {isArticleModalOpen && selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              {selectedArticle.id ? 'Edit Article' : 'Create New Article'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Title (English)</label>
                <input
                  type="text"
                  value={selectedArticle.title_en}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, title_en: e.target.value })}
                  className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Slug</label>
                  <input
                    type="text"
                    value={selectedArticle.slug}
                    onChange={(e) => setSelectedArticle({ ...selectedArticle, slug: e.target.value })}
                    className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    value={selectedArticle.category}
                    onChange={(e) => setSelectedArticle({ ...selectedArticle, category: e.target.value })}
                    className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Summary</label>
                <textarea
                  rows={2}
                  value={selectedArticle.summary_en}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, summary_en: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Steps JSON (Live Variables Supported)</label>
                <textarea
                  rows={6}
                  value={JSON.stringify(selectedArticle.steps_json, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setSelectedArticle({ ...selectedArticle, steps_json: parsed });
                    } catch {}
                  }}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-900 text-slate-200 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsArticleModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArticle}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs cursor-pointer shadow-xs"
              >
                Save Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ EDIT MODAL */}
      {isFaqModalOpen && selectedFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              {selectedFaq.id ? 'Edit FAQ' : 'Create New FAQ'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Page</label>
                <select
                  value={selectedFaq.target_page}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, target_page: e.target.value })}
                  className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900"
                >
                  <option value="home">Home Page</option>
                  <option value="nodejs">Node.js Hosting</option>
                  <option value="wordpress">WordPress Hosting</option>
                  <option value="vps">Cloud VPS</option>
                  <option value="domains">Domain Registration</option>
                  <option value="docs">Docs &amp; Knowledge Base</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Question (English)</label>
                <input
                  type="text"
                  value={selectedFaq.question_en}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, question_en: e.target.value })}
                  className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Answer (English)</label>
                <textarea
                  rows={4}
                  value={selectedFaq.answer_en}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, answer_en: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Sort Order</label>
                <input
                  type="number"
                  value={selectedFaq.sort_order}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, sort_order: Number(e.target.value) })}
                  className="w-24 h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsFaqModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFaq}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs cursor-pointer shadow-xs"
              >
                Save FAQ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
