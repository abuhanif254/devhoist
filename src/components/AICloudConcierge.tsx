'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useBilling } from '@/context/BillingContext';
import {
    Sparkles,
    MessageSquare,
    X,
    Send,
    Rocket,
    Globe,
    Wrench,
    CheckCircle2,
    Terminal,
    ExternalLink,
    Bot,
} from 'lucide-react';

interface ConciergeMessage {
    id: string;
    role: 'assistant' | 'user';
    text: string;
    deployAction?: {
        stackSlug: string;
        stackName: string;
        runtimeVersion: string;
        pid: number;
        planName: string;
        monthlyBdt: number;
        ramGb: number;
        cpuCores: number;
        storageGb: number;
    };
    domainCard?: {
        domain: string;
        tld: string;
        available: boolean;
        retailPriceBdt: number;
        freeWithAnnual: boolean;
    };
    devopsCard?: {
        commandFix: string;
        dashboardUrl: string;
        statusUrl: string;
    };
}

const QUICK_PROMPTS = [
    'Next.js 15 + PostgreSQL এর জন্য কোন প্ল্যান ভালো?',
    'Can I host Laravel 11 + Redis + Queue?',
    'check devcloudstudio.com',
    'How to fix 503 Service Unavailable?',
];

export default function AICloudConcierge() {
    const { openStackBuilder } = useBilling();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<ConciergeMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: 'আসসালামু আলাইকুম / Hi! I am your **24/7 AI Cloud Architect & DevOps Concierge**. Ask me which plan fits your stack (Next.js, Laravel, Python, WordPress), type a domain (e.g. `myshop.com`) to check instant availability, or paste a server error code!',
        },
    ]);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const sendPrompt = async (promptText: string) => {
        const clean = promptText.trim();
        if (!clean || isLoading) return;

        const userMsg: ConciergeMessage = {
            id: `u_${Date.now()}`,
            role: 'user',
            text: clean,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/concierge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: clean }),
            });
            const data = await res.json();
            const botMsg: ConciergeMessage = {
                id: `b_${Date.now()}`,
                role: 'assistant',
                text: data.reply || 'Here is the recommended configuration for your workload.',
                deployAction: data.deployAction,
                domainCard: data.domainCard,
                devopsCard: data.devopsCard,
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    role: 'assistant',
                    text: 'Connection momentarily busy. You can deploy directly from our 16-Stack Marketplace or contact 24/7 engineering support.',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Launcher Button */}
            {!isOpen && (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open AI Cloud Architect Concierge"
                    className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-2xl shadow-blue-600/35 border border-white/20 transition-all cursor-pointer group"
                >
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                    </span>
                    <Sparkles className="w-4 h-4" />
                    <span>AI Cloud Concierge</span>
                </button>
            )}

            {/* Chat Drawer Window */}
            {isOpen && (
                <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <div className="text-xs font-extrabold flex items-center gap-1.5">
                                    <span>AI Cloud Architect &amp; DevOps</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono">
                                        24/7 LIVE
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-300">
                                    Stack Advisor • Domain Lookup • Error Doctor
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Quick Prompt Pills */}
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {QUICK_PROMPTS.map((q) => (
                            <button
                                key={q}
                                type="button"
                                onClick={() => sendPrompt(q)}
                                className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-[10px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer shrink-0"
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="p-4 space-y-3 overflow-y-auto max-h-[370px] min-h-[290px] bg-slate-50/40 dark:bg-slate-950/40 text-xs"
                    >
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={`flex flex-col ${
                                    m.role === 'user' ? 'items-end' : 'items-start'
                                }`}
                            >
                                <div
                                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                                        m.role === 'user'
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs'
                                    }`}
                                >
                                    <p className="whitespace-pre-line">{m.text}</p>

                                    {/* Mode 1: Inline 1-Click Stack Deploy Card */}
                                    {m.deployAction && (
                                        <div className="mt-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {m.deployAction.planName}
                                                </span>
                                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                                    ৳{m.deployAction.monthlyBdt}/mo
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-500">
                                                {m.deployAction.ramGb} GB RAM • {m.deployAction.cpuCores} vCPU • {m.deployAction.storageGb} GB NVMe • {m.deployAction.runtimeVersion}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const act = m.deployAction!;
                                                    setIsOpen(false);
                                                    openStackBuilder({
                                                        planName: act.planName,
                                                        defaultPlanId: act.pid,
                                                        minPlanPid: act.pid,
                                                        selectedStackSlug: act.stackSlug,
                                                        defaultStack: act.stackSlug,
                                                        basePriceBDT: act.monthlyBdt,
                                                        basePriceUSD: Number((act.monthlyBdt / 120).toFixed(2)),
                                                    });
                                                }}
                                                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                <Rocket className="w-3.5 h-3.5" />
                                                <span>⚡ 1-Click Deploy ({m.deployAction.planName})</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Mode 2: Inline Domain Availability Card */}
                                    {m.domainCard && (
                                        <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                                    {m.domainCard.domain}
                                                </span>
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        m.domainCard.available
                                                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                    }`}
                                                >
                                                    {m.domainCard.available ? 'AVAILABLE' : 'REGISTERED'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const dc = m.domainCard!;
                                                    setIsOpen(false);
                                                    openStackBuilder({
                                                        planName: 'Developer Pro',
                                                        defaultPlanId: 2,
                                                        domainName: dc.domain,
                                                        basePriceBDT: 450,
                                                        basePriceUSD: 3.75,
                                                    });
                                                }}
                                                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Claim Free with Annual Plan →</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Mode 3: Inline DevOps Resolver Card */}
                                    {m.devopsCard && (
                                        <div className="mt-3 p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[10px] space-y-2 border border-slate-800">
                                            <div>$ {m.devopsCard.commandFix}</div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <Link
                                                    href={m.devopsCard.dashboardUrl}
                                                    onClick={() => setIsOpen(false)}
                                                    className="px-2.5 py-1 rounded bg-blue-600 text-white font-sans font-bold"
                                                >
                                                    Open AI Log Doctor
                                                </Link>
                                                <a
                                                    href="https://wa.me/8801700000000"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2.5 py-1 rounded bg-emerald-600 text-white font-sans font-bold flex items-center gap-1"
                                                >
                                                    <span>WhatsApp Support</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="text-[11px] text-slate-400 font-mono animate-pulse">
                                AI Cloud Architect analyzing stack specs...
                            </div>
                        )}
                    </div>

                    {/* Input Footer */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            sendPrompt(input);
                        }}
                        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask stack advice, check domain, or paste error..."
                            className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
