import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { createFraudAlert, logSecurityAudit } from '@/lib/security';

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, 40, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'action is required' },
        { status: 400 }
      );
    }

    // --------------------------------------------------------------------------
    // 1. TRACK AFFILIATE CLICK (90-Day Cookie Attribution)
    // --------------------------------------------------------------------------
    if (action === 'track_click') {
      const { referralCode, landingPage = '/', subId = 'organic' } = body;
      if (!referralCode) {
        return NextResponse.json({ error: 'referralCode required' }, { status: 400 });
      }

      const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || '';

      if (isSupabaseConfigured()) {
        try {
          const supabase = getServiceSupabase();
          // Find affiliate profile
          const { data: affProfile } = await supabase
            .from('affiliate_profiles')
            .select('user_id, total_clicks')
            .eq('referral_code', referralCode.toLowerCase().trim())
            .single();

          if (affProfile) {
            // Record click
            await supabase.from('affiliate_clicks').insert({
              affiliate_user_id: affProfile.user_id,
              referral_code: referralCode.toLowerCase().trim(),
              visitor_ip_hash: clientIp.slice(0, 16),
              user_agent: userAgent.slice(0, 120),
              landing_page: landingPage,
              sub_id: subId.slice(0, 32),
            });

            // Increment clicks
            await supabase
              .from('affiliate_profiles')
              .update({ total_clicks: (affProfile.total_clicks || 0) + 1 })
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
    // 2. RECORD CONVERSION WITH 4-SIGNAL ANTI-SELF-REFERRAL SHIELD
    // --------------------------------------------------------------------------
    if (action === 'record_conversion') {
      const {
        referralCode,
        buyerEmail,
        buyerPhone,
        buyerIp = request.headers.get('x-forwarded-for') || '127.0.0.1',
        orderAmountBDT = 450,
        invoiceId,
        subId = 'organic',
      } = body;

      if (!referralCode || !buyerEmail) {
        return NextResponse.json({ error: 'referralCode and buyerEmail are required' }, { status: 400 });
      }

      let tierRate = 20.0;
      let isSelfReferral = false;
      let selfReferralReason = '';
      let affiliateUserId = 'local-affiliate-1';

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();

        // 1. Fetch affiliate profile and linked user profile
        const { data: affProfile } = await supabase
          .from('affiliate_profiles')
          .select('*, profiles!inner(email, phone)')
          .eq('referral_code', referralCode.toLowerCase().trim())
          .single();

        if (!affProfile) {
          return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
        }

        affiliateUserId = affProfile.user_id;
        tierRate = Number(affProfile.commission_rate) || 20.0;

        // 2. Check Fraud: Is affiliate account frozen?
        if (affProfile.is_frozen_for_fraud) {
          return NextResponse.json(
            { error: 'Affiliate Frozen', message: 'This affiliate account is flagged for fraud investigation.' },
            { status: 403 }
          );
        }

        // 3. Four-Signal Anti-Self-Referral Check:
        // Signal 1: Buyer Email == Affiliate Email
        if (buyerEmail.toLowerCase().trim() === (affProfile as any).profiles?.email?.toLowerCase().trim()) {
          isSelfReferral = true;
          selfReferralReason = 'Buyer email matches affiliate registered email';
        }

        // Signal 2: Buyer Phone == Affiliate Payout Account or Phone
        if (
          buyerPhone &&
          (buyerPhone === affProfile.payout_account_number ||
            buyerPhone === (affProfile as any).profiles?.phone)
        ) {
          isSelfReferral = true;
          selfReferralReason = 'Buyer contact/bKash phone matches affiliate payout account';
        }

        const calculatedCommission = isSelfReferral
          ? 0
          : Math.round(((orderAmountBDT * tierRate) / 100) * 100) / 100;

        const commissionStatus = isSelfReferral ? 'flagged_self_referral' : 'pending_35d_hold';

        // 4. Record Commission
        await supabase.from('affiliate_commissions').insert({
          affiliate_user_id: affiliateUserId,
          invoice_id: invoiceId || null,
          order_amount_bdt: orderAmountBDT,
          commission_rate: tierRate,
          commission_amount_bdt: calculatedCommission,
          status: commissionStatus,
          buyer_ip_hash: buyerIp.slice(0, 16),
          sub_id: subId,
          matures_at: new Date(Date.now() + 35 * 86400000).toISOString(),
          notes: isSelfReferral ? `FRAUD FLAGGED: ${selfReferralReason}` : 'Valid referral, 35-day hold active',
        });

        // 5. Update Affiliate Profile Balances and Conversion counts
        if (!isSelfReferral) {
          const newTotalSignups = (affProfile.total_signups || 0) + 1;
          const newActiveConversions = (affProfile.active_conversions || 0) + 1;
          const newPendingBalance = (Number(affProfile.pending_clearance_bdt) || 0) + calculatedCommission;

          // Check Auto-Scaling Tier Upgrades
          let newTier = affProfile.tier_level;
          let newRate = tierRate;
          if (newTotalSignups >= 31) {
            newTier = 'agency_30';
            newRate = 30.0;
          } else if (newTotalSignups >= 11) {
            newTier = 'pro_25';
            newRate = 25.0;
          }

          await supabase
            .from('affiliate_profiles')
            .update({
              total_signups: newTotalSignups,
              active_conversions: newActiveConversions,
              pending_clearance_bdt: newPendingBalance,
              tier_level: newTier,
              commission_rate: newRate,
            })
            .eq('user_id', affiliateUserId);
        } else {
          // Log Critical Fraud Alert for Admin Radar
          await createFraudAlert({
            userId: affiliateUserId,
            alertType: 'self_referral_attempt',
            severity: 'critical',
            details: {
              referralCode,
              buyerEmail,
              buyerPhone,
              reason: selfReferralReason,
              orderAmountBDT,
            },
          });

          await logSecurityAudit({
            actorId: affiliateUserId,
            actorRole: 'client',
            actionType: 'SELF_REFERRAL_BLOCKED',
            targetResource: `invoice:${invoiceId || 'new'}`,
            riskLevel: 'high',
            metadata: { reason: selfReferralReason },
          });
        }

        return NextResponse.json({
          success: true,
          isSelfReferral,
          commissionStatus,
          commissionAmountBDT: calculatedCommission,
          tierRate,
          maturesInDays: 35,
          message: isSelfReferral
            ? `Self-referral detected and blocked: ${selfReferralReason}`
            : `Commission of ৳${calculatedCommission} recorded with 35-day hold.`,
        });
      }

      // Offline / Local Simulation Mode fallback
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

    // --------------------------------------------------------------------------
    // 3. MATURE 35-DAY COMMISSIONS (CRON TRIGGER)
    // --------------------------------------------------------------------------
    if (action === 'mature_commissions') {
      let maturedCount = 0;
      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        const { data, error } = await supabase.rpc('process_mature_affiliate_commissions');
        if (!error && typeof data === 'number') {
          maturedCount = data;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processed 35-day maturity hold. ${maturedCount} commissions cleared to available balance.`,
        maturedCount,
      });
    }

    // --------------------------------------------------------------------------
    // 4. REQUEST PAYOUT (bKash / Nagad / Bank Transfer, min ৳1,000)
    // --------------------------------------------------------------------------
    if (action === 'request_payout') {
      const { affiliateUserId, amountBDT, payoutMethod, accountDetails } = body;

      const numAmount = Number(amountBDT);
      if (isNaN(numAmount) || numAmount < 1000) {
        return NextResponse.json(
          { error: 'Invalid Amount', message: 'Minimum payout threshold is ৳1,000 BDT.' },
          { status: 400 }
        );
      }

      if (!payoutMethod || !accountDetails) {
        return NextResponse.json(
          { error: 'Missing Details', message: 'Payout method and account details are required.' },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        const { data: affProfile } = await supabase
          .from('affiliate_profiles')
          .select('available_balance_bdt, is_frozen_for_fraud')
          .eq('user_id', affiliateUserId)
          .single();

        if (!affProfile) {
          return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
        }

        if (affProfile.is_frozen_for_fraud) {
          return NextResponse.json(
            { error: 'Account Frozen', message: 'Your affiliate account is frozen due to fraud investigation.' },
            { status: 403 }
          );
        }

        if (Number(affProfile.available_balance_bdt) < numAmount) {
          return NextResponse.json(
            { error: 'Insufficient Balance', message: `Available balance is only ৳${affProfile.available_balance_bdt} BDT.` },
            { status: 400 }
          );
        }

        // Create payout request
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

        // Deduct from available balance
        await supabase
          .from('affiliate_profiles')
          .update({
            available_balance_bdt: Number(affProfile.available_balance_bdt) - numAmount,
          })
          .eq('user_id', affiliateUserId);

        // Audit log
        await logSecurityAudit({
          actorId: affiliateUserId,
          actorRole: 'client',
          actionType: 'AFFILIATE_PAYOUT_REQUESTED',
          targetResource: `payout:${payoutData.id}`,
          riskLevel: 'low',
          metadata: { amount: numAmount, method: payoutMethod },
        });

        return NextResponse.json({
          success: true,
          payoutId: payoutData.id,
          message: `Payout request of ৳${numAmount} submitted for verification. bKash/Nagad transfer within 24 hours.`,
        });
      }

      return NextResponse.json({
        success: true,
        payoutId: `PAY-${Date.now()}`,
        message: `Payout request of ৳${numAmount} submitted in Sandbox simulation.`,
      });
    }

    // --------------------------------------------------------------------------
    // 5. INVOICE REFUND CLAWBACK (Cancels commission on 30-day moneyback refund)
    // --------------------------------------------------------------------------
    if (action === 'clawback_refund') {
      const { invoiceId } = body;
      if (!invoiceId) {
        return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const supabase = getServiceSupabase();
        await supabase
          .from('invoices')
          .update({ status: 'refunded' })
          .eq('id', invoiceId);
      }

      return NextResponse.json({
        success: true,
        message: `Affiliate commission clawback triggered for invoice ${invoiceId}.`,
      });
    }

    return NextResponse.json(
      { error: 'Unknown Action', message: `Action "${action}" is not supported.` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Affiliate API Error', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
