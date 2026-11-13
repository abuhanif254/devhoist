'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  FolderArchive,
  Server,
  ShieldCheck,
  Terminal,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Globe,
  Cpu,
  RotateCcw,
} from 'lucide-react';

interface DeployMode {
  id: 'git' | 'upload' | 'managed';
  tabLabel: string;
  badge: string;
  headline: string;
  subtitle: string;
  steps: { label: string; detail: string; metric: string }[];
  terminalTitle: string;
  terminalLines: string[];
  ctaLabel: string;
  ctaHref: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEPLOY_MODES: DeployMode[] = [
  {
    id: 'git',
    tabLabel: 'GitHub OAuth & PR Previews',
    badge: 'Zero-Config CI/CD',
    headline: 'Push to GitHub. Live Worldwide + Ephemeral PR Previews.',
    subtitle:
      'Connect your repository via OAuth, ship builds through our isolated Build Broker to Cloudflare R2 Edge or Compute Containers, and preview every pull request on a live URL with 1-click rollback.',
    steps: [
      {
        label: '01 • Signed Webhook',
        detail: 'Every push to main or PR triggers HMAC-verified build queues automatically.',
        metric: '< 1s trigger',
      },
      {
        label: '02 • Edge or Container',
        detail: 'Static/SSG exports serve globally on R2 Edge; dynamic servers run isolated Node/Python/PHP/Docker.',
        metric: 'R2 + Docker',
      },
      {
        label: '03 • Ephemeral PR Preview',
        detail: 'Every pull request spins up a dedicated preview URL and auto-tears down on merge or expiry.',
        metric: 'Auto cleanup',
      },
    ],
    terminalTitle: 'github-ci-cd • branch:feat/checkout → preview.devhostcloud.com',
    terminalLines: [
      '$ git push origin feat/checkout',
      '✓ HMAC webhook verified • Build queued (#bld_982a)',
      '✓ Compiled Next.js standalone artifact (zero node_modules bloat)',
      '✓ Ephemeral PR preview ready: https://pr-42.store.devhostcloud.com',
      '✓ Live SSE logs streaming • 1-Click Rollback snapshot saved',
    ],
    ctaLabel: 'Explore Developer Git Hosting',
    ctaHref: '/nodejs-hosting',
    icon: GitBranch,
  },
  {
    id: 'upload',
    tabLabel: 'Direct ZIP / Folder Upload',
    badge: 'Zero-Trust Scanner',
    headline: 'Drag & Drop ZIP or Project Folder. Scanned & Live in Seconds.',
    subtitle:
      'No repo needed. Drop a local ZIP or build folder directly into your portal. Our pre-deploy scanner blocks path traversal and malicious payloads before publishing across 16 ready stacks.',
    steps: [
      {
        label: '01 • Presigned Transfer',
        detail: 'Direct multipart upload streams archives without gateway timeouts or CLI lock-in.',
        metric: 'No CLI required',
      },
      {
        label: '02 • Zero-Trust Archive Scan',
        detail: 'Inspects file entries against traversal attacks and blocked binaries prior to extract.',
        metric: '100% scanned',
      },
      {
        label: '03 • 16 Stack Blueprints',
        detail: 'Auto-configures Next.js, Vite, Laravel, FastAPI, Django, or static sites immediately.',
        metric: '16 Stacks ready',
      },
    ],
    terminalTitle: 'upload-scanner • bundle-v2.4.zip → compute-edge-01',
    terminalLines: [
      '$ devhost upload ./dist-bundle.zip --mode=zero-trust',
      '✓ Presigned transfer complete (14.2 MB)',
      '✓ Zero-Trust Archive Scanner: 0 unsafe paths, 0 blocked scripts',
      '✓ Published to Cloudflare R2 Edge (< 15ms TTFB worldwide)',
      '✓ Live Custom Domain + SSL TXT verification active',
    ],
    ctaLabel: 'Browse 16 Marketplace Stacks',
    ctaHref: '/marketplace',
    icon: FolderArchive,
  },
  {
    id: 'managed',
    tabLabel: 'WordPress & cPanel NVMe',
    badge: 'LiteSpeed Enterprise',
    headline: 'WordPress, WooCommerce & cPanel with Instant Local Activation.',
    subtitle:
      'Get isolated CloudLinux LVE RAM/CPU, Enterprise LiteSpeed + LSCache, automated daily offsite backups, Sitejet AI builder, and instant activation via bKash, Nagad, Wallet, or Card.',
    steps: [
      {
        label: '01 • Instant Payment',
        detail: 'bKash, Nagad merchant callbacks or Wallet pay activate accounts automatically.',
        metric: 'Sub-2s unlock',
      },
      {
        label: '02 • LVE + LiteSpeed',
        detail: 'Strict neighbor isolation ensures flash-sale spikes never degrade sibling sites.',
        metric: '7,400 MB/s NVMe',
      },
      {
        label: '03 • AI Log Doctor & Backups',
        detail: 'Live panel tools diagnose errors and retain automated offsite snapshots cleanly.',
        metric: '24/7 Self-Heal',
      },
    ],
    terminalTitle: 'whm-provisioner • litespeed + cloudlinux-lve',
    terminalLines: [
      '$ payment verified: bKash Merchant PGW (Invoice #INV-9410)',
      '✓ WHM cPanel account created on Equinix SG1 (~38ms BDIX)',
      '✓ WordPress + LSCache + Redis + Wildcard SSL provisioned',
      '✓ Atomic renewal wallet & automated invoice receipts enabled',
      '✓ Ready in Client Area with 1-Click WHM SSO login',
    ],
    ctaLabel: 'Explore Live Control Panel',
    ctaHref: '/panel-preview',
    icon: Server,
  },
];

export default function DeployModesShowcase() {
  const [activeId, setActiveId] = useState<'git' | 'upload' | 'managed'>('git');
  const activeMode = DEPLOY_MODES.find((m) => m.id === activeId) || DEPLOY_MODES[0];

  return (
    <div className="w-full space-y-6">
      {/* Interactive Mode Switcher Bar (Horizontally scrollable on narrow phones) */}
      <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {DEPLOY_MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = mode.id === activeId;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveId(mode.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                  : 'bg-white dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-400/50 dark:hover:border-white/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{mode.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Main Unified Control Plane Panel */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120] p-5 sm:p-8 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: Mode Headline & 3 Execution Steps */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300">
                <Sparkles className="w-3 h-3" />
                <span>{activeMode.badge}</span>
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2.5">
                {activeMode.headline}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-normal">
                {activeMode.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeMode.steps.map((step) => (
                <div
                  key={step.label}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                      {step.label}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {step.metric}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Execution Stream Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden shadow-xl">
              <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 truncate">
                  {activeMode.terminalTitle}
                </span>
              </div>
              <div className="p-4 space-y-2 font-mono text-[11px] leading-relaxed">
                {activeMode.terminalLines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      i === 0
                        ? 'text-cyan-300 font-semibold'
                        : 'text-emerald-400/95'
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>SSE Logs • AI Log Doctor • Sudo 2FA</span>
              </div>

              <Link
                href={activeMode.ctaHref}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>{activeMode.ctaLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Built-In Native Studio Capability Strip */}
        <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Interactive Console &amp; Log Doctor</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>DNS TXT Domain Verification</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>PostgreSQL / MySQL Manager</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Instant Snapshot Rollbacks</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sudo 2FA &amp; Agency Client Handover Included</span>
          </span>
        </div>
      </div>
    </div>
  );
}
