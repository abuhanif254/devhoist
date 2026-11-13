'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, Users, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Closing high-contrast architectural conversion band placed directly above Footer.
 */
export default function ClosingCtaSection() {
  const { language, t } = useLanguage();
  const isBN = language === 'BN';

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#090D16]">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 dark:border-white/10 bg-gradient-to-br from-slate-950 via-[#0B142B] to-blue-950 p-7 sm:p-12 shadow-2xl">
        {/* Background grid & radial atmospheric glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 architectural-grid opacity-20 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-blue-200 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Touch Cloud • bKash, Nagad, Wallet &amp; Stripe</span>
          </div>

          <h2
            className={`text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight ${
              isBN ? 'font-bengali' : ''
            }`}
          >
            {t('closing_title')}
          </h2>

          <p
            className={`text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal ${
              isBN ? 'font-bengali' : ''
            }`}
          >
            {t('closing_subtitle')}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="#pricing"
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all group ${
                isBN ? 'font-bengali' : ''
              }`}
            >
              <span>{isBN ? 'প্ল্যান দেখুন ও ডেপ্লয় করুন' : 'View Plans & Deploy'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>

            <Link
              href="/free-migration"
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 font-semibold text-sm transition-all ${
                isBN ? 'font-bengali' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>{isBN ? 'ফ্রি সাইট মাইগ্রেশন' : 'Free Zero-Downtime Migration'}</span>
            </Link>
          </div>

          <div className="pt-2">
            <Link
              href="/partners"
              className={`inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 hover:text-white transition-colors ${
                isBN ? 'font-bengali' : ''
              }`}
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isBN
                  ? 'এজেন্সি ও অ্যাফিলিয়েট পার্টনার প্রোগ্রাম • ৩০% রিকারিং কমিশন →'
                  : 'Agency & Affiliate Partner Program • Earn 30% Recurring Commission →'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
