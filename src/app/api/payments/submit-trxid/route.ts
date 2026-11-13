import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { notifyManualPaymentVerification } from '@/lib/adminNotifier';
import { requireUser } from '@/lib/authGuard';


const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;
const TRX_ID_REGEX = /^[A-Z0-9]{8,12}$/;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const {
      invoiceNumber,
      senderNumber,
      trxId,
      gateway = 'bKash',
      customerName,
      amount,
    } = body;

    const resolvedUserId =
      auth.role === 'admin' && typeof body.userId === 'string' && body.userId.trim()
        ? body.userId.trim()
        : auth.user.id;
    const resolvedCustomerName =
      typeof customerName === 'string' && customerName.trim()
        ? customerName.trim()
        : auth.profile.full_name;

    if (!invoiceNumber) {
      return NextResponse.json(
        { success: false, error: 'Invoice number is required.' },
        { status: 400 }
      );
    }

    // 1. Validate Sender Mobile Number
    const cleanSender = String(senderNumber || '').trim();
    if (!BD_PHONE_REGEX.test(cleanSender)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Bangladesh mobile number. Must be 11 digits starting with 013-019 (e.g. 01712345678).',
        },
        { status: 400 }
      );
    }

    // 2. Validate Transaction ID Format
    const cleanTrx = String(trxId || '').trim().toUpperCase();
    if (!TRX_ID_REGEX.test(cleanTrx)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Transaction ID (trxID). Must be 8 to 12 alphanumeric characters (e.g. 9K72LM89QP).',
        },
        { status: 400 }
      );
    }

    let invoiceAmount = Number(amount) > 0 ? Number(amount) : 0;

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();

      // 3. Block Duplicate trxID
      const { data: existingTrx } = await db
        .from('transactions')
        .select('id, status')
        .eq('trx_id', cleanTrx)
        .maybeSingle();

      if (existingTrx) {
        return NextResponse.json(
          {
            success: false,
            error: 'This Transaction ID (trxID) has already been submitted or used. If you believe this is an error, please contact support.',
          },
          { status: 409 }
        );
      }

      // 4. Verify Invoice Ownership and Update Status to 'verifying_trxid'
      const { data: invData } = await db
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle();

      if (!invData) {
        return NextResponse.json(
          { success: false, error: 'Invoice not found.' },
          { status: 404 }
        );
      }

      if (invData.user_id !== resolvedUserId && auth.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'You do not have permission to submit payment proof for this invoice.' },
          { status: 403 }
        );
      }

      if (invData.status === 'paid' || invData.status === 'refunded') {
        return NextResponse.json(
          { success: false, error: `Invoice is already '${invData.status}'.` },
          { status: 409 }
        );
      }

      invoiceAmount = Number(invData.total_bdt) || invoiceAmount;
      await db
        .from('invoices')
        .update({
          status: 'verifying_trxid',
          trx_id: cleanTrx,
          payment_method: gateway,
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_number', invoiceNumber);

      // 5. Update associated hosting service status to 'pending' (NEVER auto-active!)
      await db
        .from('hosting_services')
        .update({ status: 'pending' })
        .eq('domain', invData?.items?.[0]?.description?.match(/[a-z0-9-]+\.[a-z]{2,}/i)?.[0] || '');

      // 6. Record in transactions queue
      await db.from('transactions').insert({
        trx_id: cleanTrx,
        invoice_number: invoiceNumber,
        user_id: invData.user_id || resolvedUserId,
        amount_bdt: invoiceAmount,
        gateway: gateway.toLowerCase(),
        status: 'pending_verification',
        raw_payload: {
          senderNumber: cleanSender,
          submittedAt: new Date().toISOString(),
          customerName: resolvedCustomerName,
        },
      });
    }

    // 7. Instant Founder Telegram Alert Notification
    try {
      await notifyManualPaymentVerification({
        customerName: resolvedCustomerName,
        invoiceId: invoiceNumber,
        amountBDT: invoiceAmount || 450,
        trxId: cleanTrx,
        gateway,
      });
    } catch (notifErr) {
      console.warn('[Telegram Notification Warning]:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment details submitted successfully! Your invoice is in the verification queue.',
      invoiceNumber,
      trxId: cleanTrx,
      status: 'verifying_trxid',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to submit payment verification' },
      { status: 500 }
    );
  }
}
