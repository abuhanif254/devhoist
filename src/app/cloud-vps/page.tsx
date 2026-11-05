import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import VpsConfiguratorClient from './VpsConfiguratorClient';

export const metadata: Metadata = {
  title: 'Managed Cloud VPS & KVM Server Configurator | DevHost Cloud',
  description:
    'Dedicated KVM NVMe Cloud VPS in Singapore and USA. Customize vCPU cores, DDR5 RAM, and pure PCIe Gen4 NVMe storage with instant bKash/Nagad checkout and 10 Gbps uplink.',
  openGraph: {
    title: 'Enterprise Managed Cloud VPS | DevHost Cloud',
    description:
      'High-performance KVM Cloud VPS with custom resource sliders, root SSH, and Singapore Equinix SG1 latency.',
    url: 'https://devhostcloud.com/cloud-vps',
  },
};

export default function CloudVpsPage() {
  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Hero Section */}
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Dedicated KVM Virtualization &amp; Pure PCIe Gen4 NVMe</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.08]">
              High-Frequency Cloud VPS.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                Scale Without Limits.
              </span>
            </h1>

            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              Engineered for production Docker clusters, heavy PostgreSQL/Redis databases, and high-concurrency microservices with guaranteed hardware isolation in Singapore and USA.
            </p>

            {/* Spec Bar */}
            <div className="pt-2 flex flex-wrap justify-center items-center gap-3 text-xs font-mono text-slate-700 dark:text-zinc-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 font-medium">
                10 Gbps Redundant Uplink
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 font-medium">
                Weekly JetBackup Included
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 font-medium">
                Full Root &amp; Custom ISO
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 font-medium">
                Singapore Equinix (~42ms BD)
              </span>
            </div>
          </div>

          {/* Interactive VPS Configurator */}
          <VpsConfiguratorClient />
        </div>
      </main>

      <Footer />
    </>
  );
}
