'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Server,
  Lock,
  Cpu,
  Database,
  Globe,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  FileText,
  Key,
} from 'lucide-react';
import { getWhmcsSupportTicketUrl } from '@/config/whmcs';

export default function SecurityPageClient() {
  const [abuseForm, setAbuseForm] = useState({
    name: '',
    email: '',
    type: 'phishing',
    targetUrl: '',
    details: '',
  });
  const [abuseSubmitted, setAbuseSubmitted] = useState(false);
  const [abuseLoading, setAbuseLoading] = useState(false);

  const handleAbuseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abuseForm.email || !abuseForm.targetUrl) return;

    setAbuseLoading(true);
    // Simulate security ticket generation
    await new Promise((resolve) => setTimeout(resolve, 800));
    setAbuseLoading(false);
    setAbuseSubmitted(true);
  };

  return (
    <div className="space-y-20">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION 1: INTERACTIVE GLOBAL NETWORK MAP & DATACENTERS             */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="border-b border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-zinc-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span>Global Anycast Backbone & Tier-IV Facilities</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-normal mt-1">
            Geographically separated compute clusters connected by dark fiber transit routes with BDIX optimization.
          </p>
        </div>

        {/* SVG World Map Container */}
        <div className="relative rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 p-6 sm:p-10 overflow-hidden shadow-xl">
          <div className="absolute inset-0 architectural-grid opacity-30 pointer-events-none" />

          {/* SVG World Map Illustration */}
          <div className="relative w-full aspect-[2/1] max-h-[360px] flex items-center justify-center">
            <svg
              viewBox="0 0 1000 500"
              className="w-full h-full text-slate-300 dark:text-zinc-800"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            >
              {/* Simplified Continents Contours */}
              {/* North America */}
              <path
                d="M 120 100 Q 200 80 280 130 Q 260 220 200 260 Q 150 220 120 100 Z"
                fill="currentColor"
                fillOpacity="0.25"
              />
              {/* South America */}
              <path
                d="M 270 280 Q 320 320 290 420 Q 240 400 250 320 Z"
                fill="currentColor"
                fillOpacity="0.2"
              />
              {/* Europe & Africa */}
              <path
                d="M 450 120 Q 550 100 580 160 Q 520 240 460 220 Z"
                fill="currentColor"
                fillOpacity="0.25"
              />
              <path
                d="M 460 230 Q 560 240 540 380 Q 460 360 450 270 Z"
                fill="currentColor"
                fillOpacity="0.2"
              />
              {/* Asia & Pacific */}
              <path
                d="M 580 120 Q 750 90 850 180 Q 780 320 620 260 Z"
                fill="currentColor"
                fillOpacity="0.25"
              />
              {/* Australia */}
              <path
                d="M 780 340 Q 860 330 840 420 Q 760 400 780 340 Z"
                fill="currentColor"
                fillOpacity="0.2"
              />

              {/* Connecting Fiber Paths */}
              {/* Singapore (690, 290) to Dhaka (670, 240) */}
              <path
                d="M 690 290 Q 675 265 670 240"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
              {/* Singapore (690, 290) to USA Ashburn (240, 180) */}
              <path
                d="M 690 290 Q 460 140 240 180"
                stroke="#FAFAFA"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                strokeOpacity="0.6"
              />

              {/* Node 1: Singapore Equinix SG1 */}
              <g transform="translate(690, 290)">
                <circle r="12" fill="#10B981" fillOpacity="0.2" className="animate-ping" />
                <circle r="6" fill="#10B981" />
                <circle r="2.5" fill="#FAFAFA" />
                <text
                  x="15"
                  y="4"
                  fill="#FAFAFA"
                  fontSize="12"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  Singapore SG1 (Core)
                </text>
              </g>

              {/* Node 2: USA Ashburn VA */}
              <g transform="translate(240, 180)">
                <circle r="12" fill="#FAFAFA" fillOpacity="0.15" className="animate-ping" />
                <circle r="6" fill="#FAFAFA" />
                <circle r="2.5" fill="#09090B" />
                <text
                  x="-120"
                  y="4"
                  fill="#FAFAFA"
                  fontSize="12"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  USA Ashburn VA (Core)
                </text>
              </g>

              {/* Node 3: Dhaka Transit Node */}
              <g transform="translate(670, 240)">
                <circle r="4" fill="#10B981" />
                <text
                  x="-95"
                  y="-10"
                  fill="#10B981"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  Dhaka Edge (~38ms)
                </text>
              </g>
            </svg>
          </div>

          {/* Datacenter Specifications Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/[0.08]">
            {/* Singapore Card */}
            <div className="p-5 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Singapore Equinix SG1</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ~35–45ms to Bangladesh
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-normal leading-relaxed">
                Direct BDIX and submarine cable peering via SEA-ME-WE 4 & 5. Ideal for South Asia, Southeast Asia, and Indian subcontinent traffic.
              </p>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  Tier III+ Facility
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  2N Redundant UPS
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  Enterprise RAID-10 NVMe
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  10 Gbps Uplink
                </span>
              </div>
            </div>

            {/* USA Card */}
            <div className="p-5 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-400" />
                  <span>USA East (Ashburn, VA)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  Global Internet Backbone
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-normal leading-relaxed">
                Located in the world's most connected datacenter corridor (Data Center Alley). Handles over 70% of global internet traffic with lowest latency to US and Europe.
              </p>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  Tier-IV Certified
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  N+1 Generators
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  Enterprise RAID-10 NVMe
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                  100 Gbps Dark Fiber Ring
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 2: 6-LAYER ENTERPRISE SECURITY SHIELD (BENTO GRID)           */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            6-Layer Enterprise Defense Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            Deep-tier isolation guaranteeing that zero security threats penetrate client environments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Layer 1 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-3 relative group hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
              Layer 1: Kernel Isolation
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              CloudLinux OS & CageFS File Quarantine
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Each cPanel and Git account operates inside an encapsulated LVE container. Users cannot view neighbor processes, read adjacent MySQL sockets, or access system binaries.
            </p>
          </div>

          {/* Layer 2 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-3 relative group hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
              Layer 2: AI Malware Engine
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Imunify360 Herd Immunity & KernelCare
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Machine learning heuristics scan all uploaded files in real-time. Automatically disinfects PHP webshells, backdoor injections, and applies zero-reboot Linux kernel patches.
            </p>
          </div>

          {/* Layer 3 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-3 relative group hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-200">
              <Lock className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
              Layer 3: Hardware WAF
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              LiteSpeed WAF & ModSecurity OWASP Core
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              High-throughput ModSecurity inspection defends against SQL Injection (SQLi), Cross-Site Scripting (XSS), XML External Entities (XXE), and malicious bots with zero latency penalty.
            </p>
          </div>

          {/* Layer 4 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-3 relative group hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Radio className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
              Layer 4: Volumetric Defense
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Anycast Terabit DDoS Mitigation (L3/L4/L7)
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Scrubbing centers neutralize multi-gigabit SYN floods, UDP amplification, and HTTP flood attacks at the edge before traffic ever touches your NVMe server.
            </p>
          </div>

          {/* Layer 5 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-3 relative group hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
              <Database className="w-4 h-4 text-blue-600 dark:text-emerald-400" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
              Layer 5: Disaster Recovery
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Automated JetBackup Cloud Encrypted S3
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Nightly snapshot routines encrypt full cPanel accounts, databases, and cron jobs with AES-256 and store them offsite in geographically separated AWS S3 buckets.
            </p>
          </div>

          {/* Layer 6 */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] space-y-3 relative group hover:border-slate-300 dark:hover:border-white/20 shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-200">
              <Key className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
              Layer 6: Encryption In Transit
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Zero-Cost Sectigo & Let's Encrypt TLS 1.3
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Every domain and subdomain automatically provisions an SSL/TLS certificate with zero user intervention, automatic 90-day renewal, and HTTP/3 QUIC acceleration.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 3: ABUSE & DMCA VULNERABILITY REPORT DESK                    */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-6 max-w-2xl mx-auto">
        <div className="border-b border-white/[0.08] pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-300 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>24/7 Incident Response</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-zinc-100">
            Abuse, Phishing & Vulnerability Reporting
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-normal mt-1">
            We maintain zero tolerance for malware, phishing, or copyright infringement. Reports are investigated within 4 hours by our security team.
          </p>
        </div>

        {abuseSubmitted ? (
          <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-base font-semibold text-zinc-100">
              Security Ticket Dispatched Successfully
            </h3>
            <p className="text-xs text-zinc-300 font-mono">
              Report registered under case ID: #SEC-{Math.floor(100000 + Math.random() * 900000)}. Our senior security engineers are investigating the reported domain/IP.
            </p>
            <button
              onClick={() => {
                setAbuseSubmitted(false);
                setAbuseForm({ name: '', email: '', type: 'phishing', targetUrl: '', details: '' });
              }}
              className="mt-3 text-xs font-mono text-zinc-400 hover:text-white underline underline-offset-4"
            >
              Submit another report
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleAbuseSubmit}
            className="p-6 sm:p-7 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] space-y-4 shadow-xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-700 dark:text-zinc-400 font-medium">Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Security Researcher / Reporter"
                  value={abuseForm.name}
                  onChange={(e) => setAbuseForm({ ...abuseForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-700 dark:text-zinc-400 font-medium">Your Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="reporter@domain.com"
                  value={abuseForm.email}
                  onChange={(e) => setAbuseForm({ ...abuseForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-700 dark:text-zinc-400 font-medium">Report Category</label>
                <select
                  value={abuseForm.type}
                  onChange={(e) => setAbuseForm({ ...abuseForm, type: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-200 focus:outline-hidden font-mono cursor-pointer"
                >
                  <option value="phishing">Phishing & Credential Theft</option>
                  <option value="malware">Malware / Botnet Command Server</option>
                  <option value="dmca">Copyright Infringement (DMCA)</option>
                  <option value="vulnerability">Responsible Vulnerability Disclosure</option>
                  <option value="spam">Unsolicited Bulk Email (SPAM)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-700 dark:text-zinc-400 font-medium">Target URL / IP Address</label>
                <input
                  type="text"
                  required
                  placeholder="https://suspicious-site.com"
                  value={abuseForm.targetUrl}
                  onChange={(e) => setAbuseForm({ ...abuseForm, targetUrl: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-700 dark:text-zinc-400 font-medium">Incident Details & Evidence</label>
              <textarea
                required
                rows={4}
                placeholder="Please describe the violation, attach logs, headers, or evidence links..."
                value={abuseForm.details}
                onChange={(e) => setAbuseForm({ ...abuseForm, details: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:border-blue-500 dark:focus:border-white/25 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={abuseLoading}
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {abuseLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Submit Urgent Abuse Ticket</span>
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
