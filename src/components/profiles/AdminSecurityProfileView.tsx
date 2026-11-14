'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Key,
  Lock,
  Unlock,
  AlertTriangle,
  Globe,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Activity,
  Sparkles,
  RefreshCw,
  Ban,
  Save,
  LogOut,
} from 'lucide-react';
import { usePortal } from '@/context/PortalContext';
import { useSudoGate } from '@/components/security/SudoGateModal';

export default function AdminSecurityProfileView() {
  const { auditLogs, fraudAlerts, logout } = usePortal();
  const { isSudoActive, sudoExpiresAt, requireSudo, revokeSudo } = useSudoGate();

  // Whitelist IPs & Lockdown State (synced with cms_global_config.security_lockdown)
  const [whitelistedIps, setWhitelistedIps] = useState<string[]>([]);
  const [newIpInput, setNewIpInput] = useState('');
  const [strictIpLockdown, setStrictIpLockdown] = useState(false);
  const [emergencyFreeze, setEmergencyFreeze] = useState(false);
  const [fullLockdownConfig, setFullLockdownConfig] = useState<Record<string, unknown>>({});
  const [saveToast, setSaveToast] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Time remaining on active sudo
  const [remainingTimeStr, setRemainingTimeStr] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/cms-config?key=security_lockdown')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active || !res.ok || !data.success || !data.config) return;
        setFullLockdownConfig(data.config);
        setStrictIpLockdown(Boolean(data.config.strict_ip_country_whitelist));
        setEmergencyFreeze(Boolean(data.config.freeze_all_withdrawals));
        if (Array.isArray(data.config.admin_whitelisted_ips)) {
          setWhitelistedIps(data.config.admin_whitelisted_ips);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persistSecurityLockdown = async (patch: Record<string, unknown>, onApplied: () => void) => {
    setErrorToast(null);
    const nextConfig = { ...fullLockdownConfig, ...patch };
    try {
      const res = await fetch('/api/admin/cms-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'security_lockdown',
          value: nextConfig,
          sudoVerified: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorToast(data.error || `Failed to persist security setting (HTTP ${res.status}).`);
        return;
      }
      setFullLockdownConfig(nextConfig);
      onApplied();
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (err) {
      setErrorToast(
        err instanceof Error ? `Network error saving security configuration: ${err.message}` : 'Unable to save security configuration.'
      );
    }
  };

  useEffect(() => {
    if (!isSudoActive || !sudoExpiresAt) {
      const timer = window.setTimeout(() => setRemainingTimeStr(''), 0);
      return () => window.clearTimeout(timer);
    }

    const interval = setInterval(() => {
      const remainingSec = Math.max(0, Math.floor((sudoExpiresAt - Date.now()) / 1000));
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      setRemainingTimeStr(`${mins}:${secs.toString().padStart(2, '0')}`);
      if (remainingSec <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSudoActive, sudoExpiresAt]);

  const handleAddIp = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = newIpInput.trim();
    if (!candidate) return;
    requireSudo(async () => {
      const nextIps = [...whitelistedIps, candidate];
      await persistSecurityLockdown({ admin_whitelisted_ips: nextIps }, () => {
        setWhitelistedIps(nextIps);
        setNewIpInput('');
      });
    }, 'Add New Trusted Admin IP Address');
  };

  const handleToggleStrictLockdown = () => {
    const nextVal = !strictIpLockdown;
    requireSudo(async () => {
      await persistSecurityLockdown({ strict_ip_country_whitelist: nextVal }, () => {
        setStrictIpLockdown(nextVal);
      });
    }, `${strictIpLockdown ? 'Disable' : 'Enable'} Strict Admin IP Lockdown`);
  };

  const handleToggleFreeze = () => {
    const nextVal = !emergencyFreeze;
    requireSudo(async () => {
      await persistSecurityLockdown({ freeze_all_withdrawals: nextVal }, () => {
        setEmergencyFreeze(nextVal);
      });
    }, `${emergencyFreeze ? 'Deactivate' : 'ACTIVATE'} Emergency Platform Freeze`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-rose-600/10 via-amber-600/10 to-rose-600/10 border border-rose-500/20">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[11px] font-mono font-semibold mb-1 border border-rose-200 dark:border-rose-800">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            <span>Founder &amp; Owner Security Vault</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Root Admin Controls, Master Sudo &amp; IP Geofence
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
            Strict biometric &amp; TOTP step-up authentication protects high-stakes actions like altering price models, approving payouts, and WHM server root commands.
          </p>
        </div>

        {/* Live Sudo Status */}
        <div className="flex items-center gap-2">
          {isSudoActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
              <Unlock className="w-4 h-4" />
              <span>Sudo Active ({remainingTimeStr})</span>
              <button
                type="button"
                onClick={revokeSudo}
                className="ml-1 text-[10px] underline hover:text-rose-600 cursor-pointer"
              >
                Lock Now
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => requireSudo(() => {}, 'Elevate Root Sudo Session')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-sm hover:bg-slate-800"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Elevate Sudo Session</span>
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Sign Out of Founder NOC"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-mono text-xs flex items-center gap-2 animate-in fade-in shadow-md shadow-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span>Admin security configuration updated successfully!</span>
        </div>
      )}
      {errorToast && (
        <div className="p-3.5 rounded-xl bg-rose-600 text-white font-mono text-xs flex items-center gap-2 animate-in fade-in shadow-md shadow-rose-600/20">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* SECTION 1: MASTER SUDO STEP-UP ARCHITECTURE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-rose-600" />
            <span>Master Sudo Step-Up Guard Specifications</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Zero-Trust Policy: Sensitive actions cannot be executed merely because you are logged into `/admin`. Every critical mutation prompts `SudoGateModal`.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          {[
            {
              title: 'Pricing & Unit Costs',
              desc: 'Editing package price, unit server cost, or min owner profit',
              level: 'Strict 2FA / PIN',
            },
            {
              title: 'Affiliate Payouts',
              desc: 'Approving manual bKash/Nagad withdrawals or modifying thresholds',
              level: 'Strict 2FA / PIN',
            },
            {
              title: 'Client Impersonation',
              desc: 'Logging in as customer to inspect databases and SSH files',
              level: 'Strict 2FA / PIN',
            },
            {
              title: 'WHM Node Commands',
              desc: 'Triggering hard cPanel restarts, account suspends or terminations',
              level: 'Strict 2FA / PIN',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white font-sans text-xs">{item.title}</strong>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Locked</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-sans">{item.desc}</p>
              <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-200/60 dark:border-white/5">
                Guard: {item.level}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ADMIN IP WHITELIST & EMERGENCY FREEZE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* IP Whitelist (8 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Admin IP Geofence &amp; Whitelist</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Only requests from these IP addresses can access the `/admin` command center when strict lockdown is enabled.
            </p>
          </div>

          {/* Add IP Form */}
          <form onSubmit={handleAddIp} className="flex gap-2 text-xs font-mono">
            <input
              type="text"
              placeholder="e.g. 103.112.44.18 (Dhaka Office)"
              value={newIpInput}
              onChange={(e) => setNewIpInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-sans text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add IP</span>
            </button>
          </form>

          {/* List of Whitelisted IPs */}
          <div className="space-y-2 font-mono text-xs">
            {whitelistedIps.map((ip, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-800 dark:text-zinc-200 font-bold">{ip}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    requireSudo(async () => {
                      const nextIps = whitelistedIps.filter((_, i) => i !== idx);
                      await persistSecurityLockdown({ admin_whitelisted_ips: nextIps }, () => {
                        setWhitelistedIps(nextIps);
                      });
                    }, `Remove Whitelisted IP: ${ip}`)
                  }
                  className="text-slate-400 hover:text-rose-600 cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Platform Freeze & Lockdown (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>Security Lockdown Toggles</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              High-impact operational switches.
            </p>
          </div>

          <div className="space-y-3">
            {/* Toggle 1: Strict IP Lockdown */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white font-sans text-xs">
                  Strict IP Lockdown
                </strong>
                <button
                  type="button"
                  onClick={handleToggleStrictLockdown}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${
                    strictIpLockdown ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      strictIpLockdown ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <span className="text-[10px] text-slate-500 block leading-relaxed font-sans">
                When active, any request to `/admin` originating from an unwhitelisted IP address is immediately rejected with HTTP 403 Forbidden.
              </span>
            </div>

            {/* Toggle 2: Emergency Platform Freeze */}
            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-rose-900 dark:text-rose-200 font-sans text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Emergency Freeze</span>
                </strong>
                <button
                  type="button"
                  onClick={handleToggleFreeze}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${
                    emergencyFreeze ? 'bg-rose-600' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      emergencyFreeze ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <span className="text-[10px] text-rose-700 dark:text-rose-300 block leading-relaxed font-sans">
                Temporarily locks all automated payouts, provisioning, and wallet deductions during security incident investigations.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: LOGIN ANOMALIES & FAILED ATTEMPT INSPECTOR */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Login Anomaly &amp; Failed Attempt Inspector</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Live Edge telemetry tracking failed admin attempts, rate-limited IPs, and sudo escalations.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-mono font-bold">
            Live Stream
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-xs">
          {auditLogs.length === 0 && fraudAlerts.length === 0 ? (
            <div className="py-6 text-center text-slate-500 dark:text-zinc-400">
              No security audit or anomaly events recorded yet for this environment.
            </div>
          ) : (
            auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        log.riskLevel === 'critical' || log.riskLevel === 'high'
                          ? 'bg-rose-500'
                          : log.riskLevel === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <strong className="text-slate-900 dark:text-white font-sans text-xs">{log.action}</strong>
                    <span className="text-[10px] text-slate-400">({log.ip || 'edge'})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block font-sans">
                    Actor: {log.actor} · Target: {log.target}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{log.timestamp}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
