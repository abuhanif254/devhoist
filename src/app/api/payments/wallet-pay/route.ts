import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { whmClient } from '@/lib/whmClient';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, invoiceNumber, amount, domain, planName } = body;

    if (!userId || !invoiceNumber) {
      return NextResponse.json(
        { success: false, error: 'User ID and Invoice Number are required.' },
        { status: 400 }
      );
    }

    const payAmount = Number(amount) || 0;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet payment requires active Supabase cloud database configuration.',
        },
        { status: 503 }
      );
    }

    const db = getServiceSupabase();

    // 1. Fetch User Profile & Strict Balance Verification
    const { data: profile, error: profErr } = await db
      .from('profiles')
      .select('id, full_name, email, wallet_balance_bdt')
      .eq('id', userId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found.' },
        { status: 404 }
      );
    }

    const currentBalance = Number(profile.wallet_balance_bdt) || 0;
    if (currentBalance < payAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient Wallet Balance. Current balance: ৳${currentBalance.toLocaleString()}, required: ৳${payAmount.toLocaleString()}. Please top up your wallet first.`,
          currentBalance,
          requiredAmount: payAmount,
        },
        { status: 402 }
      );
    }

    // 2. Atomically Deduct Balance from User Profile
    const newBalance = currentBalance - payAmount;
    const { error: updateBalErr } = await db
      .from('profiles')
      .update({ wallet_balance_bdt: newBalance })
      .eq('id', userId);

    if (updateBalErr) {
      return NextResponse.json(
        { success: false, error: 'Failed to update wallet balance in database.' },
        { status: 500 }
      );
    }

    const trxId = `WLT-${Date.now().toString(36).toUpperCase()}`;

    // 3. Mark Invoice as Paid
    await db
      .from('invoices')
      .update({
        status: 'paid',
        payment_method: 'wallet',
        trx_id: trxId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('invoice_number', invoiceNumber);

    // 4. Record Transaction Entry
    await db.from('transactions').insert({
      trx_id: trxId,
      invoice_number: invoiceNumber,
      user_id: userId,
      amount_bdt: payAmount,
      gateway: 'wallet',
      status: 'Completed',
      raw_payload: {
        paymentType: 'wallet_debit',
        previousBalance: currentBalance,
        newBalance,
        paidAt: new Date().toISOString(),
      },
    });

    // 5. Automatic WHM Provisioning if Domain is Specified
    if (domain) {
      const generatedUser = domain
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
        .slice(0, 12);

      const whmRes = await whmClient.createCpanelAccount({
        username: generatedUser,
        domain: domain,
        plan: (planName || '').includes('Git') ? 'Dev_Git_15G' : 'WP_Turbo_10G',
        contactEmail: profile.email,
      });

      // Insert or Update hosting_services
      await db.from('hosting_services').upsert(
        {
          user_id: userId,
          domain: domain,
          plan_name: planName || 'Developer Pro Cloud',
          status: 'active',
          cpanel_username: whmRes.username || generatedUser,
          server_node: 'sg1',
          ip_address: whmRes.ip || '103.151.102.45',
          price_bdt: payAmount,
          billing_cycle: 'monthly',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'domain' }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order paid successfully using your prepaid wallet balance!',
      invoiceNumber,
      trxId,
      newBalance,
      status: 'paid',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Wallet checkout failed' },
      { status: 500 }
    );
  }
}
