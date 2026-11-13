// ==============================================================================
// DEVHOST CLOUD - ZERO-LOSS AFFILIATE ATTRIBUTION & 4-SIGNAL FRAUD ENGINE
// Cloudflare Workers / Edge Runtime Compatible (Web Crypto SHA-256 + ProfitEngine)
// Schema-aligned with supabase/schema.sql + phase3_payments_and_affiliate.sql
// ==============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateOrderProfitBreakdown,
  STANDARD_DOMAIN_RETAIL_PRICES_BDT,
} from '@/lib/profitEngine';
import { createFraudAlert, logSecurityAudit } from '@/lib/security';
import { renderAffiliateEmail, sendEmail } from '@/lib/emailEngine';

export interface ParsedAffiliateCookie {
  referralCode: string;
  subId: string;
  timestamp?: number;
  landing?: string;
}

export interface FraudShieldInput {
  buyerUserId?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerIp?: string;
  senderPhone?: string;
  cardFingerprint?: string;
  invoiceId?: string;
}

export interface FraudShieldResult {
  blocked: boolean;
  fraudScore: number;
  signalsTriggered: string[];
  reason?: string;
}

export interface ZeroLossCommissionInput {
  grossSellingPriceBDT: number;
  billingCycle?: 'monthly' | 'annually';
  unitServerCostBDT?: number;
  minOwnerProfitBDT?: number;
  promoDiscountBDT?: number;
  freeDomainBundleApplied?: boolean;
  bundledDomainName?: string;
  freeDomainCostBDT?: number;
  affiliateRatePercent: number;
}

export interface AffiliateConversionInput {
  invoiceId?: string;
  invoiceNumber: string;
  orderType?: string;
  buyerUserId?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerIp?: string;
  referralCode?: string;
  subId?: string;
  amountBDT: number;
  subtotalBDT?: number;
  billingCycle?: 'monthly' | 'annually';
  unitServerCostBDT?: number;
  minOwnerProfitBDT?: number;
  promoDiscountBDT?: number;
  freeDomainBundleApplied?: boolean;
  bundledDomainName?: string;
  freeDomainCostBDT?: number;
  senderPhone?: string;
  cardFingerprint?: string;
}

export interface AffiliateConversionOutcome {
  recorded: boolean;
  alreadyRecorded?: boolean;
  skippedReason?: string;
  blocked?: boolean;
  fraudReason?: string;
  signalsTriggered?: string[];
  affiliateUserId?: string;
  referralCode?: string;
  commissionBDT: number;
  commissionRatePercent: number;
  isAffiliateCapped: boolean;
  ownerNetProfitBDT: number;
  maturesAt?: string;
}

// ==============================================================================
// 1. CANONICALIZATION & FINGERPRINT HELPERS
// ==============================================================================

/**
 * Safely parses the devhost_aff_ref cookie (either JSON object or raw referral code).
 */
export function parseAffiliateAttributionCookie(
  rawCookie?: string | null
): ParsedAffiliateCookie | null {
  if (!rawCookie || typeof rawCookie !== 'string') return null;
  const trimmed = rawCookie.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as {
      code?: string;
      referralCode?: string;
      subid?: string;
      subId?: string;
      timestamp?: number;
      landing?: string;
    };
    const code = String(parsed.code || parsed.referralCode || '').trim();
    if (!code) return null;
    return {
      referralCode: code,
      subId: String(parsed.subid || parsed.subId || 'organic').trim() || 'organic',
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : undefined,
      landing: typeof parsed.landing === 'string' ? parsed.landing : undefined,
    };
  } catch {
    const clean = trimmed.replace(/[^A-Za-z0-9_-]/g, '');
    if (!clean) return null;
    return { referralCode: clean, subId: 'organic' };
  }
}

/**
 * Canonicalizes email addresses so Gmail dot tricks and +subaddress aliases resolve identically.
 */
