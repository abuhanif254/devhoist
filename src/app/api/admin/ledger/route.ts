import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { requireAdmin, verifySudoToken, serviceUnavailableResponse } from '@/lib/authGuard';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


async function logLedgerAudit(
  actionType: string,
  targetResource: string,
  metadata: Record<string, unknown>,
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ip: string = '127.0.0.1'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_role: 'admin',
      action_type: actionType,
      target_resource: targetResource,
      ip_address: ip,
      risk_level: riskLevel,
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}

/**
 * GET: Fetch financial profit ledger & compute 4-pillar unit economics
 */
export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Financial Profit Ledger');
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!isSupabaseConfigured()) {
      if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Financial Profit Ledger');
      }
      // Baseline simulated ledger data (DEV_SANDBOX_MODE only)
      const mockLedger = [
        {
          id: 'ldg-1',
          entry_code: 'LDG-2026-9001',
          entry_type: 'hosting_sale',
          gateway: 'bkash',
          trx_id: '9K72LM89QP',
          gross_amount_bdt: 450,
          base_cogs_cost_bdt: 70,
          affiliate_commission_bdt: 90,
          promo_discount_bdt: 0,
          owner_net_profit_bdt: 290,
          notes: 'Developer Pro NVMe (1 Month) - Sale via Affiliate ref_devhanif',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'ldg-2',
          entry_code: 'LDG-2026-9002',
          entry_type: 'domain_registration',
          gateway: 'nagad',
          trx_id: '8H34NK12XZ',
          gross_amount_bdt: 1250,
          base_cogs_cost_bdt: 1150,
          affiliate_commission_bdt: 0,
          promo_discount_bdt: 0,
          owner_net_profit_bdt: 100,
          notes: '.com 1-Year Registration (CIRA Buy Cost $9.50 = ৳1,150)',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'ldg-3',
          entry_code: 'LDG-2026-9003',
          entry_type: 'hosting_sale',
          gateway: 'bkash',
          trx_id: '7J45PL90OP',
          gross_amount_bdt: 350,
          base_cogs_cost_bdt: 40,
          affiliate_commission_bdt: 70,
          promo_discount_bdt: 50,
          owner_net_profit_bdt: 240,
          notes: 'Standard Shared Hosting (1 Month) - Promo code LAUNCH20 applied',
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: 'ldg-4',
          entry_code: 'LDG-2026-9004',
          entry_type: 'server_infrastructure_expense',
          gateway: 'system',
          trx_id: 'EXP-SG1-MARCH',
          gross_amount_bdt: -3500,
          base_cogs_cost_bdt: 3500,
          affiliate_commission_bdt: 0,
          promo_discount_bdt: 0,
          owner_net_profit_bdt: -3500,
          notes: 'Monthly Reseller Server Lease: Singapore SG1 Equinix 100GB NVMe Node',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];

      const totalGross = 2050; // Sales only
      const totalCogs = 1260;
      const totalAffiliate = 160;
      const netProfit = totalGross - totalCogs - totalAffiliate;

      return NextResponse.json({
        success: true,
        ledger: mockLedger,
        metrics: {
          totalGrossCollected: totalGross,
          totalServerBuyCost: totalCogs,
          totalAffiliateAllocated: totalAffiliate,
          netOwnerProfit: netProfit,
          profitMarginPercent: ((netProfit / totalGross) * 100).toFixed(1),
        },
      });
    }

    const db = getServiceSupabase();
    const { data: entries, error } = await db
      .from('financial_profit_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Aggregate 4-pillar metrics
    let totalGrossCollected = 0;
    let totalServerBuyCost = 0;
    let totalAffiliateAllocated = 0;
    let netOwnerProfit = 0;

    (entries || []).forEach((row) => {
      const gross = Number(row.gross_amount_bdt) || 0;
      const cogs = Number(row.base_cogs_cost_bdt) || 0;
      const aff = Number(row.affiliate_commission_bdt) || 0;
      const profit = Number(row.owner_net_profit_bdt) || 0;

      if (row.entry_type !== 'server_infrastructure_expense') {
        totalGrossCollected += gross;
        totalServerBuyCost += cogs;
        totalAffiliateAllocated += aff;
        netOwnerProfit += profit;
      }
    });

    const profitMarginPercent = totalGrossCollected > 0
      ? ((netOwnerProfit / totalGrossCollected) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      success: true,
      ledger: entries || [],
      metrics: {
        totalGrossCollected,
        totalServerBuyCost,
        totalAffiliateAllocated,
        netOwnerProfit,
        profitMarginPercent,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Record Double-Entry Transaction, Approve Manual TrxID, or Process Refund
 */
export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Financial Profit Ledger');
    }

    const body = await req.json();
    const { action } = body;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Process Sudo-Guarded Refund with Commission Clawback
    if (action === 'process_refund') {
      const { invoiceId, refundAmountBdt, reason } = body;

      if (!invoiceId || !refundAmountBdt) {
        return NextResponse.json({ success: false, error: 'invoiceId and refundAmountBdt are required.' }, { status: 400 });
      }

      const sudoValid = await verifySudoToken(req, adminAuth.user.id);
      if (!sudoValid) {
        return NextResponse.json(
          { success: false, requireSudo: true, error: 'Admin Sudo elevation is required to process refunds.' },
          { status: 403 }
        );
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();

        const rawId = String(invoiceId).trim();
        const { data: resolvedInvoice } = await (UUID_REGEX.test(rawId)
          ? db.from('invoices').select('id, invoice_number').eq('id', rawId).maybeSingle()
          : db.from('invoices').select('id, invoice_number').eq('invoice_number', rawId).maybeSingle());

        const resolvedInvoiceUuid = resolvedInvoice?.id || (UUID_REGEX.test(rawId) ? rawId : null);

        // Check if an affiliate commission was recorded for this invoice
        const { data: affCommission } = resolvedInvoiceUuid
          ? await db
              .from('affiliate_commissions')
              .select('*')
              .eq('invoice_id', resolvedInvoiceUuid)
              .maybeSingle()
          : await db
              .from('affiliate_commissions')
              .select('*')
              .eq('invoice_number', rawId)
              .maybeSingle();

        let clawbackBdt = 0;
        if (affCommission && affCommission.status !== 'clawed_back_refunded') {
          clawbackBdt = Number(affCommission.commission_amount_bdt) || 0;
        }

        // Update invoice status first — DB trigger_invoice_refund_clawback automatically
        // deducts pending_clearance_bdt / available_balance_bdt from affiliate_profiles
        // and transitions affiliate_commissions.status -> 'clawed_back_refunded'.
        if (resolvedInvoiceUuid) {
          await db.from('invoices').update({ status: 'refunded' }).eq('id', resolvedInvoiceUuid);
        } else {
          await db.from('invoices').update({ status: 'refunded' }).eq('invoice_number', rawId);
        }

        // Fallback clawback if DB trigger was not installed on a partial schema
        if (affCommission && clawbackBdt > 0) {
          const { data: refreshedComm } = await db
            .from('affiliate_commissions')
            .select('status')
            .eq('id', affCommission.id)
            .maybeSingle();

          if (refreshedComm && refreshedComm.status !== 'clawed_back_refunded') {
            await db
              .from('affiliate_commissions')
              .update({
                status: 'clawed_back_refunded',
                clawed_back_at: new Date().toISOString(),
                notes: 'Clawed back due to invoice refund',
              })
              .eq('id', affCommission.id);

            const { data: affProfile } = await db
              .from('affiliate_profiles')
              .select('pending_clearance_bdt, available_balance_bdt')
              .eq('user_id', affCommission.affiliate_user_id)
              .maybeSingle();

            if (affProfile) {
              const updatedFields: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
              };
              if (refreshedComm.status === 'cleared_available') {
                updatedFields.available_balance_bdt = Math.max(
                  0,
                  (Number(affProfile.available_balance_bdt) || 0) - clawbackBdt
                );
              } else {
                updatedFields.pending_clearance_bdt = Math.max(
                  0,
                  (Number(affProfile.pending_clearance_bdt) || 0) - clawbackBdt
                );
              }
              await db
                .from('affiliate_profiles')
                .update(updatedFields)
                .eq('user_id', affCommission.affiliate_user_id);
            }
          }
        }

        // Record Offset Refund in Financial Ledger
        const entryCode = `LDG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await db.from('financial_profit_ledger').insert({
          entry_code: entryCode,
          entry_type: 'customer_refund',
          invoice_id: resolvedInvoiceUuid,
          gateway: 'system',
          gross_amount_bdt: -Math.abs(refundAmountBdt),
          base_cogs_cost_bdt: 0,
          affiliate_commission_bdt: -clawbackBdt,
          promo_discount_bdt: 0,
          notes: `Customer Refund issued. Reason: ${reason || 'Customer request'}. Affiliate clawback: ৳${clawbackBdt}`,
        });
      }

      await logLedgerAudit(
        'REFUND_PROCESSED',
        `invoice:${invoiceId}`,
        { refundAmountBdt, reason, adminId: adminAuth.user.id },
        'critical',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Refund of ৳${refundAmountBdt} processed successfully. Associated affiliate commissions have been clawed back.`,
      });
    }

    // 2. Approve Manual bKash / Nagad Transaction & Run Unified Fulfillment
    if (action === 'approve_trxid') {
      const { invoiceId, invoiceNumber, trxId, grossAmountBdt, cogsBdt = 0, affiliateCutBdt = 0, domain } = body;

      if (!invoiceId && !invoiceNumber) {
        return NextResponse.json({ success: false, error: 'invoiceId or invoiceNumber is required.' }, { status: 400 });
      }

      const gross = Number(grossAmountBdt) || 0;
      const cogs = Number(cogsBdt) || 0;
      const aff = Number(affiliateCutBdt) || 0;

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();

        const rawId = String(invoiceId || '').trim();
        const rawInvNum = String(invoiceNumber || '').trim();
        const { data: invoiceRow } = await (rawId && UUID_REGEX.test(rawId)
          ? db.from('invoices').select('*').eq('id', rawId).maybeSingle()
          : db
              .from('invoices')
              .select('*')
              .eq('invoice_number', rawInvNum || rawId)
              .maybeSingle());

        const { data: txRow } = trxId
          ? await db
              .from('transactions')
              .select('id, gateway, raw_payload')
              .eq('trx_id', String(trxId))
              .maybeSingle()
          : { data: null };

        // Mark submitted TrxID as Completed
        if (trxId) {
          await db
            .from('transactions')
            .update({ status: 'Completed', updated_at: new Date().toISOString() })
            .eq('trx_id', String(trxId));
        }

        if (invoiceRow && invoiceRow.status !== 'paid') {
          const senderPhone =
            (txRow?.raw_payload as { sender_number?: string } | undefined)?.sender_number || undefined;
          const settledGateway = String(
            txRow?.gateway || invoiceRow.payment_method || 'bkash'
          ).replace(/_manual$/i, '');

          await fulfillPaidInvoiceAndAffiliate({
            db,
            invoice: invoiceRow,
            gateway: settledGateway,
            trxId: String(trxId || invoiceRow.trx_id || `ADM-${Date.now()}`),
            amountBDT: Number(invoiceRow.total_bdt || gross || 0),
            buyerIp: ip,
            senderPhone,
          });
        } else {
          // Safe fallback when invoice record wasn't linked in invoices table
          const validUuid = invoiceRow?.id || (UUID_REGEX.test(rawId) ? rawId : null);
          if (validUuid) {
            await db
              .from('invoices')
              .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                trx_id: trxId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', validUuid);
          }

          if (domain) {
            await db
              .from('hosting_services')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('domain', domain);
          }

          const entryCode = `LDG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          await db.from('financial_profit_ledger').insert({
            entry_code: entryCode,
            entry_type: 'hosting_sale',
            invoice_id: validUuid,
            gateway: txRow?.gateway === 'nagad' ? 'nagad' : 'bkash',
            trx_id: trxId,
            gross_amount_bdt: gross,
            base_cogs_cost_bdt: cogs,
            affiliate_commission_bdt: aff,
            promo_discount_bdt: 0,
            notes: `Manual TrxID approved by Admin for invoice ${invoiceNumber || invoiceId}`,
          });
        }
      }

      await logLedgerAudit(
        'MANUAL_TRXID_APPROVED',
        `invoice:${invoiceNumber || invoiceId}`,
        { trxId, gross, cogs, aff },
        'high',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Transaction ${trxId} verified and approved. Service activated and ledger recorded.`,
      });
    }

    // 2B. Reject Fake Transaction ID (Fraud Strike)
    if (action === 'reject_trxid') {
      const { invoiceId, invoiceNumber, trxId, reason } = body;

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();

        if (invoiceId) {
          await db.from('invoices').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', invoiceId);
        } else if (invoiceNumber) {
          await db.from('invoices').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('invoice_number', invoiceNumber);
        }

        if (trxId) {
          await db
            .from('transactions')
            .update({ status: 'Rejected', updated_at: new Date().toISOString() })
            .eq('trx_id', trxId);
        }
      }

      await logLedgerAudit(
        'FAKE_TRXID_REJECTED',
        `invoice:${invoiceNumber || invoiceId}`,
        { trxId, reason: reason || 'Fraudulent or non-existent transaction ID' },
        'critical',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Transaction ${trxId} marked as rejected. Fraud strike recorded.`,
      });
    }

    // 3. Record Direct Ledger Entry
    if (action === 'record_entry') {
      const { entryType, gateway, trxId, grossAmountBdt, baseCogsBdt, affBdt, notes } = body;

      const gross = Number(grossAmountBdt) || 0;
      const cogs = Number(baseCogsBdt) || 0;
      const aff = Number(affBdt) || 0;
      const entryCode = `LDG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('financial_profit_ledger').insert({
          entry_code: entryCode,
          entry_type: entryType || 'hosting_sale',
          gateway: gateway || 'bkash',
          trx_id: trxId || `TRX-${Date.now().toString(36).toUpperCase()}`,
          gross_amount_bdt: gross,
          base_cogs_cost_bdt: cogs,
          affiliate_commission_bdt: aff,
          notes: notes || 'Direct admin ledger entry',
        });
      }

      await logLedgerAudit('MANUAL_LEDGER_ENTRY', `entry:${entryCode}`, { gross, cogs, aff }, 'medium', ip);

      return NextResponse.json({
        success: true,
        message: 'Financial ledger entry recorded.',
        entryCode,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
