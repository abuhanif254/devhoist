'use client';

import React, { useState } from 'react';
import {
  Users,
  Wallet,
  Building,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Send,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Link as LinkIcon,
  Save,
  Lock,
} from 'lucide-react';
import { usePortal } from '@/context/PortalContext';
import { useSudoGate } from '@/components/security/SudoGateModal';

export default function AffiliateProfileView() {
  const { affiliate } = usePortal();
  const { requireSudo } = useSudoGate();

  // Custom Slug State
  const [customSlug, setCustomSlug] = useState('hanif-dev');
  const [copiedLink, setCopiedLink] = useState(false);

  // Payout Vault State
  const [payoutMethod, setPayoutMethod] = useState<'bkash_personal' | 'nagad_personal' | 'bank_eft'>('bkash_personal');
  const [walletNumber, setWalletNumber] = useState('01712345678');
  const [bankName, setBankName] = useState('City Bank PLC');
  const [bankBranch, setBankBranch] = useState('Dhanmondi Branch');
  const [bankAccountName, setBankAccountName] = useState('Mohammad Abu Hanif');
  const [bankAccountNumber, setBankAccountNumber] = useState('110294819001');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('225271829');
  const [payoutThreshold, setPayoutThreshold] = useState<number>(2000);
  const [payoutSchedule, setPayoutSchedule] = useState<'auto_monthly_5th' | 'manual_request'>('auto_monthly_5th');

  // 24-Hour Anti-Hijack Cooling Period State
  const [coolingPeriodUntil, setCoolingPeriodUntil] = useState<string | null>(null);

  // S2S Conversion Postback Webhook State
  const [postbackUrl, setPostbackUrl] = useState(
    'https://api.trackmarketer.com/postback?subid={subid}&payout={payout}&order={order_id}'
  );
  const [postbackTesting, setPostbackTesting] = useState(false);
  const [postbackResult, setPostbackResult] = useState<{
    success: boolean;
    message?: string;
    elapsedMs?: number;
    statusCode?: number;
  } | null>(null);

  const [saveToast, setSaveToast] = useState(false);

  const referralUrl = `https://devhostcloud.com?ref=${customSlug}`;

  // Handle Payout Vault Updates (Requires Sudo Step-Up!)
  const handleSavePayoutDetails = () => {
    requireSudo(() => {
      // Activate 24-hour cooling lock on payout updates
      const lockTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      setCoolingPeriodUntil(lockTime);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3500);
    }, 'Update bKash/Nagad Payout Destination & Bank Details');
  };

  // Test Postback Webhook
  const handleTestPostback = async () => {
    setPostbackTesting(true);
    setPostbackResult(null);

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_postback',
          webhookUrl: postbackUrl,
          subId: 'test_campaign_hanif',
          payoutAmount: 450,
        }),
      });
      const data = await res.json();
      setPostbackResult(data);
    } catch (err: any) {
      setPostbackResult({
        success: false,
        message: err.message || 'Failed to ping postback endpoint',
      });
    } finally {
      setPostbackTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-emerald-600/10 border border-emerald-500/20">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-semibold mb-1 border border-emerald-200 dark:border-emerald-800">
            <Users className="w-3 h-3 text-emerald-600" />
            <span>Affiliate Partner &amp; Growth Hub</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Affiliate Profile, Anti-Hijack Vault &amp; S2S Postbacks
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
            Configure your custom vanity tracking link, 2FA-locked withdrawal destination, and automated postback conversion pings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold">
            KYC Verified Partner ✓
          </span>
        </div>
      </div>

      {saveToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-mono text-xs flex items-center gap-2 animate-in fade-in shadow-md shadow-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span>Affiliate payout details updated! 24-hour security lock activated.</span>
        </div>
      )}

      {/* 24-Hour Anti-Hijack Security Cooling Warning */}
      {coolingPeriodUntil && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs font-mono">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <strong className="text-sm font-sans block font-bold text-amber-950 dark:text-amber-100">
              24-Hour Anti-Hijack Security Cooling Period Active
            </strong>
            <p className="leading-relaxed">
              Because your payout destination was recently modified, wallet withdrawals are temporarily locked until{' '}
              <strong className="underline">{coolingPeriodUntil}</strong>. This protects your funds if your session is ever compromised.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: CUSTOM REFERRAL SLUG */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-emerald-600" />
            <span>Custom Vanity Referral Slug</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Your unique tracking link drops a persistent 90-day cookie for recurring commissions on all products.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center font-mono text-xs">
          <div className="sm:col-span-8 flex items-center rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 px-3 py-2">
            <span className="text-slate-400 dark:text-zinc-500 select-none">https://devhostcloud.com?ref=</span>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              className="flex-1 bg-transparent text-emerald-600 dark:text-emerald-400 font-bold focus:outline-hidden"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>

            <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
              Available ✓
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: 2FA-PROTECTED PAYOUT VAULT */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>2FA-Protected Payout Destination Vault</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200 dark:border-blue-800 font-semibold">
                Sudo Protected
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Updates to these payment channels mathematically trigger the Sudo Gate Modal and a 24-hour security lock.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSavePayoutDetails}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Update Payout Details</span>
          </button>
        </div>

        {/* Payout Method Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          {[
            { id: 'bkash_personal', label: 'bKash Personal Wallet', desc: 'Instant 2-minute MFS payout' },
            { id: 'nagad_personal', label: 'Nagad Personal Wallet', desc: 'Instant MFS bank settlement' },
            { id: 'bank_eft', label: 'Commercial Bank EFT / BEFTN', desc: 'Direct corporate bank deposit' },
          ].map((m) => (
            <div
              key={m.id}
              onClick={() => setPayoutMethod(m.id as any)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                payoutMethod === m.id
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/20'
                  : 'bg-slate-50 dark:bg-zinc-950/40 border-slate-200 dark:border-white/5 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white font-sans text-xs">{m.label}</strong>
                <input
                  type="radio"
                  name="payoutMethod"
                  checked={payoutMethod === m.id}
                  onChange={() => setPayoutMethod(m.id as any)}
                  className="accent-emerald-600"
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-1">{m.desc}</span>
            </div>
          ))}
        </div>

        {/* Dynamic Fields Based on Method */}
        {payoutMethod !== 'bank_eft' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">
                {payoutMethod === 'bkash_personal' ? 'bKash Personal Mobile Number:' : 'Nagad Personal Mobile Number:'}
              </label>
              <input
                type="text"
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm tracking-wider"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Schedule Mode:</label>
              <select
                value={payoutSchedule}
                onChange={(e: any) => setPayoutSchedule(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold cursor-pointer"
              >
                <option value="auto_monthly_5th">Auto Payout Every Month (5th)</option>
                <option value="manual_request">Manual On-Demand Withdrawal</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Bank Name:</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Branch Name:</label>
              <input
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Account Title / Name:</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Account Number &amp; Routing:</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Acc #"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold"
                />
                <input
                  type="text"
                  placeholder="Routing #"
                  value={bankRoutingNumber}
                  onChange={(e) => setBankRoutingNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Payout Threshold Slider */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-zinc-400">Minimum Auto-Payout Threshold:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">৳{payoutThreshold} BDT</span>
          </div>
          <input
            type="range"
            min={1000}
            max={10000}
            step={500}
            value={payoutThreshold}
            onChange={(e) => setPayoutThreshold(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 block">
            Payouts trigger automatically once your cleared balance meets or exceeds this amount.
          </span>
        </div>
      </div>

      {/* SECTION 3: S2S CONVERSION POSTBACK WEBHOOK TESTER */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600" />
            <span>S2S Real-Time Conversion Postback Webhook</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Receive automated Server-to-Server GET/POST pings into your ad tracker (Voluum, Binom, Custom CRM) whenever a sale is credited.
          </p>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-slate-500 block mb-1">Postback URL with Dynamic Macros:</label>
            <input
              type="text"
              value={postbackUrl}
              onChange={(e) => setPostbackUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-[11px]"
            />
            <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
              <span>Macros: <code>{'{subid}'}</code>, <code>{'{payout}'}</code>, <code>{'{order_id}'}</code></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={postbackTesting}
              onClick={handleTestPostback}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold cursor-pointer flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{postbackTesting ? 'Pinging Webhook...' : 'Send Test Conversion Ping'}</span>
            </button>
          </div>

          {/* Test Ping Result */}
          {postbackResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-mono space-y-1 animate-in fade-in ${
                postbackResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {postbackResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {postbackResult.success
                    ? `Postback Verified (HTTP ${postbackResult.statusCode} in ${postbackResult.elapsedMs}ms)`
                    : 'Postback Failed to Deliver'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed break-all">
                {postbackResult.message || postbackResult.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
