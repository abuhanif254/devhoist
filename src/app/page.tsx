import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroVisualShowcase from '@/components/visuals/HeroVisualShowcase';
import Hero3DCloudAtmosphere from '@/components/visuals/Hero3DCloudAtmosphere';
import DirectionalMarquee from '@/components/visuals/DirectionalMarquee';
import DeployModesShowcase from '@/components/home/DeployModesShowcase';
import WebsitePreviewCards from '@/components/visuals/WebsitePreviewCards';
import GlobalDatacenterMap from '@/components/visuals/GlobalDatacenterMap';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import DomainChecker from '@/components/home/DomainChecker';
import PricingSection from '@/components/home/PricingSection';
import BentoGridFeatures from '@/components/home/BentoGridFeatures';
import HomeHeroClient from '@/components/home/HomeHeroClient';
import HomeSectionHeader from '@/components/home/HomeSectionHeader';
import ClosingCtaSection from '@/components/home/ClosingCtaSection';
import FaqAccordion from '@/components/common/FaqAccordion';
import DirectionalReveal from '@/components/motion/DirectionalReveal';
import { COMPLETE_FAQ_LIST } from '@/config/faqData';
import { ArrowRight, Sparkles } from 'lucide-react';

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

      <main className="w-full relative bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100 overflow-x-clip transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Structural Container with 1px Hairline Borders */}
        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.08] relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* 1. Hero Section with Rich Visual Showcase & Directional Reveal */}
          <section className="px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-14 sm:pb-16 relative z-10 border-b border-slate-200 dark:border-white/[0.08] overflow-hidden">
            {/* 3D Volumetric Cloud Atmospheric Canvas */}
            <Hero3DCloudAtmosphere />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center relative z-10">
              {/* Left Column: Bilingual Proposition & CTAs */}
              <DirectionalReveal direction="left" className="lg:col-span-6">
                <HomeHeroClient />
              </DirectionalReveal>

              {/* Right Column: Multi-Layer 3D Visual Showcase */}
              <DirectionalReveal direction="right" className="lg:col-span-6 w-full">
                <HeroVisualShowcase />
              </DirectionalReveal>
            </div>
          </section>

          {/* 2. Directional Infinite Technology Marquee */}
          <DirectionalMarquee />

          {/* 3. Instant AJAX Domain Search Bar with Bundle Matchmaker */}
          <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-14 relative z-20 border-b border-slate-200 dark:border-white/[0.08]">
            <DirectionalReveal direction="up">
              <HomeSectionHeader variant="domain" />
              <DomainChecker />
            </DirectionalReveal>
          </section>

          {/* 4. Interactive 3-Mode Deploy Architecture Showcase */}
          <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16 border-b border-slate-200 dark:border-white/[0.08]">
            <DirectionalReveal direction="up">
              <HomeSectionHeader variant="deploy" />
              <DeployModesShowcase />
            </DirectionalReveal>
          </section>

          {/* 5. 1-Click App Marketplace Website Previews */}
          <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16 border-b border-slate-200 dark:border-white/[0.08]">
            <DirectionalReveal direction="up">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Instant App Deployments</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Production Stacks &amp; Website Templates
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Launch full-stack Next.js web applications, WooCommerce storefronts, and Laravel APIs with zero manual setup.
                  </p>
                </div>

                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  <span>Explore all 16 Marketplace Stacks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <WebsitePreviewCards />
            </DirectionalReveal>
          </section>

          {/* 6. Interactive Pricing Matrix + Integrated Plan Recommender */}
          <PricingSection />

          {/* 7. Bento Grid Feature Showcase */}
          <BentoGridFeatures />

          {/* 8. Global Anycast Datacenter Map */}
          <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16 border-b border-slate-200 dark:border-white/[0.08]">
            <DirectionalReveal direction="up">
              <GlobalDatacenterMap />
            </DirectionalReveal>
          </section>

          {/* 9. Verified Customer Testimonials & Trust */}
          <TestimonialsSection />

          {/* 10. FAQ Accordion Section */}
          <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16 relative">
            <DirectionalReveal direction="up">
              <FaqAccordion
                title="Frequently Asked Questions"
                subtitle="Everything you need to know about our high-speed cloud infrastructure, R2 Edge & Compute deployments, and local payment gateways."
                items={COMPLETE_FAQ_LIST}
              />
            </DirectionalReveal>
          </section>

          {/* 11. Closing Architectural CTA Band */}
          <ClosingCtaSection />
        </div>
      </main>

      <Footer />
    </>
  );
}
