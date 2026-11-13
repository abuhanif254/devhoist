'use client';

import React, { useState } from 'react';
import {
  GitCommit,
  Cpu,
  CloudUpload,
  Server,
  ArrowRight,
  Zap,
  CheckCircle2,
  HardDrive,
  RefreshCcw,
} from 'lucide-react';
import { motion } from 'framer-motion';

const STAGES = [
  {
    step: '01',
    title: 'Local git push',
    badge: 'Zero Server Load',
    icon: GitCommit,
    color: 'from-blue-500 to-indigo-600',
    desc: 'Push code to origin/main. GitHub webhook triggers pipeline instantly.',
    metric: '0 MB server RAM',
  },
  {
    step: '02',
    title: 'Actions Runner',
    badge: 'Free Compute',
    icon: Cpu,
    color: 'from-indigo-500 to-purple-600',
    desc: 'Ubuntu runner installs dependencies & builds minified Next.js artifacts.',
    metric: '2,000 mins/mo free',
  },
  {
    step: '03',
    title: '80% Smaller Artifact',
    badge: 'Zero Bloat',
    icon: CloudUpload,
    color: 'from-purple-500 to-pink-600',
    desc: 'Only .next/standalone and public files synced over Jailed SSH.',
    metric: '~35 MB transferred',
  },
  {
    step: '04',
    title: 'cPanel NVMe Live',
    badge: 'Sub-3s Reload',
    icon: Server,
    color: 'from-emerald-500 to-teal-600',
    desc: 'Passenger touches restart.txt & serves traffic with zero dropped requests.',
    metric: '99.99% Uptime',
  },
];

export default function DirectionalPipeline() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="w-full py-12">
      {/* 4 Connected Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = activeStep === idx;

          return (
            <div key={stage.step} className="relative flex flex-col">
              <div
                onClick={() => setActiveStep(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer h-full flex flex-col justify-between ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl ring-2 ring-blue-500/20'
                    : 'bg-white/70 dark:bg-slate-950/70 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
                      STAGE {stage.step}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {stage.badge}
                    </span>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr text-white flex items-center justify-center shadow-md mb-3" style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}>
                    <div className={`w-full h-full rounded-xl bg-gradient-to-tr ${stage.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {stage.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-normal">
                    {stage.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-500">Output:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{stage.metric}</strong>
                </div>
              </div>

              {/* Directional Traveling Arrow between cards (hidden on mobile, shown on desktop) */}
              {idx < STAGES.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 items-center justify-center pointer-events-none">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/40 animate-pulse">
                    <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Animated Traveling Data Beams Strip */}
      <div className="mt-6 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Continuous Directional Stream:</span>
        </div>

        {/* Moving >>> Indicators */}
        <div className="hidden sm:flex items-center gap-2 overflow-hidden px-4 text-blue-600 dark:text-blue-400 font-bold tracking-widest text-sm">
          <motion.div
            animate={{ x: [0, 24, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          >
            &gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;
          </motion.div>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          <span>Zero Server Downtime Verified</span>
        </div>
      </div>
    </div>
  );
}
