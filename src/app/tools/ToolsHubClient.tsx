'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  SearchCheck,
  Shield,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Globe,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'dns' | 'whois' | 'headers';

interface DnsAnswerRow {
  name: string;
  type: string;
  ttl: number;
  data: string;
}

interface DnsQueryResult {
  domain: string;
  recordType: string;
  server: string;
  answers: DnsAnswerRow[];
}

interface WhoisQueryResult {
  available: boolean;
  domain: string;
  registrar?: string;
  expirationDate?: string | null;
  registrationDate?: string | null;
  lastUpdatedDate?: string | null;
  nameservers?: string[];
  status?: string[];
}

interface HeaderAuditResult {
  targetUrl: string;
  statusCode: number;
  responseTimeMs: number;
  server: string;
  grade: string;
  score: number;
  headersAudited: Record<string, string>;
}

export default function ToolsHubClient() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'dns';

  const [activeTab, setActiveTab] = useState<Tab>(
    ['dns', 'whois', 'headers'].includes(initialTab) ? initialTab : 'dns'
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab') as Tab;
    if (tabParam && ['dns', 'whois', 'headers'].includes(tabParam)) {
      const timer = window.setTimeout(() => setActiveTab(tabParam), 0);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams]);

  // --------------------------------------------------------------------------
  // TOOL 1: DNS State
  // --------------------------------------------------------------------------
  const [dnsDomain, setDnsDomain] = useState('devhostcloud.com');
  const [dnsType, setDnsType] = useState('A');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState<DnsQueryResult | null>(null);
  const [dnsError, setDnsError] = useState<string | null>(null);

  const handleDnsQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dnsDomain.trim()) return;

    setDnsLoading(true);
    setDnsError(null);
    setDnsResult(null);

    try {
      const res = await fetch(
        `/api/network-tools?tool=dns&domain=${encodeURIComponent(dnsDomain.trim())}&type=${dnsType}`
      );
      const data = await res.json();
      if (!res.ok) {
        setDnsError(data.error || 'Failed to resolve DNS query.');
      } else {
        setDnsResult(data);
      }
    } catch (err: unknown) {
      setDnsError(err instanceof Error ? err.message : 'Network connection failed.');
    } finally {
      setDnsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // TOOL 2: WHOIS State
  // --------------------------------------------------------------------------
  const [whoisDomain, setWhoisDomain] = useState('devhostcloud.com');
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisResult, setWhoisResult] = useState<WhoisQueryResult | null>(null);
  const [whoisError, setWhoisError] = useState<string | null>(null);

  const handleWhoisQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!whoisDomain.trim()) return;

    setWhoisLoading(true);
    setWhoisError(null);
    setWhoisResult(null);

    try {
      const res = await fetch(
        `/api/network-tools?tool=whois&domain=${encodeURIComponent(whoisDomain.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setWhoisError(data.error || 'WHOIS lookup failed.');
      } else {
        setWhoisResult(data);
      }
    } catch (err: unknown) {
      setWhoisError(err instanceof Error ? err.message : 'Network connection failed.');
    } finally {
      setWhoisLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // TOOL 3: Headers State
  // --------------------------------------------------------------------------
  const [headerUrl, setHeaderUrl] = useState('https://devhostcloud.com');
  const [headerLoading, setHeaderLoading] = useState(false);
  const [headerResult, setHeaderResult] = useState<HeaderAuditResult | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const handleHeaderAudit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!headerUrl.trim()) return;

    setHeaderLoading(true);
    setHeaderError(null);
    setHeaderResult(null);

    try {
      const res = await fetch(
        `/api/network-tools?tool=headers&url=${encodeURIComponent(headerUrl.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setHeaderError(data.error || 'HTTP header audit failed.');
      } else {
        setHeaderResult(data);
      }
    } catch (err: unknown) {
      setHeaderError(err instanceof Error ? err.message : 'Network connection failed.');
    } finally {
      setHeaderLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <button
          onClick={() => setActiveTab('dns')}
          className={`flex items-center gap-2 h-10 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'dns'
              ? 'bg-blue-600 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>DNS Propagation Checker</span>
        </button>

        <button
          onClick={() => setActiveTab('whois')}
          className={`flex items-center gap-2 h-10 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'whois'
              ? 'bg-blue-600 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <SearchCheck className="w-4 h-4" />
          <span>WHOIS & RDAP Lookup</span>
        </button>

        <button
          onClick={() => setActiveTab('headers')}
          className={`flex items-center gap-2 h-10 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'headers'
              ? 'bg-blue-600 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>HTTP & SSL Header Auditor</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: DNS PROPAGATION CHECKER                                        */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'dns' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <form
            onSubmit={handleDnsQuery}
            className="p-3 sm:p-4 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row gap-3 shadow-md"
          >
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Enter domain name (e.g. example.com)"
                value={dnsDomain}
                onChange={(e) => setDnsDomain(e.target.value)}
                className="w-full h-11 pl-4 pr-3 rounded-lg bg-slate-50 dark:bg-zinc-900/90 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25 font-mono"
              />
            </div>

            <div className="w-full sm:w-32">
              <select
                value={dnsType}
                onChange={(e) => setDnsType(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900/90 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-200 focus:outline-hidden font-mono cursor-pointer"
              >
                <option value="A">A (IPv4)</option>
                <option value="AAAA">AAAA (IPv6)</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX (Mail)</option>
                <option value="TXT">TXT (SPF/DKIM)</option>
                <option value="NS">NS (Nameserver)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={dnsLoading}
              className="h-11 px-5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {dnsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Query DNS</span>
            </button>
          </form>

          {/* DNS Error */}
          {dnsError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{dnsError}</span>
            </div>
          )}

          {/* DNS Result Table */}
          {dnsResult && (
            <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.06] pb-3 text-xs font-mono">
                <div className="text-slate-700 dark:text-zinc-300">
                  Target: <span className="text-slate-900 dark:text-zinc-100 font-bold">{dnsResult.domain}</span> ({dnsResult.recordType})
                </div>
                <div className="text-slate-500 dark:text-zinc-500 text-[11px]">
                  Resolved via: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{dnsResult.server}</span>
                </div>
              </div>

              {dnsResult.answers.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-500 dark:text-zinc-500">
                  No {dnsResult.recordType} records found for this domain.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">TTL</th>
                        <th className="py-2.5 px-3">Target / Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {dnsResult.answers.map((ans, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40">
                          <td className="py-2.5 px-3 text-slate-800 dark:text-zinc-300">{ans.name}</td>
                          <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">{ans.type}</td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-500">{ans.ttl}s</td>
                          <td className="py-2.5 px-3 text-slate-900 dark:text-zinc-100 font-medium break-all">
                            {ans.data}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: WHOIS & RDAP LOOKUP                                            */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'whois' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <form
            onSubmit={handleWhoisQuery}
            className="p-3 sm:p-4 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row gap-3 shadow-md"
          >
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Enter domain name (e.g. devhostcloud.com)"
                value={whoisDomain}
                onChange={(e) => setWhoisDomain(e.target.value)}
                className="w-full h-11 pl-4 pr-3 rounded-lg bg-slate-50 dark:bg-zinc-900/90 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={whoisLoading}
              className="h-11 px-5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {whoisLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SearchCheck className="w-4 h-4" />
              )}
              <span>Lookup WHOIS</span>
            </button>
          </form>

          {/* Error */}
          {whoisError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{whoisError}</span>
            </div>
          )}

          {/* WHOIS Result */}
          {whoisResult && (
            <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-5">
              {whoisResult.available ? (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                        {whoisResult.domain} is Available!
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-zinc-400">
                        This domain is not currently registered. You can claim it now.
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/cheap-domain-registration-bd?q=${whoisResult.domain}`}
                    className="h-9 px-4 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Register Domain</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-3">
                    <span className="text-slate-600 dark:text-zinc-400">Domain Name:</span>
                    <span className="text-slate-900 dark:text-zinc-100 font-bold text-sm">{whoisResult.domain}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="text-slate-500 dark:text-zinc-500 text-[11px]">Registrar:</div>
                      <div className="text-slate-900 dark:text-zinc-200 font-semibold">{whoisResult.registrar}</div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="text-slate-500 dark:text-zinc-500 text-[11px]">Expiration Date:</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {whoisResult.expirationDate
                          ? new Date(whoisResult.expirationDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Not Disclosed'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="text-slate-500 dark:text-zinc-500 text-[11px]">Registered On:</div>
                      <div className="text-slate-800 dark:text-zinc-300">
                        {whoisResult.registrationDate
                          ? new Date(whoisResult.registrationDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Not Disclosed'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1">
                      <div className="text-slate-500 dark:text-zinc-500 text-[11px]">Last Updated:</div>
                      <div className="text-slate-800 dark:text-zinc-300">
                        {whoisResult.lastUpdatedDate
                          ? new Date(whoisResult.lastUpdatedDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Not Disclosed'}
                      </div>
                    </div>
                  </div>

                  {/* Nameservers */}
                  {(whoisResult.nameservers?.length ?? 0) > 0 && (
                    <div className="pt-2">
                      <div className="text-slate-600 dark:text-zinc-400 text-[11px] mb-2">Authoritative Nameservers:</div>
                      <div className="flex flex-wrap gap-2">
                        {(whoisResult.nameservers ?? []).map((ns: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-300 text-[11px]"
                          >
                            {ns}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Flags */}
                  {(whoisResult.status?.length ?? 0) > 0 && (
                    <div className="pt-2">
                      <div className="text-slate-600 dark:text-zinc-400 text-[11px] mb-2">Registry Status Codes:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(whoisResult.status ?? []).map((st: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 text-[10px]"
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: HTTP & SSL SECURITY HEADER AUDITOR                            */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'headers' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <form
            onSubmit={handleHeaderAudit}
            className="p-3 sm:p-4 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row gap-3 shadow-md"
          >
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Enter website URL (e.g. https://devhostcloud.com)"
                value={headerUrl}
                onChange={(e) => setHeaderUrl(e.target.value)}
                className="w-full h-11 pl-4 pr-3 rounded-lg bg-slate-50 dark:bg-zinc-900/90 border border-slate-300 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={headerLoading}
              className="h-11 px-5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {headerLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span>Audit Headers</span>
            </button>
          </form>

          {/* Error */}
          {headerError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{headerError}</span>
            </div>
          )}

          {/* Audit Result */}
          {headerResult && (
            <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-5">
              {/* Score & Grade Header */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10">
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Security Grade:</div>
                  <div className="text-sm text-slate-900 dark:text-zinc-200 font-bold">
                    {headerResult.targetUrl}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                    <span>Status: {headerResult.statusCode}</span>
                    <span>•</span>
                    <span>Latency: {headerResult.responseTimeMs}ms</span>
                    <span>•</span>
                    <span>Server: {headerResult.server}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-white/15 shadow-xs">
                  <span
                    className={`text-2xl font-bold font-mono ${
                      headerResult.grade.startsWith('A')
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : headerResult.grade === 'B'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {headerResult.grade}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500">{headerResult.score}/100</span>
                </div>
              </div>

              {/* Audited Headers Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-semibold px-1">
                  Enterprise Security Headers Evaluation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(headerResult.headersAudited).map(([hdr, val]) => {
                    const isPresent = val !== 'Missing';
                    return (
                      <div
                        key={hdr}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono"
                      >
                        <div className="space-y-0.5 pr-2">
                          <div className="text-slate-900 dark:text-zinc-300 font-semibold">{hdr}</div>
                          <div
                            className={`text-[11px] ${
                              isPresent ? 'text-slate-600 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-600'
                            }`}
                          >
                            {val}
                          </div>
                        </div>
                        {isPresent ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
