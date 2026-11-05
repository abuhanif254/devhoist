import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Server, Globe, Cpu, ShieldCheck, Zap } from 'lucide-react';
import { ABOUT_DATA, CONTACT_DATA } from '@/config/legalData';

export const metadata: Metadata = {
  title: 'About Us | Bringing Vercel Agility to cPanel NVMe Reliability',
  description:
    'The story and infrastructure behind DevHost Cloud: bridging modern DevOps git push workflows with cPanel NVMe reliability and local bKash/Nagad checkout.',
  openGraph: {
    title: 'About DevHost Cloud | Our Infrastructure & Mission',
    description:
      'High-speed NVMe cloud hosting engineered for developers and businesses worldwide.',
    url: 'https://devhostcloud.com/about',
  },
};

export default function AboutPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-16 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Mission Hero */}
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Our Story &amp; Global Mission</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-zinc-50">
              Bridging the Gap Between
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                Modern DevOps &amp; Reliable Hosting.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-400 font-normal leading-relaxed">
              {ABOUT_DATA.story}
            </p>
          </div>

          {/* Core Values / Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 glass-card space-y-3.5 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{ABOUT_DATA.pillars[0].title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                {ABOUT_DATA.pillars[0].desc}
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 glass-card space-y-3.5 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{ABOUT_DATA.pillars[1].title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                {ABOUT_DATA.pillars[1].desc}
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 glass-card space-y-3.5 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{ABOUT_DATA.pillars[2].title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                {ABOUT_DATA.pillars[2].desc}
              </p>
            </div>
          </div>

          {/* Infrastructure Specifications Showcase */}
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/70 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08]">
              <div>
                <span className="text-xs font-mono uppercase text-slate-500 dark:text-zinc-400 font-bold">Audited Hardware</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Global Datacenter Fleet</h3>
              </div>
              <div className="text-right font-mono text-xs text-slate-500 dark:text-zinc-500">
                Singapore • USA
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CONTACT_DATA.datacenters.map((dc) => (
                <div key={dc.name} className="p-5 rounded-lg bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{dc.name.includes('Singapore') ? '🇸🇬' : '🇺🇸'}</span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{dc.name}</h4>
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-zinc-400 space-y-1">
                    <div>Location: {dc.location}</div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">Latency: {dc.latencyBD}</div>
                    <div className="text-slate-500 dark:text-zinc-500 font-sans">{dc.purpose}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
