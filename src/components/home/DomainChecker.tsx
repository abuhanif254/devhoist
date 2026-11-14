'use client';

import React, { useState, useEffect } from 'react';
import { Search, Globe, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { getFormattedDomainPrice } from '@/config/domainData';

interface CheckedDomainResult {
  domain: string;
  baseLabel: string;
  tld: string;
  category: string;
  badge?: string;
  available: boolean;
  isPrimaryMatch: boolean;
  pricing: {
    registerBDT: number;
    renewalBDT: number;
    transferBDT: number;
    registerUSD: number;
    renewalUSD: number;
    transferUSD: number;
  };
  cartUrl: string;
}

export default function DomainChecker() {
  const { currency, openStackBuilder } = useBilling();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CheckedDomainResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounce input to trigger instant search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        setDebouncedQuery(query.trim());
      } else if (query.trim().length === 0) {
        setResults([]);
        setHasSearched(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) return;

    let isMounted = true;
    const timer = window.setTimeout(() => {
      if (isMounted) setIsLoading(true);
    }, 0);

    fetch(`/api/domain-check?domain=${encodeURIComponent(debouncedQuery)}&currency=${currency}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setResults(data.results || []);
          setHasSearched(true);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [debouncedQuery, currency]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      setDebouncedQuery(query.trim());
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Search Bar Input Container */}
      <form
        onSubmit={handleManualSearch}
        className="relative flex items-center p-1.5 rounded-2xl bg-white dark:bg-slate-950/90 border border-slate-300 dark:border-white/[0.08] focus-within:border-blue-500 dark:focus-within:border-blue-400/50 shadow-md glass-card transition-all"
      >
        <div className="pl-3 sm:pl-3.5 text-slate-400 dark:text-slate-400">
          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find your perfect domain (e.g. mynextapp.com, devbrand.io)..."
          className="w-full px-3 py-2 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-sm font-sans min-w-0"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setHasSearched(false);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 mr-1 text-xs cursor-pointer shrink-0"
          >
            Clear
          </button>
        )}

        <button
          type="submit"
          disabled={isLoading || query.trim().length < 2}
          className="inline-flex items-center gap-1.5 h-10 px-4 sm:px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Search Domain</span>
          <span className="sm:hidden">Search</span>
        </button>
      </form>

      {/* Featured TLD Quick Pills from Exact Matrix */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-mono text-slate-500 dark:text-slate-500">Popular:</span>
        <button
          type="button"
          onClick={() => setQuery('mystartup.com')}
          className="px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
        >
          .com <span className="font-semibold text-blue-600 dark:text-blue-400">{getFormattedDomainPrice(1350, currency)}</span>
        </button>
        <button
          type="button"
          onClick={() => setQuery('nextproject.xyz')}
          className="px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
        >
          .xyz <span className="font-semibold text-blue-600 dark:text-blue-400">{getFormattedDomainPrice(290, currency)}</span>
        </button>
        <button
          type="button"
          onClick={() => setQuery('cloudapp.io')}
          className="px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
        >
          .io <span className="font-semibold text-blue-600 dark:text-blue-400">{getFormattedDomainPrice(4800, currency)}</span>
        </button>
        <button
          type="button"
          onClick={() => setQuery('intellect.ai')}
          className="px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
        >
          .ai <span className="font-semibold text-blue-600 dark:text-blue-400">{getFormattedDomainPrice(9500, currency)}</span>
        </button>
      </div>

      {/* Real-time Dynamic Results List */}
      {hasSearched && results.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1120] p-4 sm:p-5 shadow-xl glass-card animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-slate-400">
            <span className="font-mono truncate">
              Live DoH Verification: <strong className="text-slate-900 dark:text-slate-200">&quot;{debouncedQuery}&quot;</strong>
            </span>
            <span className="font-mono text-[11px] flex items-center gap-1.5 text-slate-600 dark:text-slate-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              bKash / Nagad / Card Checkout
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06] mt-2">
            {results.slice(0, 5).map((item) => {
              const regPrice = getFormattedDomainPrice(item.pricing.registerBDT, currency);
              const renPrice = getFormattedDomainPrice(item.pricing.renewalBDT, currency);

              return (
                <div
                  key={item.domain}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.available ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono truncate">
                          {item.domain}
                        </span>
                        {item.available ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold">
                            Available
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 font-semibold">
                            Registered
                          </span>
                        )}
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hidden md:inline-block font-mono">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Renews at {renPrice}/yr • Zero hidden fee
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2.5 sm:gap-4 shrink-0">
                    <div className="flex items-baseline justify-between sm:block sm:text-right">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {regPrice}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-500">1st Year</div>
                    </div>

                    {item.available ? (
                      <div className="grid grid-cols-2 sm:flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openStackBuilder({
                              pid: 2,
                              planName: 'Developer Pro Cloud',
                              basePriceMonthlyBDT: 450,
                              basePriceMonthlyUSD: 3.75,
                              domainName: item.domain,
                              specs: {
                                ram: '2 GB Isolated RAM',
                                cpu: '2 vCPU Cores',
                                storage: '5 GB NVMe SSD',
                                inodes: '300,000 Inodes',
                              },
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer shadow-xs"
                          title="Bundle with Developer Pro Cloud Hosting"
                        >
                          <span>Bundle + Host</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openStackBuilder({
                              orderMode: 'domain_registration',
                              planName: `Domain Registration: ${item.domain}`,
                              domainName: item.domain,
                              domainYears: 1,
                              basePriceBDT: item.pricing.registerBDT,
                              basePriceUSD: item.pricing.registerUSD,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-300 dark:border-white/10 transition-all shrink-0 cursor-pointer shadow-xs"
                        >
                          <span>Domain Only</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled
                        className="h-8 px-3 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 text-xs border border-slate-200 dark:border-white/5 cursor-not-allowed shrink-0"
                      >
                        Unavailable
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/[0.08] text-center">
            <a
              href={`/cheap-domain-registration-bd?q=${encodeURIComponent(debouncedQuery)}`}
              className="text-xs text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <span>View all 10 supported TLD extensions and renewal rates</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
