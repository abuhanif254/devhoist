import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { AUTH_TOKEN_COOKIE, SUDO_TOKEN_COOKIE } from '@/lib/authGuard';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing Bearer access token' },
        { status: 401 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, mock: true });
    }

    // Verify token with Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authErr?.message || 'Invalid session token' },
        { status: 401 }
      );
    }

    const authUser = authData.user;
    const userId = authUser.id;
    const cleanEmail = authUser.email ? authUser.email.trim().toLowerCase() : '';
    const fullName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.user_metadata?.user_name ||
      cleanEmail.split('@')[0] ||
      'DevHost User';

    const db = getServiceSupabase();

    // Check if profile exists (never overwrite role or wallet balance!)
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id, role, wallet_balance_bdt')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // New user registration via OAuth
      await db.from('profiles').insert({
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        role: 'client', // Strictly client!
        wallet_balance_bdt: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await db.from('customer_developer_profiles').upsert(
        {
          user_id: userId,
          account_type: 'individual',
          default_datacenter_region: 'sg1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      await db.from('user_security_credentials').upsert(
        {
          user_id: userId,
          totp_enabled: false,
          email_2fa_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } else {
      // Existing user: Update name/timestamp only; NEVER touch role or wallet balance!
      await db
        .from('profiles')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    const isSecureCookie =
      request.nextUrl.protocol === 'https:' ||
      request.headers.get('x-forwarded-proto') === 'https';

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: cleanEmail,
        role: existingProfile?.role || 'client',
      },
    });

    response.cookies.set(AUTH_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookie,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    console.error('[Sync Session Fatal Error]:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message || 'Failed to sync session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const isSecureCookie =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https';

  const response = NextResponse.json({ success: true });
  const clearOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecureCookie,
    path: '/',
    maxAge: 0,
  };
  response.cookies.set(AUTH_TOKEN_COOKIE, '', clearOpts);
  response.cookies.set(SUDO_TOKEN_COOKIE, '', clearOpts);
  return response;
}
