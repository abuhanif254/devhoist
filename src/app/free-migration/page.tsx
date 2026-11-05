import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MigrationWorkflow from '@/components/migration/MigrationWorkflow';
import SavingsCalculator from '@/components/migration/SavingsCalculator';
import MigrationForm from '@/components/migration/MigrationForm';
import FaqAccordion from '@/components/common/FaqAccordion';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';

export const metadata: Metadata = {
  title: 'Free Website & Server Migration | Zero Downtime Transfer',
  description:
    'Switch to DevHost Cloud with zero downtime. Our senior engineers migrate your complete cPanel, WordPress, databases, and emails 100% free of charge.',
  openGraph: {
    title: 'Free Zero-Downtime Website Migration | DevHost Cloud',
    description:
      'Tired of slow servers or exorbitant renewal price hikes? Switch to DevHost Cloud with free expert migration.',
    url: 'https://devhostcloud.com/free-migration',
  },
  alternates: {
    canonical: 'https://devhostcloud.com/free-migration',
  },
};

export default function FreeMigrationPage() {
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>100% Free Senior Engineer Migration</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-zinc-50">
                Switch to Speed.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                  Zero Downtime.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-400 font-normal leading-relaxed">
                Don&apos;t let renewal price traps or sluggish shared hosting hold your business back. Our Linux systems engineers migrate your cPanel, WordPress, and databases seamlessly.
              </p>

              <div className="pt-2">
                <MigrationForm />
              </div>

              <div className="pt-3 flex justify-center">
                <div className="inline-flex flex-wrap items-center justify-center divide-x divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 rounded-xl px-2 py-2 text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-xs">
                  <span className="px-3 py-0.5">0.0s Visitor Downtime</span>
                  <span className="px-3 py-0.5">Free Email Transfer</span>
                  <span className="px-3 py-0.5">Database Verified</span>
                  <span className="px-3 py-0.5">30-Day Money-Back SLA</span>
                </div>
              </div>
            </div>
          </section>

          {/* 1. Zero-Downtime Migration Workflow */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <MigrationWorkflow />
          </section>

          {/* 2. Renewal Cost Savings Calculator */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <SavingsCalculator />
          </section>

          {/* Migration FAQ Accordion */}
          <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
            <FaqAccordion
              title="Migration &amp; Transfer FAQs"
              subtitle="Everything you need to know about our zero-downtime migration guarantee, cPanel backups, and DNS switches."
              items={COMPLETE_FAQ_LIST}
            />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
