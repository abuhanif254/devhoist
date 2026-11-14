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
import {
  isStandaloneDomainOrderType,
  resolveDomainTldPriceBDT,
} from '@/lib/billingEntitlements';
import { extendAndUnsuspendHostingService } from '@/lib/lifecycleEngine';
import {
  isBdManualTld,
  registerDomainWithRegistrar,
  renewDomainWithRegistrar,
  transferDomainWithRegistrar,
} from '@/lib/registrarClient';
import {
  ensureCloudflareZone,
  isCloudflareConfigured,
  upsertCloudflareDnsRecord,
} from '@/lib/cloudflareClient';
import { decryptEppCode, encryptEppCode } from '@/lib/dnsEngine';
import { renderInvoicePaidEmail, sendEmail } from '@/lib/emailEngine';
import { notifyNewPaidOrder, sendTelegramAlert } from '@/lib/adminNotifier';

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

export interface DomainOrderFulfillmentOutcome {
  operation: 'register' | 'renew' | 'transfer';
  domain: string;
  years: number;
  status: string;
  alreadyFulfilled?: boolean;
  registrarProvider?: string | null;
  registrarOrderId?: string | null;
  cloudflareZoneId?: string | null;
  transferId?: string | null;
  expiryDate?: string;
  registrarError?: string;
}

export interface PaymentFulfillmentResult {
  kind: 'wallet_topup' | 'hosting_order' | 'domain_order';
  invoiceId: string;
  invoiceNumber: string;
  walletBalanceBDT?: number;
  affiliate?: AffiliateConversionOutcome;
  provision?: ZeroTouchProvisionResult;
  domainOrder?: DomainOrderFulfillmentOutcome;
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

  const rawOrderType = String(
    invoice.order_type ||
      firstItem.type ||
      (firstItem.isWalletTopup ? 'wallet_topup' : 'hosting_order')
  );
  const orderType =
    rawOrderType === 'domain_register'
      ? 'domain_registration'
      : rawOrderType === 'domain_renew'
      ? 'domain_renewal'
      : rawOrderType;

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
  // BRANCH A2: SERVICE RENEWAL SETTLEMENT (EXTEND DUE DATE & UNSUSPEND)
  // =========================================================================
  if (orderType === 'service_renewal' || orderType === 'renewal') {
    const renewalServiceId = String(
      invoice.service_id || firstItem.serviceId || metadata.serviceId || ''
    ).trim();

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

    if (renewalServiceId) {
      await extendAndUnsuspendHostingService(db, {
        serviceId: renewalServiceId,
        userId: userId || undefined,
        reason: `Renewal invoice ${invoiceNumber} settled via ${gateway}`,
      });
    }

    try {
      await db.from('financial_profit_ledger').insert({
        entry_code: `LEDG-REN-${Date.now().toString(36).toUpperCase()}`,
        entry_type: 'hosting_renewal',
        invoice_id: invoiceId || null,
        user_id: userId || null,
        gateway: normalizeLedgerGateway(gateway),
        trx_id: trxId,
        gross_amount_bdt: amountBDT,
        base_cogs_cost_bdt: 0,
        affiliate_commission_bdt: 0,
        promo_discount_bdt: 0,
        notes: `Hosting renewal settled (${invoiceNumber}) for service ${renewalServiceId || 'unspecified'}`,
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
        items: [{ desc: `Service Renewal (${invoiceNumber})`, amount: amountBDT }],
      });
      await sendEmail({
        to: customerEmail,
        subject: `Service Renewed: ${invoiceNumber}`,
        template: 'invoice_paid_receipt',
        html: receiptHtml,
      }).catch(() => {});
    }

    return {
      kind: 'hosting_order',
      invoiceId,
      invoiceNumber,
    };
  }

