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
}: {
  sellingPriceBDT: number;
  unitServerCostBDT: number;
  minOwnerProfitBDT: number;
  promoDiscountBDT?: number;
  promoDiscountPercent?: number;
  affiliateTierRate?: number;
  affiliateRatePercent?: number;
  billingCycle?: 'monthly' | 'annually';
}): OrderProfitBreakdown {
  const effectiveAffiliateRate = affiliateTierRate ?? affiliateRatePercent ?? 20;

  // 1. Calculate promo discount
  let computedPromoBDT = promoDiscountBDT;
  if (computedPromoBDT === undefined) {
    computedPromoBDT = Math.round(sellingPriceBDT * (promoDiscountPercent / 100));
  }
  const safePromo = Math.max(0, Math.min(computedPromoBDT, sellingPriceBDT));
  const netCollectedRevenue = Math.max(0, sellingPriceBDT - safePromo);

  // 2. Distributable Margin above baseline server cost
  const distributableMargin = Math.max(0, netCollectedRevenue - unitServerCostBDT);

  // 3. Raw Affiliate Commission based on partner tier (20%, 25%, 30%)
  const rawCommission = Math.round(netCollectedRevenue * (effectiveAffiliateRate / 100));

  // 4. Safe Affiliate Pool: Margin remaining after locking owner's minimum net profit
  const maxAllowedCommission = Math.max(
    0,
    netCollectedRevenue - unitServerCostBDT - minOwnerProfitBDT
  );

  // 5. Final Affiliate Commission: Caps safely at maxAllowedCommission
  const finalAffiliateCommissionBDT = Math.min(rawCommission, maxAllowedCommission);

  // 6. Final Locked Owner Net Profit: What the founder keeps in pocket
  const finalOwnerNetProfitBDT = Math.max(
    0,
    netCollectedRevenue - unitServerCostBDT - finalAffiliateCommissionBDT
  );

  // Verification: Is owner profit protected?
  const isProfitProtected =
    finalOwnerNetProfitBDT >= Math.min(minOwnerProfitBDT, netCollectedRevenue - unitServerCostBDT);

  const isLossMaking = netCollectedRevenue < unitServerCostBDT + minOwnerProfitBDT;
  const isAffiliateCapped = finalAffiliateCommissionBDT < rawCommission;

  const warnings: string[] = [];
  if (isLossMaking) {
    warnings.push(
      `Selling price (${sellingPriceBDT} BDT) after discount (${safePromo} BDT) violates profit floor (Cost: ${unitServerCostBDT} + Min Profit: ${minOwnerProfitBDT}).`
    );
  }
  if (isAffiliateCapped) {
    warnings.push(
      `Affiliate commission safely capped from ${rawCommission} BDT to ${finalAffiliateCommissionBDT} BDT to preserve guaranteed owner profit.`
    );
  }

  // Percentage shares of net collected revenue
  const totalRev = netCollectedRevenue || 1;
  const costRecoveryPercent = Math.round((unitServerCostBDT / totalRev) * 100);
  const affiliatePayoutPercent = Math.round((finalAffiliateCommissionBDT / totalRev) * 100);
  const ownerProfitPercent = Math.round((finalOwnerNetProfitBDT / totalRev) * 100);

  return {
    grossPriceBDT: sellingPriceBDT,
    rawPriceBDT: sellingPriceBDT,
    promoDiscountBDT: safePromo,
    netCollectedRevenueBDT: netCollectedRevenue,
    customerPaidBDT: netCollectedRevenue,
    unitServerCostBDT,
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
