import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, isDevSandboxMode, getServiceSupabase, supabase } from '@/lib/supabase';
import { serviceUnavailableResponse } from '@/lib/authGuard';
import { checkRateLimit } from '@/lib/edgeRateLimit';
import { resolveSiteOrigin } from '@/lib/paymentGateways';


export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Please try again in ${rateLimit.reset} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } }
    );
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload received.' },
        { status: 400 }
      );
    }

    const { email, password, fullName, company } = body || {};

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Full name, email address, and password are required.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const cleanName = String(fullName).trim();
    const cleanCompany = company ? String(company).trim() : '';

    if (!isSupabaseConfigured()) {
      if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Account Registration');
      }
      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        message: 'Account created in sandbox mode. Email verification required in production.',
        user: {
          id: `usr_${Date.now()}`,
          email: cleanEmail,
          fullName: cleanName,
          role: 'client',
          walletBalanceBDT: 0,
        },
      });
    }

    const db = getServiceSupabase();
    const siteOrigin = resolveSiteOrigin(req.nextUrl?.origin);

    // Execute standard Supabase email-confirmed sign-up flow (never auto-verify emails via admin API)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${siteOrigin}/login?verified=1`,
        data: {
          full_name: cleanName,
          company: cleanCompany,
        },
      },
    });

    if (signUpError) {
      const msg = signUpError.message || 'Registration failed.';
      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('exists')
      ) {
        return NextResponse.json(
          { success: false, error: 'An account with this email address already exists. Please sign in.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    // Supabase returns an empty identities array when email confirmation is on and email already exists
    if (
      signUpData?.user &&
      Array.isArray(signUpData.user.identities) &&
      signUpData.user.identities.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    const newUserId = signUpData?.user?.id || null;
    if (!newUserId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user record. Please try again.' },
        { status: 500 }
      );
    }

    // Ensure a clean profile record in public.profiles with strictly role='client' and wallet_balance_bdt=0
    try {
      await db.from('profiles').upsert(
        {
          id: newUserId,
          email: cleanEmail,
          full_name: cleanName,
          company_name: cleanCompany,
          role: 'client',
          wallet_balance_bdt: 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (profileErr) {
      console.warn('[Register Profile Upsert Warning]:', profileErr);
    }

    const requiresVerification = !signUpData.session;
    return NextResponse.json({
      success: true,
      requiresEmailVerification: requiresVerification,
      message: requiresVerification
        ? 'Account created! Please confirm your email address via the verification link we sent before logging in.'
        : 'Account created successfully! You can now log in.',
      user: {
        id: newUserId,
        email: cleanEmail,
        fullName: cleanName,
        role: 'client',
        walletBalanceBDT: 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal registration service encountered an error. Please try again.',
      },
      { status: 500 }
    );
  }
}