export function canonicalizeEmail(email?: string | null): string {
  if (!email) return '';
  const cleaned = email.trim().toLowerCase();
  const atIdx = cleaned.indexOf('@');
  if (atIdx <= 0) return cleaned;

  let local = cleaned.slice(0, atIdx);
  let domain = cleaned.slice(atIdx + 1);

  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  const plusIdx = local.indexOf('+');
  if (plusIdx > -1) {
    local = local.slice(0, plusIdx);
  }

  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * Normalizes Bangladeshi mobile numbers (+8801XXXXXXXXX -> 01XXXXXXXXX).
 */
export function normalizeBdPhone(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('8801') && digits.length >= 13) {
    digits = digits.slice(2);
  } else if (digits.startsWith('880') && digits.length >= 12) {
    digits = '0' + digits.slice(3);
  }
  return digits;
}

/**
 * Extracts public IPv4 /24 prefix (a.b.c) or IPv6 /64 prefix for subnet fraud correlation.
 */
export function extractIpSubnet24(ip?: string | null): string | null {
  if (!ip) return null;
  const clean = ip.trim().split(',')[0]?.trim().toLowerCase() || '';
  if (!clean || clean === 'unknown' || clean === '127.0.0.1' || clean === '::1') {
    return null;
  }

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) {
      return null;
    }
    return `${v4[1]}.${v4[2]}.${v4[3]}`;
  }

  if (clean.includes(':')) {
    return clean.split(':').slice(0, 4).join(':');
  }

  return null;
}

export async function sha256ShortHex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function resolveAffiliateTierRate(
  tierLevel?: string | null,
  explicitRate?: number | null
): number {
  if (typeof explicitRate === 'number' && Number.isFinite(explicitRate) && explicitRate > 0) {
    return explicitRate;
  }
  if (tierLevel === 'agency_30') return 30;
  if (tierLevel === 'pro_25') return 25;
  return 20;
}

// ==============================================================================
// 2. 4-SIGNAL ANTI-SELF-REFERRAL FRAUD SHIELD
// ==============================================================================

/**
 * Runs 4 independent anti-self-referral signals:
 * 1) User ID & canonicalized Gmail dot/plus alias overlap
 * 2) Normalized Bangladeshi phone / MFS payout number overlap
 * 3) 30-day affiliate owner session IP / /24 subnet overlap & conversion velocity
 * 4) Payment sender MFS wallet or Stripe card fingerprint overlap
 */
