'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import {
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Send,
    Lock,
    FileText,
    Globe,
    User,
    Mail,
    Building2,
} from 'lucide-react';

export default function AbuseReportingDeskPage() {
    const [reporterName, setReporterName] = useState('');
    const [reporterEmail, setReporterEmail] = useState('');
    const [reporterOrganization, setReporterOrganization] = useState('');
    const [abuseType, setAbuseType] = useState<
        'phishing_fraud' | 'malware_botnet' | 'copyright_dmca' | 'email_spam' | 'ddos_network_attack'
    >('phishing_fraud');
    const [reportedUrlOrIp, setReportedUrlOrIp] = useState('');
    const [evidenceLogs, setEvidenceLogs] = useState('');
    const [swornDeclaration, setSwornDeclaration] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submissionResult, setSubmissionResult] = useState<{
        ticketReference: string;
        status: string;
        automatedScan?: {
            isThreat: boolean;
            riskScore: number;
            reason: string;
        };
    } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/abuse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reporterName,
                    reporterEmail,
                    reporterOrganization,
                    abuseType,
                    reportedUrlOrIp,
                    evidenceLogs,
                    swornDeclaration,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to submit abuse report');
            }
            setSubmissionResult(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <Header />

            <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 w-full">
                {/* Header */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-xl mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-3 border border-rose-500/20">
                        <ShieldAlert className="w-3.5 h-3.5" /> 24/7 Upstream Trust &amp; Safety Desk
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Report Phishing, Malware, Spam or DMCA Infringement
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                        Every submission is immediately cross-checked against our <strong>Autonomous Anti-Phishing Shield (`abuseShieldEngine.ts`)</strong>. Verified bank/MFS phishing domains (bKash, Nagad, commercial banks) are automatically quarantined within seconds.
                    </p>
                </div>

                {submissionResult ? (
                    <div className="rounded-3xl border-2 border-emerald-500/30 bg-white dark:bg-slate-900 p-8 shadow-xl space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-mono uppercase text-emerald-600 font-bold">
                                    Official Tracking Reference Issued
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                                    {submissionResult.ticketReference}
                                </h2>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 font-mono">
                            <div>
                                Status:{' '}
                                <strong className="text-blue-600 dark:text-blue-400 uppercase">
                                    {submissionResult.status}
                                </strong>
                            </div>
                            {submissionResult.automatedScan && (
                                <>
                                    <div>
                                        Automated Heuristic Risk Score:{' '}
                                        <strong>{submissionResult.automatedScan.riskScore}/100</strong>
                                    </div>
                                    <div>
                                        Engine Finding: {submissionResult.automatedScan.reason}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setSubmissionResult(null);
                                    setReportedUrlOrIp('');
                                    setEvidenceLogs('');
                                }}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
                            >
                                Submit Another Report
                            </button>
                            <Link
                                href="/legal?doc=acceptable-use-and-dmca"
                                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                            >
                                View Acceptable Use Policy
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-xl space-y-6 text-xs"
                    >
                        {error && (
                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 flex items-center gap-2 font-semibold">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                                    <User className="w-3.5 h-3.5 text-blue-500" /> Your Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={reporterName}
                                    onChange={(e) => setReporterName(e.target.value)}
                                    placeholder="e.g. Security Operations"
                                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                                    <Mail className="w-3.5 h-3.5 text-blue-500" /> Official Contact Email *
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={reporterEmail}
                                    onChange={(e) => setReporterEmail(e.target.value)}
                                    placeholder="cert@organization.com"
                                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-blue-500" /> Organization / CERT / Brand
                                </label>
                                <input
                                    type="text"
                                    value={reporterOrganization}
                                    onChange={(e) => setReporterOrganization(e.target.value)}
                                    placeholder="e.g. bKash / BGD e-GOV CIRT"
                                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                                    Violation Category *
                                </label>
                                <select
                                    value={abuseType}
                                    onChange={(e) => setAbuseType(e.target.value as any)}
                                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
                                >
                                    <option value="phishing_fraud">Phishing / Brand Spoofing / MFS Scam</option>
                                    <option value="malware_botnet">Malware / Ransomware / C2 Botnet</option>
                                    <option value="copyright_dmca">DMCA Copyright / Trademark Infringement</option>
                                    <option value="email_spam">Unsolicited Bulk Email / SMTP Spam</option>
                                    <option value="ddos_network_attack">Network Attack / Port Scanning</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                                    <Globe className="w-3.5 h-3.5 text-rose-500" /> Reported Domain, URL, or Server IP *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={reportedUrlOrIp}
                                    onChange={(e) => setReportedUrlOrIp(e.target.value)}
                                    placeholder="https://suspicious-domain.xyz/login"
                                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                                <FileText className="w-3.5 h-3.5 text-blue-500" /> Technical Evidence, HTTP Headers, or Original Copyright Work URLs *
                            </label>
                            <textarea
                                rows={5}
                                required
                                value={evidenceLogs}
                                onChange={(e) => setEvidenceLogs(e.target.value)}
                                placeholder="Paste full URLs, timestamps, email headers, or links to the original copyrighted material..."
                                className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                            />
                        </div>

                        <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={swornDeclaration}
                                onChange={(e) => setSwornDeclaration(e.target.checked)}
                                className="mt-0.5 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                <strong>Sworn Good-Faith Declaration:</strong> I declare under penalty of perjury that the information in this notice is accurate and that I am authorized to act on behalf of the affected party or copyright owner.
                            </span>
                        </label>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-slate-500 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-emerald-500" /> Automated Abuse Shield Active
                            </span>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-rose-600/25 cursor-pointer"
                            >
                                <Send className="w-4 h-4" />
                                <span>{isSubmitting ? 'Scanning & Filing Notice...' : 'Submit Official Abuse / DMCA Notice'}</span>
                            </button>
                        </div>
                    </form>
                )}
            </main>

            <Footer />
        </div>
    );
}
