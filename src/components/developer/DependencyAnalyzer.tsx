'use client';

import React, { useState, useMemo } from 'react';
import {
  Code2,
  Terminal,
  Cpu,
  HardDrive,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileJson,
  Zap,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';

const PRESETS = {
  nextjs: {
    label: 'Next.js 15 + Prisma + Tailwind',
    json: JSON.stringify(
      {
        name: 'my-nextjs-app',
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^15.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          '@prisma/client': '^5.10.0',
          tailwindcss: '^4.0.0',
          'lucide-react': '^0.400.0',
          zod: '^3.23.0',
        },
        devDependencies: {
          prisma: '^5.10.0',
          typescript: '^5.4.0',
          '@types/node': '^20.0.0',
          '@types/react': '^19.0.0',
        },
      },
      null,
      2
    ),
  },
  express: {
    label: 'Express + TypeScript + JWT Microservice',
    json: JSON.stringify(
      {
        name: 'backend-api',
        version: '1.0.0',
        main: 'dist/index.js',
        scripts: {
          build: 'tsc',
          start: 'node dist/index.js',
        },
        dependencies: {
          express: '^4.19.2',
          jsonwebtoken: '^9.0.2',
          cors: '^2.8.5',
          dotenv: '^16.4.5',
          bcrypt: '^5.1.1',
        },
        devDependencies: {
          typescript: '^5.4.5',
          '@types/express': '^4.17.21',
          '@types/node': '^20.12.7',
        },
      },
      null,
      2
    ),
  },
  laravel: {
    label: 'Laravel 11 Composer API',
    json: JSON.stringify(
      {
        name: 'laravel/laravel',
        type: 'project',
        description: 'The skeleton application for the Laravel framework.',
        require: {
          'php': '^8.2',
          'laravel/framework': '^11.0',
          'laravel/sanctum': '^4.0',
          'laravel/tinker': '^2.9',
        },
        'require-dev': {
          'fakerphp/faker': '^1.23',
          'mockery/mockery': '^1.6',
          'nunomaduro/collision': '^8.1',
          'phpunit/phpunit': '^11.0',
        },
      },
      null,
      2
    ),
  },
};

interface AuditResult {
  valid: boolean;
  error: string | null;
  isComposer: boolean;
  depCount: number;
  detectedFrameworks: string[];
  naiveMB: number;
  naiveInodes: number;
  smartMB: number;
  smartInodes: number;
  recommendedPlan: {
    pid: number;
    name: string;
    priceBDT: number;
    priceUSD: number;
    ram: string;
    cpu: string;
    reason: string;
  };
  generatedYaml: string;
  startScript: string;
}

const DEFAULT_EMPTY_AUDIT: AuditResult = {
  valid: false,
  error: 'Paste or select a preset to analyze.',
  isComposer: false,
  depCount: 0,
  detectedFrameworks: [],
  naiveMB: 0,
  naiveInodes: 0,
  smartMB: 0,
  smartInodes: 0,
  recommendedPlan: {
    pid: 2,
    name: 'Developer Pro Cloud',
    priceBDT: 450,
    priceUSD: 3.75,
    ram: '2 GB Isolated RAM',
    cpu: '2 vCPU Cores',
    reason: 'Default recommended plan.',
  },
  generatedYaml: '',
  startScript: '',
};

