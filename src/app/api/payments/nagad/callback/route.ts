import { NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { serviceUnavailableResponse } from '@/lib/authGuard';
import { resolveSiteOrigin, verifyNagadPayment } from '@/lib/paymentGateways';
import { fulfillPaidInvoiceAndAffiliate } from '@/lib/paymentFulfillment';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteUrl = resolveSiteOrigin(url.origin);
  const paymentRefId =
    url.searchParams.get('payment_ref_id') || url.searchParams.get('paymentRefId') || '';
  const statusParam = (url.searchParams.get('status') || '').toLowerCase();
  const invoiceQuery = url.searchParams.get('invoice') || '';
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  if (statusParam === 'cancelled' || statusParam === 'failed' || statusParam === 'aborted') {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=${statusParam === 'cancelled' ? 'cancelled' : 'failed'}&gateway=nagad&invoice=${encodeURIComponent(invoiceQuery)}`
    );
  }

  if (!paymentRefId) {
    return NextResponse.json({ error: 'Missing Nagad payment_ref_id parameter.' }, { status: 400 });
  }

  if (!isSupabaseConfigured() && !isDevSandboxMode()) {
    return serviceUnavailableResponse('Nagad Payment Callback');
  }

  const verified = await verifyNagadPayment(paymentRefId);
  if (!verified.ok || !verified.trxId) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=failed&gateway=nagad&invoice=${encodeURIComponent(
        verified.invoiceNumber || invoiceQuery
      )}&reason=${encodeURIComponent(verified.error || 'Nagad verification failed')}`
    );
  }

  const invoiceNumber = verified.invoiceNumber || invoiceQuery;
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=success&gateway=nagad&invoice=${encodeURIComponent(invoiceNumber)}&trx=${encodeURIComponent(verified.trxId)}`
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
      `${siteUrl}/dashboard?payment=failed&gateway=nagad&reason=invoice_not_found`
    );
  }

  const expectedTotal = Number(invoice.total_bdt || 0);
  if (expectedTotal > 0 && verified.amountBDT + 1 < expectedTotal) {
    return NextResponse.redirect(
      `${siteUrl}/dashboard?payment=failed&gateway=nagad&invoice=${encodeURIComponent(invoiceNumber)}&reason=amount_mismatch`
    );
  }

  if (invoice.status !== 'paid') {
    const { error: txErr } = await db.from('transactions').insert({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      user_id: invoice.user_id || null,
      gateway: 'nagad',
      trx_id: verified.trxId,
      amount_bdt: verified.amountBDT || expectedTotal,
      status: 'Completed',
      raw_payload: {
        paymentRefId,
        clientMobileNo: verified.clientMobileNo || null,
        sender_number: verified.clientMobileNo || null,
      },
    });

    if (!txErr || txErr.code !== '23505') {
      await fulfillPaidInvoiceAndAffiliate({
        db,
        invoice,
        gateway: 'nagad',
        trxId: verified.trxId,
        amountBDT: verified.amountBDT || expectedTotal,
        buyerIp: clientIp,
        senderPhone: verified.clientMobileNo,
      });
    }
  }

  return NextResponse.redirect(
    `${siteUrl}/dashboard?payment=success&gateway=nagad&invoice=${encodeURIComponent(invoiceNumber)}&trx=${encodeURIComponent(verified.trxId)}`
  );
}
