'use client';

import React from 'react';
import { Star, ShieldCheck, Quote, CheckCircle2 } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  project: string;
  avatarBg: string;
  initials: string;
  rating: number;
  text: string;
  metric: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Tanvir Hossain',
    role: 'Lead Full-Stack Engineer',
    company: 'FinTech BD',
    project: 'Next.js App Router & PostgreSQL Portal',
    avatarBg: 'from-blue-600 to-indigo-700',
    initials: 'TH',
    rating: 5,
    text: 'Moving our Next.js standalone app to DevHost took 15 minutes. GitHub OAuth auto-deploys complete in 2.8s, and atomic edge routing switches caused zero dropped user sessions.',
    metric: '2.8s Git Deploys',
  },
  {
    name: 'Nusrat Jahan',
    role: 'Founder & CEO',
    company: 'ShobKichu Online',
    project: 'WooCommerce + Redis (15k Daily Orders)',
    avatarBg: 'from-emerald-600 to-teal-700',
    initials: 'NJ',
    rating: 5,
    text: 'During our Flash Sale, previous shared hosting crashed due to Inode limits. DevHost NVMe with LiteSpeed Cache handled 14,000 live visitors effortlessly, and bKash instant checkout was flawless.',
    metric: '99.99% Flash Sale Uptime',
  },
  {
    name: 'Mahmudul Hasan',
    role: 'CTO & Co-Founder',
    company: 'StackSolutions Agency',
    project: 'Managing 42 Client Websites',
    avatarBg: 'from-purple-600 to-violet-800',
    initials: 'MH',
    rating: 5,
    text: 'The isolated CloudLinux LVE limits give our agency total peace of mind. One client’s script spike never affects another. The cost estimator and PDF quote tool save our sales team hours.',
    metric: '42 Sites Migrated with 0 Downtime',
  },
  {
    name: 'Siam Chowdhury',
    role: 'Senior DevOps Architect',
    company: 'Logistics Courier BD',
    project: 'Node.js 22 Microservice API',
    avatarBg: 'from-amber-600 to-orange-700',
    initials: 'SC',
    rating: 5,
    text: 'Jailed SSH with custom Node.js Selector and PM2 support is the best combination for developers in South Asia. Singapore Equinix routing gives us consistent ~38ms ping to Dhaka.',
    metric: '38ms BDIX Latency',
  },
  {
    name: 'Farhana Akhter',
    role: 'Product Lead',
    company: 'SaaS Pulse App',
    project: 'Next.js App Router & Prisma',
    avatarBg: 'from-rose-600 to-pink-700',
    initials: 'FA',
    rating: 5,
    text: 'The 1-Click App Marketplace and live sandbox preview convinced our founders immediately. It feels like Vercel’s developer experience combined with local cPanel cost efficiency.',
    metric: '80% Lower Cloud Hosting Cost',
  },
  {
    name: 'Arifur Rahman',
    role: 'WordPress Performance Consultant',
    company: 'SpeedCraft Studio',
    project: 'High-Traffic Editorial News Portal',
    avatarBg: 'from-cyan-600 to-blue-700',
    initials: 'AR',
    rating: 5,
    text: 'LiteSpeed Enterprise server with QUIC.cloud integration cut our First Contentful Paint (FCP) from 1.8s down to 0.4s. 100/100 Core Web Vitals score without external expensive CDNs.',
    metric: '0.4s TTFB Recorded',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="w-full py-14 sm:py-16 bg-slate-50/50 dark:bg-[#090D16] border-b border-slate-200 dark:border-white/[0.08] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Developer &amp; Founder Validation</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Trusted by 5,000+ Fast-Growing Tech Brands
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-2xl mx-auto font-normal leading-relaxed">
            Read verified reviews from full-stack engineers, agency founders, and e-commerce leaders powering their mission-critical websites on DevHost Cloud.
          </p>
        </div>

        {/* 6 Testimonial Cards (Horizontal Snap-Scroll on Mobile/Tablet, 3-Column Grid on Desktop) */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-3 lg:gap-6 no-scrollbar">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="min-w-[85%] sm:min-w-[48%] lg:min-w-0 snap-center rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-900/80 p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between shrink-0 lg:shrink"
            >
              <div className="space-y-4">
                {/* 5-Star Rating & Metric Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    {t.metric}
                  </span>
                </div>

                {/* Review Text */}
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                  &ldquo;{t.text}&rdquo;
                </p>
              </div>

              {/* Author & Project Details */}
              <div className="pt-5 mt-5 border-t border-slate-100 dark:border-white/[0.08] flex items-center gap-3">
                {/* Custom Avatar with Gradient Initials */}
                <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${t.avatarBg} text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0`}>
                  {t.initials}
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                    <span>{t.name}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {t.role} • {t.company}
                  </div>
                  <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate mt-0.5">
                    {t.project}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
