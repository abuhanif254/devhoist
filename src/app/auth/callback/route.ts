import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

export const runtime = 'edge';

// Strict Open-Redirect Sanitizer (Guarantees relative local paths only)
function sanitizeRedirect(target: string | null): string {
  if (!target) return '/dashboard';
  const trimmed = target.trim();
  // Must start with single '/', must NOT start with '//' or '/\', must not contain schemes (http:, javascript:, data:)
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes(':')
  ) {
    return trimmed;
  }
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const nextParam = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect');
  const sanitizedNext = sanitizeRedirect(nextParam);

  const origin = requestUrl.origin;

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.redirect(`${origin}${sanitizedNext}`);
    }

    let authUser: any = null;

    // 1. PKCE Code Exchange (Google, GitHub, and Email PKCE)
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[OAuth PKCE Exchange Error]:', error.message);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent('Authentication failed: ' + error.message)}`
        );
      }
      authUser = data.user;
    } else if (tokenHash && type) {
      // 2. Token Hash Verification (Email verification, Password recovery links)
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });
      if (error) {
        console.error('[Auth OTP Verification Error]:', error.message);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent('Verification link expired or invalid.')}`
        );
      }
      authUser = data.user;
    } else {
      // No code or token provided
      return NextResponse.redirect(`${origin}/login`);
    }

    if (!authUser) {
      return NextResponse.redirect(`${origin}/login?error=no_user_session`);
    }

    const userId = authUser.id;
    const cleanEmail = authUser.email ? authUser.email.trim().toLowerCase() : '';
    const fullName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.user_metadata?.user_name ||
      cleanEmail.split('@')[0] ||
      'DevHost User';

    const db = getServiceSupabase();

    // 3. Role-Preserving Profile Sync (CRITICAL: ZERO ADMIN OVERWRITE)
    // Check if profile exists first
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id, role, wallet_balance_bdt')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Brand new user: Default strictly to 'client' and 0 starting balance
      await db.from('profiles').insert({
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        role: 'client', // Strictly client! Never admin on registration
        wallet_balance_bdt: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Default customer developer profile
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

      // Default security credentials
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

    // 4. Mandatory 2FA Gate Check across both OAuth & Password Logins
    const { data: secCreds } = await db
      .from('user_security_credentials')
      .select('totp_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (secCreds?.totp_enabled === true) {
      // Hold user at 2-Step Verification Challenge screen before granting dashboard access
      return NextResponse.redirect(
        `${origin}/login?challenge_2fa=1&userId=${userId}&email=${encodeURIComponent(
          cleanEmail
        )}&next=${encodeURIComponent(sanitizedNext)}`
      );
    }

    // 5. Success redirect to sanitized destination
    return NextResponse.redirect(`${origin}${sanitizedNext}`);
  } catch (err: any) {
    console.error('[Auth Callback Fatal Error]:', err);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Internal authentication error. Please try again.')}`
    );
  }
}
