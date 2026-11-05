'use client';

import React, { useState } from 'react';
import { Sliders, AlertTriangle, CheckCircle2, ShieldCheck, RefreshCcw } from 'lucide-react';

export default function StorageInodeSimulator() {
  const [projectSourceSizeMB, setProjectSourceSizeMB] = useState<number>(150); // 50MB to 500MB, step 25
  const [monthlyDeployments, setMonthlyDeployments] = useState<number>(25); // 5 to 100, step 5
  const [keepRollbackReleases, setKeepRollbackReleases] = useState<boolean>(true); // default true

  const retainedVersions = keepRollbackReleases ? 3 : 1;

  // Exact Mathematical Formulas:
  // 1. Naive Standard Shared Hosting:
  const naiveSingleBuildMB = projectSourceSizeMB * 2.4;
  const naiveTotalDiskGB = Number(
    ((naiveSingleBuildMB * Math.min(monthlyDeployments, 10)) / 1024).toFixed(2)
  );
  const naiveTotalInodes = Math.round(
    projectSourceSizeMB * 280 * Math.min(monthlyDeployments, 5)
  );

  // 2. Smart GitHub Actions Build + In-Place Overwrite Pipeline:
  const smartArtifactMB = projectSourceSizeMB * 0.28;
  const smartTotalDiskGB = Number(
    ((smartArtifactMB * retainedVersions) / 1024).toFixed(2)
  );
  const smartTotalInodes = Math.round(projectSourceSizeMB * 18 * retainedVersions);

  // 3. Calculated Savings Metrics:
  const diskSavedPercent = Math.max(
    0,
    Math.round(((naiveTotalDiskGB - smartTotalDiskGB) / naiveTotalDiskGB) * 100)
  );
  const inodeSavedPercent = Math.max(
    0,
    Math.round(((naiveTotalInodes - smartTotalInodes) / naiveTotalInodes) * 100)
  );

  const isNaiveOverQuota = naiveTotalDiskGB > 5 || naiveTotalInodes > 150000;

  return (
    <div className="w-full transition-colors duration-200">
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/40 p-6 sm:p-10 shadow-sm glass-card relative overflow-hidden">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-white/10 text-blue-700 dark:text-zinc-300 text-xs font-mono mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Interactive Simulator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            Storage &amp; Inode Saver Simulator
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-2xl font-normal leading-relaxed">
            See how our smart GitHub Actions runner + In-Place Overwrite pipeline prevents the classic cPanel 150,000 Inode exhaustion trap.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Sliders & Controls */}
          <div className="lg:col-span-5 space-y-6">
            {/* Slider 1: Source Size */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-zinc-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 dark:text-zinc-300 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
                  <span>Project Source Repo Size</span>
                </label>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 shadow-xs">
                  {projectSourceSizeMB} MB
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="25"
                value={projectSourceSizeMB}
                onChange={(e) => setProjectSourceSizeMB(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                <span>50 MB (Micro App)</span>
                <span>250 MB</span>
                <span>500 MB (Enterprise Monorepo)</span>
              </div>
            </div>

            {/* Slider 2: Monthly Deployments */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-zinc-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 dark:text-zinc-300 flex items-center gap-2">
                  <RefreshCcw className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-400" />
                  <span>Monthly Git Pushes / Deploys</span>
                </label>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 shadow-xs">
                  {monthlyDeployments} pushes/mo
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={monthlyDeployments}
                onChange={(e) => setMonthlyDeployments(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                <span>5 (Hobbyist)</span>
                <span>50 (Active Team)</span>
                <span>100 (High Velocity CI/CD)</span>
              </div>
            </div>

            {/* Toggle 3: Retained Releases */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                  Smart Release Rollback Buffer
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                  Keep last 3 release builds (Recommended) vs 1 latest
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeepRollbackReleases(!keepRollbackReleases)}
                className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                  keepRollbackReleases ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    keepRollbackReleases ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Right Column: Comparison Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Naive Hosting Card */}
            <div
              className={`p-5 rounded-xl border transition-all ${
                isNaiveOverQuota
                  ? 'border-red-300 dark:border-red-500/40 bg-red-50/60 dark:bg-red-950/20'
                  : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-zinc-950/50'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-semibold text-slate-600 dark:text-zinc-400">
                  Standard Hosting
                </span>
                {isNaiveOverQuota ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Quota Breach
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5">
                    Unoptimized
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Estimated Disk Footprint</div>
                  <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-zinc-200 mt-0.5">
                    {naiveTotalDiskGB} GB
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                    Accumulates unpruned node_modules
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Total Inode Count</div>
                  <div
                    className={`text-2xl font-extrabold font-mono mt-0.5 ${
                      naiveTotalInodes > 150000 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-zinc-200'
                    }`}
                  >
                    {naiveTotalInodes.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                    Starter limit: 150k / Pro: 300k
                  </div>
                </div>

                {isNaiveOverQuota && (
                  <div className="p-3 rounded-md bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[11px] text-red-800 dark:text-red-300">
                    Warning: Server will throw <code className="font-mono font-bold text-red-950 dark:text-white">ENOSPC</code> or disk write errors after just a few weeks of active commits.
                  </div>
                )}
              </div>
            </div>

            {/* 2. DevHost Smart Pipeline Card */}
            <div className="p-5 rounded-xl border border-blue-200 dark:border-white/20 bg-white dark:bg-zinc-950 shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  DevHost Pipeline
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                  {inodeSavedPercent}% Inodes Saved
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Optimized Disk Footprint</div>
                  <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {smartTotalDiskGB} GB
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                    Saves {diskSavedPercent}% storage bloat
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Consolidated Inode Count</div>
                  <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {smartTotalInodes.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
                    Consumes under 3% of your quota
                  </div>
                </div>

                <div className="p-3 rounded-md bg-blue-50/60 dark:bg-zinc-900 border border-blue-100 dark:border-white/10 text-[11px] text-slate-700 dark:text-zinc-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Zero file buildup. All builds compile in GitHub cloud runners; only standalone artifacts overwrite in-place.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
