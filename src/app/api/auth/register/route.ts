import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, company } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Full name, email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Registration simulated in offline mode.',
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

    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        company: company || '',
      },
    });

    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // 2. Ensure clean profile row in public.profiles with STRICTLY role='client' and wallet_balance_bdt=0
    const { error: profileError } = await db.from('profiles').upsert(
      {
        id: newUserId,
        email: cleanEmail,
        full_name: cleanName,
        company_name: company || '',
        role: 'client', // Strictly client! Never admin on registration
        wallet_balance_bdt: 0, // Strictly 0 starting balance!
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.warn('[Register Profile Creation Warning]:', profileError);
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
      { success: false, error: err.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