export async function evaluateFourSignalFraudShield(
  db: SupabaseClient,
  affiliate: {
    user_id: string;
    payout_account_number?: string | null;
    payout_method?: string | null;
    referral_code?: string | null;
  },
  input: FraudShieldInput
): Promise<FraudShieldResult> {
  const signals: string[] = [];
  let fraudScore = 0;

  const { data: affUserProfile } = await db
    .from('profiles')
    .select('id, email, phone')
    .eq('id', affiliate.user_id)
    .maybeSingle();

  const { data: buyerUserProfile } = input.buyerUserId
    ? await db
        .from('profiles')
        .select('id, email, phone')
        .eq('id', input.buyerUserId)
        .maybeSingle()
    : { data: null };

  // --- SIGNAL 1: User Identity + Gmail Dot / +Alias Canonical Email Match ---
  const buyerEmailCanon = canonicalizeEmail(input.buyerEmail || buyerUserProfile?.email);
  const affEmailCanon = canonicalizeEmail(affUserProfile?.email);

  if (
    (input.buyerUserId && input.buyerUserId === affiliate.user_id) ||
    (buyerEmailCanon && affEmailCanon && buyerEmailCanon === affEmailCanon)
  ) {
    fraudScore += 60;
    signals.push('signal_1_identity_email_alias_match');
  }

  // --- SIGNAL 2: Normalized Phone & Payout Mobile Match ---
  const buyerPhoneNorm = normalizeBdPhone(input.buyerPhone || buyerUserProfile?.phone);
  const affPhones = new Set(
    [
      normalizeBdPhone(affUserProfile?.phone),
      normalizeBdPhone(affiliate.payout_account_number),
    ].filter(Boolean)
  );

  if (buyerPhoneNorm && affPhones.has(buyerPhoneNorm)) {
    fraudScore += 55;
    signals.push('signal_2_phone_payout_match');
  }

  // --- SIGNAL 3: 30-Day Owner Session IP / IPv4 /24 Subnet & Velocity ---
  const cleanBuyerIp = input.buyerIp?.trim().split(',')[0]?.trim() || '';
  const buyerSubnet = extractIpSubnet24(cleanBuyerIp);

  if (buyerSubnet || (cleanBuyerIp && cleanBuyerIp !== 'unknown' && cleanBuyerIp !== '127.0.0.1')) {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: affAuditLogs } = await db
      .from('security_audit_logs')
      .select('ip_address')
      .eq('actor_id', affiliate.user_id)
      .gte('created_at', thirtyDaysAgoIso)
      .limit(40);

    const affIps = (affAuditLogs || [])
      .map((row) => String(row.ip_address || '').trim())
      .filter((ip) => Boolean(ip) && ip !== 'unknown' && ip !== '127.0.0.1');

    const exactOwnerIpMatch = Boolean(cleanBuyerIp && affIps.includes(cleanBuyerIp));
    const subnetOwnerMatch = Boolean(
      buyerSubnet && affIps.some((ip) => extractIpSubnet24(ip) === buyerSubnet)
    );

    if (exactOwnerIpMatch) {
      fraudScore += 60;
      signals.push('signal_3_owner_30d_exact_ip_match');
    } else if (subnetOwnerMatch) {
      fraudScore += 50;
      signals.push('signal_3_owner_30d_subnet24_match');
    }

    if (cleanBuyerIp) {
      const buyerIpPrefix = cleanBuyerIp.slice(0, 16);
      const { data: recentIpComms } = await db
        .from('affiliate_commissions')
        .select('id, buyer_ip_hash')
        .eq('affiliate_user_id', affiliate.user_id)
        .gte('created_at', thirtyDaysAgoIso)
        .limit(30);

      const sameIpCount = (recentIpComms || []).filter((c) => {
        const stored = String(c.buyer_ip_hash || '');
        return stored === buyerIpPrefix || (buyerSubnet && stored.startsWith(buyerSubnet));
      }).length;

      if (sameIpCount >= 3) {
        fraudScore += 50;
        signals.push('signal_3_30d_ip_velocity_abuse');
      }
    }
  }

  // --- SIGNAL 4: Payment Sender MFS Number OR Stripe Card Fingerprint ---
  const senderNorm = normalizeBdPhone(input.senderPhone);
  if (senderNorm && affPhones.has(senderNorm)) {
    fraudScore += 65;
    signals.push('signal_4_payment_sender_matches_affiliate_payout');
  }

  if (input.cardFingerprint) {
    const fp = input.cardFingerprint.trim();
    const { data: ownerTxWithFp } = await db
      .from('transactions')
      .select('id, user_id')
      .eq('user_id', affiliate.user_id)
      .filter('raw_payload->>card_fingerprint', 'eq', fp)
      .limit(1);

    if (ownerTxWithFp && ownerTxWithFp.length > 0) {
      fraudScore += 65;
      signals.push('signal_4_stripe_card_fingerprint_owner_match');
    }
  }

  const blocked = fraudScore >= 50 || signals.length > 0;
  return {
    blocked,
    fraudScore,
    signalsTriggered: signals,
    reason: blocked
      ? `Blocked by Zero-Loss 4-Signal Fraud Shield (${signals.join(', ')})`
      : undefined,
  };
}

// ==============================================================================
// 3. ZERO-LOSS COMMISSION MATH & CONVERSION RECORDING
// ==============================================================================

