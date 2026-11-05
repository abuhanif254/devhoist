'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Cloud,
  Wand2,
  CreditCard,
  ArrowRight,
  HardDrive,
  Lock,
} from 'lucide-react';

export default function BentoGridFeatures() {
  return (
    <section className="w-full py-20 relative bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-white/[0.07] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono font-semibold mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Enterprise Infrastructure</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            Engineered for Raw Velocity
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
              &amp; Peace of Mind.
            </span>
          </h2>
          <p className="mt-3 text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto font-normal leading-relaxed">
            Every layer of our hosting stack is tuned to deliver sub-100ms TTFB, zero disk bloat, and frictionless payments.
          </p>
        </div>

        {/* Bento Grid 6-Card Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Card 1 (Span 2 cols): Global NVMe SSD Speed */}
          <div className="md:col-span-2 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-xs hover:shadow-lg transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200 shadow-xs">
                <HardDrive className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-semibold shadow-2xs">
                PCIe Gen4 NVMe
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
              Global NVMe SSD Speed (USA &amp; Singapore)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6 font-normal">
              Zero slow spinning hard drives or SATA bottlenecks. Our Singapore (Equinix SG1) and USA (Ashburn, VA) nodes deliver read/write speeds over 5,000 MB/s, slashing Time-To-First-Byte (TTFB) to under 40ms in Bangladesh and South Asia.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.06] text-xs font-mono text-slate-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Singapore: ~35ms latency to BD</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>USA: 10 Gbps redundant uplink</span>
              </div>
            </div>
          </div>

          {/* Card 2 (Span 2 cols): 99.9% Uptime Guarantee */}
          <div className="md:col-span-2 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-xs hover:shadow-lg transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-zinc-200 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-semibold">
                99.99% Historical SLA
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
              99.9% Guaranteed Uptime SLA
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6 font-normal">
              Backed by CloudLinux OS KernelCare for live rebootless security patching, automated DDoS scrubbing, and isolated LVE memory and CPU sandboxing so neighbor websites can never slow down your site.
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-white/[0.06] text-xs">
              <span className="text-slate-500 dark:text-zinc-500 font-mono">Real-time status monitor:</span>
              <Link href="/server-status" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 transition-colors">
                <span>View Looking Glass</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Free Automated SSL */}
          <div className="rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-xs hover:shadow-md transition-all group">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-amber-600 dark:text-zinc-300 mb-3 shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">Free Automated SSL</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Auto-provisioning Wildcard Let&apos;s Encrypt SSL certificates for your primary domain and subdomains, renewing automatically with HTTP/3 support.
            </p>
          </div>

          {/* Card 4: External Cloud Backups */}
          <div className="rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-xs hover:shadow-md transition-all group">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-zinc-300 mb-3 shadow-xs">
              <Cloud className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">Daily Cloud Backups</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Automated daily JetBackup snapshots shipped offsite to external cloud vaults. Backups consume <strong className="text-slate-900 dark:text-zinc-200">0 MB of your local quota</strong>.
            </p>
          </div>

          {/* Card 5: Sitejet AI Website Builder */}
          <div className="rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-xs hover:shadow-md transition-all group">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-purple-600 dark:text-zinc-300 mb-3 shadow-xs">
              <Wand2 className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">Sitejet AI Builder</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Included free inside cPanel. Generate modern responsive websites by answering simple text prompts. No coding required for quick client landing pages.
            </p>
          </div>

          {/* Card 6: Local & Global Instant Gateways */}
          <div className="rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-xs hover:shadow-md transition-all group">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-300 mb-3 shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">Instant bKash &amp; Stripe</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-3 font-normal">
              Automated WHMCS payment webhooks. Pay via personal or merchant bKash, Nagad, or credit cards with instant account activation.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-semibold">bKash</span>
              <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-semibold">Nagad</span>
              <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-semibold">Card</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
