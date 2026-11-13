'use client';

import React, { useState, useEffect } from 'react';
import { Search, Globe, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { getFormattedDomainPrice } from '@/config/domainData';

interface DomainResult {
  domain: string;
  tld: string;
  available: boolean;
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

export default function DomainSearchEngine({ initialQuery = '' }: { initialQuery?: string }) {
  const { currency, openStackBuilder } = useBilling();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      searchDomain(initialQuery);
    }
  }, [initialQuery, currency]);

  const searchDomain = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/domain-check?query=${encodeURIComponent(searchTerm)}&currency=${currency}`
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchDomain(query);
  };

  return (
    <div className="w-full max-w-2xl mx-auto transition-colors duration-200">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center p-1.5 rounded-xl bg-white dark:bg-zinc-950/80 border border-slate-300 dark:border-white/[0.08] focus-within:border-blue-500 dark:focus-within:border-white/20 shadow-md glass-card transition-all"
      >
        <div className="pl-3 sm:pl-3.5 text-slate-400 dark:text-zinc-400">
          <Globe className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter domain name (e.g. awesomebrand.com)..."
          className="w-full px-3 py-2 bg-transparent text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden text-sm font-sans"
        />

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all disabled:opacity-50 shrink-0 shadow-xs cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>Check</span>
        </button>
      </form>

      {/* Live Results Preview */}
      {hasSearched && results.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 p-4 shadow-xl glass-card text-left divide-y divide-slate-100 dark:divide-white/[0.06]">
          {results.slice(0, 4).map((r) => (
            <div key={r.domain} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {r.available ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 dark:text-zinc-600 shrink-0" />
                )}
                <div>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-200">{r.domain}</span>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                    Renews at {getFormattedDomainPrice(r.pricing.renewalBDT, currency)}/yr
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
                  {getFormattedDomainPrice(r.pricing.registerBDT, currency)}
                </span>
                {r.available ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        openStackBuilder({
                          pid: 2,
                          planName: 'Developer Pro Cloud',
                          basePriceMonthlyBDT: 450,
                          basePriceMonthlyUSD: 3.75,
                          domainName: r.domain,
                          specs: {
                            ram: '2 GB Isolated RAM',
                            cpu: '2 vCPU Cores',
                            storage: '25 GB NVMe SSD',
                            inodes: '300,000 Inodes',
                          },
                        })
                      }
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-blue-700 dark:text-emerald-400 border border-blue-200 dark:border-emerald-500/30 text-[10px] font-mono transition-all cursor-pointer font-semibold"
                    >
                      <span>Bundle + Host</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openStackBuilder({
                          orderMode: 'domain_registration',
                          planName: `Domain Registration: ${r.domain}`,
                          domainName: r.domain,
                          domainYears: 1,
                          basePriceBDT: r.pricing.registerBDT,
                          basePriceUSD: r.pricing.registerUSD,
                        })
                      }
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-xs transition-all cursor-pointer"
                    >
                      <span>Register Domain</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-600">Unavailable</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
