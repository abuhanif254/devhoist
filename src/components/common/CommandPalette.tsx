'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  BookOpen,
  Server,
  Globe,
  ArrowRight,
  Terminal,
  Zap,
  Cpu,
  Calculator,
  Languages,
  DollarSign,
  Activity,
  ShieldCheck,
  SearchCheck,
  Building,
  Sparkles,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { useLanguage } from '@/context/LanguageContext';
import { EXACT_DOCS_ARTICLES } from '@/config/docsData';

export default function CommandPalette() {
  const { isCommandPaletteOpen, setIsCommandPaletteOpen, currency, setCurrency } = useBilling();
  const { language, toggleLanguage } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  // Reset search & selectedIndex on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  const handleSelectRoute = (href: string) => {
    setIsCommandPaletteOpen(false);
    router.push(href);
  };

  // Category 1: Quick Actions
  const quickActions = [
    {
      id: 'sandbox',
      title: 'Launch Live Panel Sandbox',
      desc: 'Interactive browser demo with live Git rebuilds & rollbacks',
      icon: Terminal,
      action: () => handleSelectRoute('/panel-preview'),
    },
    {
      id: 'analyzer',
      title: 'Analyze My package.json / composer.json',
      desc: 'Audit dependencies, Inode bloat & generate deploy.yml',
      icon: Cpu,
      action: () => handleSelectRoute('/nodejs-hosting#analyzer'),
    },
    {
      id: 'estimator',
      title: 'Build PDF Cost Quote & Commercial Budget',
      desc: 'Calculate multi-service pricing and print official proposal',
      icon: Calculator,
      action: () => handleSelectRoute('/estimator'),
    },
    {
      id: 'currency',
      title: `Switch Currency (Current: ${currency})`,
      desc: `Toggle pricing between ৳ BDT and $ USD`,
      icon: DollarSign,
      action: () => {
        setCurrency(currency === 'BDT' ? 'USD' : 'BDT');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'lang',
      title: `Toggle Language (Current: ${language === 'EN' ? 'English' : 'বাংলা'})`,
      desc: 'Switch between English and Bengali micro-copy',
      icon: Languages,
      action: () => {
        toggleLanguage();
        setIsCommandPaletteOpen(false);
      },
    },
  ];

  // Category 2: Hosting & Cloud Pages
  const hostingPages = [
    { title: 'Developer & Git Cloud', href: '/nodejs-hosting', icon: Terminal, category: 'CI/CD Cloud' },
    { title: 'WordPress & LiteSpeed Hosting', href: '/wordpress-hosting-bangladesh', icon: Server, category: 'Web' },
    { title: 'Managed Cloud VPS', href: '/cloud-vps', icon: Cpu, category: 'KVM NVMe' },
    { title: '1-Click App Marketplace', href: '/marketplace', icon: Zap, category: 'Templates' },
    { title: 'Free Website Migration', href: '/free-migration', icon: ArrowRight, category: 'Zero Downtime' },
    { title: 'Enterprise Dedicated Server Suite', href: '/enterprise', icon: Building, category: 'High Availability' },
    { title: 'Live Control Panel Demo Sandbox', href: '/panel-preview', icon: Terminal, category: 'Simulator' },
    { title: 'Cloud Infrastructure & Datacenters', href: '/about', icon: Server, category: 'Infrastructure' },
    { title: 'System Status & Looking Glass', href: '/server-status', icon: Activity, category: 'Real-time' },
    { title: 'Compare Plans & Hosting TCO', href: '/compare', icon: ShieldCheck, category: 'Comparison' },
    { title: 'Free Network Tools (DNS/WHOIS/Headers)', href: '/tools', icon: SearchCheck, category: 'Diagnostics' },
  ];

  // Category 3: Documentation Knowledgebase
  const docsItems = EXACT_DOCS_ARTICLES.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    readTime: article.readTime,
    summary: article.summary,
  }));

  // Filtered lists based on search
  const filteredActions = useMemo(() => {
    if (!search.trim()) return quickActions;
    const q = search.toLowerCase();
    return quickActions.filter(
      (a) => a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
    );
  }, [search, currency, language]);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return hostingPages;
    const q = search.toLowerCase();
    return hostingPages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return docsItems;
    const q = search.toLowerCase();
    return docsItems.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q)
    );
  }, [search]);

  // Total selectable items count for keyboard arrow navigation
  const totalItems = filteredActions.length + filteredPages.length + filteredDocs.length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (totalItems || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % (totalItems || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Execute active item
        let counter = 0;
        for (const act of filteredActions) {
          if (counter === selectedIndex) {
            act.action();
            return;
          }
          counter++;
        }
        for (const page of filteredPages) {
          if (counter === selectedIndex) {
            handleSelectRoute(page.href);
            return;
          }
          counter++;
        }
        for (const doc of filteredDocs) {
          if (counter === selectedIndex) {
            handleSelectRoute(`/docs#${doc.slug}`);
            return;
          }
          counter++;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, totalItems, selectedIndex, filteredActions, filteredPages, filteredDocs]);

  if (!isCommandPaletteOpen) return null;

  let currentCounter = 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex items-start justify-center animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        onClick={() => setIsCommandPaletteOpen(false)}
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Window */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/15 rounded-xl shadow-2xl overflow-hidden z-10 transition-colors">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/60">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command, page, tool, or docs topic (↑↓ arrows to navigate)..."
            className="w-full bg-transparent text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden text-sm font-sans"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="p-1 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded font-mono text-slate-500 dark:text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div ref={listRef} className="max-h-[65vh] overflow-y-auto p-3 space-y-5">
          {/* 1. Quick Actions */}
          {filteredActions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-emerald-400 font-semibold">
                Instant Cloud Actions
              </div>
              <div className="space-y-1 mt-1">
                {filteredActions.map((act) => {
                  const itemIndex = currentCounter++;
                  const isSelected = selectedIndex === itemIndex;
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      onClick={act.action}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-zinc-800/90 text-blue-900 dark:text-white border border-blue-200 dark:border-white/15 shadow-xs'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-md border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-blue-600 dark:text-emerald-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-white truncate">
                            {act.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-500 truncate">{act.desc}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-600 group-hover:text-blue-600 dark:group-hover:text-zinc-300 shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Hosting & Cloud Pages */}
          {filteredPages.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                Hosting & Architecture Pages
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                {filteredPages.map((page) => {
                  const itemIndex = currentCounter++;
                  const isSelected = selectedIndex === itemIndex;
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.href}
                      onClick={() => handleSelectRoute(page.href)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-zinc-800/90 text-blue-900 dark:text-white border border-blue-200 dark:border-white/15'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-white shrink-0" />
                        <span className="text-xs font-medium text-slate-900 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-white truncate">
                          {page.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/5 shrink-0 ml-2">
                        {page.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Documentation Articles */}
          {filteredDocs.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                Knowledgebase & Documentation
              </div>
              <div className="space-y-1 mt-1">
                {filteredDocs.map((doc) => {
                  const itemIndex = currentCounter++;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => handleSelectRoute(`/docs#${doc.slug}`)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`w-full flex items-start justify-between p-2 rounded-lg text-left transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-zinc-800/90 text-blue-900 dark:text-white border border-blue-200 dark:border-white/15 shadow-xs'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-white mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-slate-900 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-white">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-500 line-clamp-1">{doc.summary}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0 ml-2">
                        {doc.readTime}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <span>↑↓ to navigate</span>
            <span>•</span>
            <span>↵ to select</span>
            <span>•</span>
            <span>esc to close</span>
          </div>
          <span className="text-blue-600 dark:text-emerald-400 font-semibold">DevHost Cloud Super-Palette</span>
        </div>
      </div>
    </div>
  );
}
