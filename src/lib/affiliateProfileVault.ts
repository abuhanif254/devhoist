import type { SupabaseClient } from '@supabase/supabase-js';
import { isSafeExternalHttpUrl } from '@/lib/authGuard';
import { logSecurityAudit } from '@/lib/security';

export type MarketerPayoutMethod = 'bkash_personal' | 'nagad_personal' | 'bank_eft';
export type ShortPayoutMethod = 'bkash' | 'nagad' | 'bank';
export type PayoutScheduleMode = 'manual' | 'auto_monthly_1st' | 'auto_threshold';

export interface BankAccountDetails {
  bankName: string;
  branchName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
}

export interface AffiliatePayoutVaultProfile {
  partnerDisplayName: string;
  customSlug: string;
  primaryPayoutMethod: MarketerPayoutMethod;
  shortPayoutMethod: ShortPayoutMethod;
  payoutWalletNumber: string;
  bankAccountDetails: BankAccountDetails;
  payoutScheduleMode: PayoutScheduleMode;
  minPayoutThresholdBDT: number;
  conversionPostbackWebhookUrl: string;
  payoutLockUntil: string | null;
  isCoolingLocked: boolean;
}

export interface AdminPartnerSecurityContext {
  payoutLockUntil: string | null;
  isCoolingLocked: boolean;
  isFrozenForFraud: boolean;
  fraudReason: string | null;
  openFraudAlertsCount: number;
  openFraudAlerts: Array<{
    id: string;
    alertType: string;
    severity: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
}

const DEFAULT_BANK_DETAILS: BankAccountDetails = {
  bankName: '',
  branchName: '',
  accountHolderName: '',
  accountNumber: '',
  routingNumber: '',
};

export function normalizeMarketerPayoutMethod(raw: unknown): MarketerPayoutMethod {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'nagad' || val === 'nagad_personal') return 'nagad_personal';
  if (val === 'bank' || val === 'bank_eft') return 'bank_eft';
  return 'bkash_personal';
}

export function normalizeShortPayoutMethod(raw: unknown): ShortPayoutMethod {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'nagad' || val === 'nagad_personal') return 'nagad';
  if (val === 'bank' || val === 'bank_eft') return 'bank';
  return 'bkash';
}

export function normalizePayoutScheduleMode(raw: unknown): PayoutScheduleMode {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'auto_monthly_1st') return 'auto_monthly_1st';
  if (val === 'auto_threshold') return 'auto_threshold';
  return 'manual';
}

export function normalizeBankDetails(raw: unknown): BankAccountDetails {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BANK_DETAILS };
  const obj = raw as Record<string, unknown>;
  return {
    bankName: String(obj.bankName || obj.bank_name || '').trim().slice(0, 120),
    branchName: String(obj.branchName || obj.branch_name || '').trim().slice(0, 120),
    accountHolderName: String(obj.accountHolderName || obj.account_holder_name || '').trim().slice(0, 120),
    accountNumber: String(obj.accountNumber || obj.account_number || '').trim().slice(0, 64),
    routingNumber: String(obj.routingNumber || obj.routing_number || '').trim().slice(0, 32),
  };
}

export function isCoolingLockActive(payoutLockUntil: string | null | undefined, now = new Date()): boolean {
  if (!payoutLockUntil) return false;
  const ts = new Date(payoutLockUntil).getTime();
  return !Number.isNaN(ts) && ts > now.getTime();
}

