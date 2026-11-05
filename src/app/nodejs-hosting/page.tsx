import React from 'react';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import DeploymentPipelineFlowchart from '@/components/developer/DeploymentPipelineFlowchart';
import DirectionalPipeline from '@/components/visuals/DirectionalPipeline';
import TechStackTabs from '@/components/developer/TechStackTabs';
import ConfigCopyHub from '@/components/developer/ConfigCopyHub';
import SkeletonCard from '@/components/ui/SkeletonCard';
import FaqAccordion from '@/components/common/FaqAccordion';
import { Terminal, ArrowRight, Code2 } from 'lucide-react';
import { buildHostingOrderUrl } from '@/lib/whmcsRouter';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';

const DependencyAnalyzer = dynamic(
  () => import('@/components/developer/DependencyAnalyzer'),
  {
    loading: () => <SkeletonCard heightClass="h-96" lines={5} />,
  }
);

const StorageInodeSimulator = dynamic(
  () => import('@/components/developer/StorageInodeSimulator'),
  {
    loading: () => <SkeletonCard heightClass="h-80" lines={4} />,
  }
);

export const metadata: Metadata = {
  title: 'Node.js & GitHub Auto-Deploy Hosting | Zero-Downtime cPanel Cloud',
  description:
    'Deploy Next.js, Node.js, Python, and Laravel directly from GitHub with zero-downtime webhook CI/CD, Jailed SSH, and smart In-Place overwrite storage pipelines.',
  openGraph: {
    title: 'Developer Cloud Hosting | GitHub CI/CD & Next.js on cPanel',
    description:
      'Combine GitHub Actions free runners with cPanel NVMe hosting. Avoid Inode exhaustion and deploy in under 3 seconds.',
    url: 'https://devhostcloud.com/nodejs-hosting',
  },
  alternates: {
    canonical: 'https://devhostcloud.com/nodejs-hosting',
  },
};

export default function NodeJsHostingPage() {
  const directCartUrl = buildHostingOrderUrl(2, false, 'BDT');

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Developer Pro Cloud Hosting',
    description: 'High-speed NVMe hosting with GitHub Webhooks, Node.js, Next.js, and Jailed SSH.',
    offers: {
      '@type': 'Offer',
      price: '450',
      priceCurrency: 'BDT',
      availability: 'https://schema.org/InStock',
      url: directCartUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Fade */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Structural Container with 1px Architectural Borders */}
        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] relative">
          {/* Corner Crosshairs */}
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Hero Section */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 relative z-10 border-b border-slate-200 dark:border-white/[0.07]">
            <div className="max-w-4xl mx-auto text-center space-y-7">
              {/* Top Precision Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold">CI/CD Developer Cloud</span>
                <span className="text-slate-300 dark:text-zinc-600">•</span>
                <span>Developer Pro (৳450/mo)</span>
              </div>

              {/* Main Scaled H1 */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white">
                Git Push to Production.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                  Zero Downtime.
                </span>
              </h1>

              {/* Body Copy */}
              <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-300 font-normal leading-relaxed max-w-2xl mx-auto">
                Say goodbye to tedious FTP uploads and slow server builds. Our Smart Pipeline combines GitHub Actions free runners with cPanel NVMe storage, slashing disk bloat by 80% and reloading Passenger workers in 2.8 seconds.
              </p>

              {/* High-Contrast CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
                <a
                  href={directCartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 transition-all group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Deploy Developer Pro — ৳450/mo</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-1.5 transition-transform" />
                </a>

                <a
                  href="#pipeline"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 text-sm font-semibold transition-all"
                >
                  <span>Explore Pipeline Flow</span>
                  <Code2 className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                </a>
              </div>

              {/* Structured Horizontal Spec Bar */}
              <div className="pt-3 flex justify-center">
                <div className="inline-flex flex-wrap items-center justify-center divide-x divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 rounded-xl px-2 py-2 text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-xs">
                  <span className="px-3 py-0.5">2 GB Isolated RAM</span>
                  <span className="px-3 py-0.5">2 Core vCPU</span>
                  <span className="px-3 py-0.5">Jailed SSH & Terminal</span>
                  <span className="px-3 py-0.5">Node.js 18 - 22 LTS</span>
                </div>
              </div>
            </div>
          </section>

          {/* Directional Traveling Data-Flow Pipeline */}
          <section className="px-4 sm:px-6 lg:px-8 py-12 border-b border-slate-200 dark:border-white/[0.07]">
            <DirectionalPipeline />
          </section>

          {/* 1. Visual Deployment Pipeline Flowchart */}
          <section id="pipeline" className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                How the Zero-Downtime Pipeline Works
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2">
                Click through the 5 architectural stages to inspect how code flows from your terminal to cPanel.
              </p>
            </div>

            <DeploymentPipelineFlowchart />
          </section>

          {/* 2. Tech Stack Support Interactive Tabs */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Multi-Runtime Developer Support
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2">
                Switch runtimes to review hardware isolation thresholds, environment configurations, and shell features.
              </p>
            </div>

            <TechStackTabs />
          </section>

          {/* Live Dependency Architect & package.json Analyzer */}
          <section id="analyzer" className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <DependencyAnalyzer />
          </section>

          {/* 3. Interactive Storage & Inode Saver Simulator */}
          <section id="simulator" className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <StorageInodeSimulator />
          </section>

          {/* 4. One-Click Config Copy Hub */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 border-b border-slate-200 dark:border-white/[0.07] relative">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                One-Click Production Config Hub
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2">
                Copy production-ready configuration snippets directly into your repository.
              </p>
            </div>

            <ConfigCopyHub />
          </section>

          {/* Developer FAQ Accordion */}
          <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-16 relative">
            <FaqAccordion
              title="Developer & CI/CD FAQs"
              subtitle="Answers to the most common questions regarding Node.js on CloudLinux, Git webhooks, and SSH keys."
              items={COMPLETE_FAQ_LIST}
            />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
