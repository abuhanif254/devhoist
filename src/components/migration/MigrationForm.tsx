'use client';

import React, { useState } from 'react';
import { ArrowRight, Lock, Loader2 } from 'lucide-react';

export default function MigrationForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [currentHostName, setCurrentHostName] = useState('');
  const [controlPanelType, setControlPanelType] = useState<
    'cpanel' | 'cyberpanel' | 'wordpress_admin' | 'custom_vps'
  >('cpanel');
  const [selectedPlanId, setSelectedPlanId] = useState<1 | 2 | 3>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [responseSuccess, setResponseSuccess] = useState<string | null>(null);

  const panelOptions = [
    { id: 'cpanel' as const, label: 'cPanel Host', desc: 'Standard cPanel full backup' },
    { id: 'cyberpanel' as const, label: 'CyberPanel', desc: 'LiteSpeed/CyberPanel export' },
    { id: 'wordpress_admin' as const, label: 'WordPress Admin', desc: 'WP files & MySQL database' },
    { id: 'custom_vps' as const, label: 'Custom VPS / Other', desc: 'SSH / Rsync custom transfer' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          whatsappNumber,
          websiteUrl,
          currentHostName,
          controlPanelType,
          selectedPlanId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseSuccess(data.message);
        if (data.data?.ticketRedirectUrl) {
          setTimeout(() => {
            window.location.href = data.data.ticketRedirectUrl;
          }, 1500);
        }
      } else {
        alert(data.error || 'Failed to submit migration request.');
      }
    } catch {
      alert('Network error submitting migration request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 p-6 sm:p-8 text-left shadow-xl glass-card">
        {responseSuccess ? (
          <div className="text-center py-8 space-y-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto block animate-ping" />
            <h4 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Migration Request Qualified!</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto">
              Opening your native DevHost Support Desk to assign a Linux migration engineer safely...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 dark:focus:border-white/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tanvir@company.com"
                  className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 dark:focus:border-white/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Website URL to Migrate *</label>
                <input
                  type="text"
                  required
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://mycurrentsite.com"
                  className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 dark:focus:border-white/20 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Current Hosting Provider *</label>
                <input
                  type="text"
                  required
                  value={currentHostName}
                  onChange={(e) => setCurrentHostName(e.target.value)}
                  placeholder="e.g. Hostinger, Bluehost, Namecheap"
                  className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 dark:focus:border-white/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">WhatsApp / Phone Number</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+8801700000000 (For NOC update notifications)"
                className="w-full mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 text-xs focus:border-blue-500 dark:focus:border-white/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                Current Control Panel Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {panelOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setControlPanelType(opt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      controlPanelType === opt.id
                        ? 'border-blue-500 dark:border-white/30 bg-blue-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                        : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">{opt.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5 line-clamp-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                Target DevHost Cloud Package
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(1)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    selectedPlanId === 1
                      ? 'border-blue-500 dark:border-white/30 bg-blue-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Starter Pack</div>
                  <div className="text-[10px] font-mono text-slate-600 dark:text-zinc-400">৳200/mo</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(2)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    selectedPlanId === 2
                      ? 'border-blue-500 dark:border-white/30 bg-blue-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Developer Pro</div>
                  <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">৳450/mo</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(3)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    selectedPlanId === 3
                      ? 'border-blue-500 dark:border-white/30 bg-blue-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Business Max</div>
                  <div className="text-[10px] font-mono text-slate-600 dark:text-zinc-400">৳900/mo</div>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-semibold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Initiate Zero-Downtime Migration</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-zinc-500 font-mono pt-1">
              <Lock className="w-3 h-3 text-slate-400 dark:text-zinc-400" />
              <span>Credentials encrypted in transit • 100% Free Service</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
