import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { serviceUnavailableResponse } from '@/lib/authGuard';
import { verifyPaymentWebhookRequest } from '@/lib/paymentGateways';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';
import { createFraudAlert, logSecurityAudit } from '@/lib/security';

function normalizeTransactionGateway(
  rawGateway: string,
  provider: string
): 'bkash' | 'nagad' | 'stripe' | 'wallet' | 'uddoktapay' | 'sslcommerz' | 'system' {
  const lower = `${rawGateway} ${provider}`.toLowerCase();
  if (lower.includes('stripe')) return 'stripe';
  if (lower.includes('bkash')) return 'bkash';
  if (lower.includes('nagad')) return 'nagad';
  if (lower.includes('wallet')) return 'wallet';
  if (lower.includes('sslcommerz')) return 'sslcommerz';
  if (lower.includes('uddoktapay')) return 'uddoktapay';
  return 'uddoktapay';
}

export async function POST(req: Request) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  try {
    const rawBody = await req.text();
    const payload = (() => {
      try {
        return JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    // Step 1: Fail-closed cryptographic / API-key / server-verify-payment verification
    const verified = await verifyPaymentWebhookRequest(req, rawBody, payload);
    if (!verified.ok) {
      await logSecurityAudit({
        actionType: 'WEBHOOK_AUTH_REJECTED',
        targetResource: String(payload.invoice_id || payload.invoice_number || 'webhook'),
        ipAddress: clientIp,
        riskLevel: verified.status === 503 ? 'medium' : 'critical',
        metadata: {
          provider: verified.provider,
          error: verified.error,
        },
      }).catch(() => {});

      return NextResponse.json(
        { error: verified.error || 'Webhook verification failed.' },
        { status: verified.status }
      );
    }

    // Ignore benign non-payment Stripe lifecycle events
    if (verified.eventStatus === 'IGNORED') {
      return NextResponse.json({ received: true, status: 'ignored_event' });
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Payment Webhook Fulfillment');
    }

    const { invoiceNumber, trxId, amountBDT, gateway, eventStatus } = verified;
    if (!invoiceNumber || !trxId) {
      return NextResponse.json(
        { error: 'Webhook missing invoiceNumber or transaction identifier.' },
        { status: 400 }
      );
    }

    const txGateway = normalizeTransactionGateway(gateway, verified.provider);

    // Handle failed or cancelled payment states safely
    if (eventStatus !== 'COMPLETED') {
      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('transactions').insert({
          invoice_number: invoiceNumber,
          gateway: txGateway,
          trx_id: trxId,
          amount_bdt: amountBDT,
          status: 'Failed',
          raw_payload: {
            provider: verified.provider,
            reported_gateway: gateway,
            eventStatus,
            sender_number: verified.senderPhone,
            card_fingerprint: verified.cardFingerprint,
            payload: verified.rawPayload,
          },
        });
      }
      return NextResponse.json({ received: true, status: 'payment_not_completed', eventStatus });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        received: true,
        sandbox: true,
        invoiceNumber,
        trxId,
      });
    }

    const db = getServiceSupabase();

    // Step 2: Atomic Idempotency Check on transactions.trx_id AND invoice status
    const { data: existingTx } = await db
      .from('transactions')
      .select('id, status')
      .eq('trx_id', trxId)
      .maybeSingle();

    if (existingTx && existingTx.status === 'Completed') {
      return NextResponse.json({
        received: true,
        status: 'already_processed',
        trxId,
      });
    }

    const { data: invoice } = await db
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json(
        { error: `Invoice "${invoiceNumber}" not found.` },
        { status: 404 }
      );
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({
        received: true,
        status: 'invoice_already_paid',
        invoiceNumber,
      });
    }

    // Step 3: Strict Underpayment / Amount Integrity Guard
    const expectedTotal = Number(invoice.total_bdt || 0);
    if (expectedTotal > 0 && amountBDT + 1 < expectedTotal) {
      await createFraudAlert({
        userId: invoice.user_id ? String(invoice.user_id) : undefined,
        alertType: 'velocity_abuse',
        severity: 'critical',
        details: {
          reason: 'Webhook underpayment amount mismatch',
          invoiceNumber,
          expectedBDT: expectedTotal,
          receivedBDT: amountBDT,
          trxId,
          gateway,
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          error: `Underpayment rejected: invoice requires ৳${expectedTotal} BDT, gateway reported ৳${amountBDT} BDT.`,
        },
        { status: 400 }
      );
    }

    // Step 4: Insert Completed Transaction with Unique Conflict Protection (23505)
    const { error: txInsertErr } = await db.from('transactions').insert({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      user_id: invoice.user_id || null,
      gateway: txGateway,
      trx_id: trxId,
      amount_bdt: amountBDT || expectedTotal,
      status: 'Completed',
      raw_payload: {
        provider: verified.provider,
        reported_gateway: gateway,
        sender_number: verified.senderPhone || null,
        card_fingerprint: verified.cardFingerprint || null,
        remote_invoice_id: verified.remoteInvoiceId || null,
        verified_at: new Date().toISOString(),
      },
    });

    if (txInsertErr) {
      if (txInsertErr.code === '23505') {
        return NextResponse.json({
          received: true,
          status: 'already_processed_conflict',
          trxId,
        });
      }
      return NextResponse.json(
        { error: `Failed to record transaction: ${txInsertErr.message}` },
        { status: 500 }
      );
    }

    // Step 5: Unified Idempotent Fulfillment (Wallet Credit OR 4-Signal Affiliate + Provisioning)
    const fulfillment = await fulfillPaidInvoiceAndAffiliate({
      db,
      invoice,
      gateway: gateway || verified.provider,
      trxId,
      amountBDT: amountBDT || expectedTotal,
      buyerIp: clientIp,
      senderPhone: verified.senderPhone,
      cardFingerprint: verified.cardFingerprint,
    });

    await logSecurityAudit({
      actorId: invoice.user_id ? String(invoice.user_id) : undefined,
      actorRole: 'system',
      actionType: 'WEBHOOK_PAYMENT_SETTLED',
      targetResource: invoiceNumber,
      ipAddress: clientIp,
      riskLevel: 'low',
      metadata: {
        gateway,
        trxId,
        kind: fulfillment.kind,
        affiliateCommissionBDT: fulfillment.affiliate?.commissionBDT ?? 0,
      },
    }).catch(() => {});

    return NextResponse.json({
      received: true,
      status: 'settled',
      kind: fulfillment.kind,
      invoiceNumber,
      trxId,
      walletBalanceBDT: fulfillment.walletBalanceBDT,
      provision: fulfillment.provision,
      affiliate: fulfillment.affiliate,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook processing failure' },
      { status: 500 }
    );
  }
}
