'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import DependencyAnalyzer from '@/components/developer/DependencyAnalyzer';
import { useBilling } from '@/context/BillingContext';
import {
    UNIVERSAL_MARKETPLACE_STACKS,
    PLAN_SLUG_TO_PID,
    MarketplaceStackBlueprint,
    StackCategory,
} from '@/lib/stackProvisioner';
import {
    Search,
    Sparkles,
    Cpu,
    HardDrive,
    Database,
    Terminal,
    Code2,
    Layers,
    Rocket,
    CheckCircle2,
    Copy,
    Check,
    X,
    ArrowRight,
    ShieldCheck,
    Server,
    Globe,
    Key,
    GitBranch,
    Zap,
    Activity,
    FolderGit2,
} from 'lucide-react';

const CATEGORY_TABS: Array<{ id: 'All' | StackCategory; label: string }> = [
    { id: 'All', label: 'All Stacks (16)' },
    { id: 'Full-Stack JS & Vue', label: 'Full-Stack JS & Vue' },
    { id: 'PHP, Laravel & CMS', label: 'PHP, Laravel & CMS' },
    { id: 'API, Python & WebSockets', label: 'API, Python & WebSockets' },
    { id: 'AI, Automation & Monitors', label: 'AI, Automation & Monitors' },
];

type BlueprintModalTab = 'architecture' | 'cicd' | 'bridge' | 'env';

