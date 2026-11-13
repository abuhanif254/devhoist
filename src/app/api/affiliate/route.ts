import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { createFraudAlert, logSecurityAudit } from '@/lib/security';
import {
  requireAdmin,
  requireUser,
  serviceUnavailableResponse,
  verifyCronOrAdmin,
  verifySudoToken,
} from '@/lib/authGuard';
import {
  maturePendingCommissions,
  recordVerifiedAffiliateConversion,
} from '@/lib/affiliateEngine';
import {
  type BankAccountDetails,
  loadAdminPartnerSecurityMap,
  loadAffiliateMarketerVault,
  normalizeShortPayoutMethod,
  saveAffiliateMarketerVault,
} from '@/lib/affiliateProfileVault';
import { renderAffiliateEmail, sendEmail } from '@/lib/emailEngine';
import { buildAffiliateReferralUrl } from '@/lib/siteUrl';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'self';

    if (scope === 'admin') {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Admin Console');
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          scope: 'admin',
          affiliates: [],
          commissions: [],
          payouts: [],
        });
      }

      const db = getServiceSupabase();
      const [{ data: affiliates }, { data: commissions }, { data: payouts }] = await Promise.all([
        db
          .from('affiliate_profiles')
          .select('*, profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(100),
        db
          .from('affiliate_commissions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150),
        db
          .from('affiliate_payouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150),
      ]);

      const securityMap = await loadAdminPartnerSecurityMap(
        db,
        (affiliates || []) as Array<Record<string, unknown>>
      );

      const enrichedAffiliates = (affiliates || []).map((a: Record<string, unknown>) => {
        const sec = securityMap.get(String(a.user_id || ''));
        return {
          ...a,
          payoutLockUntil: sec?.payoutLockUntil || null,
          isCoolingLocked: Boolean(sec?.isCoolingLocked),
          openFraudAlertsCount: sec?.openFraudAlertsCount || 0,
        };
      });

      const enrichedPayouts = (payouts || []).map((p: Record<string, unknown>) => {
        const sec = securityMap.get(String(p.affiliate_user_id || ''));
        return {
          ...p,
          payoutLockUntil: sec?.payoutLockUntil || null,
          isCoolingLocked: Boolean(sec?.isCoolingLocked),
          isFrozenForFraud: Boolean(sec?.isFrozenForFraud),
          fraudReason: sec?.fraudReason || null,
          openFraudAlertsCount: sec?.openFraudAlertsCount || 0,
          openFraudAlerts: sec?.openFraudAlerts || [],
        };
      });

      return NextResponse.json({
        success: true,
        scope: 'admin',
        affiliates: enrichedAffiliates,
        commissions: commissions || [],
        payouts: enrichedPayouts,
      });
    }

    // Authenticated Partner Scope
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Affiliate Partner Portal');
    }

    if (!isSupabaseConfigured()) {
      const fallbackCode = auth.profile.referral_code || `dev-${auth.user.id.slice(0, 6)}`;
      return NextResponse.json({
        success: true,
        scope: 'self',
        profile: {
          referralCode: fallbackCode,
          customSlug: '',
          refLink: buildAffiliateReferralUrl(fallbackCode),
          tierLevel: 'starter_20',
          commissionRate: 20,
          totalClicks: 0,
          totalSignups: 0,
          activeConversions: 0,
          pendingClearanceBDT: 0,
          availableBalanceBDT: 0,
          totalWithdrawnBDT: 0,
          payoutMethod: 'bkash',
          primaryPayoutMethod: 'bkash_personal',
          payoutAccountNumber: '',
          payoutWalletNumber: '',
          bankAccountDetails: {
            bankName: '',
            branchName: '',
            accountHolderName: '',
            accountNumber: '',
            routingNumber: '',
          },
          payoutScheduleMode: 'manual',
          minPayoutThresholdBDT: 1000,
          conversionPostbackWebhookUrl: '',
          payoutLockUntil: null,
          isCoolingLocked: false,
          isFrozenForFraud: false,
        },
        commissions: [],
        payouts: [],
      });
    }

    const db = getServiceSupabase();
    let { data: affProfile } = await db
      .from('affiliate_profiles')
      .select('*')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (!affProfile) {
      const baseSlug = (auth.profile.email.split('@')[0] || 'partner')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 12);
      const generatedCode = `${baseSlug || 'dev'}${auth.user.id.slice(0, 4)}`;

      await db.from('affiliate_profiles').upsert(
        {
          user_id: auth.user.id,
          referral_code: auth.profile.referral_code || generatedCode,
          tier_level: 'starter_20',
          commission_rate: 20.0,
          payout_method: 'bkash',
        },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );

      const { data: created } = await db
        .from('affiliate_profiles')
        .select('*')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      affProfile = created;
    }

    const [vault, { data: commissions }, { data: payouts }] = await Promise.all([
      loadAffiliateMarketerVault(db, auth.user.id, affProfile as Record<string, unknown> | null),
      db
        .from('affiliate_commissions')
        .select('*')
        .eq('affiliate_user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      db
        .from('affiliate_payouts')
        .select('*')
        .eq('affiliate_user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const resolvedReferralCode = String(
      affProfile?.referral_code || auth.profile.referral_code || `dev-${auth.user.id.slice(0, 6)}`
    );
    const preferredShareToken = vault.customSlug || resolvedReferralCode;

    return NextResponse.json({
      success: true,
      scope: 'self',
      profile: {
        referralCode: resolvedReferralCode,
        customSlug: vault.customSlug,
        partnerDisplayName: vault.partnerDisplayName,
        refLink: buildAffiliateReferralUrl(preferredShareToken),
        tierLevel: affProfile?.tier_level || 'starter_20',
        commissionRate: Number(affProfile?.commission_rate || 20),
        totalClicks: Number(affProfile?.total_clicks || 0),
        totalSignups: Number(affProfile?.total_signups || 0),
        activeConversions: Number(affProfile?.active_conversions || 0),
        pendingClearanceBDT: Number(affProfile?.pending_clearance_bdt || 0),
        availableBalanceBDT: Number(affProfile?.available_balance_bdt || 0),
        totalWithdrawnBDT: Number(affProfile?.total_withdrawn_bdt || 0),
        payoutMethod: vault.shortPayoutMethod,
        primaryPayoutMethod: vault.primaryPayoutMethod,
        payoutAccountNumber: vault.payoutWalletNumber || affProfile?.payout_account_number || '',
        payoutWalletNumber: vault.payoutWalletNumber,
        bankAccountDetails: vault.bankAccountDetails,
        payoutScheduleMode: vault.payoutScheduleMode,
        minPayoutThresholdBDT: vault.minPayoutThresholdBDT,
        conversionPostbackWebhookUrl: vault.conversionPostbackWebhookUrl,
        payoutLockUntil: vault.payoutLockUntil,
        isCoolingLocked: vault.isCoolingLocked,
        isFrozenForFraud: Boolean(affProfile?.is_frozen_for_fraud),
        fraudReason: affProfile?.fraud_reason || undefined,
      },
      commissions: commissions || [],
      payouts: payouts || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Affiliate Fetch Error', message: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, 40, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '').trim();

    if (!action) {
      return NextResponse.json({ error: 'Bad Request', message: 'action is required' }, { status: 400 });
    }

    // --------------------------------------------------------------------------
    // 1. TRACK AFFILIATE CLICK (90-Day Cookie Attribution)
    // --------------------------------------------------------------------------
    if (action === 'track_click') {
      const referralCode = String(body.referralCode || '').trim();
      const landingPage = String(body.landingPage || '/');
      const subId = String(body.subId || 'organic');
      if (!referralCode) {
        return NextResponse.json({ error: 'referralCode required' }, { status: 400 });
      }

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Engine');
      }

      const userAgent = request.headers.get('user-agent') || '';
      if (isSupabaseConfigured()) {
        try {
          const supabase = getServiceSupabase();
          const { data: affProfile } = await supabase
            .from('affiliate_profiles')
            .select('user_id, total_clicks')
            .ilike('referral_code', referralCode)
            .maybeSingle();

          if (affProfile) {
            await supabase.from('affiliate_clicks').insert({
              affiliate_user_id: affProfile.user_id,
              referral_code: referralCode.toLowerCase(),
              visitor_ip_hash: clientIp.slice(0, 16),
              user_agent: userAgent.slice(0, 120),
              landing_page: landingPage,
              sub_id: subId.slice(0, 32),
            });

            await supabase
              .from('affiliate_profiles')
              .update({ total_clicks: Number(affProfile.total_clicks || 0) + 1 })
              .eq('user_id', affProfile.user_id);
          }
        } catch (dbErr) {
          console.warn('[Affiliate Click DB Warning]', dbErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Click attributed successfully',
        referralCode,
        subId,
      });
    }

    // --------------------------------------------------------------------------
    // 2. RECORD CONVERSION WITH 4-SIGNAL FRAUD SHIELD + ZERO-LOSS MARGIN ENGINE
    // --------------------------------------------------------------------------
    if (action === 'record_conversion') {
      const cronAuth = await verifyCronOrAdmin(request);
      if (!cronAuth.ok) return cronAuth.response;

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Engine');
      }

      const referralCode = String(body.referralCode || '').trim();
      const buyerEmail = String(body.buyerEmail || '').trim();
      const buyerPhone = body.buyerPhone ? String(body.buyerPhone).trim() : undefined;
      const buyerIp = String(body.buyerIp || clientIp);
      const orderAmountBDT = Number(body.orderAmountBDT ?? 450);
      const promoDiscountBDT = Number(body.promoDiscountBDT ?? 0);
      const invoiceId = body.invoiceId ? String(body.invoiceId).trim() : undefined;
      const invoiceNumber = String(body.invoiceNumber || invoiceId || `INV-${Date.now()}`);
      const subId = String(body.subId || 'organic');
      const billingCycle: 'monthly' | 'annually' =
        body.billingCycle === 'annually' ? 'annually' : 'monthly';
      const freeDomainBundleApplied = Boolean(body.freeDomainBundleApplied);
      const senderPhone = body.senderPhone ? String(body.senderPhone).trim() : undefined;
      const cardFingerprint = body.cardFingerprint ? String(body.cardFingerprint).trim() : undefined;

      if (!referralCode || !buyerEmail) {
        return NextResponse.json({ error: 'referralCode and buyerEmail are required' }, { status: 400 });
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          isSelfReferral: false,
          commissionStatus: 'pending_35d_hold',
          commissionAmountBDT: Math.round((orderAmountBDT * 20) / 100),
          tierRate: 20,
          maturesInDays: 35,
          message: 'Commission recorded in Sandbox mode.',
        });
      }

      const db = getServiceSupabase();
      const outcome = await recordVerifiedAffiliateConversion(db, {
        invoiceId: invoiceId && UUID_REGEX.test(invoiceId) ? invoiceId : undefined,
        invoiceNumber,
        buyerUserId: body.buyerUserId ? String(body.buyerUserId) : undefined,
        buyerEmail,
        buyerPhone,
        buyerIp,
        referralCode,
        subId,
        amountBDT: orderAmountBDT,
        promoDiscountBDT,
        billingCycle,
        freeDomainBundleApplied,
        bundledDomainName: body.bundledDomainName ? String(body.bundledDomainName) : undefined,
        senderPhone,
        cardFingerprint,
      });

      if (outcome.fraudReason?.includes('frozen')) {
        return NextResponse.json(
          { error: 'Affiliate Frozen', message: outcome.fraudReason },
          { status: 403 }
        );
      }

      if (outcome.skippedReason?.includes('not found')) {
        return NextResponse.json({ error: outcome.skippedReason }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        isSelfReferral: Boolean(outcome.blocked),
        signalsTriggered: outcome.signalsTriggered || [],
        commissionStatus: outcome.blocked
          ? 'flagged_self_referral'
          : outcome.commissionBDT > 0
            ? 'pending_35d_hold'
            : 'zero_loss_capped',
        commissionAmountBDT: outcome.commissionBDT,
        isAffiliateCapped: outcome.isAffiliateCapped,
        ownerNetProfitBDT: outcome.ownerNetProfitBDT,
        tierRate: outcome.commissionRatePercent,
        maturesInDays: 35,
        message: outcome.blocked
          ? outcome.fraudReason
          : `Zero-loss commission of ৳${outcome.commissionBDT} recorded with 35-day hold.`,
      });
    }

    // --------------------------------------------------------------------------
    // 3. MATURE 35-DAY COMMISSIONS (CRON TRIGGER / ADMIN ONLY)
    // --------------------------------------------------------------------------
    if (action === 'mature_commissions') {
      const cronAuth = await verifyCronOrAdmin(request);
      if (!cronAuth.ok) return cronAuth.response;

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Engine');
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          maturedCount: 0,
          message: 'Matured in DEV_SANDBOX_MODE.',
        });
      }

      const db = getServiceSupabase();
      const result = await maturePendingCommissions(db);

      return NextResponse.json({
        success: true,
        message: `Processed 35-day maturity hold. ${result.maturedCount} commissions cleared to available balance.`,
        maturedCount: result.maturedCount,
        totalReleasedBDT: result.totalReleasedBDT,
      });
    }

    // --------------------------------------------------------------------------
    // 4. REQUEST PAYOUT (bKash / Nagad / Bank Transfer, min ৳1,000)
    // --------------------------------------------------------------------------
    if (action === 'request_payout') {
      const auth = await requireUser(request);
      if (!auth.ok) return auth.response;

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Engine');
      }

      const numAmount = Number(body.amountBDT ?? 0);
      const rawMethod = String(body.payoutMethod || '').toLowerCase().trim();
      const accountDetails = String(body.accountDetails || '').trim();
      const affiliateUserId = auth.user.id;

      const allowedMethodInputs = ['bkash', 'nagad', 'bank', 'bkash_personal', 'nagad_personal', 'bank_eft'];
      if (!allowedMethodInputs.includes(rawMethod) || !accountDetails) {
        return NextResponse.json(
          { error: 'Missing Details', message: 'Valid payout method (bkash/nagad/bank) and account details required.' },
          { status: 400 }
        );
      }
      const payoutMethod = normalizeShortPayoutMethod(rawMethod);

      if (isNaN(numAmount) || numAmount < 1000) {
        return NextResponse.json(
          { error: 'Invalid Amount', message: 'Minimum payout threshold is ৳1,000 BDT.' },
          { status: 400 }
        );
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          payoutId: `PAY-${Date.now()}`,
          message: `Payout request of ৳${numAmount} submitted in Sandbox simulation.`,
        });
      }

      const supabase = getServiceSupabase();
      const { data: affProfile } = await supabase
        .from('affiliate_profiles')
        .select('available_balance_bdt, is_frozen_for_fraud, payout_method, payout_account_number, custom_slug')
        .eq('user_id', affiliateUserId)
        .maybeSingle();

      if (!affProfile) {
        return NextResponse.json({ error: 'Affiliate profile not found' }, { status: 404 });
      }

      if (affProfile.is_frozen_for_fraud) {
        return NextResponse.json(
          { error: 'Account Frozen', message: 'Your affiliate account is frozen due to fraud investigation.' },
          { status: 403 }
        );
      }

      const vault = await loadAffiliateMarketerVault(
        supabase,
        affiliateUserId,
        affProfile as Record<string, unknown>
      );

      if (vault.isCoolingLocked) {
        return NextResponse.json(
          {
            error: 'Cooling Lock Active',
            code: 'PAYOUT_COOLING_LOCK_ACTIVE',
            payoutLockUntil: vault.payoutLockUntil,
            message: `24-hour anti-hijack cooling lock active after payout destination change. Withdrawals unlock at ${vault.payoutLockUntil}.`,
          },
          { status: 423 }
        );
      }

      const minThreshold = Math.max(1000, Number(vault.minPayoutThresholdBDT || 1000));
      if (numAmount < minThreshold) {
        return NextResponse.json(
          {
            error: 'Below Threshold',
            message: `Minimum withdrawal threshold on your payout profile is ৳${minThreshold.toLocaleString()} BDT.`,
          },
          { status: 400 }
        );
      }

      const currentAvail = Number(affProfile.available_balance_bdt) || 0;
      if (currentAvail < numAmount) {
        return NextResponse.json(
          { error: 'Insufficient Balance', message: `Available balance is only ৳${currentAvail} BDT.` },
          { status: 400 }
        );
      }

      // Atomic conditional balance deduction BEFORE creating payout row (prevents concurrent withdrawal race)
      const { data: deductedProfile, error: deductErr } = await supabase
        .from('affiliate_profiles')
        .update({
          available_balance_bdt: Math.round((currentAvail - numAmount) * 100) / 100,
          payout_method: payoutMethod,
          payout_account_number: accountDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', affiliateUserId)
        .gte('available_balance_bdt', numAmount)
        .select('available_balance_bdt')
        .maybeSingle();

      if (deductErr || !deductedProfile) {
        return NextResponse.json(
          { error: 'Concurrent Payout Conflict', message: 'Insufficient available balance for withdrawal.' },
          { status: 409 }
        );
      }

      const { data: payoutData, error: pError } = await supabase
        .from('affiliate_payouts')
        .insert({
          affiliate_user_id: affiliateUserId,
          amount_bdt: numAmount,
          payout_method: payoutMethod,
          account_details: accountDetails,
          status: 'pending_review',
        })
        .select('id')
        .single();

      if (pError) {
        throw pError;
      }

      await logSecurityAudit({
        actorId: affiliateUserId,
        actorRole: 'client',
        actionType: 'AFFILIATE_PAYOUT_REQUESTED',
        targetResource: `payout:${payoutData.id}`,
        ipAddress: clientIp,
        riskLevel: 'low',
        metadata: { amount: numAmount, method: payoutMethod },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        payoutId: payoutData.id,
        availableBalanceBDT: Number(deductedProfile.available_balance_bdt),
        message: `Payout request of ৳${numAmount.toLocaleString()} submitted for Admin approval.`,
      });
    }

    // --------------------------------------------------------------------------
    // 5. APPROVE PAYOUT (Admin + Sudo Step-Up Verification Required)
    // --------------------------------------------------------------------------
    if (action === 'approve_payout') {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;

      const sudoValid = await verifySudoToken(request, adminAuth.user.id);
      if (!sudoValid) {
        return NextResponse.json(
          {
            success: false,
            requireSudo: true,
            error: 'Admin Sudo elevation required to approve affiliate payouts.',
          },
          { status: 403 }
        );
      }

      const payoutId = String(body.payoutId || '').trim();
      const adminTrxId = String(body.adminTrxId || body.trxId || '').trim();
      if (!payoutId || !adminTrxId) {
        return NextResponse.json(
          { error: 'payoutId and adminTrxId disbursement reference are required.' },
          { status: 400 }
        );
      }

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Payout Approval');
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          payoutId,
          status: 'approved_paid',
          adminTrxId,
        });
      }

      const db = getServiceSupabase();
      const { data: payout } = await db
        .from('affiliate_payouts')
        .select('*')
        .eq('id', payoutId)
        .maybeSingle();

      if (!payout) {
        return NextResponse.json({ error: 'Payout request not found.' }, { status: 404 });
      }

      if (payout.status !== 'pending_review') {
        return NextResponse.json(
          { error: `Payout is already in "${payout.status}" state.` },
          { status: 409 }
        );
      }

      const payoutAmount = Number(payout.amount_bdt || 0);
      const { data: casApproved, error: casApproveErr } = await db
        .from('affiliate_payouts')
        .update({
          status: 'approved_paid',
          admin_trx_id: adminTrxId,
          payout_gateway_ref: adminTrxId,
          processed_by: adminAuth.user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId)
        .eq('status', 'pending_review')
        .select('*')
        .maybeSingle();

      if (casApproveErr) {
        return NextResponse.json(
          { error: `Failed to approve payout: ${casApproveErr.message}` },
          { status: 500 }
        );
      }

      if (!casApproved) {
        return NextResponse.json(
          {
            error: 'Payout request was already approved, rejected, or transitioned concurrently.',
            code: 'ALREADY_PROCESSED',
          },
          { status: 409 }
        );
      }

      const { data: affProfile } = await db
        .from('affiliate_profiles')
        .select('total_withdrawn_bdt')
        .eq('user_id', payout.affiliate_user_id)
        .maybeSingle();

      await db
        .from('affiliate_profiles')
        .update({
          total_withdrawn_bdt: Number(affProfile?.total_withdrawn_bdt || 0) + payoutAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', payout.affiliate_user_id);

      const ledgerGateway =
        payout.payout_method === 'nagad'
          ? 'nagad'
          : payout.payout_method === 'bkash'
            ? 'bkash'
            : 'system';

      await db.from('financial_profit_ledger').insert({
        entry_code: `LEDG-PAY-${Date.now().toString(36).toUpperCase()}`,
        entry_type: 'affiliate_payout',
        user_id: payout.affiliate_user_id,
        gateway: ledgerGateway,
        trx_id: adminTrxId,
        gross_amount_bdt: 0,
        base_cogs_cost_bdt: 0,
        affiliate_commission_bdt: payoutAmount,
        promo_discount_bdt: 0,
        notes: `Affiliate Payout Approved (${payout.payout_method}: ${payout.account_details})`,
      });

      const { data: partnerProfile } = await db
        .from('profiles')
        .select('email, full_name')
        .eq('id', payout.affiliate_user_id)
        .maybeSingle();

      if (partnerProfile?.email) {
        const html = renderAffiliateEmail({
          name: String(partnerProfile.full_name || 'Partner'),
          type: 'payout_sent',
          amountBDT: payoutAmount,
          details: `Sent to ${payout.payout_method} (${payout.account_details}).`,
          trxId: adminTrxId,
        });
        sendEmail({
          to: String(partnerProfile.email),
          subject: `Payout Disbursed: ৳${payoutAmount.toLocaleString()} BDT`,
          template: 'affiliate_commission_and_payout',
          html,
        }).catch(() => {});
      }

      await logSecurityAudit({
        actorId: adminAuth.user.id,
        actorRole: 'admin',
        actionType: 'AFFILIATE_PAYOUT_APPROVED',
        targetResource: `payout:${payoutId}`,
        ipAddress: clientIp,
        riskLevel: 'high',
        metadata: { amountBDT: payoutAmount, adminTrxId, affiliateUserId: payout.affiliate_user_id },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        payoutId,
        status: 'approved_paid',
        adminTrxId,
        message: `Payout ৳${payoutAmount.toLocaleString()} approved and settled (TrxID: ${adminTrxId}).`,
      });
    }

    // --------------------------------------------------------------------------
    // 6. REJECT PAYOUT (Admin + Sudo Step-Up Required)
    // --------------------------------------------------------------------------
    if (action === 'reject_payout') {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;

      const sudoValid = await verifySudoToken(request, adminAuth.user.id);
      if (!sudoValid) {
        return NextResponse.json(
          {
            success: false,
            requireSudo: true,
            error: 'Admin Sudo elevation required to reject affiliate payouts.',
          },
          { status: 403 }
        );
      }

      const payoutId = String(body.payoutId || '').trim();
      const reason = String(body.reason || 'Rejected after risk review').trim();
      const forfeitForFraud = Boolean(body.forfeitForFraud);

      if (!payoutId) {
        return NextResponse.json({ error: 'payoutId is required.' }, { status: 400 });
      }

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Payout Rejection');
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({ success: true, payoutId, status: 'rejected_fraud' });
      }

      const db = getServiceSupabase();
      const { data: payout } = await db
        .from('affiliate_payouts')
        .select('*')
        .eq('id', payoutId)
        .maybeSingle();

      if (!payout) {
        return NextResponse.json({ error: 'Payout request not found.' }, { status: 404 });
      }

      if (payout.status !== 'pending_review') {
        return NextResponse.json(
          { error: `Payout is already in "${payout.status}" state.` },
          { status: 409 }
        );
      }

      const { data: casRejected, error: casRejectErr } = await db
        .from('affiliate_payouts')
        .update({
          status: 'rejected_fraud',
          rejected_reason: reason,
          processed_by: adminAuth.user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId)
        .eq('status', 'pending_review')
        .select('*')
        .maybeSingle();

      if (casRejectErr) {
        return NextResponse.json(
          { error: `Failed to reject payout: ${casRejectErr.message}` },
          { status: 500 }
        );
      }

      if (!casRejected) {
        return NextResponse.json(
          {
            error: 'Payout request was already approved, rejected, or transitioned concurrently.',
            code: 'ALREADY_PROCESSED',
          },
          { status: 409 }
        );
      }

      const { data: affProfile } = await db
        .from('affiliate_profiles')
        .select('available_balance_bdt')
        .eq('user_id', payout.affiliate_user_id)
        .maybeSingle();

      if (affProfile) {
        if (forfeitForFraud) {
          await db
            .from('affiliate_profiles')
            .update({
              is_frozen_for_fraud: true,
              fraud_reason: reason,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', payout.affiliate_user_id);

          await createFraudAlert({
            userId: payout.affiliate_user_id,
            alertType: 'self_referral_attempt',
            severity: 'critical',
            details: { payoutId, reason, amountBDT: payout.amount_bdt },
          }).catch(() => {});
        } else {
          await db
            .from('affiliate_profiles')
            .update({
              available_balance_bdt:
                Number(affProfile.available_balance_bdt || 0) + Number(payout.amount_bdt || 0),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', payout.affiliate_user_id);
        }
      }

      await logSecurityAudit({
        actorId: adminAuth.user.id,
        actorRole: 'admin',
        actionType: 'AFFILIATE_PAYOUT_REJECTED',
        targetResource: `payout:${payoutId}`,
        ipAddress: clientIp,
        riskLevel: 'high',
        metadata: { reason, forfeitForFraud, affiliateUserId: payout.affiliate_user_id },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        payoutId,
        status: 'rejected_fraud',
        refundedToAvailable: !forfeitForFraud,
        message: forfeitForFraud
          ? 'Payout rejected and partner account frozen for fraud.'
          : 'Payout rejected and funds returned to available balance.',
      });
    }

    // --------------------------------------------------------------------------
    // 7. UPDATE AFFILIATE PAYOUT PROFILE / VAULT (Sudo-Verified + 24h Cooling Lock)
    // --------------------------------------------------------------------------
    if (action === 'update_payout_profile' || action === 'update_payout_settings') {
      const auth = await requireUser(request);
      if (!auth.ok) return auth.response;

      const sudoValid = await verifySudoToken(request, auth.user.id);
      if (!sudoValid) {
        return NextResponse.json(
          {
            error: 'Sudo verification required',
            requireSudo: true,
            message: 'Updating payout destination, postback webhook, or slug requires Sudo 2FA verification.',
          },
          { status: 403 }
        );
      }

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Settings');
      }

      const primaryMethodInput = body.primaryPayoutMethod ?? body.payoutMethod;
      const walletInput = body.payoutWalletNumber ?? body.accountDetails;

      if (!isSupabaseConfigured()) {
        const fallbackLock = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return NextResponse.json({
          success: true,
          payoutMethod: normalizeShortPayoutMethod(primaryMethodInput || 'bkash'),
          primaryPayoutMethod: String(primaryMethodInput || 'bkash_personal'),
          payoutWalletNumber: String(walletInput || ''),
          payoutAccountNumber: String(walletInput || ''),
          payoutLockUntil: fallbackLock,
          isCoolingLocked: true,
          lockTriggered: true,
        });
      }

      const db = getServiceSupabase();
      const { data: existingAff } = await db
        .from('affiliate_profiles')
        .select('*')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (!existingAff) {
        const generatedCode = auth.profile.referral_code || `dev-${auth.user.id.slice(0, 6)}`;
        await db.from('affiliate_profiles').upsert(
          {
            user_id: auth.user.id,
            referral_code: generatedCode,
            tier_level: 'starter_20',
            commission_rate: 20.0,
            payout_method: normalizeShortPayoutMethod(primaryMethodInput || 'bkash'),
          },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      }

      const saveRes = await saveAffiliateMarketerVault(
        db,
        auth.user.id,
        {
          partnerDisplayName:
            typeof body.partnerDisplayName === 'string' ? body.partnerDisplayName : undefined,
          customSlug: typeof body.customSlug === 'string' ? body.customSlug : undefined,
          primaryPayoutMethod:
            typeof primaryMethodInput === 'string' ? primaryMethodInput : undefined,
          payoutWalletNumber: typeof walletInput === 'string' ? walletInput : undefined,
          bankAccountDetails:
            body.bankAccountDetails && typeof body.bankAccountDetails === 'object'
              ? (body.bankAccountDetails as Partial<BankAccountDetails>)
              : undefined,
          payoutScheduleMode:
            typeof body.payoutScheduleMode === 'string' ? body.payoutScheduleMode : undefined,
          minPayoutThresholdBDT:
            body.minPayoutThresholdBDT !== undefined
              ? Number(body.minPayoutThresholdBDT)
              : undefined,
          conversionPostbackWebhookUrl:
            typeof body.conversionPostbackWebhookUrl === 'string'
              ? body.conversionPostbackWebhookUrl
              : undefined,
        },
        (existingAff as Record<string, unknown> | null) || null
      );

      if (!saveRes.ok) {
        return NextResponse.json(
          { error: saveRes.code, message: saveRes.error },
          { status: saveRes.status }
        );
      }

      const refSlug =
        saveRes.vault.customSlug ||
        String(existingAff?.referral_code || auth.profile.referral_code || '');

      return NextResponse.json({
        success: true,
        lockTriggered: saveRes.lockTriggered,
        payoutMethod: saveRes.vault.shortPayoutMethod,
        primaryPayoutMethod: saveRes.vault.primaryPayoutMethod,
        payoutAccountNumber: saveRes.vault.payoutWalletNumber,
        payoutWalletNumber: saveRes.vault.payoutWalletNumber,
        bankAccountDetails: saveRes.vault.bankAccountDetails,
        payoutScheduleMode: saveRes.vault.payoutScheduleMode,
        minPayoutThresholdBDT: saveRes.vault.minPayoutThresholdBDT,
        conversionPostbackWebhookUrl: saveRes.vault.conversionPostbackWebhookUrl,
        customSlug: saveRes.vault.customSlug,
        refLink: buildAffiliateReferralUrl(refSlug),
        payoutLockUntil: saveRes.vault.payoutLockUntil,
        isCoolingLocked: saveRes.vault.isCoolingLocked,
      });
    }

    // --------------------------------------------------------------------------
    // 7B. FREEZE / UNFREEZE PARTNER FOR FRAUD (Admin + Sudo Required)
    // --------------------------------------------------------------------------
    if (action === 'freeze_partner') {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;

      const sudoValid = await verifySudoToken(request, adminAuth.user.id);
      if (!sudoValid) {
        return NextResponse.json(
          {
            error: 'Sudo verification required',
            requireSudo: true,
            message: 'Freezing an affiliate partner requires Sudo 2FA verification.',
          },
          { status: 403 }
        );
      }

      const targetUserId = String(body.affiliateUserId || body.userId || '').trim();
      const reason = String(body.reason || 'Suspicious self-referral / multi-account fraud pattern').trim();
      const freeze = body.freeze !== false;
      if (!targetUserId) {
        return NextResponse.json({ error: 'affiliateUserId is required.' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db
          .from('affiliate_profiles')
          .update({
            is_frozen_for_fraud: freeze,
            fraud_reason: freeze ? reason : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId);

        if (freeze) {
          await createFraudAlert({
            userId: targetUserId,
            alertType: 'self_referral_attempt',
            severity: 'critical',
            details: { frozenByAdmin: adminAuth.user.id, reason },
          }).catch(() => {});
        }

        await logSecurityAudit({
          actorId: adminAuth.user.id,
          actorRole: 'admin',
          actionType: freeze ? 'AFFILIATE_PARTNER_FROZEN' : 'AFFILIATE_PARTNER_UNFROZEN',
          targetResource: `affiliate:${targetUserId}`,
          ipAddress: clientIp,
          riskLevel: freeze ? 'high' : 'medium',
          metadata: { reason, freeze },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        affiliateUserId: targetUserId,
        isFrozenForFraud: freeze,
        fraudReason: freeze ? reason : null,
      });
    }

    // --------------------------------------------------------------------------
    // 8. INVOICE REFUND CLAWBACK (Admin/Cron Only)
    // --------------------------------------------------------------------------
    if (action === 'clawback_refund') {
      const cronAuth = await verifyCronOrAdmin(request);
      if (!cronAuth.ok) return cronAuth.response;

      if (!isSupabaseConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Affiliate Engine');
      }

      const invoiceId = String(body.invoiceId || '').trim();
      if (!invoiceId) {
        return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        const isUuid = UUID_REGEX.test(invoiceId);
        const { data: inv } = await (isUuid
          ? supabase.from('invoices').select('id, invoice_number').eq('id', invoiceId).maybeSingle()
          : supabase
              .from('invoices')
              .select('id, invoice_number')
              .eq('invoice_number', invoiceId)
              .maybeSingle());

        const targetUuid = inv?.id || (isUuid ? invoiceId : null);
        if (targetUuid) {
          await supabase.from('invoices').update({ status: 'refunded' }).eq('id', targetUuid);
        }

        // Fallback safety update if DB trigger absent
        const { data: comm } = targetUuid
          ? await supabase
              .from('affiliate_commissions')
              .select('*')
              .eq('invoice_id', targetUuid)
              .maybeSingle()
          : await supabase
              .from('affiliate_commissions')
              .select('*')
              .eq('invoice_number', invoiceId)
              .maybeSingle();

        if (comm && comm.status !== 'clawed_back_refunded') {
          const amt = Number(comm.commission_amount_bdt || 0);
          await supabase
            .from('affiliate_commissions')
            .update({
              status: 'clawed_back_refunded',
              clawed_back_at: new Date().toISOString(),
              notes: 'Clawed back via Affiliate Engine refund endpoint',
            })
            .eq('id', comm.id);

          const { data: aff } = await supabase
            .from('affiliate_profiles')
            .select('pending_clearance_bdt, available_balance_bdt')
            .eq('user_id', comm.affiliate_user_id)
            .maybeSingle();

          if (aff && amt > 0) {
            await supabase
              .from('affiliate_profiles')
              .update(
                comm.status === 'cleared_available'
                  ? { available_balance_bdt: Math.max(0, Number(aff.available_balance_bdt || 0) - amt) }
                  : { pending_clearance_bdt: Math.max(0, Number(aff.pending_clearance_bdt || 0) - amt) }
              )
              .eq('user_id', comm.affiliate_user_id);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Affiliate commission clawback completed for invoice ${invoiceId}.`,
      });
    }

    return NextResponse.json(
      { error: 'Unknown Action', message: `Action "${action}" is not supported.` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Affiliate API Error',
        message: err instanceof Error ? err.message : 'Server error',
      },
      { status: 500 }
    );
  }
}
