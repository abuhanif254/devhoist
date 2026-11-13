import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { requireUser, serviceUnavailableResponse } from '@/lib/authGuard';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { logSecurityAudit } from '@/lib/security';

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(req, 15, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Wallet checkout rate limit exceeded.' },
      { status: 429 }
    );
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    const rawAmountBDT = body.amountBDT !== undefined ? Number(body.amountBDT) : undefined;

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: 'Invoice number is required for Wallet checkout.' },
        { status: 400 }
      );
    }

    if (rawAmountBDT !== undefined && (!Number.isFinite(rawAmountBDT) || rawAmountBDT <= 0)) {
      return NextResponse.json(
        { error: 'Invalid payment amount specified.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Wallet Checkout');
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        sandbox: true,
        invoiceNumber,
        trxId: `WLT-SBX-${Date.now().toString(36).toUpperCase()}`,
        message: 'Wallet checkout completed in DEV_SANDBOX_MODE.',
      });
    }

    const db = getServiceSupabase();

    // Prevent using wallet balance to pay a wallet top-up invoice & cache fallback metadata
    const { data: precheck } = await db
      .from('invoices')
      .select('id, order_type, user_id, items, plan_id')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (precheck?.order_type === 'wallet_topup') {
      return NextResponse.json(
        { error: 'Wallet balance cannot be used to pay a Wallet Top-Up invoice.' },
        { status: 400 }
      );
    }

    // ACID Row-Locked PostgreSQL RPC (single source of truth for invoice.total_bdt & wallet debit)
    const { data: rpcRes, error: rpcErr } = await db.rpc('process_atomic_wallet_payment', {
      p_user_id: auth.user.id,
      p_invoice_number: invoiceNumber,
      p_trx_id: `WLT-${Date.now().toString(36).toUpperCase()}`,
    });

    if (rpcErr || !rpcRes) {
      return NextResponse.json(
        {
          error: rpcErr?.message || 'Atomic wallet debit RPC failed.',
        },
        { status: 500 }
      );
    }

    const result = (Array.isArray(rpcRes) ? rpcRes[0] : rpcRes) as {
      ok?: boolean;
      code?: string;
      error?: string;
      invoice_id?: string;
      invoice_number?: string;
      user_id?: string;
      total_bdt?: number;
      new_balance?: number;
      trx_id?: string;
      billing_cycle?: string;
      free_domain_bundle_applied?: boolean;
      bundled_domain_name?: string;
      referral_code?: string;
      referral_sub_id?: string;
      order_type?: string;
      promo_discount_bdt?: number;
      plan_id?: string;
      items?: unknown[];
    };

    if (!result.ok) {
      const codeMap: Record<string, number> = {
        NOT_FOUND: 404,
        PROFILE_NOT_FOUND: 404,
        FORBIDDEN: 403,
        INSUFFICIENT_BALANCE: 402,
        ALREADY_PROCESSED: 409,
        CONFLICT: 409,
        INVALID_INPUT: 400,
        INVALID_AMOUNT: 400,
      };
      return NextResponse.json(
        {
          error: result.error || 'Wallet checkout declined.',
          code: result.code || 'WALLET_ERROR',
        },
        { status: codeMap[result.code || ''] || 400 }
      );
    }

    // Unified idempotent Affiliate (4-signal + zero-loss) + Zero-Touch Provisioning
    const syntheticInvoiceRecord: Record<string, unknown> = {
      id: result.invoice_id,
      invoice_number: result.invoice_number || invoiceNumber,
      user_id: result.user_id || auth.user.id,
      total_bdt: Number(result.total_bdt || 0),
      billing_cycle: result.billing_cycle || 'monthly',
      free_domain_bundle_applied: Boolean(result.free_domain_bundle_applied),
      bundled_domain_name: result.bundled_domain_name,
      referral_code: result.referral_code,
      referral_sub_id: result.referral_sub_id,
      order_type: result.order_type || precheck?.order_type || 'hosting_order',
      discount_bdt: Number(result.promo_discount_bdt || 0),
      plan_id: result.plan_id ?? precheck?.plan_id,
      items: Array.isArray(result.items)
        ? result.items
        : Array.isArray(precheck?.items)
        ? precheck.items
        : [],
    };

    const fulfillment = await fulfillPaidInvoiceAndAffiliate({
      db,
      invoice: syntheticInvoiceRecord,
      gateway: 'wallet',
      trxId: result.trx_id || `WLT-${Date.now()}`,
      amountBDT: Number(result.total_bdt || 0),
      buyerIp: clientIp,
      skipInvoiceMarkPaid: true,
    });

    await logSecurityAudit({
      actorId: auth.user.id,
      actorRole: auth.role,
      actionType: 'ATOMIC_WALLET_PAYMENT_SETTLED',
      targetResource: invoiceNumber,
      ipAddress: clientIp,
      riskLevel: 'low',
      metadata: {
        amountBDT: result.total_bdt,
        newBalance: result.new_balance,
        trxId: result.trx_id,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      kind: fulfillment.kind,
      invoiceNumber: result.invoice_number || invoiceNumber,
      trxId: result.trx_id,
      paidAmountBDT: Number(result.total_bdt || 0),
      newWalletBalanceBDT: Number(result.new_balance ?? 0),
      provision: fulfillment.provision,
      domainOrder: fulfillment.domainOrder,
      affiliate: fulfillment.affiliate,
      message: `Paid ৳${Number(result.total_bdt || 0).toLocaleString()} BDT atomically from Cloud Wallet.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Wallet checkout failure' },
      { status: 500 }
    );
  }
}