export function calculateZeroLossAffiliateCommission(input: ZeroLossCommissionInput) {
  const isAnnual = input.billingCycle === 'annually';
  const unitServerCostBDT =
    typeof input.unitServerCostBDT === 'number'
      ? input.unitServerCostBDT
      : isAnnual
        ? 90 * 12
        : 90;
  const minOwnerProfitBDT =
    typeof input.minOwnerProfitBDT === 'number'
      ? input.minOwnerProfitBDT
      : isAnnual
        ? 225 * 12
        : 225;

  let freeDomainCostBDT = input.freeDomainCostBDT ?? 0;
  if (input.freeDomainBundleApplied && freeDomainCostBDT === 0) {
    const tld = input.bundledDomainName
      ? `.${input.bundledDomainName.split('.').pop()?.toLowerCase()}`
      : '.com';
    freeDomainCostBDT = STANDARD_DOMAIN_RETAIL_PRICES_BDT[tld] && tld === '.xyz' ? 250 : 1150;
  }

  const breakdown = calculateOrderProfitBreakdown({
    sellingPriceBDT: input.grossSellingPriceBDT,
    unitServerCostBDT,
    minOwnerProfitBDT,
    promoDiscountBDT: input.promoDiscountBDT ?? 0,
    affiliateRatePercent: input.affiliateRatePercent,
    billingCycle: isAnnual ? 'annually' : 'monthly',
    freeDomainCostBDT,
  });

  return {
    commissionBDT: breakdown.finalAffiliateCommissionBDT,
    rawCommissionBDT: breakdown.rawAffiliateCommissionBDT,
    maxAllowedCommissionBDT: breakdown.maxAffiliatePoolBDT,
    isAffiliateCapped: breakdown.isAffiliateCapped,
    ownerNetProfitBDT: breakdown.finalOwnerNetProfitBDT,
    totalHardCostBDT: breakdown.totalHardCostBDT ?? breakdown.unitServerCostBDT,
    breakdown,
  };
}

/**
 * Records a verified, fraud-checked, zero-loss affiliate commission in pending_35d_hold.
 * Strictly skips wallet_topup orders so wallets cannot generate double affiliate payout.
 */