export default function MarketplaceClient() {
    const { openStackBuilder, formatPrice } = useBilling();

    const [stacks, setStacks] = useState<MarketplaceStackBlueprint[]>(UNIVERSAL_MARKETPLACE_STACKS);
    const [selectedCategory, setSelectedCategory] = useState<'All' | StackCategory>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [inspectedStack, setInspectedStack] = useState<MarketplaceStackBlueprint | null>(null);
    const [modalTab, setModalTab] = useState<BlueprintModalTab>('architecture');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Sync live blueprints from Supabase via /api/hosting/install-stack
    useEffect(() => {
        let active = true;
        fetch('/api/hosting/install-stack')
            .then((r) => r.json())
            .then((data) => {
                if (active && data?.success && Array.isArray(data.stacks) && data.stacks.length > 0) {
                    setStacks(data.stacks);
                }
            })
            .catch(() => {
                // Keep fallback UNIVERSAL_MARKETPLACE_STACKS
            });
        return () => {
            active = false;
        };
    }, []);

    const filteredStacks = useMemo(() => {
        return stacks.filter((stk) => {
            const matchesCategory =
                selectedCategory === 'All' || stk.category === selectedCategory;
            if (!matchesCategory) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                stk.name.toLowerCase().includes(q) ||
                stk.slug.toLowerCase().includes(q) ||
                stk.tagline_en.toLowerCase().includes(q) ||
                stk.default_runtime_version.toLowerCase().includes(q) ||
                stk.category.toLowerCase().includes(q) ||
                stk.features.some((f) => f.toLowerCase().includes(q))
            );
        });
    }, [stacks, selectedCategory, searchQuery]);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleDeployStack = (stack: MarketplaceStackBlueprint) => {
        const planInfo = PLAN_SLUG_TO_PID[stack.recommended_plan_slug] || PLAN_SLUG_TO_PID['developer-pro'];
        openStackBuilder({
            planName: planInfo.planName,
            defaultPlanId: planInfo.pid,
            minPlanPid: planInfo.pid,
            selectedStackSlug: stack.slug,
            defaultStack: stack.slug,
            basePriceBDT: planInfo.monthlyBdt,
            basePriceUSD: Number((planInfo.monthlyBdt / 120).toFixed(2)),
            specs: {
                ram: `${planInfo.ramMb / 1024} GB Dedicated`,
                cpu: `${planInfo.cpuCores} Core vCPU`,
                storage: `${planInfo.storageGb} GB NVMe`,
            },
        });
    };

    const getDatabaseBadgeLabel = (req: MarketplaceStackBlueprint['requires_database']) => {
        if (req === 'postgresql_16') return 'PostgreSQL 16';
        if (req === 'mysql_8') return 'MySQL 8.0';
        if (req === 'sqlite_volume') return 'SQLite Volume';
        return 'Zero-DB Static';
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <Navbar />

            <main className="flex-1 pt-24 pb-20">
                {/* Hero Banner */}
                <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-12">
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 sm:p-12 shadow-xl relative overflow-hidden">
                        <div className="max-w-3xl relative z-10">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
                                <Sparkles className="w-3.5 h-3.5" /> Universal Multi-Stack Deployment Engine
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                                16 Production-Hardened Stacks.{' '}
                                <span className="text-blue-600 dark:text-blue-400">Zero Manual Server Setup.</span>
                            </h1>
                            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
                                Every blueprint automatically configures CloudLinux Passenger / LiteSpeed runtimes, provisions isolated{' '}
                                <strong>PostgreSQL 16</strong> or <strong>MySQL 8.0</strong> databases, encrypts{' '}
                                <strong>AES-256-GCM .env secrets</strong>, generates your{' '}
                                <code className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    passenger_wsgi.py
                                </code>{' '}
                                / WebSocket bridges, and wires zero-downtime GitHub Actions CI/CD.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Node.js 20/22 LTS &amp; Nitro SSR
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> PHP 8.3 JIT + Laravel Scheduler Cron
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Python 3.12 ASGI/WSGI Bridge
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Native WebSockets (wss://)
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Filter Bar & Instant Search */}
                <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-8">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        {/* Category Tabs */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {CATEGORY_TABS.map((tab) => {
                                const active = selectedCategory === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(tab.id)}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            active
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search Input */}
                        <div className="relative min-w-[280px]">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search Next.js, Vue, Laravel, FastAPI, n8n..."
                                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </section>

                {/* 16 Stacks Grid */}
                <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredStacks.map((stack) => {
                            const planInfo =
                                PLAN_SLUG_TO_PID[stack.recommended_plan_slug] ||
                                PLAN_SLUG_TO_PID['developer-pro'];
                            const formattedPrice = formatPrice(
                                planInfo.monthlyBdt,
                                Number((planInfo.monthlyBdt / 120).toFixed(2))
                            );

                            return (
                                <div
                                    key={stack.slug}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-sm hover:shadow-xl hover:border-blue-500/40 transition-all flex flex-col justify-between group"
                                >
                                    <div>
                                        {/* Top Badges */}
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[11px] font-bold">
                                                {stack.category}
                                            </span>
                                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                                {stack.popularity_installs.toLocaleString()} deploys
                                            </span>
                                        </div>

                                        {/* Stack Title & Tagline */}
                                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {stack.name}
                                        </h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                                            {stack.tagline_en}
                                        </p>

                                        {/* Technical Pills */}
                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                <Terminal className="w-3 h-3 text-blue-500" />
                                                {stack.default_runtime_version}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                <Database className="w-3 h-3 text-emerald-500" />
                                                {getDatabaseBadgeLabel(stack.requires_database)}
                                            </span>
                                            {stack.requires_redis && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-semibold">
                                                    Redis
                                                </span>
                                            )}
                                            {stack.requires_websocket_proxy && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[11px] font-mono font-semibold">
                                                    WSS Proxy
                                                </span>
                                            )}
                                        </div>

                                        {/* Hardware Requirements Box */}
                                        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-[10px] uppercase text-slate-400 font-semibold">
                                                    Min RAM
                                                </div>
                                                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                                                    {stack.min_ram_mb / 1024} GB
                                                </div>
                                            </div>
                                            <div className="border-x border-slate-200 dark:border-slate-800">
                                                <div className="text-[10px] uppercase text-slate-400 font-semibold">
                                                    vCPU
                                                </div>
                                                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                                                    {stack.min_cpu_cores} Core
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-slate-400 font-semibold">
                                                    .env Vault
                                                </div>
                                                <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                                                    {stack.default_env_schema.length} Keys
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                Min Tier: <strong className="text-slate-800 dark:text-slate-200">{planInfo.planName}</strong>
                                            </span>
                                            <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                                {formattedPrice.formatted}
                                                <span className="text-[10px] font-normal text-slate-400">/mo</span>
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setInspectedStack(stack);
                                                    setModalTab('architecture');
                                                }}
                                                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                <Code2 className="w-3.5 h-3.5 text-blue-500" />
                                                <span>View Blueprint</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDeployStack(stack)}
                                                className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                <Rocket className="w-3.5 h-3.5" />
                                                <span>1-Click Deploy</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Universal Project Manifest Analyzer */}
                <DependencyAnalyzer />
            </main>

            {/* =====================================================================
                "VIEW STACK BLUEPRINT" 4-TAB TECHNICAL MODAL
               ===================================================================== */}
            {inspectedStack && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/50">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2.5 py-0.5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                                        {inspectedStack.category}
                                    </span>
                                    <span className="text-xs font-mono text-slate-500">
                                        slug: {inspectedStack.slug}
                                    </span>
                                </div>
                                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                                    {inspectedStack.name}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {inspectedStack.tagline_bn}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setInspectedStack(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 4 Modal Navigation Tabs */}
                        <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 bg-white dark:bg-slate-900">
                            {[
                                { id: 'architecture' as BlueprintModalTab, label: '1. Architecture & Specs', icon: Layers },
                                { id: 'cicd' as BlueprintModalTab, label: '2. Auto-Generated CI/CD YAML', icon: GitBranch },
                                { id: 'bridge' as BlueprintModalTab, label: '3. Server Bridge Config', icon: Server },
                                { id: 'env' as BlueprintModalTab, label: `4. Auto-Injected .env Vault (${inspectedStack.default_env_schema.length})`, icon: Key },
                            ].map((t) => {
                                const Icon = t.icon;
                                const active = modalTab === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setModalTab(t.id)}
                                        className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                                            active
                                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Content Body */}
                        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                            {modalTab === 'architecture' && (
                                <div className="space-y-5">
                                    {/* Visual Flow Diagram */}
                                    <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
                                            Request &amp; Container Execution Pipeline
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center">
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                <div className="font-bold text-slate-900 dark:text-white">1. Cloudflare Edge</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Anycast WAF + AutoSSL</div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                <div className="font-bold text-slate-900 dark:text-white">2. Server Bridge</div>
                                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                                                    {inspectedStack.runtime_family}
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                <div className="font-bold text-slate-900 dark:text-white">3. App Runtime</div>
                                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                                                    {inspectedStack.startup_entry_file}
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                <div className="font-bold text-slate-900 dark:text-white">4. Backing Store</div>
                                                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                                                    {getDatabaseBadgeLabel(inspectedStack.requires_database)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Commands & Paths Table */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="text-slate-400 text-[10px] uppercase font-bold">Install Command</div>
                                            <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                                                {inspectedStack.install_command}
                                            </div>
                                        </div>
                                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="text-slate-400 text-[10px] uppercase font-bold">Build Command</div>
                                            <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                                                {inspectedStack.build_command}
                                            </div>
                                        </div>
                                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="text-slate-400 text-[10px] uppercase font-bold">Document Root Subpath</div>
                                            <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 mt-1">
                                                {inspectedStack.document_root_subpath}
                                            </div>
                                        </div>
                                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="text-slate-400 text-[10px] uppercase font-bold">Persistent Volume Paths</div>
                                            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                                                {inspectedStack.persistent_volume_paths.join(', ') || '/public'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalTab === 'cicd' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            Production <code className="font-mono text-blue-500">.github/workflows/deploy.yml</code>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(inspectedStack.github_workflow_yaml, 'cicd')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                                        >
                                            {copiedKey === 'cicd' ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied YAML
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" /> Copy YAML
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                                        {inspectedStack.github_workflow_yaml}
                                    </pre>
                                </div>
                            )}

                            {modalTab === 'bridge' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            Auto-Generated Server Bridge (<code className="font-mono text-blue-500">{inspectedStack.startup_entry_file}</code> / <code className="font-mono text-blue-500">.htaccess</code>)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(inspectedStack.server_bridge_script, 'bridge')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                                        >
                                            {copiedKey === 'bridge' ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied Bridge
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" /> Copy Bridge
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className="p-4 rounded-2xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                                        {inspectedStack.server_bridge_script}
                                    </pre>
                                </div>
                            )}

                            {modalTab === 'env' && (
                                <div className="space-y-3">
                                    <p className="text-slate-600 dark:text-slate-400">
                                        When this stack is deployed, <code className="font-mono">stackProvisioner.ts</code> automatically generates cryptographic secrets and encrypts them with <strong>AES-256-GCM</strong> into <code className="font-mono">project_env_variables</code>:
                                    </p>
                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-800/70 text-[11px] uppercase text-slate-500">
                                                    <th className="py-2.5 px-4">Variable Key</th>
                                                    <th className="py-2.5 px-4">Generator Rule</th>
                                                    <th className="py-2.5 px-4">Vault Encryption</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                                                {inspectedStack.default_env_schema.map((env) => (
                                                    <tr key={env.key}>
                                                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                                                            {env.key}
                                                        </td>
                                                        <td className="py-2.5 px-4 text-blue-600 dark:text-blue-400">
                                                            {env.generator === 'static' ? `Static ("${env.value}")` : env.generator}
                                                        </td>
                                                        <td className="py-2.5 px-4">
                                                            {env.isSecret ? (
                                                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                                                    AES-256-GCM Secret
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px]">
                                                                    Plain Config
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-4">
                            <div className="text-xs text-slate-500">
                                Recommended Tier:{' '}
                                <strong className="text-slate-900 dark:text-white">
                                    {PLAN_SLUG_TO_PID[inspectedStack.recommended_plan_slug].planName}
                                </strong>{' '}
                                ({inspectedStack.min_ram_mb / 1024} GB RAM, {inspectedStack.min_cpu_cores} vCPU)
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setInspectedStack(null)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const target = inspectedStack;
                                        setInspectedStack(null);
                                        handleDeployStack(target);
                                    }}
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Rocket className="w-4 h-4" />
                                    <span>1-Click Deploy {inspectedStack.name.split('(')[0].trim()}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <footer className="py-10 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span>© {new Date().getFullYear()} DevHost Cloud Infrastructure. Universal Multi-Stack Engine.</span>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="hover:text-blue-600">Home</Link>
                        <Link href="/estimator" className="hover:text-blue-600">Pricing Estimator</Link>
                        <Link href="/status" className="hover:text-blue-600">SLA Status</Link>
                        <Link href="/dashboard" className="hover:text-blue-600">Cloud Console</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
