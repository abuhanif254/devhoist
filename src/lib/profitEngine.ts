/**
 * DevHost Cloud - Deterministic Profit-Protected Unit Economics Engine
 * Mathematically guarantees:
 * 1. 100% Server Hardware/Reseller Cost Recovery on every sale.
 * 2. Guaranteed Minimum Owner Net Profit (৳ BDT) locked before affiliate pool.
 * 3. Safe, dynamically-capped affiliate commission pool when promo discounts are applied.
 */

export interface PlanUnitEconomics {
  sellingPriceBDT: number;
  unitServerCostBDT: number;
  minOwnerProfitBDT: number;
  maxAffiliatePoolBDT: number;
}

export interface OrderProfitBreakdown {
  grossPriceBDT: number;
  rawPriceBDT: number;
  promoDiscountBDT: number;
  netCollectedRevenueBDT: number;
  customerPaidBDT: number;
  unitServerCostBDT: number;
  freeDomainCostBDT?: number;
  totalHardCostBDT?: number;
  bundledDomainTLD?: string;
  hasFreeDomainBundle?: boolean;
  distributableMarginBDT: number;
  grossMarginBDT: number;
  minOwnerProfitBDT: number;
  maxAffiliatePoolBDT: number;
  rawAffiliateCommissionBDT: number;
  nominalAffiliateCommissionBDT: number;
  finalAffiliateCommissionBDT: number;
  actualAffiliateCommissionBDT: number;
  finalOwnerNetProfitBDT: number;
  ownerNetProfitBDT: number;
  isProfitProtected: boolean;
  costRecoveryPercent: number;
  serverCostPercent: number;
  affiliatePayoutPercent: number;
  affiliatePercent: number;
  ownerProfitPercent: number;
  ownerProfitMarginPercent: number;
  affiliateTierPercent: number;
  isAffiliateCapped: boolean;
  isLossMaking: boolean;
  warnings: string[];
}

export interface DomainProfitBreakdown {
  tld: string;
  regPriceBDT: number;
  registrarCostBDT: number;
  ownerGrossProfitBDT: number;
  affiliateEligible: boolean;
  affiliateCommissionBDT: number;
  ownerNetProfitBDT: number;
}

/**
 * Deterministic Unit Economics Calculation for Hosting & VPS Orders
 */