export default function DependencyAnalyzer() {
  const [jsonInput, setJsonInput] = useState<string>(PRESETS.nextjs.json);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const { openStackBuilder } = useBilling();

  // Audit calculation engine
  const audit = useMemo<AuditResult>(() => {
    try {
      if (!jsonInput.trim()) {
        return DEFAULT_EMPTY_AUDIT;
      }

      const parsed = JSON.parse(jsonInput);
      const isComposer = !!parsed.require;
      const deps = isComposer ? parsed.require || {} : parsed.dependencies || {};
      const devDeps = isComposer ? parsed['require-dev'] || {} : parsed.devDependencies || {};

      const depKeys = Object.keys(deps);
      const devDepKeys = Object.keys(devDeps);
      const totalKeys = [...depKeys, ...devDepKeys];
      const depCount = totalKeys.length;

      // Detection
      const isNext = totalKeys.some((k) => k.includes('next'));
      const isPrisma = totalKeys.some((k) => k.includes('prisma'));
      const isExpress = totalKeys.some((k) => k.includes('express') || k.includes('fastify'));
      const isNest = totalKeys.some((k) => k.includes('@nestjs'));
      const isReact = totalKeys.some((k) => k.includes('react'));

      const detectedFrameworks: string[] = [];
      if (isNext) detectedFrameworks.push('Next.js (App Router)');
      if (isExpress) detectedFrameworks.push('Node.js / Express');
      if (isNest) detectedFrameworks.push('NestJS Enterprise');
      if (isPrisma) detectedFrameworks.push('Prisma ORM');
      if (isComposer) detectedFrameworks.push('Laravel / PHP Composer');
      if (detectedFrameworks.length === 0 && isReact) detectedFrameworks.push('React SPA');
      if (detectedFrameworks.length === 0) detectedFrameworks.push('Modern Web App');

      let startScript = parsed.scripts?.start || 'node index.js';

      // Memory & Inode math formulas
      const naiveMB = depCount * 14;
      const naiveInodes = depCount * 1650;
      const smartMB = Math.round(naiveMB * 0.22);
      const smartInodes = Math.round(naiveInodes * 0.12);

      // Plan Recommendation logic
      let recommendedPlan = {
        pid: 2,
        name: 'Developer Pro Cloud',
        priceBDT: 450,
        priceUSD: 3.75,
        ram: '2 GB Isolated RAM',
        cpu: '2 vCPU Cores',
        reason: 'Optimal for Next.js, Express, and Prisma builds with standalone output.',
      };

      if (isNest || depCount > 25) {
        recommendedPlan = {
          pid: 3,
          name: 'Business Max Cloud',
          priceBDT: 900,
          priceUSD: 7.5,
          ram: '4 GB Isolated RAM',
          cpu: '2 Cores (High Freq)',
          reason: 'High dependency count requires 4 GB RAM to prevent build out-of-memory errors.',
        };
      } else if (depCount <= 8 && !isNext && !isNest && !isPrisma) {
        recommendedPlan = {
          pid: 1,
          name: 'Starter Pack',
          priceBDT: 200,
          priceUSD: 1.67,
          ram: '1 GB RAM',
          cpu: '1 Core',
          reason: 'Lightweight static or micro-backend fits comfortably within 1 GB RAM.',
        };
      }

      // Generate dynamic GitHub Actions YAML
      const buildCommand = parsed.scripts?.build ? 'npm run build' : 'echo "No build script"';

      const generatedYaml = `name: Optimized Deployment (${detectedFrameworks[0] || 'Web App'})

on:
  push:
    branches: [ "main" ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install & Compile (${detectedFrameworks[0] || 'App'})
        run: |
          npm ci
          ${buildCommand}

      - name: In-Place Overwrite SSH Sync (80% Disk Saved)
        uses: appleboy/scp-action@master
        with:
          host: \${{ secrets.CPANEL_HOST }}
          username: \${{ secrets.CPANEL_USER }}
          key: \${{ secrets.CPANEL_SSH_KEY }}
          port: 22
          source: ".next/standalone/*,public/*,.env.production"
          target: "apps/my-app"

      - name: Instant Passenger Worker Reload (0.4s)
        uses: appleboy/ssh-action@master
        with:
          host: \${{ secrets.CPANEL_HOST }}
          username: \${{ secrets.CPANEL_USER }}
          key: \${{ secrets.CPANEL_SSH_KEY }}
          port: 22
          script: |
            touch apps/my-app/tmp/restart.txt
            echo "✓ Zero-Downtime Deployment Finished"`;

      return {
        valid: true,
        error: null,
        isComposer,
        depCount,
        detectedFrameworks,
        naiveMB,
        naiveInodes,
        smartMB,
        smartInodes,
        recommendedPlan,
        generatedYaml,
        startScript,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid JSON format';
      return {
        valid: false,
        error: `JSON Syntax Error: ${errorMsg}`,
        isComposer: false,
        depCount: 0,
        detectedFrameworks: [],
        naiveMB: 0,
        naiveInodes: 0,
        smartMB: 0,
        smartInodes: 0,
        recommendedPlan: {
          pid: 2,
          name: 'Developer Pro Cloud',
          priceBDT: 450,
          priceUSD: 3.75,
          ram: '2 GB Isolated RAM',
          cpu: '2 vCPU Cores',
          reason: 'Default recommended plan.',
        },
        generatedYaml: '',
        startScript: '',
      };
    }
  }, [jsonInput]);

  const copyYamlToClipboard = () => {
    if (!audit.generatedYaml) return;
    navigator.clipboard.writeText(audit.generatedYaml);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  return (
    <div className="w-full space-y-6 transition-colors duration-200">
      {/* Preset Buttons Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/[0.08] pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
            <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" />
            <span>Live Dependency Architect</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-zinc-100 mt-1">
            Analyze Your Project Architecture
          </h3>
        </div>

        {/* Quick Load Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-500 dark:text-zinc-500 text-[11px] mr-1">Presets:</span>
          {Object.entries(PRESETS).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => setJsonInput(val.json)}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white hover:border-blue-400 dark:hover:border-white/25 transition-colors cursor-pointer text-[11px] font-medium shadow-xs"
            >
              {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Code Editor on Left, Audit Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Box */}
        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-400 px-1">
            <span className="flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-500" />
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Paste package.json or composer.json</span>
            </span>
            <span className="text-slate-400 dark:text-zinc-500 text-[11px]">Real-time JSON linting</span>
          </div>

          <div className="relative rounded-xl border border-slate-300 dark:border-white/10 bg-slate-900 dark:bg-zinc-950/90 overflow-hidden shadow-inner">
            <textarea
              rows={14}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full p-4 font-mono text-xs text-slate-200 dark:text-zinc-200 bg-transparent focus:outline-hidden resize-none leading-relaxed selection:bg-blue-600"
              placeholder='Paste {"dependencies": { ... }} here...'
              spellCheck={false}
            />
          </div>

          {audit.error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{audit.error}</span>
            </div>
          )}
        </div>

        {/* Audit Results Box */}
        <div className="lg:col-span-6 space-y-5">
          {audit.valid ? (
            <div className="space-y-4">
              {/* Detected Stack Banner */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-2 shadow-sm">
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-emerald-400 font-bold">
                  Detected Stack &amp; Architecture
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {audit.detectedFrameworks.map((fw, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-200 flex items-center gap-1.5 font-semibold"
                    >
                      <Sparkles className="w-3 h-3 text-blue-600 dark:text-emerald-400" />
                      <span>{fw}</span>
                    </span>
                  ))}
                  <span className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-mono">
                    {audit.depCount} Total Dependencies
                  </span>
                </div>
              </div>

              {/* Memory & Inode Savings Comparison */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.06] space-y-1">
                  <div className="text-slate-500 dark:text-zinc-500 text-[11px]">Unoptimized Build:</div>
                  <div className="text-red-600 dark:text-red-400 font-bold">{audit.naiveMB} MB Disk</div>
                  <div className="text-slate-500 dark:text-zinc-500 text-[10px]">~{audit.naiveInodes.toLocaleString()} Inodes</div>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-zinc-900/80 border border-emerald-200 dark:border-emerald-500/20 space-y-1">
                  <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">DevHost Smart Pipeline:</div>
                  <div className="text-slate-900 dark:text-zinc-100 font-bold">{audit.smartMB} MB Disk (78% Saved)</div>
                  <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">~{audit.smartInodes.toLocaleString()} Inodes (88% Saved)</div>
                </div>
              </div>

              {/* Recommended Plan Card */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/15 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-400 font-bold">
                      Recommended Hardware Tier
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                      {audit.recommendedPlan.name}
                    </h4>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-lg font-bold text-slate-900 dark:text-zinc-50">
                      ৳{audit.recommendedPlan.priceBDT}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-500">/mo</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 font-normal leading-relaxed">
                  {audit.recommendedPlan.reason}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    openStackBuilder({
                      pid: audit.recommendedPlan.pid,
                      planName: audit.recommendedPlan.name,
                      basePriceMonthlyBDT: audit.recommendedPlan.priceBDT,
                      basePriceMonthlyUSD: audit.recommendedPlan.priceUSD,
                      specs: {
                        ram: audit.recommendedPlan.ram,
                        cpu: audit.recommendedPlan.cpu,
                        storage: 'Pure PCIe Gen4 NVMe',
                      },
                    })
                  }
                  className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Deploy {audit.recommendedPlan.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Generated CI/CD YAML Script */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400">
                  <span className="font-semibold">Tailored .github/workflows/deploy.yml</span>
                  <button
                    type="button"
                    onClick={copyYamlToClipboard}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-zinc-300 hover:text-blue-700 dark:hover:text-white cursor-pointer font-medium"
                  >
                    {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedYaml ? 'Copied YAML' : 'Copy CI/CD Script'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono text-slate-200 dark:text-zinc-300 overflow-x-auto max-h-40 leading-relaxed shadow-inner">
                  {audit.generatedYaml}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-slate-500 dark:text-zinc-500 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-zinc-950/50">
              Fix JSON errors on the left to see architecture audit &amp; resource forecast.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
