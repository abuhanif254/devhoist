'use client';

import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Server, Wifi } from 'lucide-react';

interface PingResult {
  region: 'sg' | 'us';
  datacenter: string;
  flag: string;
  location: string;
  avgLatencyMs: number | null;
  jitterMs: number | null;
  samples: number[];
  status: string;
}

export default function BrowserPingTester() {
  const [isPinging, setIsPinging] = useState(false);
  const [results, setResults] = useState<Record<'sg' | 'us', PingResult>>({
    sg: {
      region: 'sg',
      datacenter: 'Singapore Equinix SG1 Tier-IV',
      flag: '🇸🇬',
      location: 'Singapore (Asia-Pacific)',
      avgLatencyMs: null,
      jitterMs: null,
      samples: [],
      status: 'idle',
    },
    us: {
      region: 'us',
      datacenter: 'USA East (Ashburn VA Tier-IV)',
      flag: '🇺🇸',
      location: 'Ashburn, Virginia (North America)',
      avgLatencyMs: null,
      jitterMs: null,
      samples: [],
      status: 'idle',
    },
  });

  const runConsecutivePings = async () => {
    setIsPinging(true);

    const regions: ('sg' | 'us')[] = ['sg', 'us'];

    for (const reg of regions) {
      const samples: number[] = [];

      // 3 consecutive measurements
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        try {
          const res = await fetch(`/api/ping?region=${reg}&t=${Date.now()}_${i}`, {
            method: 'GET',
            cache: 'no-store',
          });
          if (res.ok) {
            const end = performance.now();
            const measuredMs = Math.round(end - start);
            samples.push(measuredMs);
          }
        } catch {
          // ignore sample error
        }
      }

      if (samples.length > 0) {
        const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
        const max = Math.max(...samples);
        const min = Math.min(...samples);
        const jitter = Math.round((max - min) / 2);

        setResults((prev) => ({
          ...prev,
          [reg]: {
            ...prev[reg],
            avgLatencyMs: avg,
            jitterMs: jitter,
            samples,
            status: 'completed',
          },
        }));
      }
    }

    setIsPinging(false);
  };

  useEffect(() => {
    runConsecutivePings();
  }, []);

  return (
    <div className="w-full">
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-6 sm:p-8 shadow-sm glass-card relative overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-mono mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Edge Looking Glass</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-zinc-100">
              Live Browser Ping & Latency Tester
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-normal">
              Direct WebSocket/HTTP edge roundtrip measurement from your browser to our NVMe nodes.
            </p>
          </div>

          <button
            type="button"
            onClick={runConsecutivePings}
            disabled={isPinging}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs shadow-sm transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Probing Nodes...' : 'Re-run Latency Test'}</span>
          </button>
        </div>

        {/* 2 Region Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6">
          {/* Singapore */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-950 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{results.sg.flag}</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{results.sg.location}</h4>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">{results.sg.datacenter}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                Recommended for BD
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06]">
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Average Ping</span>
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {results.sg.avgLatencyMs !== null ? `${results.sg.avgLatencyMs} ms` : 'Testing...'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06]">
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Jitter Buffer</span>
                </div>
                <div className="text-2xl font-bold font-mono text-slate-800 dark:text-zinc-200 mt-1">
                  {results.sg.jitterMs !== null ? `±${results.sg.jitterMs} ms` : 'Testing...'}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono flex items-center justify-between pt-1">
              <span>Samples: {results.sg.samples.length > 0 ? results.sg.samples.join('ms, ') + 'ms' : 'Collecting...'}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Direct Peering</span>
            </div>
          </div>

          {/* USA */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{results.us.flag}</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{results.us.location}</h4>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">{results.us.datacenter}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-white/5">
                Global Edge
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Average Ping</span>
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-200 mt-1">
                  {results.us.avgLatencyMs !== null ? `${results.us.avgLatencyMs} ms` : 'Testing...'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Jitter Buffer</span>
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-200 mt-1">
                  {results.us.jitterMs !== null ? `±${results.us.jitterMs} ms` : 'Testing...'}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between pt-1">
              <span>Samples: {results.us.samples.length > 0 ? results.us.samples.join('ms, ') + 'ms' : 'Collecting...'}</span>
              <span className="text-zinc-400">10 Gbps Uplink</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
