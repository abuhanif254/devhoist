'use client';

import React from 'react';
import { Globe2, Shield, Mail } from 'lucide-react';

export default function DomainAddonsGrid() {
  const addons = [
    {
      title: 'Free DNS Management',
      desc: 'Point your domain to any host, VPS, or CDN with full support for A, AAAA, CNAME, MX, TXT, and SRV records.',
      icon: Globe2,
      badge: 'Free Forever',
    },
    {
      title: 'Domain Theft Protection',
      desc: 'Registrar Lock prevents unauthorized domain transfers, hijacking, or accidental ownership reassignment.',
      icon: Shield,
      badge: 'Registrar Lock',
    },
    {
      title: 'Free Email & URL Forwarding',
      desc: 'Forward info@yourdomain.com directly to your personal Gmail or redirect traffic to your social handles instantly.',
      icon: Mail,
      badge: 'Included',
    },
  ];

  return (
    <div className="w-full transition-colors duration-200">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
          Included 100% Free with Every Domain
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 font-normal leading-relaxed">
          Other registrars charge extra fees for basic features. We include everything upfront.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {addons.map((a, idx) => {
          const Icon = a.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/60 hover:border-slate-300 dark:hover:border-white/[0.16] glass-card transition-all space-y-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-zinc-200">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-white/5 font-semibold">
                  {a.badge}
                </span>
              </div>

              <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">{a.title}</h4>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">{a.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
