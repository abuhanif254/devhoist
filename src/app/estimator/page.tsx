import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EstimatorClient from './EstimatorClient';

export const metadata: Metadata = {
  title: 'Multi-Service Cloud Cost Estimator & Official PDF Quote Generator | DevHost Cloud',
  description:
    'Calculate multi-service hosting budgets across shared, Cloud VPS, domains, and enterprise add-ons. Download an official printable PDF proposal with 99.9% SLA terms and agency bulk discounts.',
  openGraph: {
    title: 'Cloud Cost Estimator & PDF Quote Builder | DevHost Cloud',
    description:
      'Interactive multi-service budget calculator with instant PDF quote generation for agencies and enterprise procurement.',
    url: 'https://devhostcloud.com/estimator',
  },
};

export default function EstimatorPage() {
  return (
    <>
      <div className="print:hidden">
        <Header />
      </div>

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 print:py-0 print:bg-white print:text-zinc-950 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none print:hidden" />

        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-12 relative print:border-none print:px-0 print:max-w-none">
          <span className="crosshair-corner crosshair-tl print:hidden" />
          <span className="crosshair-corner crosshair-tr print:hidden" />

          {/* Header (Hidden in Print) */}
          <div className="text-center space-y-4 max-w-3xl mx-auto print:hidden">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Multi-Service Budgeting &amp; Official Commercial Proposal</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.1]">
              Cloud Cost Estimator &amp; Quote Builder
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              Configure multi-server architectures, domain portfolios, and enterprise add-ons. Download an official printable PDF proposal for management or client approval.
            </p>
          </div>

          {/* Estimator Client Component */}
          <EstimatorClient />
        </div>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </>
  );
}
