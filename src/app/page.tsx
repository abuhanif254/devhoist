import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroVisualShowcase from '@/components/visuals/HeroVisualShowcase';
import Hero3DCloudAtmosphere from '@/components/visuals/Hero3DCloudAtmosphere';
import DirectionalMarquee from '@/components/visuals/DirectionalMarquee';
import DirectionalPipeline from '@/components/visuals/DirectionalPipeline';
import WebsitePreviewCards from '@/components/visuals/WebsitePreviewCards';
import GlobalDatacenterMap from '@/components/visuals/GlobalDatacenterMap';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import DomainChecker from '@/components/home/DomainChecker';
import PricingSection from '@/components/home/PricingSection';
import PlanRecommenderQuiz from '@/components/home/PlanRecommenderQuiz';
import BentoGridFeatures from '@/components/home/BentoGridFeatures';
import FaqAccordion from '@/components/common/FaqAccordion';
import DirectionalReveal from '@/components/motion/DirectionalReveal';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';
import { ArrowRight, Server, ShieldCheck, Zap, Globe, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'DevHost Cloud | Modern Global Web & Developer Hosting',
  description:
    'Combine Vercel developer experience with cPanel reliability. Deploy Next.js, Node.js & WordPress with zero-downtime GitHub Actions, LiteSpeed caching, and instant bKash/Nagad checkout.',
  openGraph: {
    title: 'DevHost Cloud | Modern Global Web & Developer Hosting',
    description:
      'High-speed NVMe cloud hosting in Singapore & USA with automated GitHub deployment and bKash/Nagad payments.',
    url: 'https://devhostcloud.com',
    siteName: 'DevHost Cloud',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevHost Cloud - Developer Cloud Hosting',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: 'https://devhostcloud.com',
  },
};

