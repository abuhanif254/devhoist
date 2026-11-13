'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Server,
  Terminal,
  Globe,
  ArrowRight,
  Activity,
  BookOpen,
  ChevronDown,
  Sun,
  Moon,
  Search,
  Menu,
  X,
  ExternalLink,
  Shield,
  Layers,
  Zap,
  Cpu,
  SearchCheck,
  Scale,
  Sparkles,
  Calculator,
  LayoutDashboard,
  Building,
  CheckCircle2,
  LogOut,
  User,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePortal } from '@/context/PortalContext';

export default function Navbar() {
  const pathname = usePathname();
  const { currentUser, logout } = usePortal();
  const { currency, setCurrency, theme, toggleTheme, setIsCommandPaletteOpen, openStackBuilder } = useBilling();
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [cmsBanner, setCmsBanner] = useState<{
    enabled: boolean;
    badge_en: string;
    badge_bn: string;
    text_en: string;
    text_bn: string;
    promo_code?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/admin/cms-config?key=announcement_banner')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) setCmsBanner(data.config);
      })
      .catch(() => {});
  }, []);

  const isLight = theme === 'light';

  return (
    <header className="sticky top-0 z-50 w-full transition-colors duration-200 shadow-xs">
      {/* =========================================================================
          TIER 1: TOP MICRO-UTILITY BAR (h-9, 100% Zero-Overflow)
         ========================================================================= */}
      <div className="w-full h-9 bg-slate-50 dark:bg-[#090D16]/95 border-b border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
          {/* Left: Live Status Uptime & bKash Activation */}
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <span className="truncate text-[11px] sm:text-xs font-mono text-slate-700 dark:text-slate-300">
              <strong className="text-emerald-700 dark:text-emerald-400 font-semibold mr-1.5">
                {cmsBanner?.enabled ? (language === 'BN' ? cmsBanner.badge_bn : cmsBanner.badge_en) : '99.99%'}
              </strong>
              <span>
                {cmsBanner?.enabled
                  ? (language === 'BN' ? cmsBanner.text_bn : cmsBanner.text_en)
                  : 'Global Uptime SLA — Instant bKash & Nagad Activation'}
              </span>
            </span>
          </div>

          {/* Right: Micro Utilities (Clean, single-line, zero overflow) */}
          <div className="flex items-center gap-1.5 sm:gap-3.5 shrink-0 whitespace-nowrap">
            {/* Server Status Link */}
            <Link
              href="/server-status"
              className="hidden md:inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-slate-100 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('nav_status')}</span>
            </Link>

            {/* Docs Link */}
            <Link
              href="/docs"
              className="hidden sm:inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-slate-100 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{t('nav_docs')}</span>
            </Link>

            <span className="hidden sm:inline-block text-slate-300 dark:text-slate-700">|</span>

            {/* Compact Language Switcher (EN | বাং) */}
            <div className="inline-flex items-center p-0.5 rounded-md bg-slate-200/80 dark:bg-slate-900 border border-slate-300/60 dark:border-white/10 text-[11px]">
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  language === 'EN'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('BN')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  language === 'BN'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                বাং
              </button>
            </div>

            {/* Compact Currency Switcher (৳ BDT | $ USD) */}
            <div className="inline-flex items-center p-0.5 rounded-md bg-slate-200/80 dark:bg-slate-900 border border-slate-300/60 dark:border-white/10 text-[11px]">
              <button
                type="button"
                onClick={() => setCurrency('BDT')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  currency === 'BDT'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ৳<span className="hidden sm:inline"> BDT</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                $<span className="hidden sm:inline"> USD</span>
              </button>
            </div>

            {/* Theme Toggle (Light / Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1 rounded-md bg-slate-200/70 dark:bg-slate-900 border border-slate-300/60 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle theme"
            >
              {isLight ? (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {/* User Session / Client Area */}
            {currentUser ? (
              <div className="hidden sm:inline-flex items-center gap-2">
                <Link
                  href={currentUser.role === 'admin' ? '/admin' : '/dashboard'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{currentUser.role === 'admin' ? 'Admin NOC' : 'Client Area'}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
              >
                <span>Sign In</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TIER 2: MAIN PRIMARY NAVBAR (h-16, Strict 5-Menu Balance)
         ========================================================================= */}
      <div className="w-full h-16 bg-white/95 dark:bg-[#090D16]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08]">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
          {/* 1. Left: Brand Logo */}
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  DevHost
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded bg-blue-50 dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-white/10 uppercase">
                  Cloud
                </span>
              </div>
            </Link>

            {/* 2. Center: STRICTLY 5 MENU ITEMS (No clutter, perfect spacing) */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-[14px] font-semibold">
              {/* Menu 1: Hosting Mega Menu */}
              <div
                className="relative"
                onMouseEnter={() => setActiveDropdown('hosting')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'hosting' ? null : 'hosting')}
                  className={`flex items-center gap-1.5 py-2 transition-colors cursor-pointer ${
                    activeDropdown === 'hosting' || pathname.includes('hosting') || pathname.includes('vps')
                      ? 'text-blue-600 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white'
                  }`}
                >
                  <span>{t('nav_hosting')}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'hosting' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'hosting' && (
                  <div className="absolute top-full -left-4 w-[620px] bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 whitespace-normal">
                    <div className="grid grid-cols-2 gap-4">
                      <Link
                        href="/wordpress-hosting-bangladesh"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>Web &amp; WordPress Hosting</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            LiteSpeed Enterprise server, cPanel &amp; free Sitejet AI builder.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/nodejs-hosting"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Terminal className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>Developer Git Hosting</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                              ৳450/mo
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            GitHub OAuth CI/CD, PR previews, ZIP upload &amp; containers.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/cloud-vps"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>Managed Cloud VPS</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            Dedicated NVMe KVM, custom slider specs &amp; full root access.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/enterprise"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Building className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>Enterprise Bare-Metal</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            AMD EPYC dedicated hardware clusters with 99.99% SLA.
                          </p>
                        </div>
                      </Link>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between text-xs">
                      <Link
                        href="/free-migration"
                        onClick={() => setActiveDropdown(null)}
                        className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Free Website Migration with Zero Downtime →</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Menu 2: Domains Mega Menu */}
              <div
                className="relative"
                onMouseEnter={() => setActiveDropdown('domains')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'domains' ? null : 'domains')}
                  className={`flex items-center gap-1.5 py-2 transition-colors cursor-pointer ${
                    activeDropdown === 'domains' || pathname.includes('domain') || pathname.includes('tools')
                      ? 'text-blue-600 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white'
                  }`}
                >
                  <span>Domains</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'domains' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'domains' && (
                  <div className="absolute top-full -left-8 w-[620px] bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 whitespace-normal">
                    <div className="grid grid-cols-2 gap-4">
                      <Link
                        href="/cheap-domain-registration-bd"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>Domain Name Search</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            Instant live availability for .com (৳1,350), .xyz, .io &amp; .ai.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/tools?tab=whois"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                          <SearchCheck className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>WHOIS &amp; RDAP Lookup</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            Inspect registrar details, expiry dates &amp; raw records.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/tools?tab=dns"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>Global DNS Propagation</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            Check A, CNAME &amp; MX records across worldwide resolver nodes.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/tools?tab=headers"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 whitespace-nowrap">
                            <span>SSL &amp; Security Auditor</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed whitespace-normal break-words">
                            Verify HSTS, CSP and TLS certificates in real time.
                          </p>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Menu 3: Marketplace */}
              <Link
                href="/marketplace"
                className={`py-2 transition-colors ${
                  pathname === '/marketplace'
                    ? 'text-blue-600 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                Marketplace
              </Link>

              {/* Menu 4: Pricing & Estimator */}
              <Link
                href="/estimator"
                className={`py-2 transition-colors ${
                  pathname === '/estimator'
                    ? 'text-blue-600 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                Pricing &amp; Estimator
              </Link>

              {/* Menu 5: Explore Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setActiveDropdown('explore')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'explore' ? null : 'explore')}
                  className={`flex items-center gap-1.5 py-2 transition-colors cursor-pointer ${
                    activeDropdown === 'explore'
                      ? 'text-blue-600 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white'
                  }`}
                >
                  <span>Explore</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'explore' ? 'rotate-180' : ''}`} />
                </button>

                {activeDropdown === 'explore' && (
                  <div className="absolute top-full -left-4 w-60 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <Link
                      href="/panel-preview"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 text-blue-600" />
                      <span>Live Panel Demo</span>
                    </Link>

                    <Link
                      href="/compare"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <Scale className="w-4 h-4 text-emerald-600" />
                      <span>Why Choose Us (Compare)</span>
                    </Link>

                    <Link
                      href="/security"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span>Security &amp; Trust Center</span>
                    </Link>

                    <Link
                      href="/partners"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Affiliate &amp; Agency Partners</span>
                    </Link>

                    <Link
                      href="/changelog"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <Layers className="w-4 h-4 text-cyan-600" />
                      <span>Engineering Changelog</span>
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* 3. Right: STRICTLY 2 ACTIONS (Zero Overflow Guaranteed!) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Action 1: Compact Search Trigger Pill (Single Line) */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-lg flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-medium cursor-pointer whitespace-nowrap"
              title="Search documentation & commands (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 shadow-2xs">
                ⌘K
              </kbd>
            </button>

            {/* Action 2: High-Contrast Royal Cobalt Deploy CTA */}
            <button
              type="button"
              onClick={() =>
                openStackBuilder({
                  pid: 2,
                  planName: 'Developer Pro Cloud',
                  basePriceMonthlyBDT: 450,
                  basePriceMonthlyUSD: 3.75,
                  specs: {
                    ram: '2 GB Isolated RAM',
                    cpu: '2 Core vCPU',
                    storage: '5 GB NVMe SSD',
                    inodes: '300,000 Inodes',
                  },
                })
              }
              className="h-9 sm:h-10 px-3.5 sm:px-5 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center gap-1.5 sm:gap-2 transition-all group cursor-pointer"
            >
              <span>{t('nav_deploy')}</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE COMPREHENSIVE DRAWER
         ========================================================================= */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[100px] bg-white dark:bg-[#090D16] border-b border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-5 max-h-[82vh] overflow-y-auto animate-in slide-in-from-top-4 duration-200 z-50">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold px-2 py-1">
              Hosting Products
            </div>
            <Link
              href="/wordpress-hosting-bangladesh"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Web &amp; WordPress Hosting
            </Link>
            <Link
              href="/nodejs-hosting"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Developer Git Hosting (৳450/mo)
            </Link>
            <Link
              href="/cloud-vps"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Managed Cloud VPS
            </Link>
            <Link
              href="/enterprise"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Enterprise Bare-Metal &amp; HA
            </Link>
            <Link
              href="/free-migration"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
            >
              Free Website Migration
            </Link>
          </div>

          <div className="space-y-1 border-t border-slate-100 dark:border-white/10 pt-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold px-2 py-1">
              Domains &amp; Cloud Tools
            </div>
            <Link
              href="/cheap-domain-registration-bd"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Domain Name Search
            </Link>
            <Link
              href="/tools"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              WHOIS, DNS &amp; Security Tools
            </Link>
            <Link
              href="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              1-Click App Marketplace
            </Link>
            <Link
              href="/estimator"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Pricing &amp; Cost Estimator
            </Link>
            <Link
              href="/panel-preview"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
            >
              Live Control Panel Sandbox
            </Link>
          </div>

          <div className="border-t border-slate-100 dark:border-white/10 pt-4 flex flex-col gap-2.5">
            {currentUser ? (
              <>
                <Link
                  href={currentUser.role === 'admin' ? '/admin' : '/dashboard'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-sm font-semibold flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{currentUser.role === 'admin' ? 'Founder Admin NOC' : 'Customer Portal (Client Area)'}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full h-10 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out ({currentUser.name || currentUser.email})</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full h-10 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 transition-colors"
              >
                <span>Sign In to Cloud Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openStackBuilder({
                  pid: 2,
                  planName: 'Developer Pro Cloud',
                  basePriceMonthlyBDT: 450,
                  basePriceMonthlyUSD: 3.75,
                });
              }}
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>Deploy Developer Pro — ৳450/mo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
