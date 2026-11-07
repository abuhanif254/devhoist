import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';


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
      // No server query params provided.
      // This happens when Supabase returns an Implicit OAuth token in the URL hash fragment (#access_token=...)!
      // Since hash fragments are never sent to the server in HTTP GET, we render an ultra-fast client-side HTML bridge.
      // The bridge inspects window.location.hash, ensures the Supabase session is established, syncs profile, and redirects to dashboard.
      const htmlBridge = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Securing Cloud Session | DevHost Cloud</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { text-align: center; padding: 2.5rem; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 90%; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 0.8s linear infinite; margin: 0 auto 1.25rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div style="font-weight: 600; font-size: 1.15rem; letter-spacing: -0.02em;">Securing Cloud Session...</div>
    <div style="color: #a1a1aa; font-size: 0.875rem; margin-top: 0.5rem;" id="msg">Finalizing credentials & connecting to dashboard</div>
  </div>
  <script>
    (async function() {
      try {
        const hash = window.location.hash;
        const targetNext = ${JSON.stringify(sanitizedNext)};
        
        if (hash && (hash.includes('access_token=') || hash.includes('refresh_token='))) {
          const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const errorDesc = hashParams.get('error_description') || hashParams.get('error');

          if (errorDesc) {
            window.location.replace('/login?error=' + encodeURIComponent(errorDesc));
            return;
          }

          if (accessToken) {
            // Save tokens directly into localStorage so supabase-js client picks them up
            try {
              const storageKey = 'sb-' + ('senlgfzhomodiyhnclfg') + '-auth-token';
              const sessionPayload = {
                access_token: accessToken,
                refresh_token: refreshToken || '',
                token_type: 'bearer',
                expires_in: 3600,
                expires_at: Math.floor(Date.now() / 1000) + 3600
              };
              localStorage.setItem(storageKey, JSON.stringify(sessionPayload));
            } catch (err) {
              console.warn('Storage sync notice:', err);
            }

            // Sync user profile on server
            try {
              await fetch('/api/auth/sync-session', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + accessToken
                },
                body: JSON.stringify({ refresh_token: refreshToken })
              });
            } catch (err) {
              console.warn('Sync server notice:', err);
            }

            window.location.replace(targetNext.startsWith('/') ? targetNext : '/dashboard');
            return;
          }
        }
        
        // No hash credentials found, redirect to login
        window.location.replace('/login');
      } catch (e) {
        window.location.replace('/login?error=auth_failed');
      }
    })();
  </script>
</body>
</html>`;
      return new NextResponse(htmlBridge, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
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
