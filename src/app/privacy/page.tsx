import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Lock, FileText, ShieldCheck, Database, CreditCard, Code, Clock } from 'lucide-react';
import { PRIVACY_POLICY_DATA } from '@/config/legalData';

export const metadata: Metadata = {
  title: 'Privacy Policy | Zero-Log DNS, Payment Tokenization & GDPR/BD Compliance',
  description:
    'Our strict privacy framework covering tokenized bKash/Nagad transactions, zero-log DNS resolution, and full compliance with GDPR and Bangladesh ICT guidelines.',
  openGraph: {
    title: 'Privacy Policy | DevHost Cloud',
    url: 'https://devhostcloud.com/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-12 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300">
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
              <span>Effective Date: November 2026</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
              Privacy & Security Policy
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm max-w-xl mx-auto font-normal leading-relaxed">
              Transparent, uncompromising data protection standards covering payment tokenization, server telemetry, and Zero-Log DNS.
            </p>
          </div>

          {/* Plain-English Summary Box */}
          <div className="p-6 sm:p-7 rounded-xl border border-blue-200 dark:border-white/20 bg-blue-50/50 dark:bg-zinc-900/60 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Summary in Plain English</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-normal">
              {PRIVACY_POLICY_DATA.summaryBox}
            </p>
          </div>

          {/* Detailed Policy Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
            {/* 1. Payment Tokenization & Financial Security */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
                <span>1. Payment Tokenization & Zero Stored Financial Data</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                {PRIVACY_POLICY_DATA.paymentSecurity}
              </p>
            </section>

            {/* 2. Source Code & Intellectual Property Ownership */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
                <span>2. Code Ownership & Proprietary IP Rights</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                {PRIVACY_POLICY_DATA.codeOwnership}
              </p>
            </section>

            {/* 3. Server Logging & Metrics Retention */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
                <span>3. Server Logging & Security Telemetry</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                {PRIVACY_POLICY_DATA.dataRetention}
              </p>
            </section>

            {/* 4. Compliance & User Rights */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>4. GDPR & Bangladesh Data Protection Rights</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                {PRIVACY_POLICY_DATA.gdprRights}
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
