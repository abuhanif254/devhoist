import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ToolsHubClient from './ToolsHubClient';

export const metadata: Metadata = {
  title: 'Free Webmaster & Network Diagnostic Tools | DNS, WHOIS & SSL Header Auditor',
  description:
    'Free real-time developer network tools: Global DNS propagation checker via Cloudflare DoH, live RDAP WHOIS registry lookup, and HTTP/SSL security header audit.',
  openGraph: {
    title: 'Network Diagnostic & Webmaster Tools | DevHost Cloud',
    description:
      'Check DNS records, inspect WHOIS domain registration, and audit security headers in real-time.',
    url: 'https://devhostcloud.com/tools',
  },
};

export default function ToolsPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-12 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Cloudflare Anycast & RDAP Diagnostics</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Webmaster & Network Diagnostic Hub
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              Test live DNS propagation, inspect domain registry expiration dates, and audit SSL and HTTP response headers with sub-second accuracy.
            </p>
          </div>

          {/* Suspense wrapper for Next.js searchParams */}
          <Suspense fallback={<div className="text-center py-12 font-mono text-xs text-slate-500 dark:text-zinc-500">Loading network diagnostics...</div>}>
            <ToolsHubClient />
          </Suspense>
        </div>
      </main>

      <Footer />
    </>
  );
}
