import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { serviceUnavailableResponse } from '@/lib/authGuard';
import { executeBkashPayment, resolveSiteOrigin } from '@/lib/paymentGateways';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteUrl = resolveSiteOrigin(url.origin);
  const paymentID = url.searchParams.get('paymentID') || '';
  const statusParam = (url.searchParams.get('status') || '').toLowerCase();
  const invoiceQuery = url.searchParams.get('invoice') || '';
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  if (statusParam === 'cancel' || statusParam === 'failure') {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=${statusParam === 'cancel' ? 'cancelled' : 'failed'}&gateway=bkash&invoice=${encodeURIComponent(invoiceQuery)}`
    );
  }

  if (!paymentID) {
    return NextResponse.json({ error: 'Missing bKash paymentID parameter.' }, { status: 400 });
  }

  if (!isSupabaseConfigured() && !isDevSandboxMode()) {
    return serviceUnavailableResponse('bKash Payment Callback');
  }

  const execRes = await executeBkashPayment(paymentID);
  if (!execRes.ok || !execRes.trxID) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=failed&gateway=bkash&invoice=${encodeURIComponent(
        execRes.merchantInvoiceNumber || invoiceQuery
      )}&reason=${encodeURIComponent(execRes.error || 'bKash execute declined')}`
    );
  }

  const invoiceNumber = execRes.merchantInvoiceNumber || invoiceQuery;
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=success&gateway=bkash&invoice=${encodeURIComponent(invoiceNumber)}&trx=${encodeURIComponent(execRes.trxID)}`
    );
  }

  const db = getServiceSupabase();
  const { data: invoice } = await db
    .from('invoices')
    .select('*')
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=failed&gateway=bkash&reason=invoice_not_found`
    );
  }

  const expectedTotal = Number(invoice.total_bdt || 0);
  if (expectedTotal > 0 && execRes.amountBDT + 1 < expectedTotal) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=failed&gateway=bkash&invoice=${encodeURIComponent(invoiceNumber)}&reason=amount_mismatch`
    );
  }

  if (invoice.status !== 'paid') {
    const { error: txErr } = await db.from('transactions').insert({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      user_id: invoice.user_id || null,
      gateway: 'bkash',
      trx_id: execRes.trxID,
      amount_bdt: execRes.amountBDT || expectedTotal,
      status: 'Completed',
      raw_payload: {
        paymentID,
        customerMsisdn: execRes.customerMsisdn || null,
        sender_number: execRes.customerMsisdn || null,
      },
    });

    if (!txErr || txErr.code !== '23505') {
      await fulfillPaidInvoiceAndAffiliate({
        db,
        invoice,
        gateway: 'bkash',
        trxId: execRes.trxID,
        amountBDT: execRes.amountBDT || expectedTotal,
        buyerIp: clientIp,
        senderPhone: execRes.customerMsisdn,
      });
    }
  }

  return NextResponse.redirect(
    `${siteUrl}/dashboard?payment=success&gateway=bkash&invoice=${encodeURIComponent(invoiceNumber)}&trx=${encodeURIComponent(execRes.trxID)}`
  );
}
