'use client';

import React, { useState } from 'react';
import { Globe, Server, Activity, ShieldCheck, Zap } from 'lucide-react';

interface DatacenterNode {
  id: string;
  city: string;
  country: string;
  facility: string;
  latencyToBD: string;
  uptime: string;
  bandwidth: string;
  x: number; // SVG %
  y: number; // SVG %
  color: string;
}

const NODES: DatacenterNode[] = [
  {
    id: 'sg',
    city: 'Singapore',
    country: 'Singapore',
    facility: 'Equinix SG1 Tier-IV',
    latencyToBD: '38ms (BDIX Peer)',
    uptime: '99.99%',
    bandwidth: '40 Gbps Uplink',
    x: 74,
    y: 58,
    color: '#2563EB',
  },
  {
    id: 'dhaka',
    city: 'Dhaka',
    country: 'Bangladesh',
    facility: 'Direct BDIX Edge Cache',
    latencyToBD: '4ms (Local)',
    uptime: '100%',
    bandwidth: '10 Gbps BDIX',
    x: 69,
    y: 45,
    color: '#059669',
  },
  {
    id: 'us',
    city: 'Ashburn, VA',
    country: 'United States',
    facility: 'Equinix DC2 Tier-IV',
    latencyToBD: '185ms (Global)',
    uptime: '99.99%',
    bandwidth: '100 Gbps Core',
    x: 24,
    y: 38,
    color: '#4F46E5',
  },
  {
    id: 'lon',
    city: 'London',
    country: 'United Kingdom',
    facility: 'Telehouse North Two',
    latencyToBD: '125ms (Europe)',
    uptime: '99.99%',
    bandwidth: '40 Gbps Linx',
    x: 47,
    y: 32,
    color: '#7C3AED',
  },
  {
    id: 'fra',
    city: 'Frankfurt',
    country: 'Germany',
    facility: 'DE-CIX Interxion FRA',
    latencyToBD: '130ms (Europe)',
    uptime: '99.99%',
    bandwidth: '50 Gbps Core',
    x: 52,
    y: 35,
    color: '#0284C7',
  },
];

export default function GlobalDatacenterMap() {
  const [selectedNode, setSelectedNode] = useState<DatacenterNode>(NODES[0]);

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-xl glass-card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-2">
            <Globe className="w-3.5 h-3.5" />
            <span>High-Speed Global Anycast Backbone</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Tier-IV Datacenter Infrastructure &amp; Peering
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-2xl font-normal leading-relaxed">
            Click on any datacenter cluster to inspect routing latency, hardware redundancy, and BDIX peering interconnects.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-700 dark:text-zinc-300 shrink-0">
          <div className="text-slate-500 dark:text-zinc-500">Selected Node:</div>
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {selectedNode.city}, {selectedNode.country}
          </div>
          <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
            Latency to BD: {selectedNode.latencyToBD}
          </div>
        </div>
      </div>

      {/* Visual Interactive SVG Map Container */}
      <div className="relative w-full aspect-[2/1] min-h-[300px] mt-6 bg-slate-100/70 dark:bg-zinc-950/80 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 flex items-center justify-center">
        {/* World Map SVG Outline */}
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full object-contain pointer-events-none select-none opacity-40 dark:opacity-30"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Grid Lines */}
          <line x1="0" y1="125" x2="1000" y2="125" stroke="currentColor" strokeDasharray="4 8" strokeWidth="0.5" />
          <line x1="0" y1="250" x2="1000" y2="250" stroke="currentColor" strokeDasharray="4 8" strokeWidth="0.5" />
          <line x1="0" y1="375" x2="1000" y2="375" stroke="currentColor" strokeDasharray="4 8" strokeWidth="0.5" />
          <line x1="250" y1="0" x2="250" y2="500" stroke="currentColor" strokeDasharray="4 8" strokeWidth="0.5" />
          <line x1="500" y1="0" x2="500" y2="500" stroke="currentColor" strokeDasharray="4 8" strokeWidth="0.5" />
          <line x1="750" y1="0" x2="750" y2="500" stroke="currentColor" strokeDasharray="4 8" strokeWidth="0.5" />

          {/* Animated Fiber Optic Arcs Connecting Nodes */}
          {/* US -> UK */}
          <path
            d="M 240 190 Q 350 120 470 160"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            strokeDasharray="6 6"
            className="animate-pipeline-beam"
          />
          {/* UK -> Frankfurt */}
          <path
            d="M 470 160 Q 495 165 520 175"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            strokeDasharray="6 6"
            className="animate-pipeline-beam"
          />
          {/* Frankfurt -> Dhaka */}
          <path
            d="M 520 175 Q 600 170 690 225"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            strokeDasharray="6 6"
            className="animate-pipeline-beam"
          />
          {/* Dhaka -> Singapore */}
          <path
            d="M 690 225 Q 715 255 740 290"
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeDasharray="6 6"
            className="animate-pipeline-beam"
          />
        </svg>

        {/* Interactive Node Markers */}
        {NODES.map((node) => {
          const isSelected = selectedNode.id === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNode(node)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                {/* Ping Pulse */}
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: node.color }}
                />
                {/* Solid Core */}
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white shadow-md transition-transform ${
                    isSelected ? 'scale-125' : 'group-hover:scale-110'
                  }`}
                  style={{ backgroundColor: node.color }}
                />
              </span>

              {/* Tooltip Tag */}
              <span className="absolute top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900/90 text-white font-mono text-[10px] whitespace-nowrap opacity-90 group-hover:opacity-100 shadow-md">
                {node.city} ({node.latencyToBD.split(' ')[0]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Cluster Hardware Breakdown Specs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/10 font-mono text-xs">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10">
          <span className="text-slate-500 dark:text-zinc-500 text-[11px]">Selected Cluster:</span>
          <div className="font-bold text-slate-800 dark:text-zinc-100 mt-1">{selectedNode.facility}</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10">
          <span className="text-slate-500 dark:text-zinc-500 text-[11px]">Network Capacity:</span>
          <div className="font-bold text-blue-600 dark:text-blue-400 mt-1">{selectedNode.bandwidth}</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10">
          <span className="text-slate-500 dark:text-zinc-500 text-[11px]">Hardware SLA:</span>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-1">{selectedNode.uptime} Guaranteed</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10">
          <span className="text-slate-500 dark:text-zinc-500 text-[11px]">Routing Protocol:</span>
          <div className="font-bold text-slate-800 dark:text-zinc-100 mt-1">BGP4 + Anycast DNS</div>
        </div>
      </div>
    </div>
  );
}
