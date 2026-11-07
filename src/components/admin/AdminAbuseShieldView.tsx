'use client';

import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, Ban, AlertTriangle, Search, Filter, ShieldCheck } from 'lucide-react';

interface QuarantinedEvent {
  id: string;
  flagged_hostname: string;
  threat_category: string;
  matched_rule: string;
  risk_score: number;
  enforcement_action: 'quarantined_pending_review' | 'suspended_immediately' | 'whitelisted_false_positive';
  created_at: string;
}

const INITIAL_EVENTS: QuarantinedEvent[] = [
  {
    id: 'ab_1',
    flagged_hostname: 'bkash-reward-claim.xyz',
    threat_category: 'phishing_brand_spoof',
    matched_rule: 'Brand Spoofing: bKash + Deceptive Term: claim',
    risk_score: 100,
    enforcement_action: 'quarantined_pending_review',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'ab_2',
    flagged_hostname: 'nagad-verify-pin.top',
    threat_category: 'phishing_brand_spoof',
    matched_rule: 'Brand Spoofing: Nagad + Deceptive Term: verify + High-Abuse TLD (.top)',
    risk_score: 100,
    enforcement_action: 'quarantined_pending_review',
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    id: 'ab_3',
    flagged_hostname: 'binance-airdrop-login.com',
    threat_category: 'crypto_scam_pattern',
    matched_rule: 'Crypto Scam: Binance + Deceptive Term: airdrop',
    risk_score: 95,
    enforcement_action: 'suspended_immediately',
    created_at: new Date(Date.now() - 360 * 60000).toISOString(),
  },
];

export default function AdminAbuseShieldView() {
  const [events, setEvents] = useState<QuarantinedEvent[]>(INITIAL_EVENTS);
  const [search, setSearch] = useState('');

  const handleAction = (id: string, action: 'whitelisted_false_positive' | 'suspended_immediately') => {
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, enforcement_action: action } : ev))
    );
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
      </div>

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
            {filtered.map((item) => (
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
                      onClick={() => handleAction(item.id, 'whitelisted_false_positive')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      Whitelist
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, 'suspended_immediately')}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-semibold text-[11px] transition-colors cursor-pointer"
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
