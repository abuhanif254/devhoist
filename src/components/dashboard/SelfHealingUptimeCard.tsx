'use client';

import React, { useState } from 'react';
import { ShieldCheck, Activity, CheckCircle2, AlertTriangle, Zap, Clock, Lock, Loader2 } from 'lucide-react';
import { generate30DayUptimeBars, DayUptimeBar } from '@/lib/selfHealingEngine';

interface SelfHealingUptimeCardProps {
  serviceId: string;
  domain: string;
  userId?: string;
  uptimePercent?: number;
  avgLatencyMs?: number;
  sslDaysRemaining?: number;
}

export default function SelfHealingUptimeCard({
  serviceId,
  domain,
  userId,
  uptimePercent = 99.99,
  avgLatencyMs = 38,
  sslDaysRemaining = 88,
}: SelfHealingUptimeCardProps) {
  const [healingLoading, setHealingLoading] = useState(false);
  const [healingFeedback, setHealingFeedback] = useState<string | null>(null);
  const [healingError, setHealingError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<DayUptimeBar | null>(null);

  // Generate 30-day visual uptime status strip
  const bars = generate30DayUptimeBars(uptimePercent);

  const handleSelfHeal = async () => {
    setHealingLoading(true);
    setHealingFeedback(null);
    setHealingError(null);

    try {
      const res = await fetch('/api/hosting/self-heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          domain,
          userId,
          incidentType: 'http_503_passenger_hang',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.healingResult) {
        setHealingFeedback(
          data.message || `Self-Healing Engine recycled Passenger workers & flushed LSCache in ${(data.healingResult.durationMs / 1000).toFixed(1)}s — operational.`
        );
      } else {
        setHealingError(data.error || `Self-healing command failed (HTTP ${res.status}). Check server logs or try again.`);
      }
    } catch (err) {
      setHealingError(
        err instanceof Error ? `Self-healing engine unreachable: ${err.message}` : 'Unable to reach Self-Healing Engine.'
      );
    } finally {
      setHealingLoading(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Autonomous 30-Day SLA Uptime &amp; Self-Healing
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                99.99% SLA Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Continuously probed across Singapore SG1 and Global Edge PoPs
            </p>
          </div>
        </div>

        {/* 1-Click Self-Heal Action */}
        <button
          type="button"
          disabled={healingLoading}
          onClick={handleSelfHeal}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {healingLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Self-Healing Engine Running...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ Self-Healing Auto-Restart</span>
            </>
          )}
        </button>
      </div>

      {/* 30-Day Status Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>30 Days Ago</span>
          <span className="font-semibold text-slate-700 dark:text-zinc-300">
            {hoveredBar ? `${hoveredBar.dateStr}: ${hoveredBar.uptimePercent}% Uptime` : '100% Operational (Past 30 Days)'}
          </span>
          <span>Today</span>
        </div>

        {/* 30 Visual Bars */}
        <div className="grid grid-cols-30 gap-1 h-8 items-end bg-slate-100/60 dark:bg-zinc-950/50 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
          {bars.map((bar) => {
            const isUp = bar.status === 'up';
            return (
              <div
                key={bar.dayIndex}
                onMouseEnter={() => setHoveredBar(bar)}
                onMouseLeave={() => setHoveredBar(null)}
                className={`w-full rounded-sm transition-all cursor-pointer ${
                  isUp
                    ? 'h-6 bg-emerald-500 hover:bg-emerald-400 dark:bg-emerald-500'
                    : 'h-4 bg-amber-500 hover:bg-amber-400'
                }`}
                title={`${bar.dateStr}: ${bar.uptimePercent}% uptime`}
              />
            );
          })}
        </div>
      </div>

      {/* Performance & SLA Telemetry Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-white/5 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">Average Edge TTFB</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {avgLatencyMs}ms (BDIX Singapore)
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-white/5 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">TLS 1.3 AutoSSL</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {sslDaysRemaining} Days (Auto-Renew Active)
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-white/5 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">Passenger Watchdog</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              1.2s Auto-Recovery Guard
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Alert Banner */}
      {healingFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{healingFeedback}</span>
        </div>
      )}
      {healingError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{healingError}</span>
        </div>
      )}
    </div>
  );
}
