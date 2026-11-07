import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, supabase } from '@/lib/supabase';


export async function POST(req: NextRequest) {
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

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(fullName).trim();
    const cleanCompany = company ? String(company).trim() : '';

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Account registered successfully.',
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
    let newUserId: string | null = null;

    // 1. Try creating user via Admin API (which bypasses confirmation if service role key is present)
    try {
      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          company: cleanCompany,
        },
      });

      if (!authError && authData?.user) {
        newUserId = authData.user.id;
      } else if (authError) {
        const msg = authError.message || '';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('exists')) {
          return NextResponse.json(
            { success: false, error: 'An account with this email address already exists. Please log in.' },
            { status: 400 }
          );
        }
        // If service key is invalid or not authorized, fallback to standard signUp below
        console.warn('[Register Admin createUser notice]:', msg);
      }
    } catch (adminErr: any) {
      console.warn('[Register Admin Exception]:', adminErr?.message);
    }

    // 2. Fallback to standard signUp if Admin API was not applicable
    if (!newUserId) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
            company: cleanCompany,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || 'Registration failed.';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('exists')) {
          return NextResponse.json(
            { success: false, error: 'An account with this email address already exists. Please sign in.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { success: false, error: msg },
          { status: 400 }
        );
      }

      if (signUpData?.user) {
        newUserId = signUpData.user.id;
      }
    }

    if (!newUserId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user record. Please try again.' },
        { status: 500 }
      );
    }

    // 3. Ensure a clean profile record in public.profiles with strictly role='client' and wallet_balance_bdt=0
    try {
      await db.from('profiles').upsert(
        {
          id: newUserId,
          email: cleanEmail,
          full_name: cleanName,
          company_name: cleanCompany,
          role: 'client', // Strictly client role on registration!
          wallet_balance_bdt: 0, // Zero starting balance!
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (profileErr) {
      console.warn('[Register Profile Upsert Warning]:', profileErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
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
