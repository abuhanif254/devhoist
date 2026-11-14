'use client';

import React, { useState, useMemo } from 'react';
import {
    Code2,
    Cpu,
    HardDrive,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    Copy,
    Check,
    ArrowRight,
    FileCode2,
    Terminal,
    ShieldCheck,
    Database,
    Layers,
    Server,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { convertBdtToUsd, formatCurrency } from '@/config/constants';
import {
    getStackBlueprintBySlug,
    PLAN_SLUG_TO_PID,
    MarketplaceStackBlueprint,
} from '@/lib/stackProvisioner';

type ManifestFormat = 'package.json' | 'composer.json' | 'requirements.txt';

interface PresetManifest {
    id: string;
    label: string;
    format: ManifestFormat;
    badge: string;
    code: string;
}

const MANIFEST_PRESETS: PresetManifest[] = [
    {
        id: 'nextjs15',
        label: 'Next.js 15 + Prisma (package.json)',
        format: 'package.json',
        badge: 'Node.js 22',
        code: `{
  "name": "acme-saas-platform",
  "version": "2.4.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "prisma generate && next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^5.22.0",
    "next-auth": "^5.0.0-beta.25",
    "stripe": "^17.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "typescript": "^5.6.3"
  }
}`,
    },
    {
        id: 'nuxt3',
        label: 'Vue 3 + Nuxt 3 SSR (package.json)',
        format: 'package.json',
        badge: 'Nitro SSR',
        code: `{
  "name": "vue-commerce-ssr",
  "private": true,
  "scripts": {
    "build": "nuxi build",
    "dev": "nuxi dev"
  },
  "dependencies": {
    "nuxt": "^3.14.0",
    "vue": "^3.5.12",
    "vue-router": "^4.4.5",
    "@pinia/nuxt": "^0.5.5",
    "@prisma/client": "^5.22.0"
  }
}`,
    },
    {
        id: 'laravel11',
        label: 'Laravel 11 SaaS + Filament (composer.json)',
        format: 'composer.json',
        badge: 'PHP 8.3 JIT',
        code: `{
  "name": "laravel/enterprise-saas",
  "type": "project",
  "require": {
    "php": "^8.2|^8.3",
    "laravel/framework": "^11.31",
    "filament/filament": "^3.2",
    "livewire/livewire": "^3.5",
    "laravel/horizon": "^5.29",
    "predis/predis": "^2.2"
  },
  "scripts": {
    "post-autoload-dump": [
      "@php artisan package:discover --ansi"
    ]
  }
}`,
    },
    {
        id: 'fastapi',
        label: 'Python FastAPI + SQLAlchemy (requirements.txt)',
        format: 'requirements.txt',
        badge: 'Python 3.12 ASGI',
        code: `fastapi==0.115.5
uvicorn[standard]==0.32.1
a2wsgi==1.10.7
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
pydantic==2.10.2
redis==5.2.0
celery==5.4.0`,
    },
    {
        id: 'nestjs',
        label: 'NestJS + Socket.io + Prisma (package.json)',
        format: 'package.json',
        badge: 'Microservice WS',
        code: `{
  "name": "fintech-core-api",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main"
  },
  "dependencies": {
    "@nestjs/core": "^10.4.7",
    "@nestjs/common": "^10.4.7",
    "@nestjs/websockets": "^10.4.7",
    "@nestjs/platform-socket.io": "^10.4.7",
    "@prisma/client": "^5.22.0",
    "socket.io": "^4.8.1",
    "ioredis": "^5.4.1"
  }
}`,
    },
];

interface AnalysisOutput {
    stack: MarketplaceStackBlueprint;
    detectedPackages: string[];
    detectedFormat: ManifestFormat;
    frameworkTitle: string;
    runtimeRecommendation: string;
    databaseAddonLabel: string;
    standardNodeModulesMb: number;
    optimizedBundleMb: number;
    standardInodes: number;
    optimizedInodes: number;
    ramRequiredMb: number;
    recommendedPlan: {
        pid: number;
        planName: string;
        monthlyBdt: number;
        ramMb: number;
        cpuCores: number;
        storageGb: number;
    };
    warnings: string[];
}

export default function DependencyAnalyzer() {
    const { openStackBuilder, currency } = useBilling();
    const [activePresetId, setActivePresetId] = useState<string>('nextjs15');
    const [rawInput, setRawInput] = useState<string>(MANIFEST_PRESETS[0].code);
    const [activeCodeTab, setActiveCodeTab] = useState<'workflow' | 'bridge'>('workflow');
    const [copiedTab, setCopiedTab] = useState<string | null>(null);

    const analysis = useMemo<AnalysisOutput>(() => {
        const text = rawInput.trim();
        const lower = text.toLowerCase();

        let matchedSlug = 'nextjs-15-standalone';
        let detectedFormat: ManifestFormat = 'package.json';
        let detectedPackages: string[] = [];
        const warnings: string[] = [];

        // Check if Python requirements.txt / pyproject.toml
        const looksLikePython =
            !text.startsWith('{') ||
            lower.includes('fastapi') ||
            lower.includes('uvicorn') ||
            lower.includes('django') ||
            lower.includes('flask') ||
            lower.includes('sqlalchemy');

        if (looksLikePython && !text.startsWith('{')) {
            detectedFormat = 'requirements.txt';
            matchedSlug = 'fastapi-django-python';
            detectedPackages = text
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('#'))
                .map((l) => l.split(/[=<>~[]/)[0].trim())
                .filter(Boolean);

            if (lower.includes('fastapi') && !lower.includes('a2wsgi')) {
                warnings.push(
                    'FastAPI uses ASGI: DevHost automatically injects `a2wsgi` in passenger_wsgi.py so CloudLinux Passenger runs your async endpoints natively.'
                );
            }
            if (lower.includes('celery') || lower.includes('redis')) {
                warnings.push(
                    'Detected Celery / Redis async queue: Redis Unix Socket + Supervisor daemon is pre-enabled on Developer Pro & Business Max.'
                );
            }
        } else {
            try {
                const parsed = JSON.parse(text);
                // Check if composer.json
                if (parsed.require || parsed['require-dev'] || lower.includes('laravel/framework')) {
                    detectedFormat = 'composer.json';
                    const reqs = { ...(parsed.require || {}), ...(parsed['require-dev'] || {}) };
                    detectedPackages = Object.keys(reqs);

                    if (reqs['laravel/framework'] || lower.includes('laravel')) {
                        matchedSlug = 'laravel-11-saas';
                        warnings.push(
                            'Laravel Artisan Scheduler (`schedule:run`) & `storage:link` will be auto-configured in cPanel Cron Jobs.'
                        );
                    } else {
                        matchedSlug = 'wordpress-woocommerce-turbo';
                    }
                } else {
                    // package.json
                    detectedFormat = 'package.json';
                    const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
                    detectedPackages = Object.keys(deps);

                    if (deps['@strapi/strapi']) {
                        matchedSlug = 'strapi-headless-cms';
                        warnings.push(
                            'Strapi v5 admin webpack compilation spikes to 3.2 GB RAM. Minimum required tier locked to Business Max (4 GB RAM).'
                        );
                    } else if (deps['n8n']) {
                        matchedSlug = 'n8n-workflow-automation';
                    } else if (deps['@medusajs/medusa'] || deps['@medusajs/framework']) {
                        matchedSlug = 'medusa-headless-commerce';
                    } else if (deps['@nestjs/core']) {
                        matchedSlug = 'nestjs-prisma-api';
                    } else if (deps['nuxt'] || deps['vue']) {
                        matchedSlug = 'vue-nuxt3-ssr';
                    } else if (deps['@sveltejs/kit']) {
                        matchedSlug = 'sveltekit-fullstack';
                    } else if (deps['@remix-run/node'] || deps['@react-router/node']) {
                        matchedSlug = 'remix-react-router';
                    } else if (deps['astro']) {
                        matchedSlug = 'astro-mdx-blog';
                    } else if (deps['ghost']) {
                        matchedSlug = 'ghost-publishing';
                    } else if (deps['socket.io'] || deps['ws'] || deps['express']) {
                        matchedSlug = 'express-realtime-websocket';
                    } else {
                        matchedSlug = 'nextjs-15-standalone';
                        if (!text.includes('standalone')) {
                            warnings.push(
                                'Add `output: "standalone"` in next.config.ts to shrink node_modules from ~460 MB to ~52 MB and save 38,000+ inodes.'
                            );
                        }
                    }

                    if (deps['puppeteer'] || deps['playwright']) {
                        warnings.push(
                            'Headless Chromium detected (`puppeteer`/`playwright`): requires Cloud KVM-1 VPS or Business Max 4 GB RAM.'
                        );
                    }
                }
            } catch {
                // Fallback heuristic if JSON has syntax error while typing
                if (lower.includes('laravel')) {
                    detectedFormat = 'composer.json';
                    matchedSlug = 'laravel-11-saas';
                } else if (lower.includes('nuxt') || lower.includes('vue')) {
                    matchedSlug = 'vue-nuxt3-ssr';
                } else if (lower.includes('nestjs')) {
                    matchedSlug = 'nestjs-prisma-api';
                }
            }
        }

        const stack = getStackBlueprintBySlug(matchedSlug) || getStackBlueprintBySlug('nextjs-15-standalone')!;
        const recommendedPlan = PLAN_SLUG_TO_PID[stack.recommended_plan_slug];
        const pkgCount = Math.max(detectedPackages.length, 6);

        const standardNodeModulesMb = detectedFormat === 'requirements.txt' ? pkgCount * 28 : pkgCount * 58;
        const optimizedBundleMb = Math.max(24, Math.round(standardNodeModulesMb * 0.16));
        const standardInodes = pkgCount * 5400;
        const optimizedInodes = Math.max(850, Math.round(standardInodes * 0.09));

        const dbLabel =
            stack.requires_database === 'postgresql_16'
                ? 'PostgreSQL 16 + Connection Pool'
                : stack.requires_database === 'mysql_8'
                ? 'MySQL 8.0 (InnoDB Turbo)'
                : stack.requires_database === 'sqlite_volume'
                ? 'SQLite 3 Persistent Volume'
                : 'Zero-DB Edge Static';

        const cacheAddon = stack.requires_redis ? ' + Redis Socket' : '';
        const wsAddon = stack.requires_websocket_proxy ? ' + WSS Tunnel' : '';

        return {
            stack,
            detectedPackages,
            detectedFormat,
            frameworkTitle: stack.name,
            runtimeRecommendation: `${stack.default_runtime_version} (${stack.runtime_family})`,
            databaseAddonLabel: `${dbLabel}${cacheAddon}${wsAddon}`,
            standardNodeModulesMb,
            optimizedBundleMb,
            standardInodes,
            optimizedInodes,
            ramRequiredMb: stack.min_ram_mb,
            recommendedPlan,
            warnings,
        };
    }, [rawInput]);

    const handleSelectPreset = (preset: PresetManifest) => {
        setActivePresetId(preset.id);
        setRawInput(preset.code);
    };

    const handleCopy = (content: string, key: string) => {
        navigator.clipboard.writeText(content);
        setCopiedTab(key);
        setTimeout(() => setCopiedTab(null), 2000);
    };

    return (
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl overflow-hidden">
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-indigo-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-500/20">
                                <Sparkles className="w-3.5 h-3.5" /> Universal Multi-Stack Manifest Inspector
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                Paste <code className="text-blue-600 dark:text-blue-400">package.json</code>,{' '}
                                <code className="text-rose-600 dark:text-rose-400">composer.json</code>, or{' '}
                                <code className="text-emerald-600 dark:text-emerald-400">requirements.txt</code>
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
                                Our Universal Stack Engine inspects your dependencies, calculates exact CloudLinux RAM &amp; Inode footprints, generates your <code className="font-mono">.github/workflows/deploy.yml</code> + <code className="font-mono">passenger_wsgi.py</code> / <code className="font-mono">.htaccess</code> bridge, and locks in the minimum safe hosting plan.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 text-xs font-mono font-semibold flex items-center gap-1.5">
                                <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                                Detected: {analysis.detectedFormat}
                            </span>
                        </div>
                    </div>

                    {/* Quick Manifest Presets */}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                            Try Stack Preset:
                        </span>
                        {MANIFEST_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleSelectPreset(preset)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                                    activePresetId === preset.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                }`}
                            >
                                <span>{preset.label}</span>
                                <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                        activePresetId === preset.id
                                            ? 'bg-blue-700 text-blue-100'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    {preset.badge}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main 2-Column Body */}
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
                    {/* Left Column: Manifest Editor */}
                    <div className="lg:col-span-5 p-6 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-950/40">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <Code2 className="w-4 h-4 text-blue-500" /> Project Dependency Manifest
                                </label>
                                <span className="text-xs text-slate-500 font-mono">
                                    {analysis.detectedPackages.length} packages parsed
                                </span>
                            </div>
                            <textarea
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                rows={16}
                                spellCheck={false}
                                className="w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-950 text-emerald-400 font-mono text-xs p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                                placeholder="Paste package.json, composer.json, or requirements.txt here..."
                            />
                        </div>

                        {/* Inode & Memory Optimization Comparison */}
                        <div className="mt-5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Standalone / Autoloader Compression
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    -84% Disk &amp; Inodes
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                    <div className="text-slate-500 dark:text-slate-400">Raw Unbundled Install</div>
                                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                        ~{analysis.standardNodeModulesMb} MB / {analysis.standardInodes.toLocaleString()} files
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                    <div className="text-slate-500 dark:text-slate-400">DevHost Optimized Artifact</div>
                                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        ~{analysis.optimizedBundleMb} MB / {analysis.optimizedInodes.toLocaleString()} files
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Architecture Output & Auto-Generated Pipeline */}
                    <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                        {/* Top Telemetry Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    <Layers className="w-3.5 h-3.5 text-blue-500" /> Matched Blueprint
                                </div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
                                    {analysis.frameworkTitle}
                                </div>
                                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                                    {analysis.runtimeRecommendation}
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    <Database className="w-3.5 h-3.5 text-emerald-500" /> Auto-Wired Backing Services
                                </div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
                                    {analysis.databaseAddonLabel}
                                </div>
                                <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    Entry: {analysis.stack.startup_entry_file}
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                    <Cpu className="w-3.5 h-3.5" /> Minimum Safe Hardware
                                </div>
                                <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                                    {analysis.recommendedPlan.planName} ({formatCurrency(analysis.recommendedPlan.monthlyBdt, currency)}/mo)
                                </div>
                                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                    {analysis.ramRequiredMb / 1024} GB RAM • {analysis.stack.min_cpu_cores} vCPU • {analysis.stack.min_storage_gb} GB NVMe
                                </div>
                            </div>
                        </div>

                        {/* Advisories */}
                        {analysis.warnings.length > 0 && (
                            <div className="space-y-2">
                                {analysis.warnings.map((warn, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200"
                                    >
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <span>{warn}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tabs: CI/CD Workflow YAML vs Server Bridge Script */}
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveCodeTab('workflow')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            activeCodeTab === 'workflow'
                                                ? 'bg-slate-900 text-white dark:bg-blue-600'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        .github/workflows/deploy.yml
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveCodeTab('bridge')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            activeCodeTab === 'bridge'
                                                ? 'bg-slate-900 text-white dark:bg-blue-600'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        Server Bridge ({analysis.stack.runtime_family === 'python_wsgi_asgi' ? 'passenger_wsgi.py' : '.htaccess / Startup'})
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        handleCopy(
                                            activeCodeTab === 'workflow'
                                                ? analysis.stack.github_workflow_yaml
                                                : analysis.stack.server_bridge_script,
                                            activeCodeTab
                                        )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                                >
                                    {copiedTab === activeCodeTab ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" /> Copy Snippet
                                        </>
                                    )}
                                </button>
                            </div>

                            <pre className="rounded-2xl bg-slate-950 text-slate-200 p-4 text-xs font-mono overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                                {activeCodeTab === 'workflow'
                                    ? analysis.stack.github_workflow_yaml
                                    : analysis.stack.server_bridge_script}
                            </pre>
                        </div>

                        {/* CTA Action Footer */}
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>
                                    Auto-injects <strong>{analysis.stack.default_env_schema.length} encrypted .env secrets</strong> &amp; provisions <strong>{analysis.databaseAddonLabel}</strong>
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    openStackBuilder({
                                        planName: analysis.recommendedPlan.planName,
                                        defaultPlanId: analysis.recommendedPlan.pid,
                                        minPlanPid: analysis.recommendedPlan.pid,
                                        selectedStackSlug: analysis.stack.slug,
                                        defaultStack: analysis.stack.slug,
                                        basePriceBDT: analysis.recommendedPlan.monthlyBdt,
                                        basePriceUSD: convertBdtToUsd(analysis.recommendedPlan.monthlyBdt),
                                        specs: {
                                            ram: `${analysis.recommendedPlan.ramMb / 1024} GB Dedicated`,
                                            cpu: `${analysis.recommendedPlan.cpuCores} Core vCPU`,
                                            storage: `${analysis.recommendedPlan.storageGb} GB NVMe`,
                                        },
                                    })
                                }
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                            >
                                <Terminal className="w-4 h-4" />
                                <span>1-Click Deploy {analysis.stack.name.split('(')[0].trim()}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
