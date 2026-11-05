'use client';

import React, { useState } from 'react';
import { Terminal, Cpu, ShieldCheck, Key, Settings, CheckCircle2, Copy, Check } from 'lucide-react';

interface TechStackInfo {
  id: string;
  name: string;
  badge: string;
  runtimes: string[];
  isolation: {
    ram: string;
    cpu: string;
    entryProcesses: string;
    ioSpeed: string;
  };
  sshDetails: string;
  envConfigExample: string;
  highlights: string[];
}

const TECH_STACKS: TechStackInfo[] = [
  {
    id: 'nextjs',
    name: 'Next.js',
    badge: 'App Router & SSR',
    runtimes: ['Next.js 14.x', 'Next.js 15.x', 'Next.js 16.x', 'Node.js 18, 20 & 22 LTS'],
    isolation: {
      ram: '2 GB Dedicated LVE RAM (Developer Pro)',
      cpu: '2 Core Isolated CloudLinux CPU',
      entryProcesses: '40 Concurrent EP',
      ioSpeed: '50 MB/s Pure NVMe Throughput',
    },
    sshDetails: 'Full Jailed SSH access with Git, rsync, and npm binaries in your dedicated user shell.',
    envConfigExample: `NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/db"
NEXT_PUBLIC_APP_URL="https://myapp.com"`,
    highlights: [
      'Full support for Next.js standalone output and SSR/ISR pages',
      'Phusion Passenger auto-spawning worker threads',
      'Sharp image optimization pre-compiled on x86_64 architecture',
      'Zero local Inode waste via our rsync overwrite pipeline',
    ],
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    badge: 'Express / Fastify',
    runtimes: ['Node.js 18.x LTS', 'Node.js 20.x LTS', 'Node.js 22.x LTS', 'pnpm / yarn / npm'],
    isolation: {
      ram: '2 GB Dedicated LVE RAM',
      cpu: '2 Core Isolated CPU',
      entryProcesses: '40 Concurrent EP',
      ioSpeed: '50 MB/s NVMe',
    },
    sshDetails: 'Direct `app.js` entrypoint managed by Passenger with automatic uncaughtException recovery.',
    envConfigExample: `NODE_ENV=production
PORT=8080
JWT_SECRET="super-secret-random-key"
CORS_ORIGIN="https://myfrontend.com"`,
    highlights: [
      'WebSocket and long-polling support enabled out of the box',
      'Native C++ add-ons compiled with node-gyp on Linux x86_64',
      'Instant zero-downtime worker restarts with `touch tmp/restart.txt`',
      'CloudLinux CageFS protection preventing cross-account snooping',
    ],
  },
  {
    id: 'python',
    name: 'Python',
    badge: 'FastAPI / Django',
    runtimes: ['Python 3.10', 'Python 3.11', 'Python 3.12', 'pip & virtualenv'],
    isolation: {
      ram: '2 GB RAM',
      cpu: '2 Core Isolated CPU',
      entryProcesses: '35 EP',
      ioSpeed: '50 MB/s NVMe',
    },
    sshDetails: 'cPanel Python Selector sets up an isolated virtualenv in your home directory with full pip install.',
    envConfigExample: `PYTHONUNBUFFERED=1
SECRET_KEY="django-insecure-prod-key"
DEBUG=False
ALLOWED_HOSTS="api.domain.com"`,
    highlights: [
      'WSGI & ASGI application loaders pre-wired',
      'Support for poetry, pipenv, and standard requirements.txt',
      'Direct cron job integration with python runner binaries',
      'Pre-installed SQLite3, PostgreSQL & MySQL client libraries',
    ],
  },
  {
    id: 'php',
    name: 'Laravel / PHP',
    badge: 'PHP 8.3 & OPcache',
    runtimes: ['PHP 8.1', 'PHP 8.2', 'PHP 8.3', 'Composer 2.x'],
    isolation: {
      ram: '2 GB RAM',
      cpu: '2 Core Isolated CPU',
      entryProcesses: '40 EP',
      ioSpeed: '50 MB/s NVMe',
    },
    sshDetails: 'Global `composer` command available in SSH. Artisan commands run at full native speed.',
    envConfigExample: `APP_NAME="Production App"
APP_ENV=production
APP_KEY="base64:generated-key="
APP_DEBUG=false
APP_URL="https://example.com"`,
    highlights: [
      'LiteSpeed Web Server with LSAPI engine outperforming PHP-FPM by 200%',
      'Hardware-accelerated OPcache with JIT compiler active',
      'Automated `artisan config:cache` and `artisan route:cache` pipelines',
      'Redis object caching available for session & queue management',
    ],
  },
  {
    id: 'static',
    name: 'Static / Astro',
    badge: 'Edge-Cached Assets',
    runtimes: ['Pure HTML5, CSS3, JS', 'React / Vue / Astro / Svelte Static Export'],
    isolation: {
      ram: '1 GB RAM pool',
      cpu: '1 Core',
      entryProcesses: '20 EP',
      ioSpeed: '25 MB/s NVMe',
    },
    sshDetails: 'Deploy directly to public_html/ using GitHub Actions or rsync.',
    envConfigExample: `PUBLIC_API_URL="https://api.yourdomain.com"
SITE_TITLE="Modern Agency"`,
    highlights: [
      'Sub-20ms TTFB directly cached by LiteSpeed Enterprise web server',
      'Free HTTP/3 and QUIC transport protocol enabled',
      'Gzip & Brotli automatic pre-compression',
      'Custom error pages and .htaccess redirect control',
    ],
  },
];

