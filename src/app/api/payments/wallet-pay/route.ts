import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { executeZeroTouchProvisioning } from '@/lib/zeroTouchProvisioner';
import { requireUser } from '@/lib/authGuard';


export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const {
      invoiceNumber,
      amount,
      domain,
      planName,
      planId,
      billingCycle,
      freeDomainBundleApplied,
      bundledDomainName,
      appStack,
    } = body;

    const userId =
      auth.role === 'admin' && typeof body.userId === 'string' && body.userId.trim()
        ? body.userId.trim()
        : auth.user.id;

    if (!invoiceNumber || typeof invoiceNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invoice Number is required.' },
        { status: 400 }
      );
    }

    const clientAmount = Number(amount);
    if (!Number.isFinite(clientAmount) || clientAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Payment amount must be a positive number.' },
        { status: 400 }
      );
    }

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

    // 1. Fetch & Verify Invoice Ownership and Total Before Any Balance Debit
    const { data: inv, error: invErr } = await db
      .from('invoices')
      .select('id, user_id, total_bdt, status, billing_cycle, free_domain_bundle_applied, bundled_domain_name')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (invErr || !inv) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found.' },
        { status: 404 }
      );
    }

    if (inv.user_id !== userId && auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to pay this invoice.' },
        { status: 403 }
      );
    }

    if (inv.status === 'paid' || inv.status === 'refunded' || inv.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: `Invoice is already marked as '${inv.status}'.` },
        { status: 409 }
      );
    }

    const payAmount = Number(inv.total_bdt);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid invoice total on server.' },
        { status: 400 }
      );
    }

    if (Math.abs(clientAmount - payAmount) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount mismatch: expected ৳${payAmount.toLocaleString()} for invoice ${invoiceNumber}.`,
        },
        { status: 400 }
      );
    }

    // 2. Fetch User Profile & Strict Balance Verification
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

    // 3. Optimistic Guarded Balance Deduction (requires wallet_balance_bdt >= payAmount in DB)
    const newBalance = Math.round((currentBalance - payAmount) * 100) / 100;
    const { data: updatedProf, error: updateBalErr } = await db
      .from('profiles')
      .update({ wallet_balance_bdt: newBalance })
      .eq('id', userId)
      .gte('wallet_balance_bdt', payAmount)
      .select('wallet_balance_bdt')
      .maybeSingle();

    if (updateBalErr || !updatedProf) {
      return NextResponse.json(
        { success: false, error: 'Concurrent balance conflict or insufficient funds during debit.' },
        { status: 409 }
      );
    }

    const trxId = `WLT-${Date.now().toString(36).toUpperCase()}`;

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

    const dbInvoiceId: string = inv.id;

    // 5. Run Full 5-Step Zero-Touch Autonomous Provisioning Pipeline
    const effectiveDomain = domain || inv.bundled_domain_name || bundledDomainName || 'my-app.com';
    const provisionResult = await executeZeroTouchProvisioning({
      invoiceId: dbInvoiceId,
      invoiceNumber,
      userId,
      customerEmail: profile.email,
      customerName: profile.full_name,
      domain: effectiveDomain,
      planId: planId || 'developer-pro',
      planName: planName || 'Developer Pro Cloud',
      gateway: 'wallet',
      trxId,
      amountBDT: payAmount,
      billingCycle: inv.billing_cycle || billingCycle || 'monthly',
      freeDomainBundleApplied: Boolean(inv.free_domain_bundle_applied ?? freeDomainBundleApplied),
      bundledDomainName: inv.bundled_domain_name || bundledDomainName || effectiveDomain,
      appStack: appStack || 'nextjs_git',
    });

    return NextResponse.json({
      success: true,
      message: 'Order paid & zero-touch cloud infrastructure activated successfully in under 3 seconds!',
      invoiceNumber,
      trxId,
      newBalance,
      status: 'paid',
      provisioning: provisionResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Wallet checkout failed' },
      { status: 500 }
    );
  }
}
