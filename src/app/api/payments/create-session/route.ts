import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { extractCookie, requireUser, serviceUnavailableResponse } from '@/lib/authGuard';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { parseAffiliateAttributionCookie } from '@/lib/affiliateEngine';
import {
  createBkashCheckoutPayment,
  createNagadCheckoutSession,
  createStripeCheckoutSession,
  createUddoktaPayCheckout,
  getMerchantMfsNumbers,
  resolveSiteOrigin,
} from '@/lib/paymentGateways';
import { calculateOrderProfitBreakdown } from '@/lib/profitEngine';

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(req, 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Checkout rate limit exceeded. Please retry shortly.' },
      { status: 429 }
    );
  }

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const gateway = String(body.gateway || body.method || 'uddoktapay').toLowerCase().trim();
    const rawAmountBDT = Number(body.amountBDT ?? body.amount ?? 0);
    const items = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
    const firstItem = items[0] || {};
    const orderType = String(
      body.orderType ||
        (firstItem.type === 'wallet_topup' || firstItem.isWalletTopup ? 'wallet_topup' : 'hosting_order')
    );

    if (!Number.isFinite(rawAmountBDT) || rawAmountBDT <= 0 || rawAmountBDT > 10_000_000) {
      return NextResponse.json(
        { error: 'Invalid payment amount specified.' },
        { status: 400 }
      );
    }

    if (orderType === 'wallet_topup' && rawAmountBDT < 50) {
      return NextResponse.json(
        { error: 'Minimum wallet top-up amount is ৳50 BDT.' },
        { status: 400 }
      );
    }

    if (!['uddoktapay', 'bkash', 'nagad', 'stripe', 'wallet'].includes(gateway)) {
      return NextResponse.json(
        { error: `Unsupported payment gateway "${gateway}".` },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Payment Checkout');
    }

    const billingCycle: 'monthly' | 'annually' =
      body.billingCycle === 'annually' || firstItem.billingCycle === 'annually'
        ? 'annually'
        : 'monthly';
    const freeDomainApplied = Boolean(body.freeDomainApplied ?? firstItem.freeDomainApplied);
    const domain = String(body.domain || firstItem.domain || '').trim();
    const planSlugOrId = String(body.planSlug || body.planId || firstItem.planSlug || firstItem.planId || '').trim();
    const promoCodeInput = String(body.promoCode || '').trim().toUpperCase();

    // Parse referral attribution from body or Edge middleware devhost_aff_ref cookie
    const cookieAttr = parseAffiliateAttributionCookie(extractCookie(req, 'devhost_aff_ref'));
    let referralCode = String(body.referralCode || cookieAttr?.referralCode || '').trim();
    const subId = String(body.subId || cookieAttr?.subId || 'organic').trim() || 'organic';

    if (
      referralCode &&
      auth.profile.referral_code &&
      referralCode.toLowerCase() === auth.profile.referral_code.toLowerCase()
    ) {
      referralCode = '';
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    // =========================================================================
    // AUTHORITATIVE SERVER-SIDE PRICING & ZERO-LOSS PROMO VALIDATION
    // =========================================================================
    let subtotalBDT = rawAmountBDT;
    let discountBDT = 0;
    let totalBDT = rawAmountBDT;
    let verifiedPlanName = String(body.planName || firstItem.name || 'DevHost Cloud Service');

    if (db && orderType !== 'wallet_topup' && planSlugOrId) {
      const pidSlugMap: Record<string, string> = {
        '1': 'starter',
        '2': 'developer-pro',
        '3': 'business-max',
      };
      const resolvedSlug = (pidSlugMap[planSlugOrId] || planSlugOrId).toLowerCase();
      const { data: planRow } = await db
        .from('catalog_hosting_plans')
        .select('id, slug, name_en, selling_price_monthly_bdt, unit_server_cost_bdt, min_owner_profit_bdt, annual_discount_percent, whm_package_name')
        .eq('slug', resolvedSlug)
        .maybeSingle();

      if (planRow) {
        verifiedPlanName = String(planRow.name_en || verifiedPlanName);
        const monthlyPrice = Number(planRow.selling_price_monthly_bdt || 0);
        const annualDiscount = Number(planRow.annual_discount_percent ?? 20);
        const baseCyclePrice =
          billingCycle === 'annually'
            ? Math.round(monthlyPrice * 12 * (1 - annualDiscount / 100))
            : monthlyPrice;

        subtotalBDT = baseCyclePrice;
        totalBDT = baseCyclePrice;

        if (promoCodeInput) {
          const { data: promo } = await db
            .from('promo_codes')
            .select('code, discount_type, discount_value, max_uses, current_uses, expires_at, is_active')
            .eq('code', promoCodeInput)
            .maybeSingle();

          const expired = promo?.expires_at && new Date(String(promo.expires_at)).getTime() < Date.now();
          const exhausted = promo?.max_uses && Number(promo.current_uses || 0) >= Number(promo.max_uses);

          if (!promo || !promo.is_active || expired || exhausted) {
            return NextResponse.json(
              { error: `Promo code "${promoCodeInput}" is invalid, expired, or usage-exhausted.` },
              { status: 400 }
            );
          }

          discountBDT =
            promo.discount_type === 'percentage'
              ? Math.round((subtotalBDT * Number(promo.discount_value || 0)) / 100)
              : Math.min(subtotalBDT, Number(promo.discount_value || 0));

          totalBDT = Math.max(1, subtotalBDT - discountBDT);

          // Enforce zero-loss floor on discounted plan price
          const profitCheck = calculateOrderProfitBreakdown({
            sellingPriceBDT: subtotalBDT,
            unitServerCostBDT:
              billingCycle === 'annually'
                ? Number(planRow.unit_server_cost_bdt || 0) * 12
                : Number(planRow.unit_server_cost_bdt || 0),
            minOwnerProfitBDT:
              billingCycle === 'annually'
                ? Number(planRow.min_owner_profit_bdt || 0) * 12
                : Number(planRow.min_owner_profit_bdt || 0),
            promoDiscountBDT: discountBDT,
            billingCycle,
            freeDomainCostBDT: freeDomainApplied ? 1150 : 0,
          });

          if (profitCheck.isLossMaking) {
            return NextResponse.json(
              {
                error: 'Promo code discount violates server COGS & minimum margin protection on this cycle.',
              },
              { status: 400 }
            );
          }
        }

        // Prevent client amount tampering (> ৳5 delta vs server price)
        if (Math.abs(totalBDT - rawAmountBDT) > 5 && !firstItem.customBundleTotal) {
          return NextResponse.json(
            {
              error: `Price tampering detected: client supplied ৳${rawAmountBDT} BDT, authoritative server total is ৳${totalBDT} BDT.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const generatedInvNum =
      typeof body.invoiceNumber === 'string' && /^DEV-INV-[A-Za-z0-9_-]{4,}$/.test(body.invoiceNumber.trim())
        ? body.invoiceNumber.trim()
        : `DEV-INV-${Date.now().toString(36).toUpperCase()}`;

    const invoiceItems =
      items.length > 0
        ? items
        : [
            {
              name: orderType === 'wallet_topup' ? 'DevHost Wallet Credit Top-Up' : verifiedPlanName,
              type: orderType,
              domain: domain || undefined,
              planId: planSlugOrId || undefined,
              billingCycle,
              freeDomainApplied,
              promoCode: promoCodeInput || undefined,
              promoDiscountBDT: discountBDT,
              referralCode: referralCode || undefined,
              amountBDT: totalBDT,
            },
          ];

    if (db) {
      const { error: invErr } = await db.from('invoices').upsert(
        {
          invoice_number: generatedInvNum,
          user_id: auth.user.id,
          items: invoiceItems,
          subtotal_bdt: subtotalBDT,
          discount_bdt: discountBDT,
          total_bdt: totalBDT,
          status: 'unpaid',
          payment_method: gateway,
          order_type: orderType,
          billing_cycle: billingCycle,
          free_domain_bundle_applied: freeDomainApplied,
          bundled_domain_name: domain || null,
          referral_code: referralCode || null,
          referral_sub_id: subId,
          plan_id: planSlugOrId || null,
          promo_code: promoCodeInput || null,
          promo_discount_bdt: discountBDT,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'invoice_number' }
      );

      if (invErr) {
        return NextResponse.json(
          { error: 'Failed to create billing invoice', details: invErr.message },
          { status: 500 }
        );
      }
    }

    const reqOrigin = (() => {
      try {
        return new URL(req.url).origin;
      } catch {
        return undefined;
      }
    })();
    const siteUrl = resolveSiteOrigin(reqOrigin);
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '103.205.71.1';

    const sessionInput = {
      invoiceNumber: generatedInvNum,
      amountBDT: totalBDT,
      customerName: auth.profile.full_name,
      customerEmail: auth.profile.email,
      customerPhone: auth.profile.phone,
      userId: auth.user.id,
      planName: orderType === 'wallet_topup' ? 'Wallet Credit Top-Up' : verifiedPlanName,
      referralCode: referralCode || undefined,
      siteUrl,
      clientIp,
    };

    // 1. Wallet Readiness
    if (gateway === 'wallet') {
      return NextResponse.json({
        success: true,
        mode: 'wallet_ready',
        gateway: 'wallet',
        invoiceNumber: generatedInvNum,
        amountBDT: totalBDT,
      });
    }

    // 2. Stripe Checkout (Never emits fake checkout URLs without live key)
    if (gateway === 'stripe') {
      const stripeRes = await createStripeCheckoutSession(sessionInput);
      if (!stripeRes.configured) {
        if (!isDevSandboxMode()) {
          return serviceUnavailableResponse('Stripe Checkout');
        }
        return NextResponse.json({
          success: true,
          mode: 'sandbox_simulation',
          gateway: 'stripe',
          invoiceNumber: generatedInvNum,
          amountBDT: totalBDT,
          message: 'DEV_SANDBOX_MODE Stripe simulation session.',
        });
      }
      if (!stripeRes.paymentUrl) {
        return NextResponse.json(
          { error: stripeRes.error || 'Failed to initialize Stripe checkout session.' },
          { status: stripeRes.statusCode || 502 }
        );
      }
      return NextResponse.json({
        success: true,
        mode: 'live_stripe',
        gateway: 'stripe',
        paymentUrl: stripeRes.paymentUrl,
        providerRef: stripeRes.providerRef,
        invoiceNumber: generatedInvNum,
        amountBDT: totalBDT,
      });
    }

    // 3. Official bKash Tokenized Checkout
    if (gateway === 'bkash') {
      const bkashRes = await createBkashCheckoutPayment(sessionInput);
      if (bkashRes.configured) {
        if (!bkashRes.paymentUrl) {
          return NextResponse.json(
            { error: bkashRes.error || 'bKash gateway initialization failed.' },
            { status: bkashRes.statusCode || 502 }
          );
        }
        return NextResponse.json({
          success: true,
          mode: 'live_bkash',
          gateway: 'bkash',
          paymentUrl: bkashRes.paymentUrl,
          providerRef: bkashRes.providerRef,
          invoiceNumber: generatedInvNum,
          amountBDT: totalBDT,
        });
      }
    }

    // 4. Official Nagad Merchant PG
    if (gateway === 'nagad') {
      const nagadRes = await createNagadCheckoutSession(sessionInput);
      if (nagadRes.configured) {
        if (!nagadRes.paymentUrl) {
          return NextResponse.json(
            { error: nagadRes.error || 'Nagad gateway initialization failed.' },
            { status: nagadRes.statusCode || 502 }
          );
        }
        return NextResponse.json({
          success: true,
          mode: 'live_nagad',
          gateway: 'nagad',
          paymentUrl: nagadRes.paymentUrl,
          providerRef: nagadRes.providerRef,
          invoiceNumber: generatedInvNum,
          amountBDT: totalBDT,
        });
      }
    }

    // 5. UddoktaPay Aggregate Gateway (Direct or fallback from unconfigured bKash/Nagad)
    const uddoktaRes = await createUddoktaPayCheckout(sessionInput);
    if (uddoktaRes.configured) {
      if (!uddoktaRes.paymentUrl) {
        return NextResponse.json(
          { error: uddoktaRes.error || 'UddoktaPay checkout creation failed.' },
          { status: uddoktaRes.statusCode || 502 }
        );
      }
      return NextResponse.json({
        success: true,
        mode: 'live_uddoktapay',
        gateway: 'uddoktapay',
        paymentUrl: uddoktaRes.paymentUrl,
        invoiceNumber: generatedInvNum,
        amountBDT: totalBDT,
      });
    }

    // 6. Real Manual MFS Send-Money + TrxID Verification Queue (when live PG keys omitted for BD MFS)
    const mfs = getMerchantMfsNumbers();
    const isNagad = gateway === 'nagad';
    return NextResponse.json({
      success: true,
      mode: 'manual_verification',
      gateway,
      invoiceNumber: generatedInvNum,
      amountBDT: totalBDT,
      instructions: {
        method: isNagad ? 'Nagad Send Money' : 'bKash Send Money',
        merchantNumber: isNagad ? mfs.nagad : mfs.bkash,
        exactAmountBDT: totalBDT,
        reference: generatedInvNum,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout initialization failed' },
      { status: 500 }
    );
  }
}
