'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { WHMCS_CONFIG, getWhmcsCartUrl } from '@/config/whmcs';

type Currency = 'BDT' | 'USD';
type BillingCycle = 'monthly' | 'annually';
type Theme = 'dark' | 'light';

export type StackOrderMode =
  | 'hosting_order'
  | 'domain_registration'
  | 'domain_renewal'
  | 'domain_transfer';

export interface StackBuilderConfig {
  orderMode?: StackOrderMode;
  pid?: number;
  defaultPlanId?: number;
  planName: string;
  basePriceMonthlyBDT?: number;
  basePriceMonthlyUSD?: number;
  basePriceBDT?: number;
  basePriceUSD?: number;
  domainYears?: number;
  eppCode?: string;
  defaultRegion?: 'sg' | 'us';
  defaultBillingCycle?: BillingCycle;
  defaultStack?: 'nextjs_git' | 'wordpress_lscache' | 'laravel_php' | 'clean_cpanel' | string;
  selectedStackSlug?: string;
  minPlanPid?: number;
  domainName?: string;
  promoCode?: string;
  specs?: {
    ram?: string;
    cpu?: string;
    storage?: string;
    bandwidth?: string;
    inodes?: string;
  };
}

interface BillingContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  theme: Theme;
  toggleTheme: () => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isStackBuilderOpen: boolean;
  stackBuilderConfig: StackBuilderConfig | null;
  openStackBuilder: (config: StackBuilderConfig) => void;
  closeStackBuilder: () => void;
  formatPrice: (priceMonthlyBDT: number, priceMonthlyUSD: number) => {
    formatted: string;
    period: string;
    discountNote?: string;
    rawAmount: number;
    symbol: string;
  };
  getCartUrl: (pid: number, domain?: string) => string;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [theme, setTheme] = useState<Theme>('light');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isStackBuilderOpen, setIsStackBuilderOpen] = useState(false);
  const [stackBuilderConfig, setStackBuilderConfig] = useState<StackBuilderConfig | null>(null);

  // Initialize theme from localStorage or default to light
  useEffect(() => {
    // Clean up stale dark mode keys to prevent stuck dark theme
    localStorage.removeItem('devhost-theme');
    localStorage.removeItem('devhost-theme-v2');
    localStorage.removeItem('devhost-theme-v3');

    const savedTheme = localStorage.getItem('devhost-theme-v4') as Theme | null;
    const resolvedTheme: Theme = savedTheme === 'dark' ? 'dark' : 'light';
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }

    const savedCurrency = localStorage.getItem('devhost-currency') as Currency | null;
    const timer = window.setTimeout(() => {
      setTheme(resolvedTheme);
      if (savedCurrency) {
        setCurrency(savedCurrency);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Keyboard shortcut listener for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsStackBuilderOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    localStorage.setItem('devhost-currency', newCurrency);
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('devhost-theme-v4', nextTheme);
      if (nextTheme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
      return nextTheme;
    });
  };

  const openStackBuilder = (config: StackBuilderConfig) => {
    setStackBuilderConfig(config);
    setIsStackBuilderOpen(true);
  };

  const closeStackBuilder = () => {
    setIsStackBuilderOpen(false);
  };

  const formatPrice = (priceMonthlyBDT: number, priceMonthlyUSD: number) => {
    const symbol = currency === 'BDT' ? '৳' : '$';
    const baseMonthly = currency === 'BDT' ? priceMonthlyBDT : priceMonthlyUSD;

    if (billingCycle === 'annually') {
      // 20% discount applied to monthly equivalent
      const discountedMonthly = baseMonthly * (1 - WHMCS_CONFIG.yearlyDiscountPercent / 100);
      const rounded = currency === 'BDT' ? Math.round(discountedMonthly) : Number(discountedMonthly.toFixed(2));
      return {
        formatted: `${symbol}${rounded}`,
        period: '/mo billed annually',
        discountNote: '20% OFF applied',
        rawAmount: rounded,
        symbol,
      };
    }

    return {
      formatted: `${symbol}${baseMonthly}`,
      period: '/mo',
      rawAmount: baseMonthly,
      symbol,
    };
  };

  const getCartUrl = (pid: number, domain?: string) => {
    return getWhmcsCartUrl(pid, billingCycle, currency, domain);
  };

  return (
    <BillingContext.Provider
      value={{
        currency,
        setCurrency: handleCurrencyChange,
        billingCycle,
        setBillingCycle,
        theme,
        toggleTheme,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isStackBuilderOpen,
        stackBuilderConfig,
        openStackBuilder,
        closeStackBuilder,
        formatPrice,
        getCartUrl,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}
