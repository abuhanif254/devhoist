// ==============================================================================
// DEVHOST CLOUD - UNIFIED IDEMPOTENT PAYMENT FULFILLMENT PIPELINE
// Shared by: Webhook (UddoktaPay/Stripe), bKash Callback, Nagad Callback,
//            Atomic Wallet Pay, and Admin Ledger Manual Approval.
// ==============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recordVerifiedAffiliateConversion,
  type AffiliateConversionOutcome,
} from '@/lib/affiliateEngine';
import {
  executeZeroTouchProvisioning,
  type ZeroTouchProvisionResult,
} from '@/lib/zeroTouchProvisioner';
import { renderInvoicePaidEmail, sendEmail } from '@/lib/emailEngine';
import { notifyNewPaidOrder } from '@/lib/adminNotifier';

export interface PaymentFulfillmentInput {
  db: SupabaseClient;
  invoice: Record<string, unknown>;
  gateway: string;
  trxId: string;
  amountBDT: number;
  buyerIp?: string;
  senderPhone?: string;
  cardFingerprint?: string;
  skipInvoiceMarkPaid?: boolean;
}

export interface PaymentFulfillmentResult {
  kind: 'wallet_topup' | 'hosting_order';
  invoiceId: string;
  invoiceNumber: string;
  walletBalanceBDT?: number;
  affiliate?: AffiliateConversionOutcome;
  provision?: ZeroTouchProvisionResult;
}

function normalizeLedgerGateway(raw: string): 'bkash' | 'nagad' | 'stripe' | 'wallet' | 'system' {
  const lower = raw.toLowerCase();
  if (lower.includes('bkash')) return 'bkash';
  if (lower.includes('nagad')) return 'nagad';
  if (lower.includes('stripe')) return 'stripe';
  if (lower.includes('wallet')) return 'wallet';
  return 'system';
}

/**
 * Credits a user's wallet or triggers 4-signal affiliate + zero-touch hosting provisioning
 * in an idempotent, double-entry ledger-backed pipeline.
 */