export function validatePostbackTemplateUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return true;
  const authoritySegment = trimmed.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] || '';
  if (/[{}@]/.test(authoritySegment)) return false;
  // Temporarily replace S2S macro tokens so new URL() checks the real host/protocol against SSRF
  const probe = trimmed
    .replace(/\{subid\}/gi, 'probe_subid')
    .replace(/\{payout\}/gi, '100')
    .replace(/\{order_id\}/gi, 'INV-PROBE');
  if (!isSafeExternalHttpUrl(probe)) return false;
  try {
    const parsed = new URL(probe);
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildAffiliatePostbackUrl(
  templateUrl: string,
  vars: { subid: string; payout: number; orderId: string }
): string | null {
  const trimmed = String(templateUrl || '').trim();
  if (!trimmed || !validatePostbackTemplateUrl(trimmed)) return null;

  const built = trimmed
    .replace(/\{subid\}/gi, encodeURIComponent(vars.subid || 'direct'))
    .replace(/\{payout\}/gi, encodeURIComponent(String(Number(vars.payout || 0).toFixed(2))))
    .replace(/\{order_id\}/gi, encodeURIComponent(vars.orderId || 'unknown'));

  return isSafeExternalHttpUrl(built) ? built : null;
}

export async function fireAffiliatePostbackWebhook(
  db: SupabaseClient,
  params: {
    affiliateUserId: string;
    subId: string;
    payoutBDT: number;
    orderId: string;
  }
): Promise<{ fired: boolean; url?: string; status?: number; skippedReason?: string }> {
  try {
    const { data: marketer } = await db
      .from('affiliate_marketer_profiles')
      .select('conversion_postback_webhook_url')
      .eq('user_id', params.affiliateUserId)
      .maybeSingle();

    const template = String(
      (marketer as Record<string, unknown> | null)?.conversion_postback_webhook_url || ''
    ).trim();

    if (!template) {
      return { fired: false, skippedReason: 'no_webhook_configured' };
    }

    const safeUrl = buildAffiliatePostbackUrl(template, {
      subid: params.subId,
      payout: params.payoutBDT,
      orderId: params.orderId,
    });

    if (!safeUrl) {
      await logSecurityAudit({
        actorId: params.affiliateUserId,
        actorRole: 'system',
        actionType: 'AFFILIATE_POSTBACK_BLOCKED_SSRF',
        targetResource: `affiliate:${params.affiliateUserId}`,
        riskLevel: 'high',
        metadata: { orderId: params.orderId },
      });
      return { fired: false, skippedReason: 'ssrf_blocked' };
    }

    const res = await fetch(safeUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'DevHostCloud-Affiliate-Postback/1.0' },
    });

    await logSecurityAudit({
      actorId: params.affiliateUserId,
      actorRole: 'system',
      actionType: 'AFFILIATE_POSTBACK_DISPATCHED',
      targetResource: `order:${params.orderId}`,
      riskLevel: 'low',
      metadata: { status: res.status, payoutBDT: params.payoutBDT, subId: params.subId },
    });

    return { fired: res.ok, url: safeUrl, status: res.status };
  } catch (err: unknown) {
    return {
      fired: false,
      skippedReason: err instanceof Error ? err.message : 'network_error',
    };
  }
}