export async function recordVerifiedAffiliateConversion(
  db: SupabaseClient,
  input: AffiliateConversionInput
): Promise<AffiliateConversionOutcome> {
  if (input.orderType === 'wallet_topup') {
    return {
      recorded: false,
      skippedReason: 'Wallet top-up transactions do not generate affiliate commissions.',
      commissionBDT: 0,
      commissionRatePercent: 0,
      isAffiliateCapped: false,
      ownerNetProfitBDT: 0,
    };
  }

  const promoDiscountBDT = Math.max(0, input.promoDiscountBDT ?? 0);
  const grossSellingPriceBDT =
    typeof input.subtotalBDT === 'number' && input.subtotalBDT >= input.amountBDT
      ? input.subtotalBDT
      : input.amountBDT + promoDiscountBDT;

  // Idempotency: Do not double-credit commission for the same invoice
  if (input.invoiceId) {
    const { data: existingComm } = await db
      .from('affiliate_commissions')
      .select('id, affiliate_user_id, commission_amount_bdt, commission_rate, status, matures_at')
      .eq('invoice_id', input.invoiceId)
      .maybeSingle();

    if (existingComm) {
      return {
        recorded: false,
        alreadyRecorded: true,
        affiliateUserId: String(existingComm.affiliate_user_id),
        commissionBDT: Number(existingComm.commission_amount_bdt || 0),
        commissionRatePercent: Number(existingComm.commission_rate || 0),
        isAffiliateCapped: false,
        ownerNetProfitBDT: 0,
        maturesAt: existingComm.matures_at ? String(existingComm.matures_at) : undefined,
      };
    }
  }

  // Resolve affiliate referral code from input or referred buyer's profile
  let resolvedCode = input.referralCode?.trim() || '';
  if (!resolvedCode && input.buyerUserId) {
    const { data: buyerRow } = await db
      .from('profiles')
      .select('referred_by')
      .eq('id', input.buyerUserId)
      .maybeSingle();
    if (buyerRow?.referred_by) {
      resolvedCode = String(buyerRow.referred_by).trim();
    }
  }

  if (!resolvedCode) {
    const noRefMath = calculateZeroLossAffiliateCommission({
      grossSellingPriceBDT,
      billingCycle: input.billingCycle,
      unitServerCostBDT: input.unitServerCostBDT,
      minOwnerProfitBDT: input.minOwnerProfitBDT,
      promoDiscountBDT,
      freeDomainBundleApplied: input.freeDomainBundleApplied,
      bundledDomainName: input.bundledDomainName,
      freeDomainCostBDT: input.freeDomainCostBDT,
      affiliateRatePercent: 0,
    });

    return {
      recorded: false,
      skippedReason: 'No referral attribution present on order.',
      commissionBDT: 0,
      commissionRatePercent: 0,
      isAffiliateCapped: false,
      ownerNetProfitBDT: noRefMath.ownerNetProfitBDT,
    };
  }

  // Match case-insensitively across lowercase/uppercase referral codes
  const { data: affiliate } = await db
    .from('affiliate_profiles')
    .select(
      'user_id, referral_code, tier_level, commission_rate, total_signups, active_conversions, pending_clearance_bdt, available_balance_bdt, payout_account_number, payout_method, is_frozen_for_fraud'
    )
    .ilike('referral_code', resolvedCode)
    .maybeSingle();

  if (!affiliate) {
    return {
      recorded: false,
      skippedReason: `Referral code ${resolvedCode} not found.`,
      commissionBDT: 0,
      commissionRatePercent: 0,
      isAffiliateCapped: false,
      ownerNetProfitBDT: input.amountBDT,
    };
  }

  if (affiliate.is_frozen_for_fraud) {
    return {
      recorded: false,
      blocked: true,
      fraudReason: 'Affiliate account is frozen for fraud investigation.',
      affiliateUserId: affiliate.user_id,
      referralCode: String(affiliate.referral_code || resolvedCode),
      commissionBDT: 0,
      commissionRatePercent: 0,
      isAffiliateCapped: false,
      ownerNetProfitBDT: input.amountBDT,
    };
  }

  // Run 4-Signal Anti-Self-Referral Fraud Shield
  const shield = await evaluateFourSignalFraudShield(db, affiliate, {
    buyerUserId: input.buyerUserId,
    buyerEmail: input.buyerEmail,
    buyerPhone: input.buyerPhone,
    buyerIp: input.buyerIp,
    senderPhone: input.senderPhone,
    cardFingerprint: input.cardFingerprint,
    invoiceId: input.invoiceId,
  });

  const buyerIpPrefix = input.buyerIp ? input.buyerIp.split(',')[0]?.trim().slice(0, 16) : null;
  const buyerEmailHash = input.buyerEmail ? await sha256ShortHex(canonicalizeEmail(input.buyerEmail)) : null;
  const buyerPhoneHash = input.buyerPhone ? await sha256ShortHex(normalizeBdPhone(input.buyerPhone)) : null;
  const senderFingerprint = input.cardFingerprint
    ? input.cardFingerprint
    : input.senderPhone
      ? await sha256ShortHex(normalizeBdPhone(input.senderPhone))
      : null;

  if (shield.blocked) {
    await db.from('affiliate_commissions').insert({
      affiliate_user_id: affiliate.user_id,
      referred_user_id: input.buyerUserId || null,
      invoice_id: input.invoiceId || null,
      invoice_number: input.invoiceNumber,
      order_amount_bdt: input.amountBDT,
      commission_rate: Number(affiliate.commission_rate || 20),
      commission_amount_bdt: 0,
      status: 'flagged_self_referral',
      buyer_ip_hash: buyerIpPrefix,
      buyer_email_hash: buyerEmailHash,
      buyer_phone_hash: buyerPhoneHash,
      payment_sender_fingerprint: senderFingerprint,
      sub_id: input.subId || 'organic',
      matures_at: new Date().toISOString(),
      notes: shield.reason || 'Blocked self-referral attempt',
    });

    await createFraudAlert({
      userId: input.buyerUserId || affiliate.user_id,
      alertType: 'self_referral_attempt',
      severity: 'critical',
      details: {
        invoiceNumber: input.invoiceNumber,
        referralCode: affiliate.referral_code || resolvedCode,
        affiliateUserId: affiliate.user_id,
        buyerIp: input.buyerIp || 'unknown',
        fraudScore: shield.fraudScore,
        signals: shield.signalsTriggered,
      },
    }).catch(() => {});

    await logSecurityAudit({
      actorId: input.buyerUserId || affiliate.user_id,
      actorRole: 'client',
      actionType: 'AFFILIATE_SELF_REFERRAL_BLOCKED',
      targetResource: input.invoiceNumber,
      ipAddress: input.buyerIp || '127.0.0.1',
      riskLevel: 'high',
      metadata: {
        referralCode: affiliate.referral_code || resolvedCode,
        signals: shield.signalsTriggered,
        fraudScore: shield.fraudScore,
      },
    }).catch(() => {});

    const ownerOnly = calculateZeroLossAffiliateCommission({
      grossSellingPriceBDT,
      billingCycle: input.billingCycle,
      unitServerCostBDT: input.unitServerCostBDT,
      minOwnerProfitBDT: input.minOwnerProfitBDT,
      promoDiscountBDT,
      freeDomainBundleApplied: input.freeDomainBundleApplied,
      bundledDomainName: input.bundledDomainName,
      freeDomainCostBDT: input.freeDomainCostBDT,
      affiliateRatePercent: 0,
    });

    return {
      recorded: false,
      blocked: true,
      fraudReason: shield.reason,
      signalsTriggered: shield.signalsTriggered,
      affiliateUserId: affiliate.user_id,
      referralCode: String(affiliate.referral_code || resolvedCode),
      commissionBDT: 0,
      commissionRatePercent: 0,
      isAffiliateCapped: false,
      ownerNetProfitBDT: ownerOnly.ownerNetProfitBDT,
    };
  }

  // Zero-Loss Commission Math
  const tierRate = resolveAffiliateTierRate(affiliate.tier_level, Number(affiliate.commission_rate));
  const zeroLoss = calculateZeroLossAffiliateCommission({
    grossSellingPriceBDT,
    billingCycle: input.billingCycle,
    unitServerCostBDT: input.unitServerCostBDT,
    minOwnerProfitBDT: input.minOwnerProfitBDT,
    promoDiscountBDT,
    freeDomainBundleApplied: input.freeDomainBundleApplied,
    bundledDomainName: input.bundledDomainName,
    freeDomainCostBDT: input.freeDomainCostBDT,
    affiliateRatePercent: tierRate,
  });

  if (zeroLoss.commissionBDT <= 0) {
    return {
      recorded: false,
      skippedReason: 'Commission capped to 0 to protect minimum owner profit margin.',
      affiliateUserId: affiliate.user_id,
      referralCode: String(affiliate.referral_code || resolvedCode),
      commissionBDT: 0,
      commissionRatePercent: tierRate,
      isAffiliateCapped: true,
      ownerNetProfitBDT: zeroLoss.ownerNetProfitBDT,
    };
  }

  const maturesAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertErr } = await db.from('affiliate_commissions').insert({
    affiliate_user_id: affiliate.user_id,
    referred_user_id: input.buyerUserId || null,
    invoice_id: input.invoiceId || null,
    invoice_number: input.invoiceNumber,
    order_amount_bdt: input.amountBDT,
    commission_rate: tierRate,
    commission_amount_bdt: zeroLoss.commissionBDT,
    status: 'pending_35d_hold',
    buyer_ip_hash: buyerIpPrefix,
    buyer_email_hash: buyerEmailHash,
    buyer_phone_hash: buyerPhoneHash,
    payment_sender_fingerprint: senderFingerprint,
    loss_capped_from_bdt: zeroLoss.isAffiliateCapped ? zeroLoss.rawCommissionBDT : 0,
    commission_pool_max_bdt: zeroLoss.maxAllowedCommissionBDT,
    sub_id: input.subId || 'organic',
    matures_at: maturesAt,
    notes: zeroLoss.isAffiliateCapped
      ? `Zero-loss capped (${zeroLoss.rawCommissionBDT} -> ${zeroLoss.commissionBDT} BDT), 35-day hold active`
      : 'Verified referral conversion, 35-day hold active',
  });

  if (insertErr) {
    return {
      recorded: false,
      skippedReason: `Database insert error: ${insertErr.message}`,
      commissionBDT: 0,
      commissionRatePercent: tierRate,
      isAffiliateCapped: zeroLoss.isAffiliateCapped,
      ownerNetProfitBDT: zeroLoss.ownerNetProfitBDT,
    };
  }

  // Update affiliate balance + automatic tier progression
  const newSignups = Number(affiliate.total_signups || 0) + 1;
  const newConversions = Number(affiliate.active_conversions || 0) + 1;
  const newTierLevel =
    newConversions >= 31 ? 'agency_30' : newConversions >= 11 ? 'pro_25' : affiliate.tier_level || 'starter_20';
  const nextRate = resolveAffiliateTierRate(newTierLevel);
  const newPending = Number(affiliate.pending_clearance_bdt || 0) + zeroLoss.commissionBDT;

  await db
    .from('affiliate_profiles')
    .update({
      total_signups: newSignups,
      active_conversions: newConversions,
      tier_level: newTierLevel,
      commission_rate: nextRate,
      pending_clearance_bdt: Number(newPending.toFixed(2)),
    })
    .eq('user_id', affiliate.user_id);

  // Notify partner asynchronously
  const { data: partnerProfile } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', affiliate.user_id)
    .maybeSingle();

  if (partnerProfile?.email) {
    const html = renderAffiliateEmail({
      name: String(partnerProfile.full_name || 'Partner'),
      type: 'commission_earned',
      amountBDT: zeroLoss.commissionBDT,
      details: `Order ${input.invoiceNumber} settled at ৳${input.amountBDT.toLocaleString()} BDT (${tierRate}% zero-loss rate${
        zeroLoss.isAffiliateCapped ? ', capped to preserve server COGS margin' : ''
      }).`,
      holdDaysRemaining: 35,
    });
    sendEmail({
      to: String(partnerProfile.email),
      subject: `Affiliate Commission Earned: ৳${zeroLoss.commissionBDT.toLocaleString()} BDT (${input.invoiceNumber})`,
      template: 'affiliate_commission_and_payout',
      html,
    }).catch(() => {});
  }

  return {
    recorded: true,
    affiliateUserId: affiliate.user_id,
    referralCode: String(affiliate.referral_code || resolvedCode),
    commissionBDT: zeroLoss.commissionBDT,
    commissionRatePercent: tierRate,
    isAffiliateCapped: zeroLoss.isAffiliateCapped,
    ownerNetProfitBDT: zeroLoss.ownerNetProfitBDT,
    maturesAt,
  };
}

