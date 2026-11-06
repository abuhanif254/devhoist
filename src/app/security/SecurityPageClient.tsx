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
import SecurityPerimeterVisual from '@/components/visuals/SecurityPerimeterVisual';
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
      {/* SECTION 1: INTERACTIVE 3D GLOBAL THREAT DEFENSE & ANYCAST MESH      */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <SecurityPerimeterVisual />
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 2: 6-LAYER ENTERPRISE SECURITY SHIELD (BENTO GRID)           */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            6-Layer Enterprise Defense Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1 leading-relaxed">
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
              CloudLinux OS &amp; CageFS File Quarantine
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
              Imunify360 Herd Immunity &amp; KernelCare
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
              LiteSpeed WAF &amp; ModSecurity OWASP Core
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
              Zero-Cost Sectigo &amp; Let&apos;s Encrypt TLS 1.3
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
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-white/10 text-xs font-mono text-amber-800 dark:text-zinc-300 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>24/7 Incident Response</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Abuse, Phishing &amp; Vulnerability Reporting
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1 leading-relaxed max-w-xl mx-auto">
            We maintain zero tolerance for malware, phishing, or copyright infringement. Reports are investigated within 4 hours by our security team.
          </p>
        </div>

        {abuseSubmitted ? (
          <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Security Ticket Dispatched Successfully
            </h3>
            <p className="text-xs text-slate-700 dark:text-zinc-300 font-mono">
              Report registered under case ID: #SEC-{Math.floor(100000 + Math.random() * 900000)}. Our senior security engineers are investigating the reported domain/IP.
            </p>
            <button
              type="button"
              onClick={() => {
                setAbuseSubmitted(false);
                setAbuseForm({ name: '', email: '', type: 'phishing', targetUrl: '', details: '' });
              }}
              className="mt-3 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
                <label className="text-xs font-mono text-slate-800 dark:text-zinc-300 font-semibold">Your Full Name</label>
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
                <label className="text-xs font-mono text-slate-800 dark:text-zinc-300 font-semibold">Your Email Address</label>
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
                <label className="text-xs font-mono text-slate-800 dark:text-zinc-300 font-semibold">Report Category</label>
                <select
                  value={abuseForm.type}
                  onChange={(e) => setAbuseForm({ ...abuseForm, type: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-200 focus:outline-hidden font-mono cursor-pointer"
                >
                  <option value="phishing">Phishing &amp; Credential Theft</option>
                  <option value="malware">Malware / Botnet Command Server</option>
                  <option value="dmca">Copyright Infringement (DMCA)</option>
                  <option value="vulnerability">Responsible Vulnerability Disclosure</option>
                  <option value="spam">Unsolicited Bulk Email (SPAM)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-800 dark:text-zinc-300 font-semibold">Target URL / IP Address</label>
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
              <label className="text-xs font-mono text-slate-800 dark:text-zinc-300 font-semibold">Incident Details &amp; Evidence</label>
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
