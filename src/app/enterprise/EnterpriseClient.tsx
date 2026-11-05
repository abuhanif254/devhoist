'use client';

import React, { useState } from 'react';
import {
  Server,
  Cpu,
  Layers,
  ShieldCheck,
  Send,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Globe,
  Radio,
  Building2,
  FileCheck,
  MessageSquare,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';

export default function EnterpriseClient() {
  const { openStackBuilder } = useBilling();

  const [auditForm, setAuditForm] = useState({
    name: '',
    email: '',
    company: '',
    trafficRps: '1,000–5,000 req/s',
    stack: 'Next.js / Node.js + PostgreSQL',
    notes: '',
  });
  const [auditSubmitted, setAuditSubmitted] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setAuditLoading(false);
    setAuditSubmitted(true);
  };

  return (
    <div className="space-y-20">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION 1: MULTI-REGION HIGH-AVAILABILITY ARCHITECTURE DIAGRAM      */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Multi-Tier Redundant High-Availability Architecture</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            Zero single point of failure (SPOF) with automatic failover in under 1.2 seconds.
          </p>
        </div>

        {/* SVG Flowchart Container */}
        <div className="p-6 sm:p-10 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 architectural-grid opacity-30 pointer-events-none" />

          {/* Architecture Flow SVG */}
          <div className="relative w-full max-w-4xl mx-auto py-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Step 1: Anycast Edge */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-center space-y-2 shadow-xs">
                <Globe className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">1. Global Anycast Edge</div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">
                  Cloudflare 300+ Edge PoPs with Terabit DDoS Scrubbing
                </p>
              </div>

              {/* Step 2: Load Balancer */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-center space-y-2 shadow-xs">
                <Layers className="w-6 h-6 text-slate-700 dark:text-zinc-200 mx-auto" />
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">2. HAProxy Balancer</div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">
                  Round-Robin SSL Offloading & Health Checks
                </p>
              </div>

              {/* Step 3: Compute Cluster */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-zinc-900/90 border border-emerald-300 dark:border-emerald-500/30 text-center space-y-2 shadow-xs ring-1 ring-emerald-500/20">
                <Server className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">3. Primary + Replica</div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                  Dual AMD EPYC Bare-Metal NVMe Nodes (Singapore SG1)
                </p>
              </div>

              {/* Step 4: S3 Backup */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-center space-y-2 shadow-xs">
                <ShieldCheck className="w-6 h-6 text-slate-700 dark:text-zinc-200 mx-auto" />
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">4. Offsite Disaster Sync</div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">
                  AES-256 S3 Encrypted Immutable Snapshots
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/[0.08] text-center text-xs font-mono text-slate-600 dark:text-zinc-400">
              ⚡ Guaranteed RTO (Recovery Time Objective) &lt; 5 minutes • RPO (Recovery Point Objective) &lt; 1 hour
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 2: DEDICATED BARE-METAL & HA CLUSTER SPECS TABLE             */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Dedicated Bare-Metal & HA Compute Specs
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            Pure dedicated hardware with zero virtualization overhead for high-concurrency workloads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* E-1 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-400">Dedicated Bare-Metal</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">Enterprise E-1</h3>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-50 mt-2">
                  ৳14,500 <span className="text-xs font-normal text-slate-500 dark:text-zinc-500">/mo</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1.5 text-xs font-mono text-slate-700 dark:text-zinc-300">
                <div>AMD EPYC 8 Cores (16 Threads)</div>
                <div>32 GB ECC DDR5 4800MHz RAM</div>
                <div>2x 500 GB PCIe Gen4 NVMe (RAID-1)</div>
                <div>10 Gbps Redundant Uplink (30 TB BW)</div>
                <div>1 Dedicated Clean IPv4 Subnet</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                openStackBuilder({
                  pid: 103,
                  planName: 'Enterprise E-1 Bare-Metal',
                  basePriceMonthlyBDT: 14500,
                  basePriceMonthlyUSD: 120.83,
                  specs: {
                    ram: '32 GB ECC DDR5',
                    cpu: 'AMD EPYC 8 Cores',
                    storage: '2x 500GB NVMe RAID-1',
                  },
                })
              }
              className="w-full h-10 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              Order Enterprise E-1
            </button>
          </div>

          {/* E-2 */}
          <div className="p-6 rounded-xl bg-blue-50/40 dark:bg-zinc-900/80 border-2 border-blue-600 dark:border-white/20 flex flex-col justify-between space-y-5 shadow-xl relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30">
              High Concurrency
            </span>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-blue-600 dark:text-emerald-400 font-semibold">Production Beast</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">Enterprise E-2</h3>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-50 mt-2">
                  ৳24,000 <span className="text-xs font-normal text-slate-500 dark:text-zinc-500">/mo</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] space-y-1.5 text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-xs">
                <div>AMD EPYC 16 Cores (32 Threads)</div>
                <div>64 GB ECC DDR5 4800MHz RAM</div>
                <div>2x 1 TB Enterprise NVMe (RAID-1)</div>
                <div>10 Gbps Redundant Uplink (50 TB BW)</div>
                <div>Hardware IPMI & Remote KVM</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                openStackBuilder({
                  pid: 104,
                  planName: 'Enterprise E-2 Bare-Metal',
                  basePriceMonthlyBDT: 24000,
                  basePriceMonthlyUSD: 200.0,
                  specs: {
                    ram: '64 GB ECC DDR5',
                    cpu: 'AMD EPYC 16 Cores',
                    storage: '2x 1TB Enterprise NVMe',
                  },
                })
              }
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              Order Enterprise E-2
            </button>
          </div>

          {/* Custom Cluster */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-400">Tailored Architecture</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">Custom HA Cluster</h3>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-50 mt-2">
                  Custom Quote
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.06] space-y-1.5 text-xs font-mono text-slate-700 dark:text-zinc-300">
                <div>2x Load-Balanced Web Application Nodes</div>
                <div>1x Primary + 1x Replica PostgreSQL/MySQL</div>
                <div>Redis Sentinel Multi-Node Cache</div>
                <div>Dedicated Senior DevOps Incident Channel</div>
                <div>Custom Government / Tender B2B Billing</div>
              </div>
            </div>

            <a
              href="#audit-form"
              className="w-full h-10 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center justify-center transition-colors"
            >
              Request Cluster Quote
            </a>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 3: B2B SLA & AUDIT INQUIRY FORM                             */}
      {/* -------------------------------------------------------------------- */}
      <section id="audit-form" className="max-w-2xl mx-auto space-y-6">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 mb-2">
            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" />
            <span>Senior DevOps Consultation</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Request an Architecture Audit & Quote
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            Our principal infrastructure architects will review your project requirements and respond within 6 business hours.
          </p>
        </div>

        {auditSubmitted ? (
          <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
              Audit Request Registered
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 font-mono">
              Our enterprise solutions lead will contact {auditForm.email} via email and WhatsApp.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleAuditSubmit}
            className="p-6 sm:p-7 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] space-y-4 shadow-xl text-xs font-mono"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-zinc-400 font-medium">Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="CTO / Tech Lead"
                  value={auditForm.name}
                  onChange={(e) => setAuditForm({ ...auditForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-zinc-400 font-medium">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="tech@company.com"
                  value={auditForm.email}
                  onChange={(e) => setAuditForm({ ...auditForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-zinc-400 font-medium">Company / Organization</label>
                <input
                  type="text"
                  required
                  placeholder="Acme FinTech Ltd."
                  value={auditForm.company}
                  onChange={(e) => setAuditForm({ ...auditForm, company: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-zinc-400 font-medium">Current / Target Concurrency</label>
                <select
                  value={auditForm.trafficRps}
                  onChange={(e) => setAuditForm({ ...auditForm, trafficRps: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="500–1,000 req/s">500–1,000 req/s</option>
                  <option value="1,000–5,000 req/s">1,000–5,000 req/s</option>
                  <option value="5,000–20,000 req/s">5,000–20,000 req/s</option>
                  <option value="20,000+ req/s">20,000+ req/s (Enterprise)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-700 dark:text-zinc-400 font-medium">Infrastructure Notes & Requirements</label>
              <textarea
                rows={3}
                placeholder="Mention database engines, custom networking, compliance rules, or SLA requirements..."
                value={auditForm.notes}
                onChange={(e) => setAuditForm({ ...auditForm, notes: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 focus:outline-hidden resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={auditLoading}
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-sans font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Submit Enterprise Audit Request</span>
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