export default function TechStackTabs() {
  const [activeTabId, setActiveTabId] = useState<string>('nextjs');
  const [copied, setCopied] = useState(false);

  const currentStack = TECH_STACKS.find((s) => s.id === activeTabId) || TECH_STACKS[0];

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(currentStack.envConfigExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full transition-colors duration-200">
      {/* Switchable Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pb-6 border-b border-slate-200 dark:border-white/[0.08]">
        {TECH_STACKS.map((stack) => (
          <button
            key={stack.id}
            type="button"
            onClick={() => setActiveTabId(stack.id)}
            className={`flex items-center gap-2 h-9 px-3.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTabId === stack.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
            }`}
          >
            <span>{stack.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activeTabId === stack.id
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
              }`}
            >
              {stack.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content Panel */}
      <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Isolation & Features */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1 font-bold">
              Runtime &amp; Environment
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
              {currentStack.name} CloudLinux Specification
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 font-normal">
              Supported Engines: {currentStack.runtimes.join(' • ')}
            </p>
          </div>

          {/* 4 Hardware Quotas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/50 shadow-xs">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-zinc-400 mb-1.5" />
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">CPU Allocation</div>
              <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 mt-0.5">{currentStack.isolation.cpu}</div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/50 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-zinc-400 mb-1.5" />
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Dedicated RAM</div>
              <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 mt-0.5">{currentStack.isolation.ram}</div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/50 shadow-xs">
              <Settings className="w-4 h-4 text-indigo-600 dark:text-zinc-400 mb-1.5" />
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Entry Processes</div>
              <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 mt-0.5">{currentStack.isolation.entryProcesses}</div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/50 shadow-xs">
              <Terminal className="w-4 h-4 text-cyan-600 dark:text-zinc-400 mb-1.5" />
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">NVMe I/O Speed</div>
              <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 mt-0.5">{currentStack.isolation.ioSpeed}</div>
            </div>
          </div>

          {/* Shell & SSH Notice */}
          <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-zinc-900/50 border border-blue-100 dark:border-white/[0.08] flex items-start gap-3">
            <Key className="w-4 h-4 text-blue-600 dark:text-zinc-300 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-zinc-400 leading-relaxed">
              <strong className="text-slate-900 dark:text-zinc-200 font-semibold">Jailed Shell Capability: </strong>
              {currentStack.sshDetails}
            </div>
          </div>

          {/* Key Architecture Highlights */}
          <div className="space-y-2.5">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
              Pipeline Advantages
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentStack.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-white/[0.06] text-xs text-slate-700 dark:text-zinc-300 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Copyable .env / Config Snippet */}
        <div className="lg:col-span-5 w-full">
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-900 dark:bg-zinc-950 overflow-hidden shadow-md">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 dark:bg-zinc-900/60 border-b border-slate-700 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-[11px] font-mono text-slate-300 dark:text-zinc-400 ml-1">.env.production</span>
              </div>
              <button
                type="button"
                onClick={handleCopyEnv}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-slate-700 hover:bg-slate-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[11px] font-mono text-white transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-300" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 font-mono text-xs text-emerald-400 dark:text-zinc-300 overflow-x-auto leading-relaxed">
              <pre className="text-slate-200">{currentStack.envConfigExample}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
