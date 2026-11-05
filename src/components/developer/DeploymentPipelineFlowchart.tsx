'use client';

import React, { useState } from 'react';
import PipelineBeam from '@/components/ui/PipelineBeam';
import {
  GitCommit,
  Cpu,
  CloudUpload,
  Server,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export default function DeploymentPipelineFlowchart() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      id: 1,
      title: '1. Local git push',
      badge: 'Zero Overhead',
      icon: GitCommit,
      desc: 'Developer commits code and pushes to branch `origin/main`. Webhook payload fires automatically.',
      stat: '0s local build time',
      detail:
        'Your local developer environment triggers a standard git push. No need to build heavy artifacts locally or manually FTP files.',
    },
    {
      id: 2,
      title: '2. GitHub Actions Runner',
      badge: 'Free Compute',
      icon: Cpu,
      desc: 'GitHub runner spins up, installs dependencies, compiles TypeScript/Tailwind, and bundles output.',
      stat: 'Free 2,000 mins/mo',
      detail:
        'Crucial Advantage: Compiling happens entirely on GitHub cloud runners. Your cPanel CPU and RAM are 100% spared, keeping live user traffic unthrottled.',
    },
    {
      id: 3,
      title: '3. Artifact Filter',
      badge: '80% Reduction',
      icon: CloudUpload,
      desc: 'Only `.next/standalone` or `dist` files are prepared. DevDependencies and tests are discarded.',
      stat: '~40 MB payload',
      detail:
        'Instead of syncing 400 MB of 40,000 node_modules files, only the minified production binaries and static public assets are transferred.',
    },
    {
      id: 4,
      title: '4. In-Place Overwrite',
      badge: 'Zero Inode Waste',
      icon: Server,
      desc: 'Files rsync over Jailed SSH directly into production directory, atomically replacing changed files.',
      stat: '0 duplicate dirs',
      detail:
        'Old build hashes are automatically pruned. You never exhaust cPanel Inode quotas or stack duplicate release folders.',
    },
    {
      id: 5,
      title: '5. Passenger Reload',
      badge: 'Zero Downtime',
      icon: CheckCircle2,
      desc: 'Pipeline touches `tmp/restart.txt`. CloudLinux Phusion Passenger gracefully reloads workers in 2s.',
      stat: 'Sub-3s reload',
      detail:
        'Active visitors browsing your site experience uninterrupted connections with 200 OK responses.',
    },
  ];

  return (
    <div className="w-full transition-colors duration-200">
      {/* Interactive Step Navigator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-6">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = activeStep === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStep(s.id)}
              className={`p-3.5 rounded-lg border text-left transition-all duration-150 relative cursor-pointer ${
                isActive
                  ? 'border-blue-500 dark:border-white/20 bg-blue-50/70 dark:bg-zinc-900 text-blue-950 dark:text-zinc-100 shadow-sm ring-1 ring-blue-500/20'
                  : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/40 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.16] hover:bg-slate-50 dark:hover:bg-zinc-900/70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center ${
                    isActive ? 'bg-blue-600 text-white font-medium' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/5 font-medium">
                  {s.badge}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 truncate">{s.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">{s.stat}</div>
            </button>
          );
        })}
      </div>

      {/* GPU-Accelerated Pipeline Beam Connector */}
      <div className="hidden lg:block px-6 -mt-3 mb-5">
        <PipelineBeam className="w-full h-3 opacity-60" />
      </div>

      {/* Active Step Deep-Dive Card */}
      <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/50 glass-card relative overflow-hidden transition-colors shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                Pipeline Stage {activeStep} of 5
              </span>
              <span className="text-slate-300 dark:text-zinc-600">•</span>
              <span className="text-xs text-blue-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {steps[activeStep - 1].badge}
              </span>
            </div>
            <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
              {steps[activeStep - 1].title}
            </h4>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              {steps[activeStep - 1].detail}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shrink-0 font-mono text-xs text-slate-700 dark:text-zinc-300 space-y-2">
            <div className="text-slate-600 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-300" />
              <span>Performance Impact:</span>
            </div>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              Server RAM consumption: 0 MB during build
            </div>
            <div className="text-slate-600 dark:text-zinc-400">
              Live Visitor Request Delay: <strong className="text-slate-900 dark:text-zinc-200 font-semibold">0.0ms</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
