import React from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Terminal, ArrowLeft, Home, SearchCheck, Server, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[75vh] flex items-center justify-center relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden px-4 py-20 transition-colors duration-200">
        {/* Architectural Grid Background */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-xl w-full rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/60 p-8 sm:p-10 shadow-2xl glass-card relative z-10 text-center space-y-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-zinc-900 border border-rose-200 dark:border-white/10 text-xs font-mono text-rose-700 dark:text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>HTTP Status 404 — Route Not Provisioned</span>
          </div>

          <div className="space-y-2">
            <div className="text-6xl sm:text-7xl font-bold font-mono text-slate-900 dark:text-zinc-100 tracking-tighter">
              404
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">
              Resource Not Found
            </h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400 font-normal leading-relaxed max-w-md mx-auto">
              The requested URI does not match any active edge worker or routed documentation slug. It may have been deprecated or moved.
            </p>
          </div>

          {/* Diagnostic Box */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] text-left font-mono text-xs text-slate-700 dark:text-zinc-400 space-y-1.5">
            <div className="text-slate-500 dark:text-zinc-500"># Cloud Edge Diagnostics</div>
            <div>&gt; upstream_status: <span className="text-rose-600 dark:text-rose-400 font-bold">404 NOT_FOUND</span></div>
            <div>&gt; resolver: <span className="text-slate-900 dark:text-zinc-300">Cloudflare Pages Edge Runtime</span></div>
            <div>&gt; hint: <span className="text-blue-600 dark:text-emerald-400 font-semibold">Use Ctrl+K or search below</span></div>
          </div>

          {/* Action Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white font-semibold text-xs shadow-sm transition-all"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </Link>

            <Link
              href="/docs"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 text-xs font-semibold transition-all"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span>Browse Documentation</span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
