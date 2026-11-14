/**
 * Global Constants, Currency & Billing Math
 * Single source of truth for exchange rates, WHMCS parameters, and billing equations.
 */

export const BASE_CURRENCY = 'BDT' as const;
export const SECONDARY_CURRENCY = 'USD' as const;
export type CurrencyCode = typeof BASE_CURRENCY | typeof SECONDARY_CURRENCY;

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BDT: '৳',
  USD: '$',
};

// Fixed Exchange Rate: 120 BDT = 1 USD
export const USD_EXCHANGE_RATE = 120;

// Annual Discount Rate: 20% OFF
export const ANNUAL_DISCOUNT = 0.20;

// WHMCS Configuration
export const WHMCS_CONFIG = {
  WHMCS_URL: process.env.NEXT_PUBLIC_WHMCS_URL || 'https://billing.yourdomain.com',
  CURRENCY_ID_BDT: 1,
  CURRENCY_ID_USD: 2,
};

/**
 * Currency Conversion Formula
 * usdPrice = Number((bdtPrice / 120).toFixed(2))
 */
export function convertBdtToUsd(bdtPrice: number): number {
  return Number((bdtPrice / USD_EXCHANGE_RATE).toFixed(2));
}

export function formatCurrency(bdtPrice: number, currency: CurrencyCode = 'BDT'): string {
  if (currency === 'USD') {
    return `$${convertBdtToUsd(bdtPrice).toFixed(2)}`;
  }
  return `৳${Math.round(bdtPrice).toLocaleString()}`;
}

/**
 * Exact Billing Math Formulas
 * monthlyEffectivePrice = isAnnual ? Math.round(baseMonthlyPrice * 0.8) : baseMonthlyPrice
 * annualTotalBilled = Math.round(baseMonthlyPrice * 0.8) * 12
 * annualSavingsAmount = (baseMonthlyPrice * 12) - annualTotalBilled
 */
export function calculateBilling(baseMonthlyPriceBDT: number, isAnnual: boolean, currency: CurrencyCode = 'BDT') {
  const effectiveMonthlyBDT = isAnnual
    ? Math.round(baseMonthlyPriceBDT * (1 - ANNUAL_DISCOUNT))
    : baseMonthlyPriceBDT;

  const annualTotalBilledBDT = Math.round(baseMonthlyPriceBDT * (1 - ANNUAL_DISCOUNT)) * 12;
  const annualSavingsBDT = (baseMonthlyPriceBDT * 12) - annualTotalBilledBDT;

  if (currency === 'USD') {
    const effectiveMonthlyUSD = convertBdtToUsd(effectiveMonthlyBDT);
    const annualTotalBilledUSD = convertBdtToUsd(annualTotalBilledBDT);
    const annualSavingsUSD = convertBdtToUsd(annualSavingsBDT);

    return {
      currency: 'USD' as const,
      symbol: '$',
      monthlyEffectivePrice: effectiveMonthlyUSD,
      annualTotalBilled: annualTotalBilledUSD,
      annualSavingsAmount: annualSavingsUSD,
      isAnnual,
      formattedPrice: `$${effectiveMonthlyUSD.toFixed(2)}`,
      formattedTotal: `$${annualTotalBilledUSD.toFixed(2)}`,
      formattedSavings: `$${annualSavingsUSD.toFixed(2)}`,
    };
  }

  return {
    currency: 'BDT' as const,
    symbol: '৳',
    monthlyEffectivePrice: effectiveMonthlyBDT,
    annualTotalBilled: annualTotalBilledBDT,
    annualSavingsAmount: annualSavingsBDT,
    isAnnual,
    formattedPrice: `৳${effectiveMonthlyBDT}`,
    formattedTotal: `৳${annualTotalBilledBDT.toLocaleString()}`,
    formattedSavings: `৳${annualSavingsBDT.toLocaleString()}`,
  };
}
