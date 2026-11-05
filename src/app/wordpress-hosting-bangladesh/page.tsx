import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SpeedBenchmarkChart from '@/components/wordpress/SpeedBenchmarkChart';
import SitejetPreview from '@/components/wordpress/SitejetPreview';
import ComparisonMatrix from '@/components/wordpress/ComparisonMatrix';
import FaqAccordion from '@/components/common/FaqAccordion';
import { Server, ArrowRight, Clock } from 'lucide-react';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';

export const metadata: Metadata = {
  title: 'WordPress Hosting Bangladesh | LiteSpeed NVMe & Sitejet AI Builder',
  description:
    'Experience sub-50ms TTFB in Bangladesh with LiteSpeed Enterprise Web Server, LSCache, NVMe SSDs in Singapore, 1-Click Softaculous WordPress, and bKash/Nagad checkout.',
  openGraph: {
    title: 'Fastest WordPress Hosting in Bangladesh | DevHost Cloud',
    description:
      'Ultra-fast NVMe WordPress hosting with built-in Sitejet AI builder, LiteSpeed cache, and free daily cloud backups.',
    url: 'https://devhostcloud.com/wordpress-hosting-bangladesh',
  },
  alternates: {
    canonical: 'https://devhostcloud.com/wordpress-hosting-bangladesh',
  },
};

export default function WordPressHostingPage() {
  const starterCartUrl = buildHostingOrderUrl(1, false, 'BDT');

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'LiteSpeed WordPress Hosting Bangladesh',
    description: 'High-speed WordPress hosting with LiteSpeed Enterprise and NVMe SSD.',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: '200',
      highPrice: '900',
      offerCount: '3',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Structural Container with 1px Architectural Borders */}
        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Hero Section */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 relative z-10 border-b border-slate-200 dark:border-white/[0.07]">
            <div className="max-w-4xl mx-auto text-center space-y-7">
              {/* Precision Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Singapore Tier-IV NVMe</span>
                <span className="text-slate-300 dark:text-zinc-600">•</span>
                <span className="text-blue-900 dark:text-zinc-200">LiteSpeed Enterprise</span>
              </div>

              {/* Scaled H1 */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white">
                Blazing WordPress.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                  Sub-50ms TTFB.
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-300 font-normal leading-relaxed max-w-2xl mx-auto">
                Powered by pure PCIe Gen4 NVMe SSDs, LiteSpeed Enterprise caching, and automated JetBackup offsite cloud snapshots. Launch in seconds with 1-Click Softaculous or create a site with Sitejet AI.
              </p>

              {/* High-Contrast CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
                <a
                  href={starterCartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 transition-all group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Launch WordPress — ৳200/mo</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-1.5 transition-transform" />
                </a>

                <a
                  href="#benchmark"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 text-sm font-semibold transition-all cursor-pointer"
                >
                  <span>View Speed Benchmarks</span>
                  <Clock className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                </a>
              </div>

              {/* Structured Spec Bar */}
              <div className="pt-3 flex justify-center">
                <div className="inline-flex flex-wrap items-center justify-center divide-x divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 rounded-xl px-2 py-2 text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-xs">
                  <span className="px-3 py-0.5">1-Click Softaculous</span>
                  <span className="px-3 py-0.5">Sitejet AI Builder</span>
                  <span className="px-3 py-0.5">Free Wildcard SSL</span>
                  <span className="px-3 py-0.5">bKash &amp; Nagad Accepted</span>
                </div>
              </div>
            </div>
          </section>

          {/* 1. LiteSpeed vs Apache Speed Benchmark Chart */}
          <section id="benchmark" className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <SpeedBenchmarkChart />
          </section>

          {/* 2. Sitejet AI Website Builder Preview */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <SitejetPreview />
          </section>

          {/* 3. Sticky Feature Comparison Matrix */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <ComparisonMatrix />
          </section>

          {/* WordPress FAQ Accordion */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
            <FaqAccordion
              title="WordPress & Web Hosting FAQs"
              subtitle="Everything you need to know about LiteSpeed caching, Softaculous installations, and WooCommerce performance."
              items={COMPLETE_FAQ_LIST}
            />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
