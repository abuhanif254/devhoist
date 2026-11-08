import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BrowserPingTester from '@/components/status/BrowserPingTester';
import UptimeHistoryGraph from '@/components/status/UptimeHistoryGraph';
import NetworkLookingGlassStudio from '@/components/status/NetworkLookingGlassStudio';
import FaqAccordion from '@/components/common/FaqAccordion';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';

export const metadata: Metadata = {
  title: 'Global Server Status & Looking Glass | Live Latency & 99.9% SLA',
  description:
    'Monitor real-time server fleet health, run client-side browser ping tests to Singapore & USA NVMe nodes, and inspect 90-day 99.98% historical uptime metrics.',
  openGraph: {
    title: 'Server Status & Looking Glass | DevHost Cloud',
    description:
      'Live server latency tester and 90-day uptime history across our global Tier-IV datacenters.',
    url: 'https://devhostcloud.com/server-status',
  },
  alternates: {
    canonical: 'https://devhostcloud.com/server-status',
  },
};

export default function ServerStatusPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Structural Container with 1px Architectural Borders */}
        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Hero Section */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 relative z-10 border-b border-slate-200 dark:border-white/[0.07]">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Real-Time Fleet Health (99.98% Historical Uptime)</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-zinc-50">
                Transparency First.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                  Live Server Status.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-400 font-normal leading-relaxed">
                We publish real-time uptime metrics, roundtrip ping statistics, and network latency benchmarks so you know your mission-critical applications are in safe hands.
              </p>

              <div className="pt-3 flex justify-center">
                <div className="inline-flex flex-wrap items-center justify-center divide-x divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 rounded-xl px-2 py-2 text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-xs">
                  <span className="px-3 py-0.5">Tier-IV Equinix SG1</span>
                  <span className="px-3 py-0.5">Tier-IV Ashburn VA</span>
                  <span className="px-3 py-0.5">60s Automated Probes</span>
                  <span className="px-3 py-0.5">99.99% Financial SLA</span>
                </div>
              </div>
            </div>
          </section>

          {/* 1. Interactive Network Looking Glass, Latency Radar & SLA Credit Studio */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <NetworkLookingGlassStudio />
          </section>

          {/* 2. Live Browser-to-Datacenter Ping Tester */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <BrowserPingTester />
          </section>

          {/* 2. 90-Day Uptime Heatmap & Historic Uptime */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <UptimeHistoryGraph />
          </section>

          {/* Status FAQ Accordion */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
            <FaqAccordion
              title="Infrastructure &amp; SLA FAQs"
              subtitle="Learn about our high-availability power grids, BDIX network routes, and 99.99% credit SLA."
              items={COMPLETE_FAQ_LIST}
            />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
