import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { executeZeroTouchProvisioning } from '@/lib/zeroTouchProvisioner';
import { timingSafeEqualStr, verifyHmacSha256Hex } from '@/lib/authGuard';

const STRIPE_TOLERANCE_SECONDS = 300;

async function verifyPaymentWebhookSignature(
  request: Request,
  rawBody: string
): Promise<{ ok: true; via: string } | { ok: false; status: number; message: string }> {
  const uddoktaSecret = process.env.UDDOKTAPAY_API_KEY?.trim() || '';
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';
  const customWebhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || '';

  const uddoktaHeader = request.headers.get('rt-uddoktapay-api-key')?.trim() || '';
  if (
    uddoktaHeader &&
    uddoktaSecret &&
    !uddoktaSecret.includes('your-uddoktapay-key') &&
    timingSafeEqualStr(uddoktaHeader, uddoktaSecret)
  ) {
    return { ok: true, via: 'uddoktapay' };
  }

  const stripeSigHeader = request.headers.get('stripe-signature')?.trim() || '';
  if (stripeSigHeader && stripeSecret && !stripeSecret.includes('your-stripe')) {
    const parts = Object.fromEntries(
      stripeSigHeader.split(',').map((kv) => {
        const [k, v] = kv.trim().split('=');
        return [k, v];
      })
    );
    const tsNum = Number(parts.t);
    const v1Sig = parts.v1 || '';
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
    if (
      Number.isFinite(tsNum) &&
      ageSeconds <= STRIPE_TOLERANCE_SECONDS &&
      v1Sig &&
      (await verifyHmacSha256Hex(`${tsNum}.${rawBody}`, v1Sig, stripeSecret))
    ) {
      return { ok: true, via: 'stripe' };
    }
    return { ok: false, status: 401, message: 'Invalid or expired Stripe webhook signature.' };
  }

  const customSigHeader = request.headers.get('x-devhost-webhook-signature')?.trim() || '';
  const customSecretHeader = request.headers.get('x-devhost-webhook-secret')?.trim() || '';
  if (customWebhookSecret) {
    if (customSigHeader && (await verifyHmacSha256Hex(rawBody, customSigHeader, customWebhookSecret))) {
      return { ok: true, via: 'hmac_sha256' };
    }
    if (customSecretHeader && timingSafeEqualStr(customSecretHeader, customWebhookSecret)) {
      return { ok: true, via: 'shared_secret' };
    }
  }

  const hasAnyConfiguredSecret = Boolean(
    (uddoktaSecret && !uddoktaSecret.includes('your-uddoktapay-key')) ||
      (stripeSecret && !stripeSecret.includes('your-stripe')) ||
      customWebhookSecret
  );

  if (!hasAnyConfiguredSecret) {
    return {
      ok: false,
      status: 503,
      message: 'Payment webhook gateway secrets are not configured on the server.',
    };
  }

  return {
    ok: false,
    status: 401,
    message: 'Unauthorized payment webhook: missing or invalid cryptographic signature.',
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const sigCheck = await verifyPaymentWebhookSignature(request, rawBody);
    if (!sigCheck.ok) {
      return NextResponse.json({ error: 'Unauthorized', message: sigCheck.message }, { status: sigCheck.status });
    }

    let payload: Record<string, any> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON webhook payload.' }, { status: 400 });
    }

    // Support payload schemas from UddoktaPay, bKash, Stripe, and DevHost Webhooks
    const invoiceNumber =
      payload.invoice_number ||
      payload.metadata?.invoice_number ||
      payload.invoiceNumber ||
      payload.order_id;

    const trxId =
      payload.transaction_id ||
      payload.trx_id ||
      payload.trxID ||
      payload.payment_id ||
      `TRX-${Date.now()}`;

    let amount = Number(payload.amount || payload.amount_bdt || 0);
    let domain = payload.domain || payload.metadata?.domain || payload.custom_domain;
    let planName = payload.plan_name || payload.metadata?.plan_name || 'Developer Pro Cloud';
    let planId = payload.plan_id || payload.metadata?.plan_id || 'developer-pro';
    const contactEmail = payload.email || payload.metadata?.email || payload.customer_email;
    const customerName = payload.customer_name || payload.metadata?.customer_name || 'Developer';
    let userId = payload.user_id || payload.metadata?.user_id;
    let billingCycle = (payload.billing_cycle || payload.metadata?.billing_cycle || 'monthly') as
      | 'monthly'
      | 'annually';
    let freeDomainBundle = Boolean(
      payload.free_domain_bundle || payload.metadata?.free_domain_bundle_applied
    );
    let bundledDomain = payload.bundled_domain || payload.metadata?.bundled_domain_name || domain;
    const gateway = payload.gateway || payload.payment_method || sigCheck.via || 'bkash';

    console.log(`[Payment Webhook] Verified (${sigCheck.via}) for Invoice: ${invoiceNumber}, TrxID: ${trxId}`);

    // Fetch invoice metadata from Supabase and enforce idempotency + exact server amount
    let dbInvoiceId: string | undefined;
    if (isSupabaseConfigured()) {
      const supabase = getServiceSupabase();

      const { data: existingCompletedTrx } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('trx_id', trxId)
        .eq('status', 'Completed')
        .maybeSingle();

      if (existingCompletedTrx) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          message: 'Webhook transaction already processed.',
          invoiceNumber,
          trxId,
        });
      }

      if (invoiceNumber) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('*')
          .eq('invoice_number', invoiceNumber)
          .maybeSingle();

        if (inv) {
          if (inv.status === 'paid') {
            return NextResponse.json({
              success: true,
              alreadyProcessed: true,
              message: 'Invoice already marked as paid.',
              invoiceNumber,
              trxId,
            });
          }

          dbInvoiceId = inv.id;
          userId = inv.user_id || userId;
          const dbAmount = Number(inv.total_bdt ?? inv.total_amount_bdt ?? inv.amount ?? 0);
          if (amount > 0 && dbAmount > 0 && amount + 0.01 < dbAmount) {
            return NextResponse.json(
              {
                error: 'Underpayment Rejected',
                message: `Paid amount ${amount} is less than invoice total ${dbAmount}.`,
              },
              { status: 400 }
            );
          }
          amount = dbAmount || amount;
          billingCycle = (inv.billing_cycle || billingCycle) as 'monthly' | 'annually';
          freeDomainBundle = freeDomainBundle || Boolean(inv.free_domain_bundle_applied);
          bundledDomain = bundledDomain || inv.bundled_domain_name;

          // Extract domain from invoice items if missing
          if (!domain && Array.isArray(inv.items) && inv.items.length > 0) {
            const firstItem = inv.items[0];
            domain = firstItem.domain || firstItem.description?.match(/([a-z0-9-]+\.[a-z]{2,})/i)?.[0];
            planName = planName || firstItem.name || firstItem.plan_name;
          }
        }
      }

      // Record transaction entry
      await supabase.from('transactions').insert({
        trx_id: trxId,
        invoice_number: invoiceNumber || null,
        user_id: userId || null,
        amount_bdt: amount || 450,
        gateway: ['bkash', 'nagad', 'stripe', 'wallet', 'uddoktapay'].includes(gateway) ? gateway : 'bkash',
        status: 'Completed',
        raw_payload: payload,
        created_at: new Date().toISOString(),
      });
    }

    const effectiveDomain = domain || bundledDomain || 'devhost-app.net';

    // EXECUTE 5-STEP ZERO-TOUCH INSTANT PROVISIONING PIPELINE
    const provisionResult = await executeZeroTouchProvisioning({
      invoiceId: dbInvoiceId,
      invoiceNumber,
      userId,
      customerEmail: contactEmail,
      customerName,
      domain: effectiveDomain,
      planId,
      planName,
      gateway,
      trxId,
      amountBDT: amount || 450,
      billingCycle,
      freeDomainBundleApplied: freeDomainBundle,
      bundledDomainName: bundledDomain,
    });

    return NextResponse.json({
      success: true,
      message: 'Zero-Touch Order Provisioned & Activated Successfully!',
      invoiceNumber,
      trxId,
      provisioning: provisionResult,
    });
  } catch (err: any) {
    console.error('[Payment Webhook Error]', err);
    return NextResponse.json(
      { error: 'Webhook Processing Error', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