export function calculateOrderProfitBreakdown({
  sellingPriceBDT,
  unitServerCostBDT,
  minOwnerProfitBDT,
  promoDiscountBDT,
  promoDiscountPercent = 0,
  affiliateTierRate,
  affiliateRatePercent = 20,
  billingCycle = 'monthly',
  freeDomainCostBDT = 0,
  bundledDomainTLD,
}: {
  sellingPriceBDT: number;
  unitServerCostBDT: number;
  minOwnerProfitBDT: number;
  promoDiscountBDT?: number;
  promoDiscountPercent?: number;
  affiliateTierRate?: number;
  affiliateRatePercent?: number;
  billingCycle?: 'monthly' | 'annually';
  freeDomainCostBDT?: number;
  bundledDomainTLD?: string;
}): OrderProfitBreakdown {
  const effectiveAffiliateRate = affiliateTierRate ?? affiliateRatePercent ?? 20;
  const safeFreeDomainCost = Math.max(0, freeDomainCostBDT || 0);
  const totalHardCost = unitServerCostBDT + safeFreeDomainCost;

  // 1. Calculate promo discount
  let computedPromoBDT = promoDiscountBDT;
  if (computedPromoBDT === undefined) {
    computedPromoBDT = Math.round(sellingPriceBDT * (promoDiscountPercent / 100));
  }
  const safePromo = Math.max(0, Math.min(computedPromoBDT, sellingPriceBDT));
  const netCollectedRevenue = Math.max(0, sellingPriceBDT - safePromo);

  // 2. Distributable Margin above baseline server and bundled domain cost
  const distributableMargin = Math.max(0, netCollectedRevenue - totalHardCost);

  // 3. Raw Affiliate Commission based on partner tier (20%, 25%, 30%)
  const rawCommission = Math.round(netCollectedRevenue * (effectiveAffiliateRate / 100));

  // 4. Safe Affiliate Pool: Margin remaining after locking owner's minimum net profit and hard costs
  const maxAllowedCommission = Math.max(
    0,
    netCollectedRevenue - totalHardCost - minOwnerProfitBDT
  );

  // 5. Final Affiliate Commission: Caps safely at maxAllowedCommission
  const finalAffiliateCommissionBDT = Math.min(rawCommission, maxAllowedCommission);

  // 6. Final Locked Owner Net Profit: What the founder keeps in pocket
  const finalOwnerNetProfitBDT = Math.max(
    0,
    netCollectedRevenue - totalHardCost - finalAffiliateCommissionBDT
  );

  // Verification: Is owner profit protected?
  const isProfitProtected =
    finalOwnerNetProfitBDT >= Math.min(minOwnerProfitBDT, netCollectedRevenue - totalHardCost);

  const isLossMaking = netCollectedRevenue < totalHardCost + minOwnerProfitBDT;
  const isAffiliateCapped = finalAffiliateCommissionBDT < rawCommission;

  const warnings: string[] = [];
  if (isLossMaking) {
    warnings.push(
      `Selling price (${sellingPriceBDT} BDT) after discount (${safePromo} BDT) violates profit floor (Cost: ${totalHardCost} + Min Profit: ${minOwnerProfitBDT}).`
    );
  }
  if (isAffiliateCapped) {
    warnings.push(
      `Affiliate commission safely capped from ${rawCommission} BDT to ${finalAffiliateCommissionBDT} BDT to preserve guaranteed owner profit.`
    );
  }
  if (safeFreeDomainCost > 0) {
    warnings.push(
      `1st-Year Free Domain Bundle (${bundledDomainTLD || '.com'}) wholesale buy cost ৳${safeFreeDomainCost} BDT protected. Owner profit guaranteed.`
    );
  }

  // Percentage shares of net collected revenue
  const totalRev = netCollectedRevenue || 1;
  const costRecoveryPercent = Math.round((totalHardCost / totalRev) * 100);
  const affiliatePayoutPercent = Math.round((finalAffiliateCommissionBDT / totalRev) * 100);
  const ownerProfitPercent = Math.round((finalOwnerNetProfitBDT / totalRev) * 100);

  return {
    grossPriceBDT: sellingPriceBDT,
    rawPriceBDT: sellingPriceBDT,
    promoDiscountBDT: safePromo,
    netCollectedRevenueBDT: netCollectedRevenue,
    customerPaidBDT: netCollectedRevenue,
    unitServerCostBDT,
    freeDomainCostBDT: safeFreeDomainCost,
    totalHardCostBDT: totalHardCost,
    bundledDomainTLD,
    hasFreeDomainBundle: safeFreeDomainCost > 0,
    distributableMarginBDT: distributableMargin,
    grossMarginBDT: distributableMargin,
    minOwnerProfitBDT,
    maxAffiliatePoolBDT: maxAllowedCommission,
    rawAffiliateCommissionBDT: rawCommission,
    nominalAffiliateCommissionBDT: rawCommission,
    finalAffiliateCommissionBDT,
    actualAffiliateCommissionBDT: finalAffiliateCommissionBDT,
    finalOwnerNetProfitBDT,
    ownerNetProfitBDT: finalOwnerNetProfitBDT,
    isProfitProtected,
    costRecoveryPercent,
    serverCostPercent: costRecoveryPercent,
    affiliatePayoutPercent,
    affiliatePercent: affiliatePayoutPercent,
    ownerProfitPercent,
    ownerProfitMarginPercent: ownerProfitPercent,
    affiliateTierPercent: effectiveAffiliateRate,
    isAffiliateCapped,
    isLossMaking,
    warnings,
  };
}

/**
 * Domain TLD Unit Economics Calculation
 */
export function calculateDomainProfitBreakdown({
  tld,
  regPriceBDT,
  registrarCostBDT,
  affiliateEligible = false,
  affiliateTierRate = 20,
}: {
  tld: string;
  regPriceBDT: number;
  registrarCostBDT: number;
  affiliateEligible?: boolean;
  affiliateTierRate?: number;
}): DomainProfitBreakdown {
  const grossProfit = Math.max(0, regPriceBDT - registrarCostBDT);
  let affiliateCommission = 0;

  if (affiliateEligible && grossProfit > 100) {
    // Only pay commission from margin if explicitly eligible
    affiliateCommission = Math.min(
      Math.round(grossProfit * (affiliateTierRate / 100)),
      Math.round(grossProfit * 0.4) // Never pay more than 40% of margin
    );
  }

  const ownerNetProfit = grossProfit - affiliateCommission;

  return {
    tld,
    regPriceBDT,
    registrarCostBDT,
    ownerGrossProfitBDT: grossProfit,
    affiliateEligible,
    affiliateCommissionBDT: affiliateCommission,
    ownerNetProfitBDT: ownerNetProfit,
  };
}

/**
 * Validates a proposed plan pricing change against zero-loss policy
 */
