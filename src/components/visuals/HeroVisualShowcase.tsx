'use client';

import React, { useState, useRef } from 'react';
import {
  Server,
  Zap,
  Globe,
  Activity,
  Terminal,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  GitBranch,
} from 'lucide-react';
import { BkashBadge, NagadBadge, StripeBadge } from './BrandLogos';

export default function HeroVisualShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt: max 6 degrees
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-2xl mx-auto lg:max-w-none transition-transform duration-200 ease-out py-6"
      style={{
        perspective: '1000px',
      }}
    >
      <div
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transition: 'transform 0.15s ease-out',
        }}
        className="relative"
      >
        {/* =========================================================================
            LAYER 1: MAIN BROWSER CLOUD DASHBOARD & LIVE PREVIEW
           ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden glass-card">
          {/* Browser Window Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-100/80 dark:bg-zinc-900 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-slate-500 dark:text-zinc-400 font-medium">
                cloud-console.devhost.net
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                99.99% Uptime SLA
              </span>
            </div>
          </div>

          {/* Browser Body / Cloud Metrics */}
          <div className="p-6 space-y-6">
            {/* Top row: Site Preview & NVMe Speed Meter */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              {/* Left Column: Interactive Mini Site Mockup */}
              <div className="sm:col-span-7 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 p-4 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>ecommerce-live.com</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    HTTP/3 QUIC
                  </span>
                </div>

                {/* Simulated Storefront Thumbnail with Rich Imagery */}
                <div className="h-32 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-4 text-white flex flex-col justify-between shadow-inner relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
                  <div>
                    <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      Next.js 15 Storefront
                    </span>
                    <h5 className="text-base font-bold mt-1 tracking-tight">Superfast B2C Checkout</h5>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/20">
                    <span className="font-mono text-emerald-300">TTFB: 24ms</span>
                    <span className="font-mono">Cache Hit: 99.8%</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Speed & Hardware Gauges */}
              <div className="sm:col-span-5 space-y-3.5">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                      <span>NVMe PCIe 4.0</span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">Gen4</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    7,400 MB/s
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 w-[94%]" />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Passenger Workers</span>
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-semibold">Active</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    2.8s Reload
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 w-[88%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Real-Time Traffic Wave Chart (SVG Area Curve) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-zinc-900/60">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Real-Time Inbound Requests (BDIX &amp; Global)</span>
                </span>
                <span className="font-mono text-slate-500 dark:text-zinc-400">14,280 req/sec</span>
              </div>
              <div className="h-14 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,45 Q50,20 100,35 T200,15 T300,28 T400,10 L400,60 L0,60 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M0,45 Q50,20 100,35 T200,15 T300,28 T400,10"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            LAYER 2: FLOATING TOP-RIGHT 3D ISOMETRIC SERVER BLADE
           ========================================================================= */}
        <div className="hidden sm:block absolute -top-8 -right-6 w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3.5 shadow-xl animate-float z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Equinix SG1</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono">
                  42ms
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                Direct BDIX Local Peering
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-zinc-400">
            <span>AMD EPYC 9654</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">128 vCPUs</span>
          </div>
        </div>

        {/* =========================================================================
            LAYER 3: FLOATING BOTTOM-LEFT GIT PUSH & PAYMENT BADGE
           ========================================================================= */}
        <div className="hidden sm:block absolute -bottom-7 -left-6 w-68 rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3.5 shadow-xl z-20">
          <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-zinc-200 font-semibold">
              <GitBranch className="w-3.5 h-3.5 text-blue-600" />
              <span>git push origin main</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">1.8s ✓</span>
          </div>

          <div className="flex items-center justify-between pt-2.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
              Instant Provisioning:
            </span>
            <div className="flex items-center gap-1.5">
              <BkashBadge className="scale-90 origin-right" />
              <NagadBadge className="scale-90 origin-right" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
