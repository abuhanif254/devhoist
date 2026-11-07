'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Share2,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Gift,
  Code,
  Users,
} from 'lucide-react';

interface HandoverItem {
  id: string;
  handover_token: string;
  client_name: string;
  client_email: string;
  project_title: string;
  plan_slug: string;
  billing_cycle: string;
  developer_setup_fee_bdt: number;
  hosting_price_bdt: number;
  total_payable_bdt: number;
  status: 'pending_client_claim' | 'claimed_and_paid' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
}

const DEFAULT_HANDOVERS: HandoverItem[] = [
  {
    id: 'ho_1',
    handover_token: 'dh_ho_2026_acme',
    client_name: 'Acme Textiles Ltd',
    client_email: 'director@acmetextiles.com',
    project_title: 'Next.js Corporate B2B Portal & Catalog',
    plan_slug: 'developer-pro',
    billing_cycle: 'annual',
    developer_setup_fee_bdt: 18000,
    hosting_price_bdt: 4320,
    total_payable_bdt: 22320,
    status: 'claimed_and_paid',
    expires_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'ho_2',
    handover_token: 'dh_ho_2026_dhakafood',
    client_name: 'Dhaka Food Hub',
    client_email: 'ceo@dhakafoodhub.com',
    project_title: 'High-Throughput eCommerce & Delivery App',
    plan_slug: 'business-max',
    billing_cycle: 'annual',
    developer_setup_fee_bdt: 25000,
    hosting_price_bdt: 9120,
    total_payable_bdt: 34120,
    status: 'pending_client_claim',
    expires_at: new Date(Date.now() + 12 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

export default function AgencyHandoverView({
  developerUserId = 'dev_hanif',
  developerName = 'Tanvir Ahmed',
}: {
  developerUserId?: string;
  developerName?: string;
}) {
  const [handovers, setHandovers] = useState<HandoverItem[]>(DEFAULT_HANDOVERS);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [planSlug, setPlanSlug] = useState('developer-pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [setupFeeBDT, setSetupFeeBDT] = useState('15000');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHandovers() {
      try {
        const res = await fetch(`/api/agency/handover?devUserId=${developerUserId}`);
        const data = await res.json();
        if (data.success && data.handovers && data.handovers.length > 0) {
          setHandovers(data.handovers);
        }
      } catch {
        // Fallback to initial mock list
      }
    }
    fetchHandovers();
  }, [developerUserId]);

  const hostingPrice = planSlug === 'developer-pro'
    ? (billingCycle === 'annual' ? 4320 : 450)
    : planSlug === 'business-max'
    ? (billingCycle === 'annual' ? 9120 : 950)
    : (billingCycle === 'annual' ? 1920 : 200);

  const totalFee = (Number(setupFeeBDT) || 0) + hostingPrice;

  const handleCreateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientEmail || !projectTitle) return;

    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const res = await fetch('/api/agency/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerUserId,
          developerName,
          clientName,
          clientEmail,
          projectTitle,
          planSlug,
          billingCycle,
          developerSetupFeeBDT: Number(setupFeeBDT) || 0,
          hostingPriceBDT: hostingPrice,
        }),
      });

      const data = await res.json();
      if (data.success && data.handover) {
        setHandovers((prev) => [data.handover, ...prev]);
        setGeneratedLink(data.handoverUrl || `https://devhost.cloud/handover/${data.handoverToken}`);
        setClientName('');
        setClientEmail('');
        setProjectTitle('');
        setSetupFeeBDT('15000');
      }
    } catch {
      const token = `dh_ho_${Date.now().toString(36)}`;
      const newMockItem: HandoverItem = {
        id: `ho_${Date.now()}`,
        handover_token: token,
        client_name: clientName,
        client_email: clientEmail,
        project_title: projectTitle,
        plan_slug: planSlug,
        billing_cycle: billingCycle,
        developer_setup_fee_bdt: Number(setupFeeBDT) || 0,
        hosting_price_bdt: hostingPrice,
        total_payable_bdt: totalFee,
        status: 'pending_client_claim',
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
      };
      setHandovers((prev) => [newMockItem, ...prev]);
      setGeneratedLink(`https://devhost.cloud/handover/${token}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (token: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-xl shadow-blue-600/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Freelancer &amp; Agency Growth Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            White-Label Client Handover Studio
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
            Deliver completed web projects directly to your client. Transfer hosting ownership, collect your custom setup fee, keep Git/SSH developer access, and lock in 20%–30% lifetime recurring affiliate commissions!
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-xs border border-white/10 shrink-0">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold font-mono">
              Partner Commission
            </div>
            <div className="text-2xl font-black font-mono mt-0.5">25% Recurring</div>
            <div className="text-[10px] text-blue-100 mt-0.5">Locked on every client renewal</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Create Handover Form + Active Handovers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Handover Link Generator */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 dark:border-white/5 pb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>Generate Client Handover Link</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Creates a branded payment and ownership handover invoice for your client
            </p>
          </div>

          <form onSubmit={handleCreateHandover} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Client Name / Organization
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Fashion Ltd"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Client Email (Ownership Transferee)
              </label>
              <input
                type="email"
                placeholder="client@company.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Project Title &amp; Scope
              </label>
              <input
                type="text"
                placeholder="e.g. Next.js 15 Corporate Web Store"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Hosting Plan
                </label>
                <select
                  value={planSlug}
                  onChange={(e) => setPlanSlug(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="developer-pro">Developer Pro (৳450/mo)</option>
                  <option value="business-max">Business Max (৳950/mo)</option>
                  <option value="starter-pack">Starter Pack (৳200/mo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Billing Cycle
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as any)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="annual">Annual (Includes Free Domain)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Your Custom Development Fee (৳ BDT)
              </label>
              <input
                type="number"
                placeholder="15000"
                value={setupFeeBDT}
                onChange={(e) => setSetupFeeBDT(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                Collected from client and credited directly to your Developer Wallet!
              </span>
            </div>

            {/* Total Summary Box */}
            <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Hosting ({billingCycle === 'annual' ? '1 Year + Free Domain' : '1 Month'}):</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">৳{hostingPrice}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Developer Setup Fee:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">৳{Number(setupFeeBDT) || 0}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400">
                <span>Total Client Invoice:</span>
                <span className="font-mono text-sm">৳{totalFee.toLocaleString()} BDT</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>Generate Official Handover Link</span>
            </button>
          </form>

          {/* Generated Link Alert Box */}
          {generatedLink && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Handover Link Ready!</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('new', generatedLink)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedToken === 'new' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken === 'new' ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
              <p className="font-mono text-[11px] text-emerald-900 dark:text-emerald-300 break-all bg-white dark:bg-zinc-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                {generatedLink}
              </p>
            </div>
          )}
        </div>

        {/* Right List: Active & Historical Handovers */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Client Project Handover Portfolio
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Track client claims, setup fee clearances, and recurring affiliate commission status
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {handovers.length} Total Handover{handovers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {handovers.map((item) => {
              const handoverUrl = `https://devhost.cloud/handover/${item.handover_token}`;
              const isClaimed = item.status === 'claimed_and_paid';

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {item.project_title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>Client: {item.client_name} ({item.client_email})</span>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-center ${
                        isClaimed
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {isClaimed ? '✓ Claimed & Paid' : '⏳ Pending Client Claim'}
                    </span>
                  </div>

                  {/* Financial & Access Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50">
                      <span className="text-[10px] text-slate-400 block">Plan</span>
                      <span className="font-bold text-slate-900 dark:text-white uppercase font-mono">
                        {item.plan_slug.replace('-', ' ')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50">
                      <span className="text-[10px] text-slate-400 block">Setup Fee Earned</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        ৳{item.developer_setup_fee_bdt.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50">
                      <span className="text-[10px] text-slate-400 block">Total Invoice</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                        ৳{item.total_payable_bdt.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50">
                      <span className="text-[10px] text-slate-400 block">Collaborator Access</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                        <Code className="w-3 h-3 text-emerald-500" />
                        <span>SSH &amp; Git Active</span>
                      </span>
                    </div>
                  </div>

                  {/* Copy Link & Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono truncate">
                      <span>Token:</span>
                      <code className="text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {item.handover_token}
                      </code>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.handover_token, handoverUrl)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedToken === item.handover_token ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedToken === item.handover_token ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      <a
                        href={handoverUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Preview Page ↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
