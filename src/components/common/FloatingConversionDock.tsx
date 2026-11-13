'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, Sparkles, X, ShieldCheck } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import AnimatedPrice from '@/components/ui/AnimatedPrice';

export default function FloatingConversionDock() {
  const pathname = usePathname();
  const { currency, billingCycle, setBillingCycle, openStackBuilder } = useBilling();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Supported service pages
  const allowedRoutes = [
    '/',
    '/nodejs-hosting',
    '/wordpress-hosting-bangladesh',
    '/cloud-vps',
    '/marketplace',
  ];

  const isSupportedPage = allowedRoutes.includes(pathname);

  useEffect(() => {
    if (!isSupportedPage || isDismissed) {
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const scrollPercentage = (window.scrollY / scrollHeight) * 100;

      if (scrollPercentage > 30) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname, isSupportedPage, isDismissed]);

  if (!isSupportedPage || isDismissed || !isVisible) {
    return null;
  }

  const isBDT = currency === 'BDT';
  const isAnnual = billingCycle === 'annually';

  // Flagship Developer Pro specs
  const baseMonthly = isBDT ? 450 : 3.75;
  const effectiveMonthly = isAnnual
    ? isBDT
      ? Math.round(baseMonthly * 0.8)
      : Number((baseMonthly * 0.8).toFixed(2))
    : baseMonthly;

  const symbol = isBDT ? '৳' : '$';

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border border-slate-300 dark:border-white/15 shadow-2xl shadow-slate-900/15 dark:shadow-black/80 transition-colors">
        {/* Left: Status pulse & plan summary */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>

          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
              <span>Developer Pro Cloud</span>
              <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-300 border border-blue-200 dark:border-white/10 font-semibold">
                NVMe + Git
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-normal">
              <AnimatedPrice
                amount={effectiveMonthly}
                currencySymbol={symbol}
                suffix="/mo"
                className="text-slate-900 dark:text-slate-200 font-bold"
              />
              {isAnnual && (
                <span className="hidden sm:inline text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  (20% off)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick cycle switch + Instant Deploy CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Annual Toggle Pill */}
          <button
            type="button"
            onClick={() => setBillingCycle(isAnnual ? 'monthly' : 'annually')}
            className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono transition-all cursor-pointer ${
              isAnnual
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-white/5'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>{isAnnual ? '20% OFF Active' : 'Save 20%'}</span>
          </button>

          {/* Deploy CTA */}
          <button
            type="button"
            onClick={() =>
              openStackBuilder({
                pid: 2,
                planName: 'Developer Pro Cloud',
                basePriceMonthlyBDT: 450,
                basePriceMonthlyUSD: 3.75,
              })
            }
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <span>Deploy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer"
            aria-label="Dismiss dock"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
