'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  DollarSign,
  Globe,
  Terminal,
  Activity,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
} from 'lucide-react';

interface AuditCheckResult {
  id: string;
  name: string;
  category: 'DATABASE' | 'SECURITY' | 'FINANCE' | 'SYSTEM' | 'SEO';
  status: 'PASSED' | 'WARNING' | 'FAILED';
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

interface AuditReport {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
    totalDurationMs: number;
  };
  checks: AuditCheckResult[];
}

export default function AdminSystemHealthAuditor() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-audit');
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete system audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runAudit();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DATABASE':
        return <Database className="w-4 h-4 text-blue-500" />;
      case 'SECURITY':
        return <Lock className="w-4 h-4 text-purple-500" />;
      case 'FINANCE':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'SYSTEM':
        return <Terminal className="w-4 h-4 text-amber-500" />;
      case 'SEO':
        return <Globe className="w-4 h-4 text-cyan-500" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: 'PASSED' | 'WARNING' | 'FAILED') => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            PASSED
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            WARNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-500" />
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Trigger Banner */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              Zero-Mock System &amp; Security Auditor
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Automated production self-test verifying all 6 Workflows: Database RLS, Unit Economics,
            Web Crypto TOTP &amp; AES-256 Vault, DNS/Shell Firewall, Edge WAF, and Dynamic SEO.
          </p>
        </div>

        <button
          onClick={runAudit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running Penetration Audit...' : 'Re-Run System Audit'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Audit failed: {error}</span>
        </div>
      )}

      {/* Metrics Summary Grid */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950">
            <span className="text-[11px] font-mono text-slate-400 block uppercase">Overall State</span>
            <div className="mt-1">
              <span
                className={`text-base font-bold uppercase ${
                  report.overallStatus === 'HEALTHY'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : report.overallStatus === 'WARNING'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {report.overallStatus}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950">
            <span className="text-[11px] font-mono text-slate-400 block uppercase">Passed Invariants</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {report.summary.passed}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ {report.summary.totalChecks}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950">
            <span className="text-[11px] font-mono text-slate-400 block uppercase">Warnings</span>
            <div className="mt-1">
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {report.summary.warnings}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950">
            <span className="text-[11px] font-mono text-slate-400 block uppercase">Failed Invariants</span>
            <div className="mt-1">
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {report.summary.failed}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 col-span-2 md:col-span-1">
            <span className="text-[11px] font-mono text-slate-400 block uppercase">Scan Latency</span>
            <div className="mt-1 flex items-center gap-1 text-slate-700 dark:text-zinc-200 text-sm font-mono font-semibold">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{report.summary.totalDurationMs}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Checklist Table */}
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Master System &amp; Cryptographic Diagnostic Checks</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {report ? `Checked: ${new Date(report.timestamp).toLocaleTimeString()}` : 'Scanning...'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {report?.checks.map((check) => {
            const isExpanded = expandedCheckId === check.id;

            return (
              <div key={check.id} className="p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedCheckId(isExpanded ? null : check.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-900 shrink-0 mt-0.5">
                      {getCategoryIcon(check.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {check.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {check.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">{check.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-11 sm:ml-0">
                    <span className="text-xs font-mono text-slate-400">{check.latencyMs}ms</span>
                    {getStatusBadge(check.status)}
                    {check.details && (
                      <button className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Details JSON inspector */}
                {isExpanded && check.details && (
                  <div className="mt-3 ml-11 p-3 rounded-lg bg-slate-900 dark:bg-zinc-950 border border-slate-800 text-slate-200 text-xs font-mono overflow-x-auto">
                    <pre>{JSON.stringify(check.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
