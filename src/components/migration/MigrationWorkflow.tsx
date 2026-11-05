'use client';

import React from 'react';
import { Send, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function MigrationWorkflow() {
  const steps = [
    {
      step: '01',
      title: 'Submit Old Host Details',
      desc: 'Fill out our secure migration ticket with your current cPanel, FTP, or WordPress admin credentials. We handle the rest.',
      icon: Send,
      badge: 'Takes 60 Seconds',
    },
    {
      step: '02',
      title: 'Zero-Downtime Background Transfer',
      desc: 'Our senior Linux systems engineers clone all website files, databases, SSL certs, and email mailboxes without interrupting your live site.',
      icon: RefreshCw,
      badge: 'Senior Engineers',
    },
    {
      step: '03',
      title: 'DNS Switch & Verification',
      desc: 'We preview the migrated site on a temporary test domain. Once you approve, we switch DNS with 0.0 seconds of visitor downtime.',
      icon: CheckCircle2,
      badge: 'Zero Downtime SLA',
    },
  ];

  return (
    <div className="w-full">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Our Seamless 3-Step Migration Workflow
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 font-normal leading-relaxed">
          Sit back and relax while our infrastructure team moves your entire site for free.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 hover:border-slate-300 dark:hover:border-white/[0.16] shadow-sm glass-card transition-all space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-slate-300 dark:text-zinc-700 font-mono">{s.step}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/5 font-semibold">
                  {s.badge}
                </span>
              </div>

              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
                <Icon className="w-4 h-4" />
              </div>

              <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">{s.title}</h4>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
