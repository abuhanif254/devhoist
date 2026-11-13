import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { requireUser, serviceUnavailableResponse } from '@/lib/authGuard';
import { createFraudAlert, logSecurityAudit, validatePaymentTrxId } from '@/lib/security';
import { notifyManualPaymentVerification } from '@/lib/adminNotifier';
import { checkRateLimit } from '@/lib/edgeRateLimit';

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(req, 12, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Manual verification attempt rate limit exceeded.' },
      { status: 429 }
    );
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    const rawTrxId = String(body.trxId || '').trim();
    const senderNumber = body.senderNumber ? String(body.senderNumber).trim() : '';
    const gatewayRaw = String(body.gateway || 'bkash').toLowerCase().trim();

    if (!invoiceNumber || !rawTrxId) {
      return NextResponse.json(
        { error: 'Invoice Number and TrxID are required.' },
        { status: 400 }
      );
    }

    if (gatewayRaw !== 'bkash' && gatewayRaw !== 'nagad') {
      return NextResponse.json(
        { error: 'Manual TrxID submission only supports bKash or Nagad.' },
        { status: 400 }
      );
    }

    const trxCheck = validatePaymentTrxId(rawTrxId, gatewayRaw);
    if (!trxCheck.valid) {
      if (trxCheck.isHighRisk) {
        await createFraudAlert({
          userId: auth.user.id,
          alertType: 'duplicate_trxid',
          severity: 'critical',
          details: { invoiceNumber, trxId: trxCheck.normalizedTrxId, gateway: gatewayRaw, clientIp },
        }).catch(() => {});
      }
      return NextResponse.json(
        { error: trxCheck.error || 'Invalid Transaction ID format.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Manual MFS Verification Queue');
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        sandbox: true,
        status: 'verifying_trxid',
        invoiceNumber,
        trxId: trxCheck.normalizedTrxId,
        message: 'Transaction ID recorded in DEV_SANDBOX_MODE verification queue.',
      });
    }

    const db = getServiceSupabase();

    // Verify caller owns this invoice (or admin)
    const { data: invoice } = await db
      .from('invoices')
      .select('id, user_id, invoice_number, total_bdt, status')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    if (invoice.user_id !== auth.user.id && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: you do not own this invoice.' },
        { status: 403 }
      );
    }

    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'This invoice is already marked as paid.' },
        { status: 409 }
      );
    }

    // DB-level duplicate TrxID detection across restarts / edge isolates
    const { data: dupTx } = await db
      .from('transactions')
      .select('id, invoice_number, status')
      .eq('trx_id', trxCheck.normalizedTrxId)
      .maybeSingle();

    if (dupTx) {
      await createFraudAlert({
        userId: auth.user.id,
        alertType: 'duplicate_trxid',
        severity: 'critical',
        details: {
          reason: 'Replayed MFS TrxID attempted across invoices',
          attemptedInvoice: invoiceNumber,
          existingInvoice: dupTx.invoice_number,
          trxId: trxCheck.normalizedTrxId,
          clientIp,
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          error: 'This Transaction ID has already been submitted or claimed on another order.',
        },
        { status: 409 }
      );
    }

    const authoritativeTotal = Number(invoice.total_bdt || body.amountBDT || 0);

    const { error: txErr } = await db.from('transactions').insert({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      user_id: auth.user.id,
      gateway: gatewayRaw,
      trx_id: trxCheck.normalizedTrxId,
      amount_bdt: authoritativeTotal,
      status: 'pending_verification',
      raw_payload: {
        submittedByUserId: auth.user.id,
        sender_number: senderNumber || null,
        clientIp,
        submittedAt: new Date().toISOString(),
      },
    });

    if (txErr) {
      if (txErr.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate Transaction ID detected.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Failed to submit TrxID: ${txErr.message}` },
        { status: 500 }
      );
    }

    await db
      .from('invoices')
      .update({
        status: 'verifying_trxid',
        payment_method: `${gatewayRaw}_manual`,
        trx_id: trxCheck.normalizedTrxId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    await logSecurityAudit({
      actorId: auth.user.id,
      actorRole: auth.role,
      actionType: 'MANUAL_TRXID_SUBMITTED',
      targetResource: invoiceNumber,
      ipAddress: clientIp,
      riskLevel: 'low',
      metadata: {
        gateway: gatewayRaw,
        trxId: trxCheck.normalizedTrxId,
        amountBDT: authoritativeTotal,
        senderNumber: senderNumber || undefined,
      },
    }).catch(() => {});

    notifyManualPaymentVerification({
      customerName: auth.profile.full_name,
      invoiceId: invoiceNumber,
      amountBDT: authoritativeTotal,
      trxId: trxCheck.normalizedTrxId,
      gateway: gatewayRaw,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: 'verifying_trxid',
      invoiceNumber,
      trxId: trxCheck.normalizedTrxId,
      amountBDT: authoritativeTotal,
      message: `Transaction ID ${trxCheck.normalizedTrxId} submitted for verification. Activation follows approval.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Manual TrxID submission failed' },
      { status: 500 }
    );
  }
}