  // =========================================================================
  // BRANCH B: STANDALONE PAID DOMAIN ORDER (REGISTER / RENEW / TRANSFER-IN)
  // =========================================================================
  if (isStandaloneDomainOrderType(orderType)) {
    const cleanDomain = String(
      invoice.bundled_domain_name || firstItem.domain || metadata.domain || ''
    )
      .trim()
      .toLowerCase();
    const normType = orderType.toLowerCase();
    const operation: 'register' | 'renew' | 'transfer' =
      normType === 'domain_renewal' || normType === 'domain_renew'
        ? 'renew'
        : normType === 'domain_transfer'
        ? 'transfer'
        : 'register';

    const years =
      operation === 'transfer'
        ? 1
        : Math.max(1, Math.min(10, Number(firstItem.years ?? metadata.years ?? 1)));
    const tldInfo = await resolveDomainTldPriceBDT(db, cleanDomain, operation);
    const tld = tldInfo.tld;
    const wholesaleCogsBDT = Math.max(0, Math.round(tldInfo.registrarCostBDT * years));
    const promoDiscountBDT = Number(invoice.discount_bdt || firstItem.promoDiscountBDT || 0);
    const referralCode = String(
      invoice.referral_code ||
        firstItem.referralCode ||
        metadata.referralCode ||
        customer?.referred_by ||
        ''
    ).trim();

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

    // Idempotency guard: prevent duplicate registrar API submission on webhook retries
    let existingLedger: { id?: string } | null = null;
    try {
      const { data: ledgerRow } = await db
        .from('financial_profit_ledger')
        .select('id')
        .eq('trx_id', trxId)
        .maybeSingle();
      existingLedger = ledgerRow || null;
    } catch {
      existingLedger = null;
    }

    const affiliate = tldInfo.affiliateEligible
      ? await recordVerifiedAffiliateConversion(db, {
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
          billingCycle: 'annually',
          unitServerCostBDT: wholesaleCogsBDT,
          minOwnerProfitBDT: tldInfo.minOwnerProfitBDT * years,
          promoDiscountBDT,
          freeDomainBundleApplied: false,
          bundledDomainName: cleanDomain,
          senderPhone: input.senderPhone,
          cardFingerprint: input.cardFingerprint,
        })
      : {
          recorded: false,
          skippedReason: `${tld} uses fixed zero-margin wholesale pricing (affiliate excluded).`,
          commissionBDT: 0,
          commissionRatePercent: 0,
          isAffiliateCapped: false,
          ownerNetProfitBDT: Math.max(0, amountBDT - wholesaleCogsBDT),
        };

    let outcome: DomainOrderFulfillmentOutcome = {
      operation,
      domain: cleanDomain,
      years,
      status: existingLedger ? 'Already Fulfilled' : 'Pending',
      alreadyFulfilled: Boolean(existingLedger),
    };

    if (!existingLedger && cleanDomain) {
      let registrarProvider: string | null = isBdManualTld(cleanDomain) ? 'btcl_manual' : null;
      let registrarOrderId: string | null = null;
      let cfZoneId: string | null = null;
      let cfZoneStatus = 'pending';
      let cfNameservers: string[] = [];
      let serverNameservers = ['ns1.devhost.net', 'ns2.devhost.net'];
      let finalExpiryDate = new Date(Date.now() + years * 365 * 86400000).toISOString().split('T')[0];

      if (operation === 'register') {
        if (isCloudflareConfigured()) {
          const cfZone = await ensureCloudflareZone(cleanDomain);
          if (cfZone.ok && cfZone.zoneId) {
            cfZoneId = cfZone.zoneId;
            cfZoneStatus = cfZone.status || 'pending';
            cfNameservers = cfZone.nameServers || [];
            if (cfNameservers.length >= 2) {
              serverNameservers = cfNameservers;
            }
          }
        }

        const regRes = await registerDomainWithRegistrar({
          domain: cleanDomain,
          years,
          nameservers: serverNameservers,
          protectPrivacy: true,
          contact: { name: customerName, email: customerEmail },
        });

        registrarProvider = regRes.provider;
        registrarOrderId = regRes.orderId || null;
        const domainStatus = regRes.ok
          ? regRes.data?.status || (isBdManualTld(cleanDomain) ? 'Pending' : 'Active')
          : 'Pending';
        if (regRes.data?.nameservers && regRes.data.nameservers.length >= 2) {
          serverNameservers = regRes.data.nameservers;
        }

        const { data: existingRegDom } = await db
          .from('domains')
          .select('id, user_id')
          .eq('domain_name', cleanDomain)
          .maybeSingle();

        if (
          existingRegDom &&
          existingRegDom.user_id &&
          userId &&
          existingRegDom.user_id !== userId
        ) {
          throw new Error(
            `Ownership conflict: domain ${cleanDomain} already belongs to another customer account.`
          );
        }

        await db.from('domains').upsert(
          {
            user_id: userId || existingRegDom?.user_id || null,
            domain_name: cleanDomain,
            tld,
            status: domainStatus,
            registrar_lock: domainStatus === 'Active',
            whois_privacy: true,
            auto_renew: true,
            nameservers: serverNameservers,
            registrar_provider: registrarProvider || 'unassigned',
            registrar_order_id: registrarOrderId,
            cloudflare_zone_id: cfZoneId,
            cloudflare_zone_status: cfZoneStatus,
            cloudflare_nameservers: cfNameservers,
            expiry_date: finalExpiryDate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'domain_name' }
        );

        if (cfZoneId && isCloudflareConfigured()) {
          const { data: activeNode } = await db
            .from('whm_server_nodes')
            .select('ip_address')
            .eq('is_healthy', true)
            .limit(1)
            .maybeSingle();
          const defaultIp = String(activeNode?.ip_address || '103.151.102.45');
          await upsertCloudflareDnsRecord(
            cfZoneId,
            { type: 'A', name: '@', content: defaultIp, ttl: 3600, proxied: true },
            { apexDomain: cleanDomain }
          ).catch(() => {});
          await upsertCloudflareDnsRecord(
            cfZoneId,
            { type: 'CNAME', name: 'www', content: cleanDomain, ttl: 3600, proxied: true },
            { apexDomain: cleanDomain }
          ).catch(() => {});
        }

        if (!regRes.ok) {
          sendTelegramAlert(
            `⚠️ <b>Paid Domain Registration Needs Review</b>\nDomain: <code>${cleanDomain}</code>\nInvoice: <code>${invoiceNumber}</code>\nReason: ${regRes.error || regRes.message}`,
            'order'
          ).catch(() => {});
        } else if (isBdManualTld(cleanDomain)) {
          sendTelegramAlert(
            `🇧🇩 <b>BTCL .bd Manual Registration Queued</b>\nDomain: <code>${cleanDomain}</code>\nInvoice: <code>${invoiceNumber}</code>`,
            'order'
          ).catch(() => {});
        }

        outcome = {
          operation,
          domain: cleanDomain,
          years,
          status: domainStatus,
          registrarProvider,
          registrarOrderId,
          cloudflareZoneId: cfZoneId,
          expiryDate: finalExpiryDate,
          registrarError: regRes.ok ? undefined : regRes.error || regRes.message,
        };
      } else if (operation === 'renew') {
        const regRes = await renewDomainWithRegistrar({ domain: cleanDomain, years });
        registrarProvider = regRes.provider;
        registrarOrderId = regRes.orderId || null;

        const { data: existingDom } = await db
          .from('domains')
          .select('id, user_id, expiry_date')
          .eq('domain_name', cleanDomain)
          .maybeSingle();

        if (existingDom && existingDom.user_id && userId && existingDom.user_id !== userId) {
          throw new Error(
            `Ownership conflict: domain ${cleanDomain} already belongs to another customer account.`
          );
        }

        const baseMs = existingDom?.expiry_date
          ? Math.max(Date.now(), new Date(String(existingDom.expiry_date)).getTime())
          : Date.now();
        finalExpiryDate = new Date(baseMs + years * 365 * 86400000).toISOString().split('T')[0];
        const nextStatus = regRes.ok && !isBdManualTld(cleanDomain) ? 'Active' : 'Pending';

        await db.from('domains').upsert(
          {
            user_id: userId || existingDom?.user_id || null,
            domain_name: cleanDomain,
            tld,
            status: nextStatus,
            expiry_date: finalExpiryDate,
            registrar_provider: registrarProvider || 'unassigned',
            registrar_order_id: registrarOrderId || undefined,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'domain_name' }
        );

        if (!regRes.ok) {
          sendTelegramAlert(
            `⚠️ <b>Paid Domain Renewal Needs Review</b>\nDomain: <code>${cleanDomain}</code> (+${years}y)\nInvoice: <code>${invoiceNumber}</code>\nReason: ${regRes.error || regRes.message}`,
            'order'
          ).catch(() => {});
        }

        outcome = {
          operation,
          domain: cleanDomain,
          years,
          status: nextStatus,
          registrarProvider,
          registrarOrderId,
          expiryDate: finalExpiryDate,
          registrarError: regRes.ok ? undefined : regRes.error || regRes.message,
        };
      } else {
        // Inbound Domain Transfer (`domain_transfer`)
        const encryptedFromOrder = String(
          firstItem.eppCodeEncrypted || metadata.eppCodeEncrypted || ''
        ).trim();
        const plainFromOrder = String(firstItem.eppCode || metadata.eppCode || '').trim();
        const plainEpp = encryptedFromOrder
          ? await decryptEppCode(encryptedFromOrder)
          : plainFromOrder;
        const storedEncryptedEpp =
          encryptedFromOrder || (await encryptEppCode(plainEpp || 'PENDING-EPP'));

        let transferStep = 1;
        let transferStatus: string = 'pending_payment';
        let statusMessage = 'Payment verified. Submit valid EPP Auth code to dispatch registrar transfer.';
        let registrarErr: string | undefined;

        if (plainEpp && plainEpp !== 'PENDING-EPP') {
          const trfRes = await transferDomainWithRegistrar({
            domain: cleanDomain,
            eppCode: plainEpp,
          });
          registrarProvider = trfRes.provider;
          registrarOrderId = trfRes.orderId || null;

          if (trfRes.ok) {
            transferStep = trfRes.mode === 'manual_btcl_queue' ? 1 : 2;
            transferStatus = trfRes.mode === 'manual_btcl_queue' ? 'pending_payment' : 'verifying_epp';
            statusMessage = trfRes.message;
          } else {
            transferStep = 2;
            transferStatus = 'rejected_invalid_epp';
            statusMessage = trfRes.message || trfRes.error || 'Registrar rejected EPP transfer request.';
            registrarErr = trfRes.error || trfRes.message;
          }
        }

        const { data: trfRow } = await db
          .from('domain_transfers')
          .insert({
            user_id: userId,
            domain_name: cleanDomain,
            tld,
            epp_code_encrypted: storedEncryptedEpp,
            transfer_price_bdt: amountBDT || tldInfo.unitPriceBDT,
            invoice_id: invoiceId || null,
            current_step: transferStep,
            status: transferStatus,
            status_message: statusMessage,
            auto_import_dns: true,
            registrar_transfer_id: registrarOrderId,
            registrar_provider: registrarProvider || 'unassigned',
            epp_status: registrarErr ? 'rejected' : 'submitted',
          })
          .select('id')
          .single();

        const { data: existingTrfDom } = await db
          .from('domains')
          .select('id, user_id')
          .eq('domain_name', cleanDomain)
          .maybeSingle();

        if (
          existingTrfDom &&
          existingTrfDom.user_id &&
          userId &&
          existingTrfDom.user_id !== userId
        ) {
          throw new Error(
            `Ownership conflict: domain ${cleanDomain} already belongs to another customer account.`
          );
        }

        await db.from('domains').upsert(
          {
            user_id: userId || existingTrfDom?.user_id || null,
            domain_name: cleanDomain,
            tld,
            status: 'Transferring',
            registrar_lock: true,
            whois_privacy: true,
            auto_renew: true,
            registrar_provider: registrarProvider || 'unassigned',
            registrar_order_id: registrarOrderId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'domain_name' }
        );

        outcome = {
          operation,
          domain: cleanDomain,
          years: 1,
          status: transferStatus,
          registrarProvider,
          registrarOrderId,
          transferId: trfRow?.id ? String(trfRow.id) : null,
          registrarError: registrarErr,
        };
      }

      try {
        await db.from('financial_profit_ledger').insert({
          entry_code: `LEDG-DOM-${Date.now().toString(36).toUpperCase()}`,
          entry_type:
            operation === 'renew'
              ? 'domain_renewal'
              : operation === 'transfer'
              ? 'domain_transfer'
              : 'domain_registration',
          invoice_id: invoiceId || null,
          user_id: userId || null,
          gateway: normalizeLedgerGateway(gateway),
          trx_id: trxId,
          gross_amount_bdt: amountBDT,
          base_cogs_cost_bdt: wholesaleCogsBDT,
          affiliate_commission_bdt: affiliate.commissionBDT,
          promo_discount_bdt: promoDiscountBDT,
          notes: `Domain ${operation.toUpperCase()}: ${cleanDomain} (${years}y) via ${outcome.registrarProvider || gateway}`,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Idempotent / non-fatal ledger log
      }
    }

    if (customerEmail) {
      const receiptHtml = renderInvoicePaidEmail({
        name: customerName,
        invoiceNumber,
        amountBDT,
        paymentMethod: gateway,
        trxId,
        paidDate: new Date().toISOString().split('T')[0],
        items: [{ desc: `Domain ${operation.toUpperCase()}: ${cleanDomain} (${years}y)`, amount: amountBDT }],
      });
      sendEmail({
        to: customerEmail,
        subject: `Domain Order Settled: ${cleanDomain} (${invoiceNumber})`,
        template: 'invoice_paid_receipt',
        html: receiptHtml,
      }).catch(() => {});
    }

    notifyNewPaidOrder({
      customerName,
      customerEmail: customerEmail || 'client@devhostcloud.com',
      packageName: `Domain ${operation.toUpperCase()} (${years}y)`,
      domain: cleanDomain,
      amountBDT,
      gateway,
      trxId,
      invoiceId: invoiceNumber,
    }).catch(() => {});

    return {
      kind: 'domain_order',
      invoiceId,
      invoiceNumber,
      affiliate,
      domainOrder: outcome,
    };
  }

  // =========================================================================
  // BRANCH C: HOSTING / BUNDLE ORDER -> 4-SIGNAL AFFILIATE + ZERO-TOUCH PROVISION
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
