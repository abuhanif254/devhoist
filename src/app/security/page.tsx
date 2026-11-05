import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SecurityPageClient from './SecurityPageClient';

export const metadata: Metadata = {
  title: 'Security & Trust Center | 6-Layer Enterprise Shield & Global Datacenters',
  description:
    'Explore DevHost Cloud enterprise security architecture: CloudLinux CageFS isolation, Imunify360 AI firewall, LiteSpeed WAF, Anycast DDoS defense, and automated offsite backups.',
  openGraph: {
    title: 'Security & Trust Center | DevHost Cloud',
    description:
      'Tier-IV Singapore & USA datacenters protected by 6-layer enterprise security shield and real-time abuse mitigation.',
    url: 'https://devhostcloud.com/security',
  },
};

export default function SecurityPage() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Tier-IV Certified Datacenters & ISO 27001 Standards</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.1]">
              Enterprise Security &
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                Infrastructure Trust Center.
              </span>
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              Our 6-layer security perimeter defends your applications, APIs, and customer data with hardware isolation, AI malware scrubbing, and Anycast DDoS mitigation.
            </p>
          </div>

          {/* Client Interactive Security Hub */}
          <SecurityPageClient />
        </div>
      </main>

      <Footer />
    </>
  );
}
