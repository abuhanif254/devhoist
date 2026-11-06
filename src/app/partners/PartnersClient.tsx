'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  Users,
  CreditCard,
  Sparkles,
  Layers,
  Zap,
} from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { getWhmcsClientAreaUrl } from '@/config/whmcs';

const PLAN_OPTIONS = [
  { id: 'starter', name: 'Starter Pack', bdt: 200, usd: 1.67 },
  { id: 'developer', name: 'Developer Pro (Most Popular)', bdt: 450, usd: 3.75 },
  { id: 'business', name: 'Business Max', bdt: 900, usd: 7.5 },
  { id: 'vps', name: 'Managed Cloud VPS', bdt: 2750, usd: 22.92 },
];

export default function PartnersClient() {
  const { currency } = useBilling();
  const isBDT = currency === 'BDT';
  const symbol = isBDT ? '৳' : '$';

  const [referredClients, setReferredClients] = useState<number>(15);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('developer');

  const selectedPlan =
    PLAN_OPTIONS.find((p) => p.id === selectedPlanId) || PLAN_OPTIONS[1];

  const planBaseMonthly = isBDT ? selectedPlan.bdt : selectedPlan.usd;

  // Commission tier rate
  let commissionRate = 0.2; // 20%
  let tierLabel = 'Standard Affiliate (20%)';

  if (referredClients > 30) {
    commissionRate = 0.3; // 30%
    tierLabel = 'Agency Partner Tier (30% Max)';
  } else if (referredClients > 10) {
    commissionRate = 0.25; // 25%
    tierLabel = 'Pro Partner Tier (25%)';
  }

  const grossMonthlyVolume = referredClients * planBaseMonthly;
  const monthlyEarnings = isBDT
    ? Math.round(grossMonthlyVolume * commissionRate)
    : Number((grossMonthlyVolume * commissionRate).toFixed(2));

  const annualEarnings = isBDT
    ? monthlyEarnings * 12
    : Number((monthlyEarnings * 12).toFixed(2));

  return (
    <div className="space-y-20">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION A: INTERACTIVE RECURRING EARNINGS CALCULATOR                 */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 mb-3 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Interactive Passive Income Simulator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Estimate Your Monthly Recurring Earnings
          </h2>
          <p className="text-slate-600 dark:text-zinc-400 text-xs sm:text-sm mt-1 font-normal max-w-2xl leading-relaxed">
            Unlike one-time bounty programs, our partner commissions are 100% recurring for every active month your client stays with DevHost Cloud.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls (Left) */}
          <div className="lg:col-span-7 space-y-7 p-6 sm:p-7 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] shadow-md">
            {/* Slider 1: Active Referrals */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <label className="uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600 dark:text-zinc-300" />
                  <span>Referred Active Clients</span>
                </label>
                <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-3 py-1 rounded border border-slate-200 dark:border-white/10 shadow-2xs">
                  {referredClients} Clients
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={referredClients}
                onChange={(e) => setReferredClients(Number(e.target.value))}
                className="w-full accent-blue-600 dark:accent-zinc-200 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                <span>1 Client (20%)</span>
                <span>15 Clients (25%)</span>
                <span>31+ Clients (30% Agency)</span>
                <span>100 Max</span>
              </div>
            </div>

            {/* Selector 2: Average Plan Value */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-semibold block">
                Select Average Client Hosting Plan
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PLAN_OPTIONS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const price = isBDT ? plan.bdt : plan.usd;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-zinc-900 border-blue-500 dark:border-white/30 ring-1 ring-blue-500/20'
                          : 'bg-white dark:bg-zinc-950/60 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {plan.name}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {symbol}{price}/mo
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payout Rule Notice */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.06] flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-slate-700 dark:text-zinc-300 leading-relaxed">
                <span className="text-slate-900 dark:text-zinc-100 font-bold">Guaranteed Payout Schedule:</span> Minimum ৳1,000 threshold paid automatically on the 5th of every month directly to your bKash, Nagad, or Bangladeshi Bank Account.
              </div>
            </div>
          </div>

          {/* Real-time Earnings Card (Right) */}
          <div className="lg:col-span-5 p-6 sm:p-7 rounded-xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/15 space-y-6 shadow-xl sticky top-24">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-emerald-400 font-semibold">
                  {tierLabel}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Projected Earnings</h3>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                {(commissionRate * 100).toFixed(0)}% Cut
              </span>
            </div>

            <div className="space-y-4 font-mono">
              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">Monthly Recurring Payout:</div>
                <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-50 mt-1">
                  {symbol}{monthlyEarnings.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400"> /month</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Gross Monthly Volume:</span>
                  <span className="text-slate-900 dark:text-zinc-200 font-semibold">{symbol}{grossMonthlyVolume.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Your Monthly Share:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {symbol}{monthlyEarnings.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-white/[0.06] pt-2 text-slate-900 dark:text-zinc-200">
                  <span>Annual Passive Income:</span>
                  <span className="text-slate-900 dark:text-zinc-100 font-bold">
                    {symbol}{annualEarnings.toLocaleString()} /year
                  </span>
                </div>
              </div>
            </div>

            <a
              href={`${getWhmcsClientAreaUrl()}register.php`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white transition-all shadow-md group cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Join Partner Program Now</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </a>

            <div className="text-center text-[11px] font-mono text-slate-500 dark:text-zinc-500">
              Instant activation • Automated referral tracking cookie (90 days)
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION B: 4-STEP PARTNERSHIP JOURNEY                                */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            How The Partner Program Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            Zero complicated paperwork. Get your tracking link in 60 seconds and start monetizing recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-2">
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-500 font-semibold">Step 01</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-200">Free Sign Up</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Create your affiliate account via our WHMCS portal in under a minute. No application approval delays.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-2">
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-500 font-semibold">Step 02</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-200">Share Your Link</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Recommend DevHost to clients, fellow developers, or your YouTube/blog audience with your 90-day tracking cookie.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-2">
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-500 font-semibold">Step 03</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-200">Clients Deploy</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Clients activate hosting with bKash/Nagad or Card. Real-time conversion tracking appears in your partner dashboard.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-2">
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Step 04</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-200">Monthly Payouts</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Receive automated recurring payouts every 5th of the month via bKash, Nagad, or direct bank transfer.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION C: AGENCY EXCLUSIVE PERKS                                    */}
      {/* -------------------------------------------------------------------- */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 dark:border-white/[0.08] pb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Agency Partner Tier Exclusives (31+ Clients)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1">
            High-volume agencies and software houses receive customized infrastructure and dedicated support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Free Staging & Dev Servers</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Qualifying agencies receive a complimentary high-RAM developer staging server to test and showcase client builds with zero downtime.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-zinc-200">
              <Briefcase className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Dedicated Engineering WhatsApp</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Skip standard ticket queues. Direct WhatsApp escalation channel to senior DevOps engineers for immediate client emergency resolution.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-200">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">White-Label Client Billing</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Option to bundle hosting fees directly into your agency retainers with wholesale reseller discounts or client direct billing.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