export async function fulfillPaidInvoiceAndAffiliate(
  input: PaymentFulfillmentInput
): Promise<PaymentFulfillmentResult> {
  const { db, invoice, gateway, trxId, amountBDT } = input;
  const invoiceId = String(invoice.id || '');
  const invoiceNumber = String(invoice.invoice_number || '');
  const userId = invoice.user_id ? String(invoice.user_id) : '';
  const items = Array.isArray(invoice.items)
    ? (invoice.items as Array<Record<string, unknown>>)
    : [];
  const firstItem = items[0] || {};
  const metadata = (invoice.metadata as Record<string, unknown> | undefined) || {};

  const orderType = String(
    invoice.order_type ||
      (firstItem.type === 'wallet_topup' || firstItem.isWalletTopup ? 'wallet_topup' : 'hosting_order')
  );

  // Lookup buyer identity once for receipt email, Telegram alerts, and affiliate checks
  const { data: customer } = userId
    ? await db
        .from('profiles')
        .select('id, email, full_name, phone, referred_by, wallet_balance_bdt')
        .eq('id', userId)
        .maybeSingle()
    : { data: null };

  const customerEmail = customer?.email ? String(customer.email) : undefined;
  const customerName = customer?.full_name ? String(customer.full_name) : 'Valued Developer';
  const customerPhone = customer?.phone ? String(customer.phone) : undefined;

  // =========================================================================
  // BRANCH A: WALLET TOP-UP (Credit Wallet Atomically, Never Award Affiliate)
  // =========================================================================
  if (orderType === 'wallet_topup' && userId) {
    let newBalance = Number(customer?.wallet_balance_bdt || 0);
    let credited = false;

    try {
      const { data: rpcRes, error: rpcErr } = await db.rpc('credit_user_wallet_atomic', {
        p_user_id: userId,
        p_amount_bdt: amountBDT,
        p_gateway: gateway,
        p_trx_id: trxId,
        p_description: `Wallet top-up settled via ${gateway} (${invoiceNumber})`,
      });

      if (!rpcErr && rpcRes) {
        const resObj = (Array.isArray(rpcRes) ? rpcRes[0] : rpcRes) as {
          ok?: boolean;
          success?: boolean;
          new_balance?: number;
          new_balance_bdt?: number;
        };
        if (resObj?.ok || resObj?.success) {
          newBalance = Number(resObj.new_balance ?? resObj.new_balance_bdt ?? newBalance + amountBDT);
          credited = true;
        }
      }
    } catch {
      // Fallback below if RPC not yet deployed or running in lightweight mock
    }

    if (!credited) {
      const { data: existingWt } = await db
        .from('wallet_transactions')
        .select('id')
        .eq('reference_id', trxId)
        .eq('type', 'credit')
        .maybeSingle();

      if (!existingWt) {
        newBalance = Number((Number(customer?.wallet_balance_bdt || 0) + amountBDT).toFixed(2));
        await db.from('profiles').update({ wallet_balance_bdt: newBalance }).eq('id', userId);
        await db.from('wallet_transactions').insert({
          user_id: userId,
          type: 'credit',
          amount_bdt: amountBDT,
          balance_after_bdt: newBalance,
          gateway,
          reference_id: trxId,
          description: `Wallet top-up settled via ${gateway} (${invoiceNumber})`,
        });
      }
    }

    if (!input.skipInvoiceMarkPaid && invoiceId) {
      await db
        .from('invoices')
        .update({
          status: 'paid',
          payment_method: gateway,
          trx_id: trxId,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);
    }

    try {
      await db.from('financial_profit_ledger').insert({
        entry_code: `LEDG-TOP-${Date.now().toString(36).toUpperCase()}`,
        entry_type: 'wallet_topup',
        invoice_id: invoiceId || null,
        user_id: userId,
        gateway: normalizeLedgerGateway(gateway),
        trx_id: trxId,
        gross_amount_bdt: amountBDT,
        base_cogs_cost_bdt: 0,
        affiliate_commission_bdt: 0,
        promo_discount_bdt: 0,
        notes: `Atomic Wallet Top-Up for ${customerEmail || userId} (${invoiceNumber})`,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Idempotent / non-fatal ledger log
    }

    if (customerEmail) {
      const receiptHtml = renderInvoicePaidEmail({
        name: customerName,
        invoiceNumber,
        amountBDT,
        paymentMethod: gateway,
        trxId,
        paidDate: new Date().toISOString().split('T')[0],
        items: [{ desc: 'DevHost Cloud Wallet Top-Up Credit', amount: amountBDT }],
      });
      sendEmail({
        to: customerEmail,
        subject: `Wallet Credited: ৳${amountBDT.toLocaleString()} BDT (${invoiceNumber})`,
        template: 'invoice_paid_receipt',
        html: receiptHtml,
      }).catch(() => {});
    }

    notifyNewPaidOrder({
      customerName,
      customerEmail: customerEmail || 'client@devhostcloud.com',
      packageName: 'Wallet Credit Top-Up',
      domain: 'wallet.devhostcloud.com',
      amountBDT,
      gateway,
      trxId,
      invoiceId: invoiceNumber,
    }).catch(() => {});

    return {
      kind: 'wallet_topup',
      invoiceId,
      invoiceNumber,
      walletBalanceBDT: newBalance,
    };
  }

  // =========================================================================
  // BRANCH B: HOSTING / DOMAIN ORDER -> 4-SIGNAL AFFILIATE + ZERO-TOUCH PROVISION
  // =========================================================================
  const domain = String(
    invoice.bundled_domain_name ||
      firstItem.domain ||
      metadata.domain ||
      `app-${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}.devhostcloud.com`
  );
  const planName = String(
    firstItem.name || firstItem.description || metadata.planName || 'Developer Pro Cloud'
  );
  const planId = (firstItem.planId || firstItem.plan_id || metadata.planId) as
    | string
    | number
    | undefined;
  const billingCycle: 'monthly' | 'annually' =
    invoice.billing_cycle === 'annually' || firstItem.billingCycle === 'annually'
      ? 'annually'
      : 'monthly';
  const freeDomainBundleApplied = Boolean(
    invoice.free_domain_bundle_applied || firstItem.freeDomainApplied
  );
  const promoDiscountBDT = Number(invoice.discount_bdt || firstItem.promoDiscountBDT || 0);
  const referralCode = String(
    invoice.referral_code || firstItem.referralCode || metadata.referralCode || customer?.referred_by || ''
  ).trim();
  const appStack = firstItem.appStack
    ? String(firstItem.appStack)
    : metadata.appStack
      ? String(metadata.appStack)
      : undefined;

  const affiliate = await recordVerifiedAffiliateConversion(db, {
    invoiceId,
    invoiceNumber,
    orderType,
    buyerUserId: userId || undefined,
    buyerEmail: customerEmail,
    buyerPhone: customerPhone,
    buyerIp: input.buyerIp,
    referralCode: referralCode || undefined,
    subId: invoice.referral_sub_id ? String(invoice.referral_sub_id) : undefined,
    amountBDT,
    subtotalBDT:
      typeof invoice.subtotal_bdt === 'number' && Number(invoice.subtotal_bdt) > 0
        ? Number(invoice.subtotal_bdt)
        : amountBDT + promoDiscountBDT,
    billingCycle,
    promoDiscountBDT,
    freeDomainBundleApplied,
    bundledDomainName: domain,
    senderPhone: input.senderPhone,
    cardFingerprint: input.cardFingerprint,
  });

  const provision = await executeZeroTouchProvisioning({
    invoiceId: invoiceId || undefined,
    invoiceNumber,
    userId: userId || undefined,
    customerEmail,
    customerName,
    domain,
    planId,
    planName,
    gateway: normalizeLedgerGateway(gateway),
    trxId,
    amountBDT,
    billingCycle,
    freeDomainBundleApplied,
    bundledDomainName: domain,
    appStack,
    affiliateCommissionBDT: affiliate.commissionBDT,
    promoDiscountBDT,
    skipInvoiceMarkPaid: input.skipInvoiceMarkPaid,
    referralCode: affiliate.referralCode,
  });

  return {
    kind: 'hosting_order',
    invoiceId,
    invoiceNumber,
    affiliate,
    provision,
  };
}