export default function HomePage() {
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'DevHost Cloud Web & Developer Hosting',
    description:
      'Ultra-fast NVMe cloud hosting with GitHub CI/CD, LiteSpeed caching, and cPanel in Singapore & USA.',
    brand: {
      '@type': 'Brand',
      name: 'DevHost Cloud',
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: '200',
      highPrice: '900',
      offerCount: '3',
      offers: [
        {
          '@type': 'Offer',
          name: 'Starter Pack',
          price: '200',
          priceCurrency: 'BDT',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Developer Pro',
          price: '450',
          priceCurrency: 'BDT',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Business Max',
          price: '900',
          priceCurrency: 'BDT',
          availability: 'https://schema.org/InStock',
        },
      ],
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '382',
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DevHost Cloud',
    url: 'https://devhostcloud.com',
    logo: 'https://devhostcloud.com/logo.png',
    sameAs: ['https://github.com/devhostcloud'],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+8801700000000',
      contactType: 'customer support',
      availableLanguage: ['English', 'Bengali'],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Structural Container with 1px Hairline Borders */}
        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* 1. Hero Section with Rich Visual Showcase & Directional Reveal */}
          <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 relative z-10 border-b border-slate-200 dark:border-white/[0.07] overflow-hidden">
            {/* 3D Volumetric Cloud Atmospheric Canvas (High-Visual 3D Clouds Behind Content) */}
            <Hero3DCloudAtmosphere />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
              {/* Left Column: Proposition & CTAs (Slides in from Left) */}
              <DirectionalReveal direction="left" className="lg:col-span-6 space-y-6 text-center lg:text-left">
                {/* Precision Trust Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold">99.99% Verified Uptime SLA</span>
                  <span className="text-slate-300 dark:text-zinc-600">•</span>
                  <span>Singapore &amp; USA NVMe</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white">
                  Developer Experience of Vercel.
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400 mt-1">
                    Accessibility of cPanel.
                  </span>
                </h1>

                {/* Subheadline with high-contrast text */}
                <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-300 font-normal max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Deploy Next.js, Node.js, Python, and WordPress on enterprise NVMe SSD infrastructure. Automated zero-downtime GitHub pipelines, LiteSpeed caching, and instant bKash/Nagad checkout starting at just ৳200/mo.
                </p>

                {/* High-Contrast CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <Link
                    href="/nodejs-hosting"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 transition-all group"
                  >
                    <span>Deploy Custom App</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-1.5 transition-transform" />
                  </Link>

                  <Link
                    href="/wordpress-hosting-bangladesh"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 text-sm font-semibold transition-all"
                  >
                    <Server className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <span>Launch WordPress</span>
                  </Link>
                </div>

                {/* Structured Spec Highlights */}
                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs font-mono text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Zero-Downtime Deployments</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Instant bKash, Nagad &amp; Card</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>30-Day Money-Back SLA</span>
                  </div>
                </div>
              </DirectionalReveal>

              {/* Right Column: Multi-Layer 3D Visual Showcase (Slides in from Right) */}
              <DirectionalReveal direction="right" className="lg:col-span-6 w-full">
                <HeroVisualShowcase />
              </DirectionalReveal>
            </div>
          </section>

          {/* 2. Directional Infinite Technology Marquee (Dual-sliding: ← Row 1, → Row 2) */}
          <DirectionalMarquee />

          {/* 3. Instant AJAX Domain Search Bar with Bundle Matchmaker */}
          <section className="px-4 sm:px-6 lg:px-8 py-12 relative z-20 border-b border-slate-200 dark:border-white/[0.07]">
            <DirectionalReveal direction="up">
              <div className="text-center max-w-xl mx-auto mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Find &amp; Secure Your Domain in Seconds
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                  Check live DNS availability for .com, .xyz, .io, .ai with 1-click hosting bundle savings.
                </p>
              </div>
              <DomainChecker />
            </DirectionalReveal>
          </section>

          {/* 4. Directional Data-Flow Pipeline: How Code Flows to Production */}
          <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-200 dark:border-white/[0.07]">
            <DirectionalReveal direction="up">
              <div className="text-center max-w-3xl mx-auto mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-3">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Directional CI/CD Architecture</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  How Git Push Flows to Live Production
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-xl mx-auto">
                  Watch code travel through 4 automated stages—compiling on free GitHub cloud runners and syncing atomically to cPanel.
                </p>
              </div>

              <DirectionalPipeline />
            </DirectionalReveal>
          </section>

          {/* 5. 1-Click App Marketplace Website Previews */}
          <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-200 dark:border-white/[0.07]">
            <DirectionalReveal direction="up">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Instant App Deployments</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Production Stacks &amp; Website Templates
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-xl">
                    Launch full-stack Next.js web applications, WooCommerce storefronts, and Laravel APIs with zero manual setup.
                  </p>
                </div>

                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  <span>Explore all 12 Marketplace Stacks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <WebsitePreviewCards />
            </DirectionalReveal>
          </section>

          {/* 6. Interactive Pricing Matrix */}
          <PricingSection />

          {/* 7. Global Anycast Datacenter Map */}
          <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-200 dark:border-white/[0.07]">
            <DirectionalReveal direction="up">
              <GlobalDatacenterMap />
            </DirectionalReveal>
          </section>

          {/* 8. Interactive Plan Recommender Quiz */}
          <PlanRecommenderQuiz />

          {/* 9. Bento Grid Feature Showcase */}
          <BentoGridFeatures />

          {/* 10. Verified Customer Testimonials & Trust */}
          <TestimonialsSection />

          {/* 11. FAQ Accordion Section */}
          <section className="px-4 sm:px-6 lg:px-8 py-20 relative">
            <DirectionalReveal direction="up">
              <FaqAccordion
                title="Frequently Asked Questions"
                subtitle="Everything you need to know about our high-speed cloud infrastructure, GitHub deployments, and local payment gateways."
                items={COMPLETE_FAQ_LIST}
              />
            </DirectionalReveal>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
