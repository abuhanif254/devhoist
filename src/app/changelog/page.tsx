import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { GitCommit, Tag, Sparkles, CheckCircle2, Shield, Zap, Terminal } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Engineering Changelog & Platform Releases | DevHost Cloud',
  description:
    'Public timeline of technical innovations, kernel upgrades, CI/CD pipeline improvements, and datacenter peering expansions at DevHost Cloud.',
  openGraph: {
    title: 'Platform Changelog | DevHost Cloud',
    description:
      'Explore continuous engineering releases: Node.js 22 LTS, Next.js 15, LiteSpeed HTTP/3, and bKash instant webhook v2.',
    url: 'https://devhostcloud.com/changelog',
  },
};

const RELEASES = [
  {
    version: 'v2.4.0',
    date: 'November 2026',
    title: 'Node.js v22 LTS & Next.js 15 Standalone Pipeline Rollout',
    badge: 'Major Release',
    icon: Terminal,
    desc: 'Upgraded all Singapore SG1 and US East NVMe clusters to support Node.js 22 LTS with full V8 engine speedups and zero-bloat Next.js 15 standalone build tracing.',
    highlights: [
      'Next.js 15 App Router & React 19 server components verified.',
      'Reduced average deployment archive sync size from 82MB to 14.2MB.',
      'Passenger worker reload reduced to 0.38 seconds via Jailed SSH webhook.',
    ],
  },
  {
    version: 'v2.3.2',
    date: 'October 2026',
    title: 'Automated bKash & Nagad Instant Webhook v2',
    badge: 'Billing & Automation',
    icon: Zap,
    desc: 'Rewrote the payment gateway callback handler into an asynchronous Edge-compatible microservice with real-time tokenization and webhook retry queues.',
    highlights: [
      'WHMCS invoice-to-cPanel account delivery slashed to 1.8 seconds.',
      'Direct IPN verification with 0% dropped transactions during flash sales.',
      'Automatic SMS and WhatsApp order dispatch notification pipeline.',
    ],
  },
  {
    version: 'v2.2.0',
    date: 'September 2026',
    title: 'LiteSpeed Enterprise v6.3 + HTTP/3 QUIC Upgrade',
    badge: 'Performance & Network',
    icon: Sparkles,
    desc: 'Deployed LiteSpeed Enterprise v6.3 across all shared and developer cloud nodes, introducing kernel-level HTTP/3 QUIC connection migration.',
    highlights: [
      '18% faster TLS handshake on 4G/5G mobile networks in Bangladesh.',
      'Object Cache Redis pool upgraded to 6.2 with persistent memory sockets.',
      'QUIC.cloud Smart Tier-IV edge routing for static WebP/AVIF images.',
    ],
  },
  {
    version: 'v2.1.0',
    date: 'August 2026',
    title: 'Sitejet AI Website Builder Native cPanel Integration',
    badge: 'Ecosystem & Tools',
    icon: CheckCircle2,
    desc: 'Integrated the enterprise Sitejet AI site generator directly into cPanel for all Starter Pack, Developer Pro, and Business Max accounts at zero additional cost.',
    highlights: [
      '140+ mobile-responsive agency starter templates unlocked.',
      '3-prompt AI generation of corporate websites with clean HTML/CSS export.',
      'Integrated e-commerce catalog manager with cash-on-delivery support.',
    ],
  },
  {
    version: 'v2.0.0',
    date: 'July 2026',
    title: 'CloudLinux OS Shared Pro + Imunify360 AI Firewall',
    badge: 'Security & Kernel',
    icon: Shield,
    desc: 'Transitioned 100% of physical hypervisors to CloudLinux OS with CageFS virtualized user filesystems and real-time AI malware scanning.',
    highlights: [
      'LVE container resource limits (CPU, RAM, Inodes, EP) enforced per account.',
      'Imunify360 herd immunity automatically quarantines web backdoors.',
      'KernelCare zero-reboot security patching ensures 99.99% real uptime.',
    ],
  },
  {
    version: 'v1.9.0',
    date: 'June 2026',
    title: 'BDIX Direct Transit Peering in Singapore SG1',
    badge: 'Infrastructure',
    icon: GitCommit,
    desc: 'Established direct private network interconnects (PNI) with Bangladesh Internet Exchange (BDIX) transit carriers inside Equinix SG1 Singapore.',
    highlights: [
      'Submarine cable latency between Dhaka and Singapore reduced to ~38ms.',
      '10 Gbps unmetered upstream peering with redundant Tier-1 transits.',
      'Zero international packet loss during peak South Asian internet hours.',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-16 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <GitCommit className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" />
              <span>Continuous Engineering Cadence</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.1]">
              Platform Engineering Changelog
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-xl mx-auto">
              A transparent timeline of architectural releases, kernel updates, and infrastructure enhancements powering DevHost Cloud.
            </p>
          </div>

          {/* Timeline of Releases */}
          <div className="relative border-l border-slate-200 dark:border-white/10 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-12">
            {RELEASES.map((rel) => {
              const Icon = rel.icon;
              return (
                <div key={rel.version} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-zinc-950 border-2 border-blue-600 dark:border-emerald-400 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-emerald-400" />
                  </div>

                  <div className="space-y-3 p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] group-hover:border-slate-300 dark:group-hover:border-white/20 transition-all shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 font-mono text-xs font-bold text-blue-700 dark:text-zinc-100">
                          {rel.version}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                          {rel.badge}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">{rel.date}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">{rel.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">{rel.desc}</p>

                    <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-1.5">
                      {rel.highlights.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs font-mono text-slate-700 dark:text-zinc-300">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
