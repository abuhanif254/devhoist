'use client';

import React, { useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';

export default function SpeedBenchmarkChart() {
  const [metric, setMetric] = useState<'ttfb' | 'rps'>('ttfb');

  return (
    <div className="w-full transition-colors duration-200">
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/40 p-6 sm:p-8 shadow-sm glass-card relative overflow-hidden">
        {/* Header & Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/[0.08]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono mb-2 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Independent Benchmark Tests</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
              LiteSpeed Enterprise vs. Standard Apache
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 font-normal">
              Tested on live WordPress 6.7 + WooCommerce store carrying 500 catalog items.
            </p>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setMetric('ttfb')}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md font-semibold transition-all cursor-pointer ${
                metric === 'ttfb' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Time-To-First-Byte (TTFB)</span>
            </button>
            <button
              type="button"
              onClick={() => setMetric('rps')}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md font-semibold transition-all cursor-pointer ${
                metric === 'rps' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Requests Per Second</span>
            </button>
          </div>
        </div>

        {/* Benchmark Visuals */}
        <div className="pt-6 space-y-6">
          {metric === 'ttfb' ? (
            <div className="space-y-5">
              <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-medium">
                Lower score is faster (Milliseconds elapsed until first byte arrives):
              </div>

              {/* DevHost LiteSpeed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-zinc-200">
                      Our LiteSpeed Enterprise + LSCache + NVMe
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                      11x Faster
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">42ms</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 overflow-hidden">
                  <div className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full w-[8%]" />
                </div>
              </div>

              {/* Standard Nginx */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Standard Nginx FastCGI Caching</span>
                  <span className="font-mono font-bold text-slate-600 dark:text-zinc-400">220ms</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-zinc-600 rounded-full w-[38%]" />
                </div>
              </div>

              {/* Standard Apache */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Standard Shared Apache 2.4 (Most BD Hosts)</span>
                  <span className="font-mono font-bold text-slate-600 dark:text-zinc-400">480ms</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 overflow-hidden">
                  <div className="h-full bg-slate-300 dark:bg-zinc-700 rounded-full w-[82%]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-medium">
                Higher score is better (Concurrent HTTP requests handled per second):
              </div>

              {/* DevHost LiteSpeed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-zinc-200">
                      Our LiteSpeed Enterprise (LSCache Engine)
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                      4,850 RPS
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">100% capacity</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 overflow-hidden">
                  <div className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full w-[95%]" />
                </div>
              </div>

              {/* Nginx */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Nginx Reverse Proxy Cache</span>
                  <span className="font-mono font-bold text-slate-600 dark:text-zinc-400">1,900 RPS</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-zinc-600 rounded-full w-[42%]" />
                </div>
              </div>

              {/* Standard Apache */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Apache with WP Super Cache</span>
                  <span className="font-mono font-bold text-slate-600 dark:text-zinc-400">450 RPS</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 overflow-hidden">
                  <div className="h-full bg-slate-300 dark:bg-zinc-700 rounded-full w-[12%]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
