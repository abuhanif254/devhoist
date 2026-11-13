'use client';

import React from 'react';
import { ExternalLink, Star, ArrowRight, Zap, ShoppingCart, Layout, Code2 } from 'lucide-react';
import Link from 'next/link';

export interface TemplatePreviewItem {
  id: string;
  name: string;
  category: string;
  tagline: string;
  stack: string;
  previewGradient: string;
  badge: string;
  rating: number;
  setupTime: string;
}

export const FEATURED_PREVIEWS: TemplatePreviewItem[] = [
  {
    id: 'nextjs-saas',
    name: 'Next.js SaaS Starter',
    category: 'Full-Stack Web App',
    tagline: 'Tailwind CSS, Stripe subscriptions & Postgres auth pre-configured.',
    stack: 'Next.js + Prisma',
    previewGradient: 'from-blue-600 via-indigo-700 to-purple-800',
    badge: 'Trending #1',
    rating: 4.9,
    setupTime: '< 45s',
  },
  {
    id: 'litespeed-woocommerce',
    name: 'BDIX E-Commerce SuperStore',
    category: 'Online Storefront',
    tagline: 'WooCommerce + Redis object cache with bKash/Nagad PG module.',
    stack: 'WordPress + LSCache',
    previewGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
    badge: 'Popular in BD',
    rating: 5.0,
    setupTime: '< 60s',
  },
  {
    id: 'laravel-api',
    name: 'Laravel 11 Enterprise REST',
    category: 'Backend Microservice',
    tagline: 'Sanctum JWT authentication, Horizon queues & MySQL 8 database.',
    stack: 'Laravel 11 + PHP 8.3',
    previewGradient: 'from-rose-600 via-red-700 to-amber-800',
    badge: 'Enterprise',
    rating: 4.8,
    setupTime: '< 30s',
  },
  {
    id: 'strapi-headless',
    name: 'Strapi 5 Headless CMS',
    category: 'Content Engine',
    tagline: 'GraphQL API, automated media CDN upload & multi-language admin.',
    stack: 'Node.js 22 + SQLite',
    previewGradient: 'from-purple-600 via-violet-700 to-indigo-900',
    badge: 'Developer Choice',
    rating: 4.9,
    setupTime: '< 50s',
  },
];

export default function WebsitePreviewCards() {
  return (
    <div className="w-full py-4 sm:py-6">
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible">
        {FEATURED_PREVIEWS.map((item) => (
          <div
            key={item.id}
            className="snap-start shrink-0 w-[82vw] sm:w-[320px] md:w-auto group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
          >
            {/* Visual Thumbnail Area */}
            <div className={`h-40 bg-gradient-to-br ${item.previewGradient} p-4 text-white relative flex flex-col justify-between overflow-hidden`}>
              <div className="flex items-center justify-between z-10">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md uppercase tracking-wider font-semibold">
                  {item.badge}
                </span>
                <div className="flex items-center gap-1 text-[11px] font-mono bg-black/30 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                  <span>{item.rating}</span>
                </div>
              </div>

              {/* Decorative Window Preview Mockup */}
              <div className="z-10">
                <span className="text-xs font-mono opacity-85">{item.stack}</span>
                <h4 className="text-base font-bold leading-tight mt-0.5 tracking-tight">{item.name}</h4>
              </div>

              {/* Background Glow */}
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/15 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
            </div>

            {/* Description & Deploy Action */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {item.category}
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-normal">
                  {item.tagline}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  Setup: {item.setupTime}
                </span>

                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                >
                  <span>1-Click Deploy</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
