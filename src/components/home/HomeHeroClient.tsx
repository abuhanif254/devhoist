'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Server } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Bilingual Hero proposition column with a light-mode radial contrast scrim
 * over the atmospheric cloud canvas.
 */
export default function HomeHeroClient() {
  const { language, t } = useLanguage();
  const isBN = language === 'BN';

  return (
    <div className="relative space-y-6 text-center lg:text-left">
      {/* Soft radial readability veil for Light Mode daytime sky clouds */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.35)_52%,transparent_78%)] dark:bg-none"
      />

      {/* Precision Trust Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-blue-200/80 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-slate-300 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
        <span className={`font-semibold ${isBN ? 'font-bengali' : ''}`}>{t('hero_badge')}</span>
      </div>

      {/* Main Headline */}
      <h1
        className={`text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-950 dark:text-white drop-shadow-sm ${
          isBN ? 'font-bengali leading-[1.22]' : ''
        }`}
      >
        {t('hero_title_1')}
        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400 mt-1.5">
          {t('hero_title_2')}
        </span>
      </h1>

      {/* Subheadline with high-contrast legibility */}
      <p
        className={`text-base sm:text-lg text-slate-800 dark:text-slate-200 font-normal max-w-2xl mx-auto lg:mx-0 leading-relaxed ${
          isBN ? 'font-bengali' : ''
        }`}
      >
        {t('hero_subtitle')}
      </p>

      {/* High-Contrast CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
        <Link
          href="/nodejs-hosting"
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all group ${
            isBN ? 'font-bengali' : ''
          }`}
        >
          <span>{t('hero_cta_app')}</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/wordpress-hosting-bangladesh"
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white/95 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/10 text-sm font-semibold shadow-xs transition-all ${
            isBN ? 'font-bengali' : ''
          }`}
        >
          <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{t('hero_cta_wp')}</span>
        </Link>
      </div>

      {/* Structured Spec Highlights */}
      <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs font-mono text-slate-700 dark:text-slate-300 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className={isBN ? 'font-bengali' : ''}>{t('badge_bd_optimized')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{isBN ? 'ইনস্ট্যান্ট বিকাশ, নগদ ও কার্ড' : 'Instant bKash, Nagad & Card'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className={isBN ? 'font-bengali' : ''}>{t('badge_money_back')}</span>
        </div>
      </div>
    </div>
  );
}
