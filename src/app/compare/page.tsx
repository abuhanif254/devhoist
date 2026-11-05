import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ComparePageClient from './ComparePageClient';

export const metadata: Metadata = {
  title: 'Cost & Performance Comparison | DevHost Cloud vs Traditional Shared & PaaS',
  description:
    'Compare DevHost Cloud with traditional international shared hosting and modern PaaS platforms. 3-Year TCO breakdown, 15% foreign digital VAT savings, and 10-point architectural matrix.',
  openGraph: {
    title: 'Platform Comparison & TCO Calculator | DevHost Cloud',
    description:
      'Save up to 80% on 3-year hosting costs and avoid foreign VAT traps with transparent local pricing.',
    url: 'https://devhostcloud.com/compare',
  },
};

export default function ComparePage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-16 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Zero Renewal Hikes • Zero Foreign Digital VAT</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.1]">
              The Honest Comparison.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                DevHost vs The Industry.
              </span>
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              How our Git-powered NVMe hosting saves you up to ৳73,000 over 3 years compared to proprietary PaaS platforms and avoids international renewal traps.
            </p>
          </div>

          {/* Client Interactive TCO & 10-Point Comparison Table */}
          <ComparePageClient />
        </div>
      </main>

      <Footer />
    </>
  );
}
