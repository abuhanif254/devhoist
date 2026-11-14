import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { requireUser, requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import { chargeWalletAtomic, resolveAuthoritativePlanMeta } from '@/lib/billingEntitlements';
import { buildPortalUrl } from '@/lib/siteUrl';


interface HandoverStoreRecord {
  developer_user_id?: string;
  status?: string;
  claimed_by_user_id?: string;
  [key: string]: unknown;
}

// Mock in-memory store for local sandbox testing if Supabase is offline
const inMemoryHandovers = new Map<string, HandoverStoreRecord>();

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const devUserId = searchParams.get('devUserId');

    if (token) {
      if (isSupabaseConfigured()) {
        try {
          const db = getServiceSupabase();
          const { data, error } = await db
            .from('agency_handover_transfers')
            .select('*')
            .eq('handover_token', token)
            .single();

          if (data && !error) {
            const isParticipant =
              data.developer_user_id === auth.user.id ||
              data.claimed_by_user_id === auth.user.id ||
              (typeof data.client_email === 'string' &&
                data.client_email.toLowerCase() === auth.profile.email.toLowerCase()) ||
              auth.role === 'admin';
            if (!isParticipant) {
              return NextResponse.json(
                { success: false, error: 'Forbidden: you are not an authorized recipient of this handover.' },
                { status: 403 }
              );
            }
            return NextResponse.json({ success: true, handover: data });
          }
          if (!isDevSandboxMode()) {
            return NextResponse.json(
              { success: false, error: 'Handover token not found or expired.' },
              { status: 404 }
            );
          }
        } catch (dbErr) {
          console.warn('[Handover DB Read Warning]', dbErr);
          if (!isDevSandboxMode()) {
            return serviceUnavailableResponse('Agency Handover Portal');
          }
        }
      } else if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Agency Handover Portal');
      }

      // Check fallback in-memory (DEV_SANDBOX_MODE only)
      const fallback = inMemoryHandovers.get(token);
      if (fallback) {
        return NextResponse.json({ success: true, handover: fallback });
      }

      // Default mock handover for instant UI testing in DEV_SANDBOX_MODE only
      return NextResponse.json({
        success: true,
        handover: {
          id: 'ho_mock_1',
          handover_token: token,
          client_name: 'TechCorp Solutions',
          client_email: auth.profile.email || 'finance@techcorp.bd',
          project_title: 'Next.js Enterprise eCommerce & ERP Portal',
          plan_slug: 'developer-pro',
          billing_cycle: 'annual',
          developer_name: 'Tanvir Ahmed (DevHost Agency Partner)',
          developer_setup_fee_bdt: 12500,
          hosting_price_bdt: 4320,
          total_payable_bdt: 16820,
          keep_developer_ssh_git_access: true,
          lock_recurring_affiliate_commission: true,
          status: 'pending_client_claim',
          expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      });
    }

    const targetDevId = auth.role === 'admin' && devUserId ? devUserId : auth.user.id;
    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data } = await db
        .from('agency_handover_transfers')
        .select('*')
        .eq('developer_user_id', targetDevId)
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, handovers: data || [] });
    }

    if (!isSupabaseConfigured()) {
      if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Agency Handover Portal');
      }
      return NextResponse.json({
        success: true,
        handovers: Array.from(inMemoryHandovers.values()).filter(
          (h) => h.developer_user_id === targetDevId || auth.role === 'admin'
        ),
      });
    }

    return NextResponse.json({ success: true, handovers: [] });
  } catch (error: unknown) {
    console.error('[Handover GET Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load handover details' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      developerName,
      serviceId,
      clientName,
      clientEmail,
      projectTitle,
      planSlug = 'developer-pro',
      billingCycle = 'annual',
      developerSetupFeeBDT = 0,
    } = body;

    if (serviceId) {
      const srvAccess = await requireServiceAccess(request, serviceId, 'services:write');
      if (!srvAccess.ok) return srvAccess.response;
    }

    const developerUserId = auth.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Agency Handover Portal');
    }

    if (!clientName || !clientEmail || !projectTitle) {
      return NextResponse.json(
        { error: 'Client name, email, and project title are required.' },
        { status: 400 }
      );
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    const planMeta = await resolveAuthoritativePlanMeta(db, String(planSlug || 'developer-pro'));
    const cycleMonths = String(billingCycle).toLowerCase() === 'monthly' ? 1 : 12;
    const annualDiscountFactor = cycleMonths === 12 ? 0.8 : 1;
    const authoritativeHostingPriceBDT = Math.round(planMeta.monthlyPriceBDT * cycleMonths * annualDiscountFactor);
    const safeSetupFeeBDT = Math.max(0, Math.round(Number(developerSetupFeeBDT) || 0));

    const handoverToken = `dh_ho_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const handoverRecord = {
      id: `ho_${Date.now()}`,
      handover_token: handoverToken,
      developer_user_id: developerUserId,
      developer_name: developerName || 'Agency Lead Developer',
      service_id: serviceId || null,
      client_name: clientName.trim(),
      client_email: clientEmail.trim().toLowerCase(),
      project_title: projectTitle.trim(),
      plan_slug: planMeta.slug,
      billing_cycle: cycleMonths === 1 ? 'monthly' : 'annual',
      developer_setup_fee_bdt: safeSetupFeeBDT,
      hosting_price_bdt: authoritativeHostingPriceBDT,
      total_payable_bdt: safeSetupFeeBDT + authoritativeHostingPriceBDT,
      keep_developer_ssh_git_access: true,
      lock_recurring_affiliate_commission: true,
      status: 'pending_client_claim',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    if (db) {
      await db.from('agency_handover_transfers').insert({
        handover_token: handoverToken,
        developer_user_id: developerUserId,
        service_id: serviceId || null,
        client_name: handoverRecord.client_name,
        client_email: handoverRecord.client_email,
        project_title: handoverRecord.project_title,
        plan_slug: handoverRecord.plan_slug,
        billing_cycle: handoverRecord.billing_cycle,
        developer_setup_fee_bdt: handoverRecord.developer_setup_fee_bdt,
        hosting_price_bdt: handoverRecord.hosting_price_bdt,
        keep_developer_ssh_git_access: true,
        lock_recurring_affiliate_commission: true,
        status: 'pending_client_claim',
        expires_at: expiresAt,
      });
    }

    inMemoryHandovers.set(handoverToken, handoverRecord);

    return NextResponse.json({
      success: true,
      handoverToken,
      handoverUrl: buildPortalUrl(`/handover/${handoverToken}`),
      handover: handoverRecord,
    });
  } catch (error: unknown) {
    console.error('[Handover POST Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create handover' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { handoverToken, trxId, invoiceNumber, payFromWallet } = body;
    const clientUserId = auth.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Agency Handover Portal');
    }

    if (!handoverToken) {
      return NextResponse.json({ error: 'Handover token is required' }, { status: 400 });
    }

    let resolvedTrxId = typeof trxId === 'string' && trxId.trim() ? trxId.trim() : '';

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { data: existingHo } = await db
        .from('agency_handover_transfers')
        .select('id, status, client_email, service_id, developer_setup_fee_bdt, hosting_price_bdt, plan_slug, project_title, expires_at')
        .eq('handover_token', handoverToken)
        .maybeSingle();

      if (!existingHo) {
        return NextResponse.json({ error: 'Handover invitation not found.' }, { status: 404 });
      }

      if (existingHo.status && existingHo.status !== 'pending_client_claim') {
        return NextResponse.json(
          { error: 'Handover token has already been claimed or is no longer active.' },
          { status: 409 }
        );
      }

      if (existingHo.expires_at && new Date(String(existingHo.expires_at)).getTime() < Date.now()) {
        return NextResponse.json(
          { error: 'Handover invitation has expired.' },
          { status: 410 }
        );
      }

      if (
        existingHo.client_email &&
        existingHo.client_email.toLowerCase() !== auth.profile.email &&
        auth.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Forbidden: This handover invitation belongs to a different client email address.' },
          { status: 403 }
        );
      }

      const requiredTotalBDT =
        Number(existingHo.developer_setup_fee_bdt || 0) + Number(existingHo.hosting_price_bdt || 0);

      // Verify genuine settlement specifically bound to this handover token (paid invoice, atomic wallet debit, or admin)
      let paymentVerified = auth.role === 'admin' || requiredTotalBDT <= 0;
      let consumedInvoiceId: string | null = null;

      const verifyHandoverInvoiceRow = (inv: Record<string, unknown> | null | undefined): boolean => {
        if (!inv) return false;
        if (inv.handover_claimed === true) return false;
        if (String(inv.order_type || '').toLowerCase() !== 'agency_handover') return false;
        if (Number(inv.total_bdt || 0) + 1 < requiredTotalBDT) return false;
        const invItems = Array.isArray(inv.items) ? (inv.items as Array<Record<string, unknown>>) : [];
        if (invItems.length === 0) return true;
        return invItems.some((it) => {
          const itemTok = String(it.handoverToken || it.handover_token || '').trim();
          return !itemTok || itemTok === handoverToken;
        });
      };

      if (!paymentVerified && invoiceNumber) {
        const { data: paidInv } = await db
          .from('invoices')
          .select('id, user_id, status, total_bdt, order_type, trx_id, items, handover_claimed')
          .eq('invoice_number', String(invoiceNumber).trim())
          .eq('user_id', clientUserId)
          .eq('status', 'paid')
          .maybeSingle();

        if (verifyHandoverInvoiceRow(paidInv as Record<string, unknown> | null)) {
          paymentVerified = true;
          consumedInvoiceId = paidInv?.id ? String(paidInv.id) : null;
          resolvedTrxId = String(paidInv?.trx_id || resolvedTrxId || invoiceNumber);
        }
      }

      if (!paymentVerified && resolvedTrxId) {
        const { data: paidTx } = await db
          .from('transactions')
          .select('id, invoice_id, user_id, amount_bdt, status, trx_id')
          .eq('trx_id', resolvedTrxId)
          .eq('user_id', clientUserId)
          .maybeSingle();

        const txStatus = String(paidTx?.status || '').toLowerCase();
        if (
          paidTx &&
          ['completed', 'settled', 'succeeded', 'paid'].includes(txStatus) &&
          Number(paidTx.amount_bdt || 0) + 1 >= requiredTotalBDT &&
          paidTx.invoice_id
        ) {
          const { data: linkedInv } = await db
            .from('invoices')
            .select('id, user_id, status, total_bdt, order_type, trx_id, items, handover_claimed')
            .eq('id', String(paidTx.invoice_id))
            .eq('user_id', clientUserId)
            .eq('status', 'paid')
            .maybeSingle();
          if (verifyHandoverInvoiceRow(linkedInv as Record<string, unknown> | null)) {
            paymentVerified = true;
            consumedInvoiceId = linkedInv?.id ? String(linkedInv.id) : null;
          }
        }
      }

      if (!paymentVerified && payFromWallet === true) {
        const chargeRes = await chargeWalletAtomic({
          db,
          userId: clientUserId,
          amountBDT: requiredTotalBDT,
          description: `Agency Handover Claim: ${String(existingHo.project_title || handoverToken)}`,
          orderType: 'agency_handover',
          planId: existingHo.plan_slug ? String(existingHo.plan_slug) : null,
        });
        if (!chargeRes.ok) {
          return NextResponse.json(
            { error: chargeRes.error || 'Wallet settlement failed.', code: 'PAYMENT_REQUIRED' },
            { status: chargeRes.statusCode || 402 }
          );
        }
        paymentVerified = true;
        resolvedTrxId = chargeRes.trxId || resolvedTrxId;
      }

      if (!paymentVerified) {
        return NextResponse.json(
          {
            error: `Payment Required: Verify a paid handover invoice for ৳${requiredTotalBDT} BDT or pay via Cloud Wallet before claiming ownership.`,
            code: 'PAYMENT_REQUIRED',
            requiredAmountBDT: requiredTotalBDT,
          },
          { status: 402 }
        );
      }

      const { data: claimedRows, error: claimErr } = await db
        .from('agency_handover_transfers')
        .update({
          status: 'claimed_and_paid',
          claimed_by_user_id: clientUserId,
        })
        .eq('handover_token', handoverToken)
        .eq('status', 'pending_client_claim')
        .select('id');

      if (claimErr || !claimedRows || (Array.isArray(claimedRows) && claimedRows.length === 0)) {
        return NextResponse.json(
          { error: 'Handover claim conflict: token was already claimed.' },
          { status: 409 }
        );
      }

      if (consumedInvoiceId) {
        await db
          .from('invoices')
          .update({
            handover_claimed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', consumedInvoiceId);
      }

      if (existingHo.service_id) {
        await db
          .from('hosting_services')
          .update({
            user_id: clientUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingHo.service_id);
      }
    }

    const cached = inMemoryHandovers.get(handoverToken);
    if (cached) {
      cached.status = 'claimed_and_paid';
      cached.claimed_by_user_id = clientUserId;
      inMemoryHandovers.set(handoverToken, cached);
    }

    return NextResponse.json({
      success: true,
      message: 'Project claimed and service ownership successfully transferred to client account.',
      trxId: resolvedTrxId || `CLAIM-${Date.now()}`,
    });
  } catch (error: unknown) {
    console.error('[Handover Claim Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process handover claim' },
      { status: 500 }
    );
  }
}
