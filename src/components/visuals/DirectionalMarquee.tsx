'use client';

import React from 'react';
import {
  NextJsLogo,
  ReactLogo,
  NodeJsLogo,
  WordPressLogo,
  LaravelLogo,
  PythonLogo,
  GitHubLogo,
  DockerLogo,
  CpanelLogo,
  CloudflareLogo,
} from './BrandLogos';
import { Shield, Zap, Database, Server, Cpu, HardDrive } from 'lucide-react';

interface TechItem {
  name: string;
  category: string;
  icon: React.ReactNode;
}

const ROW_ONE: TechItem[] = [
  { name: 'Next.js 15', category: 'App Router', icon: <NextJsLogo className="w-4 h-4" /> },
  { name: 'React 19', category: 'Server Actions', icon: <ReactLogo className="w-4 h-4" /> },
  { name: 'Node.js 22 LTS', category: 'JavaScript Runtime', icon: <NodeJsLogo className="w-4 h-4" /> },
  { name: 'WordPress 6.7', category: 'LiteSpeed Optimized', icon: <WordPressLogo className="w-4 h-4" /> },
  { name: 'Laravel 11', category: 'PHP 8.3 / OPcache', icon: <LaravelLogo className="w-4 h-4" /> },
  { name: 'Python 3.12', category: 'FastAPI / Django', icon: <PythonLogo className="w-4 h-4" /> },
  { name: 'GitHub CI/CD', category: 'Automated Webhooks', icon: <GitHubLogo className="w-4 h-4" /> },
  { name: 'Docker Compose', category: 'VPS Containers', icon: <DockerLogo className="w-4 h-4" /> },
];

const ROW_TWO: TechItem[] = [
  { name: 'LiteSpeed Enterprise', category: 'Sub-30ms TTFB', icon: <Zap className="w-4 h-4 text-amber-500" /> },
  { name: 'cPanel & WHM', category: 'Full Management', icon: <CpanelLogo className="w-4 h-4" /> },
  { name: 'CloudLinux OS', category: 'Isolated LVE Quotas', icon: <Server className="w-4 h-4 text-blue-500" /> },
  { name: 'Cloudflare Edge', category: 'Global DNS & CDN', icon: <CloudflareLogo className="w-4 h-4" /> },
  { name: 'Imunify360', category: 'Automated AI WAF', icon: <Shield className="w-4 h-4 text-emerald-500" /> },
  { name: 'NVMe Gen4 Storage', category: '7,400 MB/s Read', icon: <HardDrive className="w-4 h-4 text-indigo-500" /> },
  { name: 'Redis Object Cache', category: 'In-Memory Cache', icon: <Database className="w-4 h-4 text-rose-500" /> },
  { name: 'AMD EPYC 9654', category: 'Dedicated vCPU', icon: <Cpu className="w-4 h-4 text-cyan-500" /> },
];

export default function DirectionalMarquee() {
  return (
    <div className="w-full py-10 overflow-hidden bg-slate-50/50 dark:bg-zinc-950 border-y border-slate-200 dark:border-white/[0.08] marquee-container relative select-none">
      {/* Edge gradient fade masks */}
      <div className="absolute left-0 inset-y-0 w-24 bg-gradient-to-r from-slate-50 dark:from-zinc-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 inset-y-0 w-24 bg-gradient-to-l from-slate-50 dark:from-zinc-950 to-transparent z-10 pointer-events-none" />

      <div className="space-y-4">
        {/* Row 1: Sliding Left (←) */}
        <div className="flex overflow-hidden">
          <div className="animate-marquee-left flex items-center gap-4 shrink-0">
            {[...ROW_ONE, ...ROW_ONE].map((item, idx) => (
              <div
                key={`r1-${idx}`}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xs hover:border-blue-500 transition-colors shrink-0"
              >
                <div className="shrink-0">{item.icon}</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{item.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2: Sliding Right (→) */}
        <div className="flex overflow-hidden">
          <div className="animate-marquee-right flex items-center gap-4 shrink-0">
            {[...ROW_TWO, ...ROW_TWO].map((item, idx) => (
              <div
                key={`r2-${idx}`}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xs hover:border-indigo-500 transition-colors shrink-0"
              >
                <div className="shrink-0">{item.icon}</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{item.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