// ==============================================================================
// 4. 35-DAY CLEARANCE / COMMISSION MATURATION
// ==============================================================================

export async function maturePendingCommissions(db: SupabaseClient): Promise<{
  maturedCount: number;
  totalReleasedBDT: number;
}> {
  try {
    const { data, error } = await db.rpc('process_mature_affiliate_commissions');
    if (!error && typeof data === 'number') {
      return { maturedCount: data, totalReleasedBDT: 0 };
    }
  } catch {
    // Fallback below if RPC not yet deployed or running under mock client
  }

  const nowIso = new Date().toISOString();
  const { data: dueList } = await db
    .from('affiliate_commissions')
    .select('id, affiliate_user_id, commission_amount_bdt, matures_at')
    .eq('status', 'pending_35d_hold');

  const eligible = (dueList || []).filter((item) => {
    const targetDate = String(item.matures_at || '');
    return targetDate && targetDate <= nowIso;
  });

  if (eligible.length === 0) {
    return { maturedCount: 0, totalReleasedBDT: 0 };
  }

  let totalReleased = 0;
  for (const comm of eligible) {
    const amt = Number(comm.commission_amount_bdt || 0);
    await db
      .from('affiliate_commissions')
      .update({ status: 'cleared_available', cleared_at: nowIso })
      .eq('id', comm.id);

    const { data: aff } = await db
      .from('affiliate_profiles')
      .select('pending_clearance_bdt, available_balance_bdt')
      .eq('user_id', comm.affiliate_user_id)
      .maybeSingle();

    if (aff) {
      await db
        .from('affiliate_profiles')
        .update({
          pending_clearance_bdt: Math.max(0, Number(aff.pending_clearance_bdt || 0) - amt),
          available_balance_bdt: Number(aff.available_balance_bdt || 0) + amt,
        })
        .eq('user_id', comm.affiliate_user_id);
    }

    totalReleased += amt;
  }

  return { maturedCount: eligible.length, totalReleasedBDT: totalReleased };
}