export async function loadAffiliateMarketerVault(
  db: SupabaseClient,
  userId: string,
  affProfile?: Record<string, unknown> | null
): Promise<AffiliatePayoutVaultProfile> {
  let marketer: Record<string, unknown> | null = null;
  try {
    const { data } = await db
      .from('affiliate_marketer_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    marketer = (data as Record<string, unknown> | null) || null;
  } catch {
    marketer = null;
  }

  const payoutLockUntil = marketer?.payout_lock_until
    ? String(marketer.payout_lock_until)
    : null;
  const primaryPayoutMethod = normalizeMarketerPayoutMethod(
    marketer?.primary_payout_method || affProfile?.payout_method
  );

  return {
    partnerDisplayName: String(marketer?.partner_display_name || ''),
    customSlug: String(marketer?.custom_referral_slug || affProfile?.custom_slug || ''),
    primaryPayoutMethod,
    shortPayoutMethod: normalizeShortPayoutMethod(primaryPayoutMethod),
    payoutWalletNumber: String(
      marketer?.payout_wallet_number ||
        affProfile?.payout_account_number ||
        affProfile?.payout_account ||
        ''
    ),
    bankAccountDetails: normalizeBankDetails(marketer?.bank_account_details),
    payoutScheduleMode: normalizePayoutScheduleMode(marketer?.payout_schedule_mode),
    minPayoutThresholdBDT: Math.max(1000, Number(marketer?.min_payout_threshold_bdt || 1000)),
    conversionPostbackWebhookUrl: String(marketer?.conversion_postback_webhook_url || ''),
    payoutLockUntil,
    isCoolingLocked: isCoolingLockActive(payoutLockUntil),
  };
}

export interface SaveAffiliateVaultInput {
  partnerDisplayName?: string;
  customSlug?: string;
  primaryPayoutMethod?: string;
  payoutWalletNumber?: string;
  bankAccountDetails?: Partial<BankAccountDetails>;
  payoutScheduleMode?: string;
  minPayoutThresholdBDT?: number;
  conversionPostbackWebhookUrl?: string;
}

export async function saveAffiliateMarketerVault(
  db: SupabaseClient,
  userId: string,
  input: SaveAffiliateVaultInput,
  existingAffProfile?: Record<string, unknown> | null
): Promise<
  | { ok: true; vault: AffiliatePayoutVaultProfile; lockTriggered: boolean }
  | { ok: false; status: number; code: string; error: string }
> {
  const existingVault = await loadAffiliateMarketerVault(db, userId, existingAffProfile);

  // 1. Validate custom slug format and global uniqueness
  let nextSlug = existingVault.customSlug;
  if (typeof input.customSlug === 'string') {
    const cleanedSlug = input.customSlug.trim().toLowerCase();
    if (cleanedSlug.length > 0 && !/^[a-z0-9][a-z0-9-]{2,31}$/.test(cleanedSlug)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_SLUG',
        error: 'Custom referral slug must be 3-32 lowercase letters, numbers, or hyphens.',
      };
    }

    if (cleanedSlug && cleanedSlug !== existingVault.customSlug.toLowerCase()) {
      const { data: marketerConflict } = await db
        .from('affiliate_marketer_profiles')
        .select('user_id, custom_referral_slug')
        .ilike('custom_referral_slug', cleanedSlug)
        .limit(5);

      const takenInMarketer =
        Array.isArray(marketerConflict) &&
        marketerConflict.some((r) => String(r.user_id) !== userId);

      const { data: affCodeConflict } = await db
        .from('affiliate_profiles')
        .select('user_id, referral_code, custom_slug')
        .limit(100);

      const takenInAff =
        Array.isArray(affCodeConflict) &&
        affCodeConflict.some(
          (r) =>
            String(r.user_id) !== userId &&
            (String(r.referral_code || '').toLowerCase() === cleanedSlug ||
              String(r.custom_slug || '').toLowerCase() === cleanedSlug)
        );

      if (takenInMarketer || takenInAff) {
        return {
          ok: false,
          status: 409,
          code: 'SLUG_TAKEN',
          error: `Custom referral slug "${cleanedSlug}" is already claimed by another partner.`,
        };
      }
    }
    nextSlug = cleanedSlug;
  }

  // 2. Validate S2S postback webhook URL against SSRF
  const nextPostbackUrl =
    typeof input.conversionPostbackWebhookUrl === 'string'
      ? input.conversionPostbackWebhookUrl.trim()
      : existingVault.conversionPostbackWebhookUrl;

  if (nextPostbackUrl && !validatePostbackTemplateUrl(nextPostbackUrl)) {
    await logSecurityAudit({
      actorId: userId,
      actorRole: 'client',
      actionType: 'AFFILIATE_POSTBACK_SSRF_REJECTED',
      targetResource: `affiliate:${userId}`,
      riskLevel: 'high',
      metadata: { attemptedUrl: nextPostbackUrl.slice(0, 120) },
    });
    return {
      ok: false,
      status: 400,
      code: 'SSRF_BLOCKED',
      error: 'Postback URL must be a valid public HTTPS/HTTP endpoint (localhost/private networks blocked).',
    };
  }

  // 3. Validate payout destination, schedule, and threshold
  const nextMethod = input.primaryPayoutMethod
    ? normalizeMarketerPayoutMethod(input.primaryPayoutMethod)
    : existingVault.primaryPayoutMethod;
  const nextShortMethod = normalizeShortPayoutMethod(nextMethod);

  const nextWalletNumber =
    typeof input.payoutWalletNumber === 'string'
      ? input.payoutWalletNumber.trim().slice(0, 64)
      : existingVault.payoutWalletNumber;

  const nextBankDetails = input.bankAccountDetails
    ? normalizeBankDetails({ ...existingVault.bankAccountDetails, ...input.bankAccountDetails })
    : existingVault.bankAccountDetails;

  if (nextMethod !== 'bank_eft' && nextWalletNumber && nextWalletNumber.length < 10) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYOUT_ACCOUNT',
      error: 'Mobile banking wallet number must be at least 10 characters.',
    };
  }

  const nextSchedule = input.payoutScheduleMode
    ? normalizePayoutScheduleMode(input.payoutScheduleMode)
    : existingVault.payoutScheduleMode;

  const rawThreshold =
    input.minPayoutThresholdBDT !== undefined
      ? Number(input.minPayoutThresholdBDT)
      : existingVault.minPayoutThresholdBDT;

  if (!Number.isFinite(rawThreshold) || rawThreshold < 1000 || rawThreshold > 1000000) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_THRESHOLD',
      error: 'Minimum auto-payout threshold must be between ৳1,000 and ৳1,000,000 BDT.',
    };
  }

  // 4. Detect payout destination changes -> enforce 24h anti-hijack cooling lock
  const bankChanged =
    JSON.stringify(nextBankDetails) !== JSON.stringify(existingVault.bankAccountDetails);
  const destinationChanged =
    nextMethod !== existingVault.primaryPayoutMethod ||
    nextWalletNumber !== existingVault.payoutWalletNumber ||
    (nextMethod === 'bank_eft' && bankChanged);

  const now = new Date();
  let nextLockUntil: string | null = isCoolingLockActive(existingVault.payoutLockUntil, now)
    ? existingVault.payoutLockUntil
    : null;

  if (destinationChanged) {
    nextLockUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  const nextDisplayName =
    typeof input.partnerDisplayName === 'string'
      ? input.partnerDisplayName.trim().slice(0, 100)
      : existingVault.partnerDisplayName;

  const summaryAccountString =
    nextMethod === 'bank_eft'
      ? `${nextBankDetails.bankName || 'Bank'} (${nextBankDetails.accountNumber || 'EFT'})`
      : nextWalletNumber;

  const nowIso = now.toISOString();

  await db.from('affiliate_marketer_profiles').upsert(
    {
      user_id: userId,
      partner_display_name: nextDisplayName || null,
      custom_referral_slug: nextSlug || null,
      primary_payout_method: nextMethod,
      payout_wallet_number: nextWalletNumber || null,
      bank_account_details: nextBankDetails,
      payout_schedule_mode: nextSchedule,
      min_payout_threshold_bdt: Math.round(rawThreshold),
      conversion_postback_webhook_url: nextPostbackUrl || null,
      payout_lock_until: nextLockUntil,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  await db
    .from('affiliate_profiles')
    .update({
      payout_method: nextShortMethod,
      payout_account_number: summaryAccountString || null,
      updated_at: nowIso,
    })
    .eq('user_id', userId);

  await logSecurityAudit({
    actorId: userId,
    actorRole: 'client',
    actionType: 'AFFILIATE_PAYOUT_PROFILE_UPDATED',
    targetResource: `affiliate:${userId}`,
    riskLevel: destinationChanged ? 'medium' : 'low',
    metadata: {
      primaryPayoutMethod: nextMethod,
      destinationChanged,
      payoutLockUntil: nextLockUntil,
      hasCustomSlug: Boolean(nextSlug),
      hasPostbackUrl: Boolean(nextPostbackUrl),
    },
  });

  const savedVault: AffiliatePayoutVaultProfile = {
    partnerDisplayName: nextDisplayName,
    customSlug: nextSlug,
    primaryPayoutMethod: nextMethod,
    shortPayoutMethod: nextShortMethod,
    payoutWalletNumber: nextWalletNumber,
    bankAccountDetails: nextBankDetails,
    payoutScheduleMode: nextSchedule,
    minPayoutThresholdBDT: Math.round(rawThreshold),
    conversionPostbackWebhookUrl: nextPostbackUrl,
    payoutLockUntil: nextLockUntil,
    isCoolingLocked: isCoolingLockActive(nextLockUntil, now),
  };

  return { ok: true, vault: savedVault, lockTriggered: destinationChanged };
}

export async function loadAdminPartnerSecurityMap(
  db: SupabaseClient,
  affProfiles: Array<Record<string, unknown>>
): Promise<Map<string, AdminPartnerSecurityContext>> {
  const result = new Map<string, AdminPartnerSecurityContext>();
  const userIds = Array.from(
    new Set(affProfiles.map((p) => String(p.user_id || '')).filter(Boolean))
  );

  const marketerByUser = new Map<string, Record<string, unknown>>();
  const alertsByUser = new Map<string, AdminPartnerSecurityContext['openFraudAlerts']>();

  if (userIds.length > 0) {
    try {
      const { data: marketerRows } = await db
        .from('affiliate_marketer_profiles')
        .select('user_id, payout_lock_until')
        .in('user_id', userIds);

      for (const m of (marketerRows || []) as Array<Record<string, unknown>>) {
        marketerByUser.set(String(m.user_id), m);
      }
    } catch {
      // Optional table fallback in older mocks
    }

    try {
      const { data: alertRows } = await db
        .from('fraud_alerts')
        .select('id, user_id, alert_type, severity, details, status, created_at')
        .eq('status', 'open')
        .in('user_id', userIds)
        .limit(100);

      for (const a of (alertRows || []) as Array<Record<string, unknown>>) {
        const uid = String(a.user_id || '');
        if (!uid) continue;
        const list = alertsByUser.get(uid) || [];
        list.push({
          id: String(a.id || ''),
          alertType: String(a.alert_type || 'fraud_signal'),
          severity: String(a.severity || 'medium'),
          details: (a.details as Record<string, unknown>) || {},
          createdAt: String(a.created_at || ''),
        });
        alertsByUser.set(uid, list);
      }
    } catch {
      // Optional alerts fallback
    }
  }

  for (const p of affProfiles) {
    const uid = String(p.user_id || '');
    if (!uid) continue;
    const marketer = marketerByUser.get(uid);
    const lockUntil = marketer?.payout_lock_until ? String(marketer.payout_lock_until) : null;
    const openAlerts = alertsByUser.get(uid) || [];
    result.set(uid, {
      payoutLockUntil: lockUntil,
      isCoolingLocked: isCoolingLockActive(lockUntil),
      isFrozenForFraud: Boolean(p.is_frozen_for_fraud),
      fraudReason: p.fraud_reason ? String(p.fraud_reason) : null,
      openFraudAlertsCount: openAlerts.length,
      openFraudAlerts: openAlerts,
    });
  }

  return result;
}
