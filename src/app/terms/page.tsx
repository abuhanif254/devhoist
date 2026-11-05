import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { TERMS_OF_SERVICE_DATA } from '@/config/legalData';

export const metadata: Metadata = {
  title: 'Terms of Service | 99.9% Global Uptime SLA & CloudLinux LVE Policy',
  description:
    'Our transparent, plain-English Terms of Service covering the 99.9% uptime SLA, CloudLinux resource isolation, zero renewal traps, and abuse guidelines.',
  openGraph: {
    title: 'Terms of Service | DevHost Cloud',
    url: 'https://devhostcloud.com/terms',
  },
};

export default function TermsPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Architectural Grid Background with Radial Mask */}
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
              Terms of Service & SLA
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm max-w-xl mx-auto font-normal leading-relaxed">
              Our service agreement engineered with zero hidden legalese, transparent uptime credits, and fair resource limits.
            </p>
          </div>

          {/* Plain-English Summary Box */}
          <div className="p-6 sm:p-7 rounded-xl border border-blue-200 dark:border-white/20 bg-blue-50/50 dark:bg-zinc-900/60 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Summary in Plain English</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-normal">
              {TERMS_OF_SERVICE_DATA.summaryBox}
            </p>
          </div>

          {/* Detailed Legal Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
            {/* 1. Uptime Guarantee & SLA Credits */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="text-blue-600 dark:text-zinc-400 font-mono">1.</span>
                <span>{TERMS_OF_SERVICE_DATA.slaGuaranteePercent} Global Uptime SLA & Credit Formula</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                {TERMS_OF_SERVICE_DATA.slaCreditFormula}
              </p>
            </section>

            {/* 2. CloudLinux Resource Limits & Fair Use */}
            <section className="space-y-4 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="text-blue-600 dark:text-zinc-400 font-mono">2.</span>
                <span>CloudLinux Isolation & Fair Use Quotas</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                {TERMS_OF_SERVICE_DATA.cloudLinuxLvePolicy.description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" /> Starter Pack
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                    {TERMS_OF_SERVICE_DATA.cloudLinuxLvePolicy.starter}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" /> Developer Pro
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                    {TERMS_OF_SERVICE_DATA.cloudLinuxLvePolicy.developerPro}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" /> Business Max
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                    {TERMS_OF_SERVICE_DATA.cloudLinuxLvePolicy.businessMax}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Transparent Renewal Pricing Guarantee */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="text-blue-600 dark:text-zinc-400 font-mono">3.</span>
                <span>Renewal Pricing Transparency (Zero Price Hikes)</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                DevHost Cloud guarantees lifetime price parity. Your annual or monthly renewal rates remain permanently locked at the initial rate agreed upon at signup. We do not use introductory discounts followed by 300%–500% renewal price spikes.
              </p>
            </section>

            {/* 4. Automated Account Lifecycle: Invoicing, Suspension & Termination */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="text-blue-600 dark:text-zinc-400 font-mono">4.</span>
                <span>Automated Billing & Account Lifecycle</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                Billing lifecycle routines are fully automated through WHMCS and WHM APIs to ensure zero service disruption for active accounts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200">Invoice Generation</div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400">{TERMS_OF_SERVICE_DATA.billingLifecycle.invoiceGeneration}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200">Grace Period</div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400">{TERMS_OF_SERVICE_DATA.billingLifecycle.gracePeriod}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">Suspension (3 Days)</div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400">{TERMS_OF_SERVICE_DATA.billingLifecycle.suspension}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="font-mono text-xs font-semibold text-rose-600 dark:text-red-400">Termination (14 Days)</div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400">{TERMS_OF_SERVICE_DATA.billingLifecycle.termination}</div>
                </div>
              </div>
            </section>

            {/* 5. Zero-Tolerance Abuse Policy */}
            <section className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-red-400" />
                <span>Zero-Tolerance Abuse & Prohibited Activities</span>
              </h2>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                To maintain server reputation, clean IP ranges, and system stability for all clients, the following activities result in immediate termination without refund eligibility:
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                {TERMS_OF_SERVICE_DATA.prohibitedActivities.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-medium"
                  >
                    ✕ {item}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
