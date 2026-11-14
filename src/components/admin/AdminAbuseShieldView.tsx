'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';

interface QuarantinedEvent {
  id: string;
  flagged_hostname: string;
  threat_category: string;
  matched_rule: string;
  risk_score: number;
  enforcement_action: 'quarantined_pending_review' | 'suspended_immediately' | 'whitelisted_false_positive';
  created_at: string;
}

interface RawAbuseReport {
  id: string;
  ticket_reference?: string;
  abuse_type?: string;
  reported_url_or_ip?: string;
  status?: string;
  admin_resolution_note?: string | null;
  created_at?: string;
}

function mapReportToEvent(row: RawAbuseReport): QuarantinedEvent {
  let enforcement: QuarantinedEvent['enforcement_action'] = 'quarantined_pending_review';
  if (row.status === 'suspended_immediately') enforcement = 'suspended_immediately';
  else if (row.status === 'whitelisted_false_positive' || row.status === 'resolved_dismissed') {
    enforcement = 'whitelisted_false_positive';
  }
  const scoreMatch = String(row.admin_resolution_note || '').match(/(\d+)\s*\/\s*100/);
  const riskScore = scoreMatch ? Number(scoreMatch[1]) : row.status === 'domain_quarantined' ? 85 : 50;

  return {
    id: row.id,
    flagged_hostname: row.reported_url_or_ip || row.ticket_reference || row.id,
    threat_category: row.abuse_type || 'phishing_fraud',
    matched_rule: row.admin_resolution_note || `Public intake report (${row.ticket_reference || 'pending review'})`,
    risk_score: riskScore,
    enforcement_action: enforcement,
    created_at: row.created_at || new Date().toISOString(),
  };
}

export default function AdminAbuseShieldView() {
  const [events, setEvents] = useState<QuarantinedEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/abuse?type=reports');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `Failed to load abuse reports (HTTP ${res.status}).`);
        return;
      }
      const mapped = Array.isArray(data.reports) ? data.reports.map(mapReportToEvent) : [];
      setEvents(mapped);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? `Network error loading abuse reports: ${err.message}` : 'Unable to reach /api/abuse.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAction = async (id: string, action: 'whitelisted_false_positive' | 'suspended_immediately') => {
    setUpdatingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_abuse_status',
          reportId: id,
          status: action,
          adminResolutionNote:
            action === 'whitelisted_false_positive'
              ? 'Cleared by Admin Abuse Shield operator'
              : 'Suspended immediately by Admin Abuse Shield operator',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `Failed to update abuse record (HTTP ${res.status}).`);
        return;
      }
      setEvents((prev) =>
        prev.map((ev) => (ev.id === id ? { ...ev, enforcement_action: action } : ev))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update abuse record.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = events.filter(
    (ev) =>
      ev.flagged_hostname.toLowerCase().includes(search.toLowerCase()) ||
      ev.matched_rule.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Anti-Phishing &amp; Upstream Abuse Quarantine Shield</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Auto-intercepts high-risk financial brand spoofing before any cPanel account or DNS zone activates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search flagged hostname..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white outline-none w-64"
            />
          </div>
          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 hover:bg-slate-50 text-slate-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
            title="Refresh Abuse Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 font-semibold font-mono uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">Flagged Hostname</th>
              <th className="py-3 px-4">Threat Category</th>
              <th className="py-3 px-4">Risk Score</th>
              <th className="py-3 px-4">Matched Signature</th>
              <th className="py-3 px-4">Status &amp; Enforcement</th>
              <th className="py-3 px-4 text-right">Review Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Loading live quarantine &amp; abuse reports...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 inline mr-2" />
                  No matching abuse or phishing quarantine alerts in the queue.
                </td>
              </tr>
            ) : filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                  {item.flagged_hostname}
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                    {item.threat_category}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono font-black text-rose-600">
                  {item.risk_score} / 100
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 text-[11px] max-w-xs truncate">
                  {item.matched_rule}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      item.enforcement_action === 'suspended_immediately'
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                        : item.enforcement_action === 'whitelisted_false_positive'
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                        : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {item.enforcement_action.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={updatingId === item.id}
                      onClick={() => handleAction(item.id, 'whitelisted_false_positive')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Whitelist
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item.id}
                      onClick={() => handleAction(item.id, 'suspended_immediately')}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Terminate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
