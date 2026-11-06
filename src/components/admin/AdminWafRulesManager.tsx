'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Ban,
  Plus,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Lock,
  AlertTriangle,
  X,
  Filter,
  Eye,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';

interface WafRule {
  id: string;
  rule_type: 'ip_address' | 'email_domain' | 'payment_wallet_number' | 'user_account' | 'country_code';
  target_value: string;
  action: 'block_403' | 'challenge_2fa' | 'freeze_withdrawals' | 'whitelist_bypass';
  reason: string;
  triggered_count: number;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminWafRulesManager() {
  const { requireSudo } = useSudoGate();
  const [rules, setRules] = useState<WafRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [ruleType, setRuleType] = useState<'ip_address' | 'email_domain' | 'payment_wallet_number' | 'user_account'>('ip_address');
  const [targetValue, setTargetValue] = useState('');
  const [ruleAction, setRuleAction] = useState<'block_403' | 'challenge_2fa' | 'freeze_withdrawals'>('block_403');
  const [reason, setReason] = useState('');

  const fetchWafRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/waf');
      const data = await res.json();
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (err) {
      console.warn('Failed to load WAF rules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWafRules();
  }, []);

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue.trim() || !reason.trim()) return;

    requireSudo(async () => {
      try {
        const res = await fetch('/api/admin/waf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_rule',
            ruleType,
            targetValue: targetValue.trim(),
            ruleAction,
            reason: reason.trim(),
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setIsAddModalOpen(false);
        setTargetValue('');
        setReason('');
        fetchWafRules();
        alert(data.message || 'WAF blacklist rule applied!');
      } catch (err: any) {
        alert(err.message);
      }
    }, `Add Edge WAF Blacklist Rule for ${targetValue}`);
  };

  const handleDeleteRule = (rule: WafRule) => {
    requireSudo(async () => {
      try {
        const res = await fetch(`/api/admin/waf?id=${rule.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        fetchWafRules();
        alert(`Entity ${rule.target_value} has been unbanned.`);
      } catch (err: any) {
        alert(err.message);
      }
    }, `Unban ${rule.target_value} from Edge WAF`);
  };

  const filteredRules = rules.filter((r) => {
    if (filterType === 'all') return true;
    return r.rule_type === filterType;
  });

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Edge WAF Active Firewall Rules &amp; Entity Blacklist</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold">
              {rules.length} Rules Active
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Enforced directly in Cloudflare Edge Middleware (`src/middleware.ts`) before touching backend containers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs"
          >
            <option value="all">All Rule Types</option>
            <option value="ip_address">IP Addresses</option>
            <option value="payment_wallet_number">Wallet Numbers</option>
            <option value="email_domain">Email Domains</option>
            <option value="user_account">User Accounts</option>
          </select>

          <button
            type="button"
            onClick={fetchWafRules}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 cursor-pointer"
            title="Refresh Rules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ban Entity</span>
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/5">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-50 dark:bg-zinc-950/70 text-slate-500 border-b border-slate-200 dark:border-white/5 uppercase text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Target Entity</th>
              <th className="py-2.5 px-3">Edge Action</th>
              <th className="py-2.5 px-3">Reason &amp; Forensic Details</th>
              <th className="py-2.5 px-3">Hits</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredRules.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No active firewall rules found for this filter.
                </td>
              </tr>
            ) : (
              filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/30">
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 uppercase">
                      {rule.rule_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    {rule.target_value}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rule.action === 'block_403'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : rule.action === 'freeze_withdrawals'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      }`}
                    >
                      {rule.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 max-w-md truncate">
                    {rule.reason}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-zinc-300">
                    {rule.triggered_count || 1}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Unban Entity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Ban Entity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <strong className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-600" />
                <span>Ban Malicious IP or Entity (Edge WAF)</span>
              </strong>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRuleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-bold">Rule Target Type:</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                >
                  <option value="ip_address">IPv4 / IPv6 Address (Block Hacker)</option>
                  <option value="payment_wallet_number">bKash/Nagad Wallet Number (Fraudster)</option>
                  <option value="email_domain">Disposable Email Domain (TempMail)</option>
                  <option value="user_account">User Account ID (Malicious Tenant)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">Target Value:</label>
                <input
                  type="text"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={
                    ruleType === 'ip_address'
                      ? '185.220.101.45'
                      : ruleType === 'payment_wallet_number'
                      ? '017XXXXXXXX'
                      : ruleType === 'email_domain'
                      ? 'guerrillamail.com'
                      : 'uuid-user-id'
                  }
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">Enforced Action:</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                >
                  <option value="block_403">block_403 (Immediate 403 Access Denied)</option>
                  <option value="freeze_withdrawals">freeze_withdrawals (Halt Payouts &amp; Withdrawals)</option>
                  <option value="challenge_2fa">challenge_2fa (Force Immediate Sudo 2FA Step-up)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold">Audit Reason / Incident Details:</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Repeated automated fake bKash TrxID submission; SQL injection probes"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer shadow-md"
                >
                  Apply Rule (Sudo Verified)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
