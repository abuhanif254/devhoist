'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { calculateSafeRefundBreakdown, STANDARD_DOMAIN_RETAIL_PRICES_BDT } from '@/lib/profitEngine';
import {
    ShieldCheck,
    FileText,
    Lock,
    RefreshCcw,
    Activity,
    AlertOctagon,
    Printer,
    CheckCircle2,
    Calculator,
    Clock,
    CreditCard,
    ArrowRight,
} from 'lucide-react';

interface LegalDoc {
    slug: string;
    title_en: string;
    title_bn: string;
    version: string;
    effective_date: string;
    summary_highlights_json: Array<{ en: string; bn: string }>;
    sections_json: Array<{
        clauseNumber: string;
        heading_en: string;
        heading_bn: string;
        content_en: string;
        content_bn: string;
    }>;
}

const DOC_TABS = [
    { slug: 'terms-of-service', label: 'Terms of Service', icon: FileText },
    { slug: 'privacy-policy', label: 'Privacy & Encryption', icon: Lock },
    { slug: 'refund-and-cancellation', label: '30-Day Refund & Domain Rule', icon: RefreshCcw },
    { slug: 'service-level-agreement', label: '99.99% Uptime SLA', icon: Activity },
    { slug: 'acceptable-use-and-dmca', label: 'AUP & DMCA Policy', icon: AlertOctagon },
];

function LegalComplianceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const docParam = searchParams.get('doc') || 'terms-of-service';

    const [activeSlug, setActiveSlug] = useState<string>(docParam);
    const [documents, setDocuments] = useState<LegalDoc[]>([]);
    const [langMode, setLangMode] = useState<'both' | 'en' | 'bn'>('both');

    // Interactive Anti-Loss Refund Simulator State
    const [simInvoiceTotal, setSimInvoiceTotal] = useState<number>(4320); // Annual Developer Pro
    const [simFreeDomainClaimed, setSimFreeDomainClaimed] = useState<boolean>(true);
    const [simDomainTld, setSimDomainTld] = useState<string>('.com');
    const [simDaysElapsed, setSimDaysElapsed] = useState<number>(12);

    useEffect(() => {
        if (docParam && DOC_TABS.some((t) => t.slug === docParam)) {
            const timer = window.setTimeout(() => setActiveSlug(docParam), 0);
            return () => window.clearTimeout(timer);
        }
    }, [docParam]);

    useEffect(() => {
        fetch('/api/abuse?type=legal')
            .then((r) => r.json())
            .then((data) => {
                if (data?.success && Array.isArray(data.documents)) {
                    setDocuments(data.documents);
                }
            })
            .catch(() => {});
    }, []);

    const activeDoc =
        documents.find((d) => d.slug === activeSlug) ||
        documents[0] || {
            slug: 'terms-of-service',
            title_en: 'Master Terms of Service & Merchant Delivery Policy',
            title_bn: 'পরিষেবার মূল শর্তাবলি এবং তাৎক্ষণিক ডেলিভারি নীতিমালা',
            version: 'v3.2 (Nov 2026)',
            effective_date: 'November 1, 2026',
            summary_highlights_json: [],
            sections_json: [],
        };

    const refundSim = calculateSafeRefundBreakdown({
        invoiceTotalBDT: simInvoiceTotal,
        freeDomainClaimed: simFreeDomainClaimed,
        bundledDomainName: `myproject${simDomainTld}`,
        bundledDomainTLD: simDomainTld,
        daysSincePurchase: simDaysElapsed,
        affiliateCommissionBDT: Math.round(simInvoiceTotal * 0.2),
    });

    const handleSwitchTab = (slug: string) => {
        setActiveSlug(slug);
        router.replace(`/legal?doc=${slug}`, { scroll: false });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
            {/* Top Compliance Header */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-10 shadow-xl mb-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" /> Official Merchant &amp; Payment Gateway Compliance Hub
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Legal, Privacy, 99.99% SLA &amp; Refund Center
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5">
                            Compliant with bKash, Nagad, SSLCommerz, Stripe, ICANN Registrar Policies, and Bangladesh Digital Commerce Guidelines.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setLangMode('both')}
                                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                                    langMode === 'both' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                EN + বাংলা
                            </button>
                            <button
                                type="button"
                                onClick={() => setLangMode('en')}
                                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                                    langMode === 'en' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                English
                            </button>
                            <button
                                type="button"
                                onClick={() => setLangMode('bn')}
                                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                                    langMode === 'bn' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                বাংলা
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            <Printer className="w-3.5 h-3.5 text-blue-600" />
                            <span>Print / Save PDF</span>
                        </button>
                    </div>
                </div>

                {/* Mandatory Merchant Gateway Disclosure Bar */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3">
                        <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                                Service Delivery Timeline
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                                Instant Automated Digital Provisioning (<strong>2 to 10 seconds</strong> upon bKash/Nagad/Stripe webhook confirmation).
                            </p>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
                        <CreditCard className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                                Refund Settlement Window
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                                30-Day Hosting Guarantee. Settled within <strong>3–5 business days</strong> to original MFS/Card or Instant Account Wallet.
                            </p>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
                        <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                                24/7 Abuse &amp; DMCA Desk
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                                Report phishing, brand spoofing, or copyright infringement at{' '}
                                <Link href="/abuse" className="text-blue-600 dark:text-blue-400 font-bold underline">
                                    /abuse
                                </Link>{' '}
                                (24h SLA).
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Policy Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
                {DOC_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeSlug === tab.slug;
                    return (
                        <button
                            key={tab.slug}
                            type="button"
                            onClick={() => handleSwitchTab(tab.slug)}
                            className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                                active
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Active Policy Document Card */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-10 shadow-lg space-y-8">
                {/* Document Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div>
                        {(langMode === 'both' || langMode === 'en') && (
                            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                                {activeDoc.title_en}
                            </h2>
                        )}
                        {(langMode === 'both' || langMode === 'bn') && (
                            <p className="text-base font-bold text-blue-600 dark:text-blue-400 font-bengali mt-1">
                                {activeDoc.title_bn}
                            </p>
                        )}
                    </div>
                    <div className="text-right font-mono text-xs text-slate-500">
                        <div>Version: <strong className="text-slate-800 dark:text-slate-200">{activeDoc.version}</strong></div>
                        <div>Effective: {activeDoc.effective_date}</div>
                    </div>
                </div>

                {/* Plain-Language Summary Box (সংক্ষেপে মূল নিয়মাবলি) */}
                {Array.isArray(activeDoc.summary_highlights_json) && activeDoc.summary_highlights_json.length > 0 && (
                    <div className="p-6 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-500/20 space-y-4">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Plain-Language Summary (সংক্ষেপে মূল নিয়মাবলি)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeDoc.summary_highlights_json.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                                >
                                    {(langMode === 'both' || langMode === 'en') && (
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                                            • {item.en}
                                        </p>
                                    )}
                                    {(langMode === 'both' || langMode === 'bn') && (
                                        <p className="text-xs text-slate-600 dark:text-slate-400 font-bengali leading-relaxed">
                                            • {item.bn}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Clauses List */}
                <div className="space-y-6">
                    {Array.isArray(activeDoc.sections_json) &&
                        activeDoc.sections_json.map((sec) => (
                            <div
                                key={sec.clauseNumber}
                                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white dark:bg-blue-600 text-xs font-mono font-bold">
                                        Clause {sec.clauseNumber}
                                    </span>
                                    {(langMode === 'both' || langMode === 'en') && (
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                            {sec.heading_en}
                                        </h3>
                                    )}
                                </div>
                                {(langMode === 'both' || langMode === 'bn') && (
                                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 font-bengali">
                                        {sec.heading_bn}
                                    </div>
                                )}
                                {(langMode === 'both' || langMode === 'en') && (
                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                        {sec.content_en}
                                    </p>
                                )}
                                {(langMode === 'both' || langMode === 'bn') && (
                                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-bengali leading-relaxed pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                        {sec.content_bn}
                                    </p>
                                )}
                            </div>
                        ))}
                </div>

                {/* Interactive Free-Domain Refund Deduction Calculator (Shown on Refund Tab) */}
                {activeSlug === 'refund-and-cancellation' && (
                    <div className="p-6 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    Interactive 30-Day Refund &amp; Free-Domain Deduction Calculator
                                </h3>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold">
                                Zero-Loss Transparent Formula
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Invoice Total Paid (BDT)
                                </label>
                                <input
                                    type="number"
                                    value={simInvoiceTotal}
                                    onChange={(e) => setSimInvoiceTotal(Number(e.target.value) || 0)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Included 1st-Yr Free Domain?
                                </label>
                                <select
                                    value={simFreeDomainClaimed ? 'yes' : 'no'}
                                    onChange={(e) => setSimFreeDomainClaimed(e.target.value === 'yes')}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                                >
                                    <option value="yes">Yes — Free Domain Claimed</option>
                                    <option value="no">No — Hosting Only</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Bundled Domain TLD
                                </label>
                                <select
                                    value={simDomainTld}
                                    disabled={!simFreeDomainClaimed}
                                    onChange={(e) => setSimDomainTld(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono disabled:opacity-50"
                                >
                                    {Object.entries(STANDARD_DOMAIN_RETAIL_PRICES_BDT).map(([tld, price]) => (
                                        <option key={tld} value={tld}>
                                            {tld} (Registry Value: ৳{price})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Days Since Purchase
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={simDaysElapsed}
                                    onChange={(e) => setSimDaysElapsed(Number(e.target.value) || 1)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <div className="text-[11px] text-slate-500">Non-Refundable Domain Deduction</div>
                                <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                                    - ৳{refundSim.nonRefundableDomainFeeBDT.toLocaleString()} BDT
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                    {refundSim.freeDomainClaimed ? 'Customer keeps 100% domain ownership' : 'No free domain attached'}
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <div className="text-[11px] text-slate-500">Affiliate Commission Clawback</div>
                                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                    ৳{refundSim.affiliateCommissionClawbackBDT.toLocaleString()} BDT
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                    Voided from 35-day hold ledger
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-emerald-600 text-white shadow-md">
                                <div className="text-[11px] text-emerald-100">Net Refundable to Customer</div>
                                <div className="text-xl font-extrabold font-mono mt-0.5">
                                    ৳{refundSim.maxSafeRefundableAmountBDT.toLocaleString()} BDT
                                </div>
                                <div className="text-[10px] text-emerald-100 mt-0.5">
                                    {refundSim.isWithin30DayWindow ? 'Within 30-Day Guarantee' : 'Outside 30-Day Window'}
                                </div>
                            </div>
                        </div>

                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                            {refundSim.formulaSummary}
                        </p>
                    </div>
                )}

                {/* 99.99% Uptime SLA Credit Tier Table (Shown on SLA Tab) */}
                {activeSlug === 'service-level-agreement' && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800/70 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            99.99% Uptime SLA Financial Credit Tier Table
                        </div>
                        <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                                    <th className="py-3 px-4">Monthly Uptime Percentage</th>
                                    <th className="py-3 px-4">Approx. Monthly Unscheduled Downtime</th>
                                    <th className="py-3 px-4">Service Credit % of Monthly Fee</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                <tr>
                                    <td className="py-3 px-4 font-bold text-emerald-600">99.90% – 100.00%</td>
                                    <td className="py-3 px-4">&lt; 43.2 minutes</td>
                                    <td className="py-3 px-4">Target SLA Met (0% Credit)</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-bold text-blue-600">99.00% – 99.89%</td>
                                    <td className="py-3 px-4">43.2 minutes – 7.2 hours</td>
                                    <td className="py-3 px-4 font-bold text-blue-600">10% Monthly Hosting Credit</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-bold text-amber-600">95.00% – 98.99%</td>
                                    <td className="py-3 px-4">7.2 hours – 36.0 hours</td>
                                    <td className="py-3 px-4 font-bold text-amber-600">25% Monthly Hosting Credit</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-bold text-rose-600">Below 95.00%</td>
                                    <td className="py-3 px-4">&gt; 36.0 hours</td>
                                    <td className="py-3 px-4 font-bold text-rose-600">100% Full Monthly Hosting Credit</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LegalCompliancePage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <Header />
            <main className="flex-1">
                <Suspense fallback={<div className="p-16 text-center text-sm font-mono">Loading Legal &amp; Compliance Hub...</div>}>
                    <LegalComplianceContent />
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}
