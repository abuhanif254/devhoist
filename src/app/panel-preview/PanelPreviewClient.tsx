'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  RotateCcw,
  Cpu,
  Layers,
  Zap,
  Play,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Activity,
  Globe,
  Lock,
  ArrowRight,
  HardDrive,
  Sparkles,
  Server,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';

type Tab = 'cicd' | 'runtime' | 'telemetry' | 'wordpress';

interface CommitRelease {
  id: string;
  hash: string;
  message: string;
  timeAgo: string;
  author: string;
  active: boolean;
  size: string;
}

export default function PanelPreviewClient() {
  const { openStackBuilder } = useBilling();
  const [activeTab, setActiveTab] = useState<Tab>('cicd');

  // --------------------------------------------------------------------------
  // TAB 1: CI/CD STATE
  // --------------------------------------------------------------------------
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<number>(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '✓ Connected to github.com/acme/storefront (main)',
    '✓ Passenger watchdog listening on port 3000',
    '✓ Release #c4a19e live on Singapore SG1 cluster',
  ]);

  const [releases, setReleases] = useState<CommitRelease[]>([
    {
      id: 'rel-1',
      hash: 'c4a19e',
      message: 'feat: add native bKash merchant PGW checkout webhook',
      timeAgo: '4 mins ago',
      author: 'tanvir@dev',
      active: true,
      size: '14.2 MB',
    },
    {
      id: 'rel-2',
      hash: '8b291d',
      message: 'perf: optimize image loader with Cloudflare AVIF edge cache',
      timeAgo: '2 hours ago',
      author: 'tanvir@dev',
      active: false,
      size: '14.1 MB',
    },
    {
      id: 'rel-3',
      hash: '3f901a',
      message: 'fix: resolve passenger memory leak on websocket reconnect',
      timeAgo: '1 day ago',
      author: 'devops@team',
      active: false,
      size: '13.9 MB',
    },
  ]);

  const triggerDeploy = async () => {
    if (isDeploying) return;
    setIsDeploying(true);
    setDeployStep(1);

    const newLogs = [
      '1. [12:00:01] Fetching commit #9f8a2b from branch main...',
      '2. [12:00:02] Running Next.js standalone build on GitHub Actions runner...',
      '3. [12:00:03] Syncing 14.2 MB standalone artifacts via SSH In-Place Overwrite...',
      '4. [12:00:04] Touching apps/storefront/tmp/restart.txt — Passenger reloaded in 0.4s!',
      '✓ Zero-downtime release #9f8a2b is now LIVE in Singapore SG1.',
    ];

    for (let i = 0; i < newLogs.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setTerminalLogs((prev) => [...prev, newLogs[i]]);
      setDeployStep(i + 1);
    }

    const newRelease: CommitRelease = {
      id: `rel-${Date.now()}`,
      hash: '9f8a2b',
      message: 'chore: automated GitHub Actions production build',
      timeAgo: 'Just now',
      author: 'github-actions[bot]',
      active: true,
      size: '14.2 MB',
    };

    setReleases((prev) => [
      newRelease,
      ...prev.map((r) => ({ ...r, active: false })),
    ]);

    setIsDeploying(false);
  };

  const rollbackToCommit = (hash: string) => {
    setReleases((prev) =>
      prev.map((r) => ({
        ...r,
        active: r.hash === hash,
      }))
    );
    setTerminalLogs((prev) => [
      ...prev,
      `[ROLLBACK] Symlink switched instantly to commit #${hash} (0.0s downtime).`,
    ]);
  };

  // --------------------------------------------------------------------------
  // TAB 2: RUNTIME & ENV STATE
  // --------------------------------------------------------------------------
  const [nodeVersion, setNodeVersion] = useState('Node.js 22 Current');
  const [envVars, setEnvVars] = useState<
    { id: string; key: string; value: string; masked: boolean }[]
  >([
    { id: '1', key: 'DATABASE_URL', value: 'mysql://u421_shop:P@ss123@127.0.0.1:3306/db_prod', masked: true },
    { id: '2', key: 'NEXT_PUBLIC_API_URL', value: 'https://storefront.devhostcloud.com/api', masked: false },
    { id: '3', key: 'BKASH_MERCHANT_SECRET', value: 'sec_bkash_98fbc184029a', masked: true },
  ]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [workerToast, setWorkerToast] = useState<string | null>(null);

  const addEnvVar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newVal.trim()) return;
    setEnvVars((prev) => [
      ...prev,
      { id: String(Date.now()), key: newKey.trim(), value: newVal.trim(), masked: true },
    ]);
    setNewKey('');
    setNewVal('');
  };

  const toggleMask = (id: string) => {
    setEnvVars((prev) =>
      prev.map((v) => (v.id === id ? { ...v, masked: !v.masked } : v))
    );
  };

  const deleteEnvVar = (id: string) => {
    setEnvVars((prev) => prev.filter((v) => v.id !== id));
  };

  const restartPassenger = () => {
    setWorkerToast('Passenger workers refreshed in 0.38s! Environment variables injected.');
    setTimeout(() => setWorkerToast(null), 3500);
  };

  // --------------------------------------------------------------------------
  // TAB 3: TELEMETRY STATE & TRAFFIC SPIKE SIMULATOR
  // --------------------------------------------------------------------------
  const [isSpiking, setIsSpiking] = useState(false);
  const [reqPerSec, setReqPerSec] = useState(45);
  const [cpuPercent, setCpuPercent] = useState(18);

  const triggerSpike = () => {
    if (isSpiking) return;
    setIsSpiking(true);
    setReqPerSec(420);
    setCpuPercent(32); // LiteSpeed absorbs 92% of traffic, so CPU barely moves

    setTimeout(() => {
      setReqPerSec(45);
      setCpuPercent(18);
      setIsSpiking(false);
    }, 4500);
  };

  // --------------------------------------------------------------------------
  // TAB 4: WORDPRESS / LSCache STATE
  // --------------------------------------------------------------------------
  const [redisCache, setRedisCache] = useState(true);
  const [strictSsl, setStrictSsl] = useState(true);
  const [stagingClone, setStagingClone] = useState(false);
  const [flushToast, setFlushToast] = useState<string | null>(null);

  const flushCache = () => {
    setFlushToast('Purged 1,420 cached objects from LiteSpeed Edge Memory in 12ms!');
    setTimeout(() => setFlushToast(null), 3000);
  };

  return (
    <div className="w-full space-y-8">
      {/* Browser Frame */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Browser Top Navigation Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900/70 flex items-center justify-between gap-4">
          {/* Traffic Dots */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          {/* Fake URL Bar */}
          <div className="flex-1 max-w-xl mx-auto flex items-center justify-center gap-2 h-7 px-3 rounded-md bg-white dark:bg-zinc-950 border border-slate-300 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-zinc-400">
            <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">https://panel.devhostcloud.com/apps/nextjs-commerce-prod</span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 hidden sm:block">
            CloudLinux LVE 9.4
          </div>
        </div>

        {/* Control Panel Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-white/[0.08] text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('cicd')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'cicd'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Git CI/CD Console</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('runtime')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'runtime'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <span>Runtime & .env Vault</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Container Telemetry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wordpress')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'wordpress'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Zap className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <span>LSCache & Redis Suite</span>
          </button>
        </div>

        {/* Panel Content Body */}
        <div className="p-6 sm:p-8 min-h-[460px] bg-slate-50/50 dark:bg-zinc-950/95">
          {/* ---------------------------------------------------------------- */}
          {/* TAB 1: GIT CI/CD TERMINAL CONSOLE                                */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'cicd' && (
            <div className="space-y-6">
              {/* App Status Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">nextjs-commerce-prod</h3>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 font-semibold">
                      main branch
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 font-mono">
                    Repository: github.com/acme/storefront • Node 22 Standalone
                  </div>
                </div>

                <button
                  type="button"
                  onClick={triggerDeploy}
                  disabled={isDeploying}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 ${isDeploying ? 'animate-spin' : ''}`} />
                  <span>{isDeploying ? 'Building Release...' : 'Trigger Git Rebuild'}</span>
                </button>
              </div>

              {/* Live Terminal Stream */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Real-Time Deployment Terminal Output</span>
                  </span>
                  <span className="text-[11px] text-zinc-500">Passenger Watchdog v6.0</span>
                </div>
                <div className="p-4 rounded-xl bg-black border border-white/10 font-mono text-xs text-zinc-300 space-y-1.5 max-h-48 overflow-y-auto">
                  {terminalLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.startsWith('✓')
                          ? 'text-emerald-400 font-semibold'
                          : log.startsWith('[ROLLBACK]')
                          ? 'text-amber-400 font-semibold'
                          : 'text-zinc-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                  {isDeploying && (
                    <div className="text-zinc-500 animate-pulse">
                      ... executing in-place standalone rsync step {deployStep}/4
                    </div>
                  )}
                </div>
              </div>

              {/* Release Commit History Table */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-slate-700 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                  Release History & 1-Click Rollback
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900/80 text-slate-700 dark:text-zinc-400 font-semibold">
                        <th className="py-2.5 px-4">Commit</th>
                        <th className="py-2.5 px-4">Message</th>
                        <th className="py-2.5 px-4">Author</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {releases.map((rel) => (
                        <tr key={rel.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="py-3 px-4 text-slate-900 dark:text-zinc-200 font-bold">#{rel.hash}</td>
                          <td className="py-3 px-4 text-slate-800 dark:text-zinc-300 max-w-xs truncate font-medium">{rel.message}</td>
                          <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{rel.author}</td>
                          <td className="py-3 px-4">
                            {rel.active ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                ACTIVE PRODUCTION
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">Archived</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!rel.active && (
                              <button
                                type="button"
                                onClick={() => rollbackToCommit(rel.hash)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Rollback</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 2: RUNTIME & ENVIRONMENT VARIABLES VAULT                     */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'runtime' && (
            <div className="space-y-6">
              {/* Version Switcher */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono uppercase">
                    CloudLinux Runtime Manager
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
                    Isolated Application Execution Environment
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">Runtime:</span>
                  <select
                    value={nodeVersion}
                    onChange={(e) => setNodeVersion(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-300 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Node.js 22 Current">Node.js 22 Current</option>
                    <option value="Node.js 20 LTS">Node.js 20 LTS</option>
                    <option value="Node.js 18 LTS">Node.js 18 LTS</option>
                    <option value="Python 3.12">Python 3.12</option>
                    <option value="PHP 8.3">PHP 8.3 LTS</option>
                  </select>
                </div>
              </div>

              {/* Toast */}
              {workerToast && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-mono flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{workerToast}</span>
                  </div>
                </div>
              )}

              {/* Environment Variables Vault */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                    Environment Variables Vault (.env.production)
                  </span>
                  <button
                    type="button"
                    onClick={restartPassenger}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restart Passenger Worker</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {envVars.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <span className="text-slate-900 dark:text-zinc-200 font-bold">{v.key}</span>
                      <span className="flex-1 text-slate-600 dark:text-zinc-400 truncate">
                        {v.masked ? '••••••••••••••••••••••••••••••' : v.value}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleMask(v.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                          title={v.masked ? 'Reveal value' : 'Mask value'}
                        >
                          {v.masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEnvVar(v.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                          title="Delete variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Variable Form */}
                <form
                  onSubmit={addEnvVar}
                  className="pt-2 flex flex-col sm:flex-row gap-2.5 font-mono text-xs"
                >
                  <input
                    type="text"
                    placeholder="KEY (e.g. STRIPE_SECRET_KEY)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="VALUE"
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Variable</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 3: REAL-TIME LVE CONTAINER TELEMETRY                         */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08]">
                <div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono uppercase">
                    CloudLinux LVE Container Isolation
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
                    Live Hardware Telemetry &amp; Request Absorber
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={triggerSpike}
                  disabled={isSpiking}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-xs font-mono font-medium transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${isSpiking ? 'animate-bounce' : ''}`} />
                  <span>{isSpiking ? 'Traffic Spike Active (420 req/s)' : 'Simulate 10x Traffic Spike'}</span>
                </button>
              </div>

              {/* 4 Telemetry SVG Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. CPU Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400">
                    <span>CPU Usage</span>
                    <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                    {cpuPercent}%
                    <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 ml-1">of 2 Cores</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${cpuPercent}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                    Load Avg: 0.14, 0.22, 0.18
                  </div>
                </div>

                {/* 2. RAM Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400">
                    <span>DDR5 Memory</span>
                    <Layers className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                    640 MB
                    <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 ml-1">/ 2,048 MB</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-blue-500 dark:bg-zinc-300 w-[31%]" />
                  </div>
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    1,408 MB Free Available
                  </div>
                </div>

                {/* 3. Disk I/O Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400">
                    <span>NVMe Throughput</span>
                    <HardDrive className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                    14.2 MB/s
                    <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 ml-1">/ 50 MB/s</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-blue-600 dark:bg-zinc-400 w-[28%]" />
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                    PCIe Gen4 Direct Bus
                  </div>
                </div>

                {/* 4. Inode Quota Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400">
                    <span>Inode File Count</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                    12,450
                    <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 ml-1">/ 300,000</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[4.1%]" />
                  </div>
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    82% Saved via Smart Pipeline
                  </div>
                </div>
              </div>

              {/* Traffic Chart Telemetry Log */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  <span className="text-slate-800 dark:text-zinc-200">Current Traffic: {reqPerSec} requests/sec</span>
                </div>
                <div className="text-slate-600 dark:text-zinc-400 text-[11px]">
                  LiteSpeed LSCache Hit Rate: <span className="text-emerald-600 dark:text-emerald-400 font-bold">96.4%</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 4: 1-CLICK WORDPRESS, LSCACHE & SITEJET AI MANAGER            */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'wordpress' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono uppercase">
                    LiteSpeed Enterprise Engine
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
                    WordPress 6.x Acceleration &amp; Edge SSL Manager
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={flushCache}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs font-mono font-medium transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Flush All Edge Cache</span>
                </button>
              </div>

              {flushToast && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{flushToast}</span>
                </div>
              )}

              {/* Interactive Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                {/* 1. Redis Cache Toggle */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-zinc-200">Redis Object Cache</span>
                    <button
                      type="button"
                      onClick={() => setRedisCache(!redisCache)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                        redisCache ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                          redisCache ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-normal">
                    Memory database caching MySQL query objects for sub-30ms load times.
                  </p>
                </div>

                {/* 2. AutoSSL Strict Mode Toggle */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-zinc-200">AutoSSL TLS 1.3</span>
                    <button
                      type="button"
                      onClick={() => setStrictSsl(!strictSsl)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                        strictSsl ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                          strictSsl ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-normal">
                    Strict HTTP/3 QUIC enforcement with zero-cost automated 90-day renewal.
                  </p>
                </div>

                {/* 3. Staging Clone Toggle */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-zinc-200">1-Click Staging</span>
                    <button
                      type="button"
                      onClick={() => setStagingClone(!stagingClone)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                        stagingClone ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                          stagingClone ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-normal">
                    Isolated staging sandbox (staging.storefront.com) to preview plugin updates safely.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sticky Conversion Bar Inside Sandbox */}
        <div className="px-6 py-4 bg-zinc-900 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-zinc-300 font-normal flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Impressed by the developer workflow? Launch your own instance in 60 seconds.</span>
          </div>

          <button
            type="button"
            onClick={() =>
              openStackBuilder({
                pid: 2,
                planName: 'Developer Pro Cloud',
                basePriceMonthlyBDT: 450,
                basePriceMonthlyUSD: 3.75,
                specs: {
                  ram: '2 GB Isolated RAM',
                  cpu: '2 vCPU Cores',
                  storage: '5 GB NVMe SSD',
                  inodes: '300,000 Inodes',
                },
              })
            }
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white text-xs font-medium transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Deploy Developer Pro — ৳450/mo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
