import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PanelPreviewClient from './PanelPreviewClient';

export const metadata: Metadata = {
  title: 'Interactive Cloud Control Panel Sandbox | Live Developer Demo',
  description:
    'Test-drive DevHost Cloud in your browser: live Git CI/CD terminal deployments, 1-click rollbacks, CloudLinux runtime manager, real-time LVE container telemetry, and Redis cache controls.',
  openGraph: {
    title: 'Cloud Control Panel Sandbox | DevHost Cloud',
    description:
      'Experience zero-downtime deployments and isolated LVE telemetry in an interactive live browser sandbox.',
    url: 'https://devhostcloud.com/panel-preview',
  },
};

export default function PanelPreviewPage() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Full Interactive Browser Demo • Zero Signup Required</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.1]">
              Live Cloud Control Panel Sandbox
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base font-normal leading-relaxed max-w-2xl mx-auto">
              Test-drive our developer management experience before ordering. Trigger simulated GitHub builds, roll back releases with zero downtime, and inspect real-time LVE container telemetry.
            </p>
          </div>

          {/* Client Interactive Sandbox Component */}
          <PanelPreviewClient />
        </div>
      </main>

      <Footer />
    </>
  );
}
