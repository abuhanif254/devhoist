'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ShieldCheck,
  Server,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Code,
  DollarSign,
  Lock,
  Gift,
  RefreshCw,
} from 'lucide-react';
import { BkashBadge, NagadBadge, StripeBadge } from '@/components/visuals/BrandLogos';

interface HandoverData {
  id: string;
  handover_token: string;
  client_name: string;
  client_email: string;
  project_title: string;
  plan_slug: string;
  billing_cycle: string;
  developer_name: string;
  developer_setup_fee_bdt: number;
  hosting_price_bdt: number;
  total_payable_bdt: number;
  keep_developer_ssh_git_access: boolean;
  lock_recurring_affiliate_commission: boolean;
  status: string;
  expires_at: string;
}

export default function ClientHandoverPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [handover, setHandover] = useState<HandoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimedSuccess, setClaimedSuccess] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<'bkash' | 'nagad' | 'card'>('bkash');
  const [clientPassword, setClientPassword] = useState('');

  useEffect(() => {
    async function loadHandover() {
      try {
        const res = await fetch(`/api/agency/handover?token=${token || 'demo'}`);
        const data = await res.json();
        if (data.success && data.handover) {
          setHandover(data.handover);
          if (data.handover.status === 'claimed_and_paid') {
            setClaimedSuccess(true);
          }
        }
      } catch (err) {
        console.error('Failed to load handover data', err);
      } finally {
        setLoading(false);
      }
    }
    loadHandover();
  }, [token]);

  const handleClaimAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handover) return;
    setClaiming(true);

    try {
      const sessionRes = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: selectedGateway === 'card' ? 'stripe' : selectedGateway,
          orderType: 'agency_handover',
          handoverToken: handover.handover_token,
          amountBDT: handover.total_payable_bdt,
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        alert(sessionData.error || 'Please sign in as the invited client email to pay and claim this project.');
        return;
      }

      if (sessionData.paymentUrl) {
        window.location.href = sessionData.paymentUrl;
        return;
      }

      const res = await fetch('/api/agency/handover', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handoverToken: handover.handover_token,
          invoiceNumber: sessionData.invoiceNumber,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setClaimedSuccess(true);
      } else {
        alert(result.error || 'Complete the gateway invoice settlement to claim project ownership.');
      }
    } catch {
      alert('Network error while initializing handover payment. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
            Verifying secure project handover link...
          </p>
        </div>
      </div>
    );
  }

  if (!handover) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl text-center border border-slate-200 dark:border-white/10">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-4">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Handover Link Expired or Invalid</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">
            This project handover transfer has expired or does not exist. Please contact your developer to request a new link.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all"
          >
            Go to DevHost Cloud
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Official Agency Project Handover</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {handover.project_title}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-zinc-400">
            Engineered by <span className="font-semibold text-blue-600 dark:text-blue-400">{handover.developer_name}</span> for{' '}
            <span className="font-semibold text-slate-800 dark:text-zinc-200">{handover.client_name}</span>
          </p>
        </div>

        {claimedSuccess ? (
          <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 sm:p-10 shadow-xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Project Successfully Claimed &amp; Activated!
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-xl mx-auto mt-2 leading-relaxed">
              Hosting ownership and production credentials have been transferred to your account ({handover.client_email}).
              Your developer (<span className="text-blue-600">{handover.developer_name}</span>) retains collaborative Git &amp; SSH access to maintain your applications.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Open Cloud Client Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Project & Financial Breakdown */}
            <div className="lg:col-span-7 space-y-6">
              {/* Project Card */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        Cloud Hosting Environment
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {handover.plan_slug.toUpperCase()} • Isolated CloudLinux Container
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                    Ready for Live Launch
                  </span>
                </div>

                <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span>10 GB Pure NVMe SSD + LiteSpeed Turbo</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>4 GB Dedicated CloudLinux RAM &amp; 2 Cores</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Automated GitHub CI/CD &amp; SSL TLS 1.3</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Collaborative Developer SSH &amp; Git Access</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>

                {/* Free Domain Highlight */}
                {handover.billing_cycle === 'annual' && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <Gift className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Includes 1st-Year FREE .com Domain Bundle (Save ৳1,350)</span>
                  </div>
                )}
              </div>

              {/* Developer Team Handover Notice */}
              <div className="bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 rounded-2xl p-5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-zinc-200 mb-1">
                  <Code className="w-4 h-4 text-blue-600" />
                  <span>Developer Collaborative Ownership</span>
                </div>
                You are becoming the primary legal and billing owner of this cloud service. Your developer maintains authorized technical collaborator access to deploy updates, manage databases, and optimize performance.
              </div>
            </div>

            {/* Right: Transparent Pricing & Claim Form */}
            <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 sm:p-7 shadow-lg">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4">
                Invoice &amp; Handover Claim
              </h3>

              {/* Financial Breakdown */}
              <div className="space-y-3 border-b border-slate-100 dark:border-white/10 pb-4 mb-4 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Cloud Hosting ({handover.billing_cycle === 'annual' ? '1 Year' : '1 Month'})</span>
                  <span className="font-medium text-slate-900 dark:text-white">৳{handover.hosting_price_bdt.toLocaleString()}</span>
                </div>
                {handover.developer_setup_fee_bdt > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>Developer Setup &amp; Delivery Fee</span>
                    <span className="font-medium text-slate-900 dark:text-white">৳{handover.developer_setup_fee_bdt.toLocaleString()}</span>
                  </div>
                )}
                {handover.billing_cycle === 'annual' && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>1st-Year .com Domain</span>
                    <span>৳0 (Free)</span>
                  </div>
                )}
              </div>

              {/* Total Payable */}
              <div className="flex items-baseline justify-between mb-6">
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Total Payable</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  ৳{handover.total_payable_bdt.toLocaleString()} BDT
                </span>
              </div>

              {/* Payment Gateway Picker */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                  Select Instant Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('bkash')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      selectedGateway === 'bkash'
                        ? 'border-pink-500 bg-pink-50/50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 font-semibold'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <BkashBadge className="w-5 h-5" />
                    <span className="text-[10px]">bKash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedGateway('nagad')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      selectedGateway === 'nagad'
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-semibold'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <NagadBadge className="w-5 h-5" />
                    <span className="text-[10px]">Nagad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedGateway('card')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      selectedGateway === 'card'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <StripeBadge className="w-5 h-5" />
                    <span className="text-[10px]">Card</span>
                  </button>
                </div>
              </div>

              {/* Claim Form */}
              <form onSubmit={handleClaimAndPay} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Your Name (Client)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={handover.client_name}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Your Email (Client Ownership)
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={handover.client_email}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Set Portal Password
                  </label>
                  <input
                    type="password"
                    placeholder="Create your cloud portal password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={claiming}
                  className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {claiming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Activating Cloud Service...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Claim Ownership &amp; Pay ৳{handover.total_payable_bdt.toLocaleString()}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>256-bit TLS Encrypted • 100% Zero-Touch Activation</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
