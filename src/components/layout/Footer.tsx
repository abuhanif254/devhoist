'use client';

import React from 'react';
import Link from 'next/link';
import {
  Terminal,
  ShieldCheck,
  Server,
  ArrowUpRight,
  Activity,
  Globe,
  Cpu,
  Lock,
} from 'lucide-react';

export default function Footer() {
  const currentYear = 2026;

  return (
    <footer className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-white/[0.08] relative overflow-hidden transition-colors duration-200">
      {/* Subtle Architectural Grid Background with Radial Mask */}
      <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_40%_at_50%_100%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Footer Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 relative z-10 border-x border-slate-200 dark:border-white/[0.07]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Column 1: Brand Info & Live Status */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-zinc-100 group-hover:border-blue-500 dark:group-hover:border-white/20 transition-colors shadow-xs">
                <Terminal className="w-4 h-4 text-blue-600 dark:text-zinc-200" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  DevHost
                </span>
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono tracking-wider rounded bg-blue-50 dark:bg-zinc-900 text-blue-700 dark:text-zinc-400 border border-blue-200 dark:border-white/10 font-semibold">
                  Cloud
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              High-performance developer cloud hosting combining Vercel-style GitHub CI/CD with cPanel reliability, LiteSpeed Enterprise caching, and local bKash/Nagad instant payments.
            </p>

            {/* Live Infrastructure Status Pill */}
            <div className="pt-1">
              <Link
                href="/server-status"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 text-xs font-mono hover:border-slate-300 dark:hover:border-white/25 transition-all shadow-xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>All Systems Operational — 99.99% SLA</span>
              </Link>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] font-bengali text-xs text-slate-700 dark:text-zinc-300 leading-relaxed shadow-xs">
              🇧🇩 <span className="font-semibold text-slate-900 dark:text-zinc-100">বাংলাদেশী ডেভেলপার ও ব্যবসার জন্য:</span> সরাসরি বিকাশ ও নগদে পেমেন্ট, ১৫% কার্ড ভ্যাট সাশ্রয় এবং ২৪/৭ বাংলা ও ইংরেজি সাপোর্ট।
            </div>
          </div>

          {/* Column 2: Hosting & Cloud */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-200 font-mono mb-4 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
              <span>Hosting & Cloud</span>
            </h4>
            <ul className="space-y-2.5 text-xs font-normal">
              <li>
                <Link href="/wordpress-hosting-bangladesh" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Web & WordPress Hosting
                </Link>
              </li>
              <li>
                <Link href="/nodejs-hosting" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                  <span>Developer Git Hosting</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-white/10">CI/CD</span>
                </Link>
              </li>
              <li>
                <Link href="/cloud-vps" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                  <span>Managed Cloud VPS</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">NVMe</span>
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                  <span>1-Click App Marketplace</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">16 Stacks</span>
                </Link>
              </li>
              <li>
                <Link href="/enterprise" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Enterprise Bare-Metal & HA
                </Link>
              </li>
              <li>
                <Link href="/free-migration" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1">
                  <span>Free Website Migration</span>
                  <ArrowUpRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Domains & Free Tools */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-200 font-mono mb-4 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
              <span>Domains & Free Tools</span>
            </h4>
            <ul className="space-y-2.5 text-xs font-normal">
              <li>
                <Link href="/cheap-domain-registration-bd" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Domain Name Search
                </Link>
              </li>
              <li>
                <Link href="/estimator" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                  <span>Cloud Cost Estimator</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">PDF Quote</span>
                </Link>
              </li>
              <li>
                <Link href="/tools?tab=whois" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  WHOIS Lookup Tool
                </Link>
              </li>
              <li>
                <Link href="/tools?tab=dns" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Global DNS Checker
                </Link>
              </li>
              <li>
                <Link href="/tools?tab=headers" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  SSL & Header Checker
                </Link>
              </li>
              <li>
                <Link href="/server-status" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Server Looking Glass
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Developers & Docs */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-200 font-mono mb-4 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
              <span>Developers & Docs</span>
            </h4>
            <ul className="space-y-2.5 text-xs font-normal">
              <li>
                <Link href="/panel-preview" className="text-blue-600 dark:text-emerald-400 hover:underline transition-colors flex items-center gap-1.5 font-medium">
                  <span>Live Control Panel Sandbox</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-blue-50 dark:bg-emerald-500/20 text-blue-700 dark:text-emerald-400 border border-blue-200 dark:border-emerald-500/30">Demo</span>
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Documentation Hub
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                  <span>Engineering Changelog</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">v2.4</span>
                </Link>
              </li>
              <li>
                <Link href="/nodejs-hosting" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  GitHub Actions CI/CD
                </Link>
              </li>
              <li>
                <Link href="/compare" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Compare Pricing & TCO
                </Link>
              </li>
              <li>
                <Link href="/partners" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                  <span>Agency & Affiliate Program</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-white/10">30%</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Company & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-200 font-mono mb-4 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
              <span>Company & Legal</span>
            </h4>
            <ul className="space-y-2.5 text-xs font-normal">
              <li>
                <Link href="/about" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  About Infrastructure
                </Link>
              </li>
              <li>
                <Link href="/server-status" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Security & Trust Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Contact 24/7 Support
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=terms-of-service" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Terms of Service &amp; Delivery
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=privacy-policy" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  Privacy &amp; Encryption Policy
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=refund-and-cancellation" className="text-emerald-700 dark:text-emerald-400 hover:underline transition-colors font-medium">
                  30-Day Refund &amp; Domain Rule
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=service-level-agreement" className="text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-zinc-100 transition-colors">
                  99.99% Uptime SLA Credits
                </Link>
              </li>
              <li>
                <Link href="/abuse" className="text-rose-600 dark:text-rose-400 hover:underline transition-colors font-medium">
                  Report Abuse / DMCA Desk
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Global Datacenters & Local Payment Badges */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Datacenters */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
            <span className="font-mono text-slate-700 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
              <Server className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
              Datacenters:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 font-mono text-[11px] shadow-xs">
              <span>🇸🇬 Singapore (Equinix SG1)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">~35ms BD</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 font-mono text-[11px] shadow-xs">
              <span>🇺🇸 USA (Ashburn, VA)</span>
              <span className="text-slate-500 dark:text-zinc-400">Tier-IV</span>
            </div>
          </div>

          {/* Payment & Cloud Badges */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-500 dark:text-zinc-500 mr-1">Gateways:</span>
            {['bKash Merchant', 'Nagad Merchant', 'Visa', 'Mastercard', 'Stripe', 'CloudLinux', 'LiteSpeed', 'cPanel'].map((badge) => (
              <span
                key={badge}
                className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 shadow-xs"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500 gap-3 font-mono">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <p>© {currentYear} DevHost Cloud Inc. All rights reserved.</p>
            <span className="hidden sm:inline text-slate-300 dark:text-zinc-700">•</span>
            <p className="text-slate-600 dark:text-zinc-400">
              Founder &amp; Developer:{' '}
              <a
                href="https://abuhanifmia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-0.5 group"
              >
                <span>Abu Hanif</span>
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              PCI-DSS Level 1 &amp; SOC 2 Type II Certified Infrastructure
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
