import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ShieldCheck, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Globe } from 'lucide-react';
import { REFUND_POLICY_DATA } from '@/config/legalData';

export const metadata: Metadata = {
  title: 'Refund Policy | 30-Day Money-Back Guarantee SLA',
  description:
    'Our transparent, 100% risk-free 30-Day Money-Back Guarantee for web and developer cloud hosting. Instant bKash, Nagad, and Card refunds without hidden fees.',
  openGraph: {
    title: '30-Day Money-Back Refund Guarantee | DevHost Cloud',
    url: 'https://devhostcloud.com/refund-policy',
  },
};

export default function RefundPolicyPage() {
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
              {REFUND_POLICY_DATA.guaranteeDays}-Day Money-Back Refund Policy
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm max-w-xl mx-auto font-normal leading-relaxed">
              Test our NVMe speed, LiteSpeed caching, and GitHub pipelines completely risk-free for {REFUND_POLICY_DATA.guaranteeDays} days.
            </p>
          </div>

          {/* Plain-English Summary Box */}
          <div className="p-6 sm:p-7 rounded-xl border border-blue-200 dark:border-white/20 bg-blue-50/50 dark:bg-zinc-900/60 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Summary in Plain English</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-normal">
              {REFUND_POLICY_DATA.summaryBox}
            </p>
          </div>

          {/* What is Covered vs Excluded */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Covered */}
            <div className="p-6 rounded-xl border border-emerald-200 dark:border-white/[0.08] bg-emerald-50/40 dark:bg-zinc-950/70 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>100% Refundable (Within {REFUND_POLICY_DATA.guaranteeDays} Days)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-zinc-300 font-mono">
                {REFUND_POLICY_DATA.coveredServices.map((srv, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{srv}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Excluded */}
            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/70 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 text-xs font-mono font-semibold">
                <XCircle className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span>Non-Refundable Registry Exclusions</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-zinc-400 font-mono">
                {REFUND_POLICY_DATA.nonRefundableItems.map((srv, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-600" />
                    <span>{srv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Domain Ownership Protection */}
          <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
              <span>1. Domain Ownership Protection</span>
            </h2>
            <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
              {REFUND_POLICY_DATA.ownershipClause}
            </p>
          </section>

          {/* Refund Processing Timeline */}
          <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
              <span>2. Processing Timeline & Payout Channels</span>
            </h2>
            <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
              {REFUND_POLICY_DATA.refundProcessTime}
            </p>
          </section>

          {/* Abuse Exception */}
          <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>3. Abuse & Terms Violation Exceptions</span>
            </h2>
            <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
              {REFUND_POLICY_DATA.abuseException}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
