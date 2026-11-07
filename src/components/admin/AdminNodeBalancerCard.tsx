'use client';

import React from 'react';
import { Layers, Server, AlertTriangle, ShieldCheck, Cpu, HardDrive } from 'lucide-react';
import { computeNodeHealthScore, WhmServerNodeRecord } from '@/lib/nodeBalancer';

interface AdminNodeBalancerCardProps {
  nodes: WhmServerNodeRecord[];
}

export default function AdminNodeBalancerCard({ nodes }: AdminNodeBalancerCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>Smart Multi-Node Bin-Packing Balancer</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                Autonomous Headroom Optimizer
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Accounts are auto-provisioned to nodes with highest available capacity headroom (60% slot / 40% disk weighting)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((node) => {
          const { score, slotPercent, diskPercent, isNearCapacity } = computeNodeHealthScore(node);

          return (
            <div
              key={node.id}
              className={`p-4 rounded-xl border transition-all ${
                isNearCapacity
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-50 dark:bg-zinc-950/40 border-slate-200 dark:border-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                      {node.node_name} ({node.node_code.toUpperCase()})
                    </h5>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {node.datacenter_location} • {node.ipv4_address}
                    </span>
                  </div>
                </div>

                {/* Score Pill */}
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Headroom</span>
                  <span
                    className={`font-mono font-black text-sm ${
                      score >= 70
                        ? 'text-emerald-600'
                        : score >= 40
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {score}/100
                  </span>
                </div>
              </div>

              {/* Progress Meters */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-zinc-400 mb-1">
                    <span>cPanel Slot Utilization</span>
                    <span className="font-mono font-semibold">
                      {node.used_cpanel_slots}/{node.max_cpanel_slots} ({slotPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        slotPercent >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${slotPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-zinc-400 mb-1">
                    <span>NVMe Disk Allocation</span>
                    <span className="font-mono font-semibold">
                      {node.allocated_disk_gb}/{node.max_disk_gb} GB ({diskPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        diskPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${diskPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Threshold Warning Banner */}
              {isNearCapacity && (
                <div className="mt-3 p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>80% threshold exceeded. Recommend adding next node in cluster.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
