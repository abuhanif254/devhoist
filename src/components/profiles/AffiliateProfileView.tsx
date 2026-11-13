'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Building2,
  Check,
  Clock,
  Copy,
  Link as LinkIcon,
  Lock,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';
import { usePortal } from '@/context/PortalContext';
import { buildAffiliateReferralUrl, getCanonicalSiteUrl } from '@/lib/siteUrl';

type MarketerPayoutMethod = 'bkash_personal' | 'nagad_personal' | 'bank_eft';
type PayoutScheduleMode = 'manual' | 'auto_monthly_1st' | 'auto_threshold';

export default function AffiliateProfileView() {
  const { affiliate, refreshUserData } = usePortal();
  const { requireSudo } = useSudoGate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const [customSlug, setCustomSlug] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<MarketerPayoutMethod>('bkash_personal');
  const [walletNumber, setWalletNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [payoutThreshold, setPayoutThreshold] = useState<number>(1000);
  const [payoutSchedule, setPayoutSchedule] = useState<PayoutScheduleMode>('manual');
  const [postbackUrl, setPostbackUrl] = useState('');
  const [payoutLockUntil, setPayoutLockUntil] = useState<string | null>(null);
  const [isCoolingLocked, setIsCoolingLocked] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      try {
        const res = await fetch('/api/affiliate', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          profile?: {
            customSlug?: string;
            primaryPayoutMethod?: MarketerPayoutMethod;
            payoutWalletNumber?: string;
            payoutAccountNumber?: string;
            bankAccountDetails?: {
              bankName?: string;
              branchName?: string;
              accountHolderName?: string;
              accountNumber?: string;
              routingNumber?: string;
            };
            payoutScheduleMode?: PayoutScheduleMode;
            minPayoutThresholdBDT?: number;
            conversionPostbackWebhookUrl?: string;
            payoutLockUntil?: string | null;
            isCoolingLocked?: boolean;
          };
        };

        if (!active || !data?.profile) return;
        const p = data.profile;
        setCustomSlug(p.customSlug || '');
        if (
          p.primaryPayoutMethod === 'bkash_personal' ||
          p.primaryPayoutMethod === 'nagad_personal' ||
          p.primaryPayoutMethod === 'bank_eft'
        ) {
          setPayoutMethod(p.primaryPayoutMethod);
        }
        setWalletNumber(p.payoutWalletNumber || p.payoutAccountNumber || '');
        setBankName(p.bankAccountDetails?.bankName || '');
        setBranchName(p.bankAccountDetails?.branchName || '');
        setAccountHolderName(p.bankAccountDetails?.accountHolderName || '');
        setAccountNumber(p.bankAccountDetails?.accountNumber || '');
        setRoutingNumber(p.bankAccountDetails?.routingNumber || '');
        setPayoutThreshold(Math.max(1000, Number(p.minPayoutThresholdBDT || 1000)));
        if (
          p.payoutScheduleMode === 'manual' ||
          p.payoutScheduleMode === 'auto_monthly_1st' ||
          p.payoutScheduleMode === 'auto_threshold'
        ) {
          setPayoutSchedule(p.payoutScheduleMode);
        }
        setPostbackUrl(p.conversionPostbackWebhookUrl || '');
        setPayoutLockUntil(p.payoutLockUntil || null);
        setIsCoolingLocked(Boolean(p.isCoolingLocked));
      } catch {
        // Ignore transient hydrate failure
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const canonicalBase = getCanonicalSiteUrl();
  const effectiveShareCode = useMemo(
    () => (customSlug.trim() ? customSlug.trim().toLowerCase() : affiliate.referralCode || 'partner'),
    [customSlug, affiliate.referralCode]
  );
  const liveReferralUrl = useMemo(
    () => buildAffiliateReferralUrl(effectiveShareCode),
    [effectiveShareCode]
  );

  const handleCopyReferralLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(liveReferralUrl).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleSavePayoutVault = () => {
    setFeedback(null);
    requireSudo(async () => {
      setIsSaving(true);
      try {
        const res = await fetch('/api/affiliate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_payout_profile',
            customSlug: customSlug.trim().toLowerCase(),
            primaryPayoutMethod: payoutMethod,
            payoutWalletNumber: walletNumber.trim(),
            bankAccountDetails: {
              bankName: bankName.trim(),
              branchName: branchName.trim(),
              accountHolderName: accountHolderName.trim(),
              accountNumber: accountNumber.trim(),
              routingNumber: routingNumber.trim(),
            },
            payoutScheduleMode: payoutSchedule,
            minPayoutThresholdBDT: Number(payoutThreshold),
            conversionPostbackWebhookUrl: postbackUrl.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          lockTriggered?: boolean;
          payoutLockUntil?: string | null;
          isCoolingLocked?: boolean;
          message?: string;
          error?: string;
        };

        if (!res.ok || !data.success) {
          setFeedback({
            type: 'error',
            message: data.message || data.error || 'Failed to persist affiliate payout profile.',
          });
          return;
        }

        setPayoutLockUntil(data.payoutLockUntil || null);
        setIsCoolingLocked(Boolean(data.isCoolingLocked));
        setFeedback({
          type: 'success',
          message: data.lockTriggered
            ? `Payout destination updated and encrypted. A mandatory 24-hour anti-hijack cooling lock is now active until ${
                data.payoutLockUntil ? new Date(data.payoutLockUntil).toLocaleString() : '24h from now'
              }.`
            : 'Affiliate slug, threshold, schedule & S2S postback settings saved.',
        });
        await refreshUserData().catch(() => {});
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Network error updating payout vault.',
        });
      } finally {
        setIsSaving(false);
      }
    }, 'Save Encrypted Affiliate Payout & Postback Vault');
  };

  const handleTestPostback = async () => {
    if (!postbackUrl.trim()) {
      setWebhookResult({ ok: false, message: 'Enter an HTTPS S2S postback URL first.' });
      return;
    }
    setIsTestingWebhook(true);
    setWebhookResult(null);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_postback',
          url: postbackUrl.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      setWebhookResult({
        ok: res.ok && Boolean(data.success),
        message: data.message || data.error || (res.ok ? 'S2S test ping delivered.' : 'Postback ping failed.'),
      });
    } catch (err: unknown) {
      setWebhookResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Postback network failure.',
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-zinc-900 to-emerald-950/80 border border-emerald-500/20 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              <Award className="w-3.5 h-3.5" />
              <span>{affiliate.commissionTier} • {affiliate.commissionRate}% Recurring Share</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              Partner Payout Vault &amp; Vanity Attribution Profile
            </h2>
            <p className="text-xs text-zinc-400">
              All destination updates require Sudo 2FA step-up and trigger a server-enforced 24h anti-hijack withdrawal lock.
            </p>
          </div>

          <div className="px-4 py-3 rounded-xl bg-black/40 border border-white/10 space-y-1 min-w-[240px]">
            <div className="text-[11px] text-zinc-400">Canonical Partner Referral URL</div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-emerald-300 truncate">{liveReferralUrl}</span>
              <button
                type="button"
                onClick={handleCopyReferralLink}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                title="Copy canonical referral URL"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 24h Anti-Hijack Cooling Lock Warning */}
      {isCoolingLocked && payoutLockUntil && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-800 dark:text-amber-200">
              24-Hour Anti-Hijack Cooling Lock Active
            </p>
            <p className="text-amber-700 dark:text-amber-300">
              Your payout destination was recently modified. Withdrawal requests are temporarily locked at the API level until{' '}
              <span className="font-mono font-bold">{new Date(payoutLockUntil).toLocaleString()}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/30 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Hydrating persisted affiliate vault &amp; cooling status...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Card: Vanity Slug & Withdrawal Vault */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Payout Destination Vault</span>
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                <Lock className="w-3 h-3" /> Sudo 2FA Gated
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>Custom Vanity Referral Slug</span>
              </label>
              <div className="flex items-center rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/10 overflow-hidden">
                <span className="px-3 py-2 text-[11px] font-mono text-slate-400 border-r border-slate-200 dark:border-white/10">
                  {canonicalBase}/?ref=
                </span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder={affiliate.referralCode || 'your-partner-slug'}
                  className="flex-1 px-3 py-2 bg-transparent text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                3–32 lowercase alphanumeric characters or hyphens. Uniquely enforced across all partners.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                Primary Settlement Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'bkash_personal' as const, label: 'bKash', icon: Smartphone },
                  { id: 'nagad_personal' as const, label: 'Nagad', icon: Smartphone },
                  { id: 'bank_eft' as const, label: 'Bank EFT', icon: Building2 },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = payoutMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPayoutMethod(opt.id)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        active
                          ? 'bg-emerald-600/10 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-zinc-950/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {payoutMethod !== 'bank_eft' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                  {payoutMethod === 'bkash_personal' ? 'bKash Personal / Merchant Wallet' : 'Nagad Account Number'}
                </label>
                <input
                  type="text"
                  value={walletNumber}
                  onChange={(e) => setWalletNumber(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/10">
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank Name (e.g. BRAC Bank)"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs"
                />
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Branch Name"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs"
                />
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Account Holder Name"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs sm:col-span-2"
                />
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account Number"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                />
                <input
                  type="text"
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  placeholder="Routing Number"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Right Card: Auto-Disbursement Rules & SSRF-Protected S2S Postback */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] space-y-5 shadow-xs flex flex-col justify-between">
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <span>Payout Rules &amp; S2S Conversion Postback</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Disbursement Schedule
                  </label>
                  <select
                    value={payoutSchedule}
                    onChange={(e) => setPayoutSchedule(e.target.value as PayoutScheduleMode)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="manual">Manual Withdrawal Only</option>
                    <option value="auto_monthly_1st">Auto Request on 1st of Month</option>
                    <option value="auto_threshold">Auto Request at Threshold</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Min Threshold (BDT)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={100}
                    value={payoutThreshold}
                    onChange={(e) => setPayoutThreshold(Math.max(1000, Number(e.target.value || 1000)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                  S2S Postback Webhook URL (SSRF Validated)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={postbackUrl}
                    onChange={(e) => setPostbackUrl(e.target.value)}
                    placeholder="https://tracker.yourdomain.com/postback?subid={subid}&payout={payout}&order={order_id}"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={isTestingWebhook}
                    onClick={handleTestPostback}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isTestingWebhook ? 'Pinging...' : 'Test Ping'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Triggered automatically on verified conversions with <code className="font-mono">{'{subid}'}</code>,{' '}
                  <code className="font-mono">{'{payout}'}</code>, and <code className="font-mono">{'{order_id}'}</code>. Localhost and RFC1918 targets are blocked.
                </p>

                {webhookResult && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] font-mono ${
                      webhookResult.ok
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {webhookResult.message}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Changing payout channel or account number sets a 24h withdrawal lock.
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSavePayoutVault}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSaving ? 'Encrypting & Saving...' : 'Save Payout Vault (Sudo)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
