import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MarketplaceClient from './MarketplaceClient';

export const metadata: Metadata = {
  title: '1-Click Application Marketplace & Starter Templates | DevHost Cloud',
  description:
    'Deploy production Next.js 15, WordPress Turbo, Laravel 11, NestJS, and self-hosted n8n in under 60 seconds with pre-tuned CloudLinux environments and zero-downtime CI/CD.',
  openGraph: {
    title: '1-Click App Marketplace | DevHost Cloud',
    description:
      'Explore 12 production templates pre-tuned for LiteSpeed, Passenger, and NVMe SSD hosting.',
    url: 'https://devhostcloud.com/marketplace',
  },
};

export default function MarketplacePage() {
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
              <span>Production Stacks • Pre-Tuned CloudLinux Environments</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.1]">
              1-Click Application Marketplace
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              Launch enterprise full-stack web applications, CMS platforms, and self-hosted developer tools in under 60 seconds with pre-configured webhooks, Redis caching, and Jailed SSH.
            </p>
          </div>

          {/* Client Interactive Marketplace Component */}
          <MarketplaceClient />
        </div>
      </main>

      <Footer />
    </>
  );
}
