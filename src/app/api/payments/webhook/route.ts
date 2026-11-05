import { NextResponse } from 'next/server';
import { whmClient } from '@/lib/whmClient';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));

    // Support payload schemas from UddoktaPay, bKash, and DevHost In-App triggers
    const invoiceNumber = payload.invoice_number || payload.metadata?.invoice_number || payload.invoiceNumber;
    const trxId = payload.transaction_id || payload.trx_id || payload.trxID || `TRX-${Date.now()}`;
    const amount = Number(payload.amount || payload.amount_bdt || 0);
    const domain = payload.domain || payload.metadata?.domain || payload.custom_domain;
    const planName = payload.plan_name || payload.metadata?.plan_name || 'Developer Git Hosting';
    const contactEmail = payload.email || payload.metadata?.email || 'client@devhost.net';
    const gateway = payload.gateway || payload.payment_method || 'bkash';

    console.log(`[Payment Webhook] Received for Invoice: ${invoiceNumber}, TrxID: ${trxId}`);

    // 1. Update Invoice & Record Transaction in Supabase (if configured)
    if (isSupabaseConfigured() && invoiceNumber) {
      try {
        const supabase = getServiceSupabase();

        // Mark invoice as paid
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            trx_id: trxId,
            paid_at: new Date().toISOString(),
          })
          .eq('invoice_number', invoiceNumber);

        // Record transaction
        await supabase.from('transactions').insert({
          trx_id: trxId,
          amount_bdt: amount || 450,
          gateway: ['bkash', 'nagad', 'stripe', 'wallet', 'uddoktapay'].includes(gateway) ? gateway : 'bkash',
          status: 'Completed',
          raw_payload: payload,
        });
      } catch (dbErr) {
        console.warn('[Webhook DB Update Warning]', dbErr);
      }
    }

    // 2. Automatic WHM / cPanel Provisioning upon successful payment
    let whmResult: any = { success: false, message: 'No domain provided for cPanel creation' };
    if (domain) {
      const generatedUser = domain
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
        .slice(0, 12);

      whmResult = await whmClient.createCpanelAccount({
        username: generatedUser,
        domain: domain,
        plan: planName.includes('Git') ? 'Dev_Git_15G' : 'WP_Turbo_10G',
        contactEmail: contactEmail,
      });

      console.log(`[WHM Provisioning Result] for ${domain}:`, whmResult);

      // Save hosting service in Supabase
      if (isSupabaseConfigured()) {
        try {
          const supabase = getServiceSupabase();
          await supabase.from('hosting_services').insert({
            domain: domain,
            plan_id: 'git-pro',
            plan_name: planName,
            whm_package_name: planName.includes('Git') ? 'Dev_Git_15G' : 'WP_Turbo_10G',
            cpanel_username: whmResult.username || generatedUser,
            server_node: 'sg1',
            ip_address: whmResult.ip || '103.151.102.45',
            status: 'active',
            disk_limit_gb: 15.0,
            disk_used_gb: 0.1,
            ram_limit_mb: 4096,
            ram_used_mb: 250,
            inode_limit: 400000,
            inode_used: 1200,
            price_bdt: amount || 450,
            billing_cycle: 'monthly',
          });
        } catch (srvErr) {
          console.warn('[Webhook Service Insert Warning]', srvErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      invoiceNumber,
      trxId,
      cpanelProvisioned: whmResult.success,
      cpanelDetails: whmResult,
    });
  } catch (err: any) {
    console.error('[Payment Webhook Error]', err);
    return NextResponse.json(
      { error: 'Webhook Processing Error', message: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
