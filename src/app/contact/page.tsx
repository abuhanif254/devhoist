'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import {
  Send,
  Mail,
  Clock,
  Phone,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { CONTACT_DATA } from '@/config/legalData';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <Header />

      <main className="w-full relative bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden py-16 sm:py-24 transition-colors duration-200">
        {/* Subtle Architectural Grid Background with Radial Mask */}
        <div className="absolute inset-0 architectural-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/[0.07] px-4 sm:px-6 lg:px-8 space-y-16 relative">
          <span className="crosshair-corner crosshair-tl" />
          <span className="crosshair-corner crosshair-tr" />

          {/* Header */}
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>24/7/365 Bilingual Support Desk (English &amp; বাংলা)</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-zinc-50">
              We&apos;re Here to Help.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 mt-1">
                Whenever You Need.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-400 font-normal leading-relaxed">
              Have an architecture question, need migration assistance, or looking for urgent server support? Reach our engineering team directly across all official channels.
            </p>
          </div>

          {/* Contact Methods Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Native Support Ticket Desk */}
            <a
              href="/dashboard?tab=support"
              className="p-6 rounded-xl border border-blue-200 dark:border-white/20 bg-white dark:bg-zinc-950 hover:border-blue-400 dark:hover:border-white/30 transition-all space-y-3.5 shadow-sm group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
                  <Server className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                  Avg Reply: &lt; 15 mins
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Technical Support Ticket</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-zinc-200" />
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                Submit cPanel, Node.js Passenger, DNS, or billing tickets directly to our Tier-2 Linux systems administrators.
              </p>
            </a>

            {/* Emergency Hotline & WhatsApp */}
            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-zinc-200">
                  <Phone className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-white/5 font-semibold">
                  Instant Connect
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">WhatsApp &amp; Phone Desk</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                Direct phone and WhatsApp escalation line for critical server alerts and real-time migration assistance:
              </p>
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-200 pt-1">
                {CONTACT_DATA.whatsapp.number}
              </div>
            </div>

            {/* Direct NOC Email */}
            <div className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-zinc-900 border border-indigo-200 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-zinc-200">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-white/5 font-semibold">
                  24/7 Monitored
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Direct NOC Dispatch</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
                Email our central network operations center directly for sales inquiries, domain approvals, or custom hardware quotes:
              </p>
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-200 pt-1">
                support@devhostcloud.com
              </div>
            </div>
          </div>

          {/* Contact Inquiry Form */}
          <div className="max-w-2xl mx-auto rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Send an Engineering Inquiry</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 font-normal">
                Fill out this quick form and our support engineers will review your inquiry immediately.
              </p>
            </div>

            {submitted ? (
              <div className="p-6 rounded-lg bg-emerald-50 dark:bg-zinc-900/50 border border-emerald-200 dark:border-white/10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Inquiry Received</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">
                  Thank you! An engineer has been paged and will respond to <strong className="text-slate-900 dark:text-zinc-200 font-mono">{email}</strong> within 15 minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Subject *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Next.js cPanel Configuration or Migration Question"
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Message / Technical Requirement *</label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your project, visitor requirements, or existing hosting details..."
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Message to Support Team</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