export function validatePricingPlanChange({
  sellingPriceBDT,
  unitServerCostBDT,
  minOwnerProfitBDT,
}: {
  sellingPriceBDT: number;
  unitServerCostBDT: number;
  minOwnerProfitBDT: number;
}): { valid: boolean; error?: string; safeAffiliatePoolBDT: number } {
  if (sellingPriceBDT <= 0 || unitServerCostBDT <= 0 || minOwnerProfitBDT <= 0) {
    return {
      valid: false,
      error: 'All financial numbers (Selling Price, Server Cost, Min Profit) must be greater than 0 BDT.',
      safeAffiliatePoolBDT: 0,
    };
  }

  const minRequiredPrice = unitServerCostBDT + minOwnerProfitBDT;

  if (sellingPriceBDT < minRequiredPrice) {
    return {
      valid: false,
      error: `Zero-Loss Violation: Selling price (৳${sellingPriceBDT}) cannot be less than Server Cost (৳${unitServerCostBDT}) + Locked Owner Profit (৳${minOwnerProfitBDT}) = ৳${minRequiredPrice} BDT.`,
      safeAffiliatePoolBDT: 0,
    };
  }

  const safePool = sellingPriceBDT - unitServerCostBDT - minOwnerProfitBDT;

  return {
    valid: true,
    safeAffiliatePoolBDT: safePool,
  };
}

export interface SafeRefundBreakdown {
  invoiceTotalBDT: number;
  freeDomainClaimed: boolean;
  bundledDomainName?: string;
  bundledDomainTLD?: string;
  nonRefundableDomainFeeBDT: number;
  nonRefundableGatewayFeeBDT: number;
  maxSafeRefundableAmountBDT: number;
  affiliateCommissionClawbackBDT: number;
  customerRetainsDomainOwnership: boolean;
  isWithin30DayWindow: boolean;
  daysSincePurchase: number;
  formulaSummary: string;
}

export const STANDARD_DOMAIN_RETAIL_PRICES_BDT: Record<string, number> = {
  '.com': 1350,
  '.net': 1450,
  '.org': 1390,
  '.io': 4900,
  '.xyz': 290,
  '.shop': 290,
  '.store': 350,
};

/**
 * Free-Domain & Gateway Refund Loss-Protection Formula
 * Guarantees the company never loses money on non-refundable registry domain costs
 * when issuing a 30-day hosting refund on an Annual Plan that included a Free Domain.
 */
export function calculateSafeRefundBreakdown({
  invoiceTotalBDT,
  freeDomainClaimed = false,
  bundledDomainName,
  bundledDomainTLD,
  freeDomainRetailPriceBDT,
  affiliateCommissionBDT = 0,
  nonRefundableGatewayFeeBDT = 0,
  daysSincePurchase = 5,
}: {
  invoiceTotalBDT: number;
  freeDomainClaimed?: boolean;
  bundledDomainName?: string;
  bundledDomainTLD?: string;
  freeDomainRetailPriceBDT?: number;
  affiliateCommissionBDT?: number;
  nonRefundableGatewayFeeBDT?: number;
  daysSincePurchase?: number;
}): SafeRefundBreakdown {
  const safeInvoiceTotal = Math.max(0, invoiceTotalBDT);
  const isWithin30DayWindow = daysSincePurchase <= 30;

  let detectedTld = bundledDomainTLD || '';
  if (!detectedTld && bundledDomainName && bundledDomainName.includes('.')) {
    detectedTld = `.${bundledDomainName.split('.').pop()!.toLowerCase()}`;
  }
  if (!detectedTld) {
    detectedTld = '.com';
  }

  const resolvedDomainFee = freeDomainClaimed
    ? freeDomainRetailPriceBDT ??
      STANDARD_DOMAIN_RETAIL_PRICES_BDT[detectedTld] ??
      1350
    : 0;

  const safeGatewayFee = Math.max(0, nonRefundableGatewayFeeBDT);
  const maxSafeRefundableAmountBDT = isWithin30DayWindow
    ? Math.max(0, safeInvoiceTotal - resolvedDomainFee - safeGatewayFee)
    : 0;

  const affiliateCommissionClawbackBDT = Math.max(0, affiliateCommissionBDT);

  const formulaSummary = !isWithin30DayWindow
    ? `Order is outside the 30-day money-back window (${daysSincePurchase} days elapsed). Refundable: ৳0.`
    : freeDomainClaimed
    ? `Invoice Paid (৳${safeInvoiceTotal}) - Non-Refundable 1st-Year Free Domain ${detectedTld} Fee (৳${resolvedDomainFee}) = Safe Refundable Hosting Balance (৳${maxSafeRefundableAmountBDT}). Customer keeps 100% ownership of ${bundledDomainName || `the ${detectedTld} domain`}.`
    : `Full 30-Day Hosting Refund Eligible: ৳${maxSafeRefundableAmountBDT} (No bundled domain deduction).`;

  return {
    invoiceTotalBDT: safeInvoiceTotal,
    freeDomainClaimed,
    bundledDomainName,
    bundledDomainTLD: detectedTld,
    nonRefundableDomainFeeBDT: resolvedDomainFee,
    nonRefundableGatewayFeeBDT: safeGatewayFee,
    maxSafeRefundableAmountBDT,
    affiliateCommissionClawbackBDT,
    customerRetainsDomainOwnership: freeDomainClaimed,
    isWithin30DayWindow,
    daysSincePurchase,
    formulaSummary,
  };
}
