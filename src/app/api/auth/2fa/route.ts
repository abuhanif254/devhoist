import { NextRequest, NextResponse } from 'next/server';
import {
  generateBase32Secret,
  generateTotpUri,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
  hashSecurityPin,
  verifySecurityPin,
  generateQrCodeSvg,
} from '@/lib/totpEngine';
import { getServiceSupabase } from '@/lib/supabase';
import { checkKeyedRateLimit, checkRateLimit } from '@/lib/edgeRateLimit';
import {
  requireUser,
  signSudoToken,
  verifySudoToken,
  SUDO_TOKEN_COOKIE,
  isSafeExternalHttpUrl,
} from '@/lib/authGuard';

function isSecureRequest(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https'
  );
}

/**
 * GET /api/auth/2fa
 * Returns 2FA and Sudo configuration state strictly for the authenticated session user.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const db = getServiceSupabase();
    const { data: creds, error } = await db
      .from('user_security_credentials')
      .select('totp_enabled, totp_secret_base32, backup_recovery_hashes, sudo_security_pin_hash')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error || !creds) {
      return NextResponse.json({
        enabled: false,
        hasSecret: false,
        hasBackupCodes: false,
        hasSudoPin: false,
      });
    }

    return NextResponse.json({
      enabled: Boolean(creds.totp_enabled),
      hasSecret: Boolean(creds.totp_secret_base32),
      hasBackupCodes: (creds.backup_recovery_hashes?.length || 0) > 0,
      hasSudoPin: Boolean(creds.sudo_security_pin_hash),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { enabled: false, error: err instanceof Error ? err.message : 'Unable to check 2FA status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const db = getServiceSupabase();

    // -------------------------------------------------------------------------
    // ACTION 1: SETUP 2FA (Generate Secret, OTP URI, SVG QR Code & Recovery Codes)
    // -------------------------------------------------------------------------
    if (action === 'setup') {
      const email = auth.profile.email || 'client@devhostcloud.com';
      const secretBase32 = generateBase32Secret(20);
      const otpauthUri = generateTotpUri(email, secretBase32);
      const qrCodeSvg = await generateQrCodeSvg(otpauthUri);
      const { plaintextCodes, hashedCodes } = await generateBackupCodes(10);

      return NextResponse.json({
        success: true,
        secretBase32,
        otpauthUri,
        qrCodeSvg,
        backupCodes: plaintextCodes,
        backupHashes: hashedCodes,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: ENABLE 2FA (Confirm initial code & activate for authenticated user)
    // -------------------------------------------------------------------------
    if (action === 'enable') {
      const { secretBase32, token, backupHashes, sudoPin } = body;

      if (!secretBase32 || !token) {
        return NextResponse.json(
          { error: 'Secret and verification code are required' },
          { status: 400 }
        );
      }

      const isValid = await verifyTotpCode(secretBase32, String(token));
      if (!isValid) {
        return NextResponse.json(
          {
            error:
              'Invalid 6-digit verification code. Please check your authenticator clock and try again.',
          },
          { status: 422 }
        );
      }

      const { data: existingCreds } = await db
        .from('user_security_credentials')
        .select('totp_enabled, totp_secret_base32, sudo_security_pin_hash')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      const changingExistingPin = Boolean(sudoPin && existingCreds?.sudo_security_pin_hash);
      if (existingCreds?.totp_enabled || changingExistingPin) {
        let reauthOk = await verifySudoToken(req, auth.user.id);
        if (!reauthOk && body.currentTotpToken && existingCreds?.totp_secret_base32) {
          reauthOk = await verifyTotpCode(
            String(existingCreds.totp_secret_base32),
            String(body.currentTotpToken)
          );
        }
        if (!reauthOk && body.currentSudoPin && existingCreds?.sudo_security_pin_hash) {
          reauthOk = await verifySecurityPin(
            String(body.currentSudoPin),
            String(existingCreds.sudo_security_pin_hash)
          );
        }
        if (!reauthOk) {
          return NextResponse.json(
            {
              error:
                'Sudo verification or current 2FA challenge is required before modifying existing 2FA or Sudo PIN credentials.',
            },
            { status: 403 }
          );
        }
      }

      const updatePayload: Record<string, unknown> = {
        user_id: auth.user.id,
        totp_enabled: true,
        totp_secret_base32: secretBase32,
        backup_recovery_hashes: Array.isArray(backupHashes) ? backupHashes : [],
        last_sudo_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (sudoPin && /^\d{6}$/.test(String(sudoPin))) {
        updatePayload.sudo_security_pin_hash = await hashSecurityPin(String(sudoPin));
      }

      const { error: upsertErr } = await db
        .from('user_security_credentials')
        .upsert(updatePayload, { onConflict: 'user_id' });

      if (upsertErr) {
        return NextResponse.json(
          { error: 'Failed to store 2FA credentials in database.' },
          { status: 500 }
        );
      }

      const sudoToken = await signSudoToken(auth.user.id, 900);
      const res = NextResponse.json({
        success: true,
        message: 'Two-Step Verification (TOTP) successfully activated.',
        totpEnabled: true,
      });

      res.cookies.set(SUDO_TOKEN_COOKIE, sudoToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        path: '/',
        maxAge: 900,
      });

      return res;
    }

    // -------------------------------------------------------------------------
    // ACTION 3: UPDATE MASTER 6-DIGIT SUDO PIN (Server-persisted SHA-256 hash)
    // -------------------------------------------------------------------------
    if (action === 'update_sudo_pin') {
      const sudoPin = String(body.sudoPin || '').trim();
      if (!/^\d{6}$/.test(sudoPin)) {
        return NextResponse.json(
          { error: 'Master Sudo PIN must be exactly 6 numeric digits.' },
          { status: 400 }
        );
      }

      const { data: existingCreds } = await db
        .from('user_security_credentials')
        .select('sudo_security_pin_hash, totp_enabled')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      // Changing an existing Sudo PIN (or when TOTP is enabled) requires an active Sudo session
      if (existingCreds?.sudo_security_pin_hash || existingCreds?.totp_enabled) {
        const hasValidSudo = await verifySudoToken(req, auth.user.id);
        if (!hasValidSudo) {
          return NextResponse.json(
            { error: 'Verify your current 2FA or Sudo PIN before updating your Master Sudo PIN.' },
            { status: 403 }
          );
        }
      }

      const pinHash = await hashSecurityPin(sudoPin);
      const { error: upsertErr } = await db
        .from('user_security_credentials')
        .upsert(
          {
            user_id: auth.user.id,
            sudo_security_pin_hash: pinHash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (upsertErr) {
        return NextResponse.json(
          { error: 'Failed to persist Sudo Security PIN.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Master 6-digit Sudo Security PIN updated securely.',
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 4: VERIFY 2FA OR SUDO STEP-UP (Strictly server-stored secrets only)
    // -------------------------------------------------------------------------
    if (action === 'verify' || action === 'verify_sudo') {
      const ipLimit = checkRateLimit(req, 10, 5 * 60 * 1000);
      const userLimit = checkKeyedRateLimit(`2fa_verify:${auth.user.id}`, 5, 5 * 60 * 1000);
      if (!ipLimit.allowed || !userLimit.allowed) {
        const retryAfter = Math.max(ipLimit.reset, userLimit.reset);
        return NextResponse.json(
          {
            success: false,
            error: `Too many 2FA / Sudo verification attempts. Locked for ${retryAfter} seconds.`,
          },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }

      const tokenInput = body.token || body.code;
      const sudoPinInput = body.sudoPin;
      const backupCodeInput = body.backupCode;

      const { data: creds, error: credsErr } = await db
        .from('user_security_credentials')
        .select('totp_enabled, totp_secret_base32, backup_recovery_hashes, sudo_security_pin_hash')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (credsErr || !creds) {
        return NextResponse.json(
          {
            success: false,
            error: 'No 2FA or Sudo credentials configured for your account.',
          },
          { status: 404 }
        );
      }

      let verified = false;
      let verificationMethod = '';
      let remainingHashes: string[] = Array.isArray(creds.backup_recovery_hashes)
        ? creds.backup_recovery_hashes
        : [];

      // Method 1: Authenticator TOTP Code
      if (tokenInput && creds.totp_secret_base32) {
        verified = await verifyTotpCode(creds.totp_secret_base32, String(tokenInput));
        if (verified) verificationMethod = 'totp';
      }

      // Method 2: Server-stored Master Sudo PIN
      if (!verified && sudoPinInput && creds.sudo_security_pin_hash) {
        verified = await verifySecurityPin(String(sudoPinInput), creds.sudo_security_pin_hash);
        if (verified) verificationMethod = 'sudo_pin';
      }

      // Method 3: One-Time Emergency Backup Recovery Code
      if (!verified && backupCodeInput && remainingHashes.length > 0) {
        const backupResult = await verifyBackupCode(String(backupCodeInput), remainingHashes);
        if (backupResult.valid) {
          verified = true;
          verificationMethod = 'backup_code';
          remainingHashes = backupResult.remainingHashedCodes;

          await db
            .from('user_security_credentials')
            .update({
              backup_recovery_hashes: remainingHashes,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', auth.user.id);
        }
      }

      if (!verified) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication failed. Incorrect TOTP code, Sudo PIN, or recovery code.',
          },
          { status: 401 }
        );
      }

      await db
        .from('user_security_credentials')
        .update({
          last_sudo_verified_at: new Date().toISOString(),
        })
        .eq('user_id', auth.user.id);

      const sudoExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const sudoToken = await signSudoToken(auth.user.id, 900);

      const response = NextResponse.json({
        success: true,
        verificationMethod,
        sudoExpiresAt,
        remainingBackupCodesCount: remainingHashes.length,
      });

      response.cookies.set(SUDO_TOKEN_COOKIE, sudoToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        path: '/',
        maxAge: 900,
      });

      return response;
    }

    // -------------------------------------------------------------------------
    // ACTION 5: REVOKE SUDO SESSION COOKIE
    // -------------------------------------------------------------------------
    if (action === 'revoke_sudo') {
      const response = NextResponse.json({ success: true });
      response.cookies.set(SUDO_TOKEN_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    // -------------------------------------------------------------------------
    // ACTION 6: DISABLE 2FA (Requires active verified Sudo cookie OR valid TOTP/PIN)
    // -------------------------------------------------------------------------
    if (action === 'disable') {
      const userDisableLimit = checkKeyedRateLimit(`2fa_disable:${auth.user.id}`, 5, 5 * 60 * 1000);
      if (!userDisableLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many 2FA disable attempts. Retry in ${userDisableLimit.reset} seconds.`,
          },
          { status: 429, headers: { 'Retry-After': String(userDisableLimit.reset) } }
        );
      }

      const hasActiveSudo = await verifySudoToken(req, auth.user.id);
      let authorized = hasActiveSudo;

      if (!authorized) {
        const { data: creds } = await db
          .from('user_security_credentials')
          .select('totp_secret_base32, sudo_security_pin_hash')
          .eq('user_id', auth.user.id)
          .maybeSingle();

        if (body.token && creds?.totp_secret_base32) {
          authorized = await verifyTotpCode(creds.totp_secret_base32, String(body.token));
        }
        if (!authorized && body.sudoPin && creds?.sudo_security_pin_hash) {
          authorized = await verifySecurityPin(String(body.sudoPin), creds.sudo_security_pin_hash);
        }
      }

      if (!authorized) {
        return NextResponse.json(
          { error: 'Sudo verification or valid 2FA/PIN required to disable 2FA.' },
          { status: 403 }
        );
      }

      await db
        .from('user_security_credentials')
        .update({
          totp_enabled: false,
          totp_secret_base32: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', auth.user.id);

      return NextResponse.json({
        success: true,
        message: 'Two-Step Verification (TOTP) disabled.',
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 7: TEST S2S CONVERSION POSTBACK WEBHOOK (SSRF-Hardened)
    // -------------------------------------------------------------------------
    if (action === 'test_postback') {
      const { webhookUrl, subId = 'fb_campaign_devhost', payoutAmount = 450 } = body;

      if (!webhookUrl || !isSafeExternalHttpUrl(String(webhookUrl))) {
        return NextResponse.json(
          {
            error:
              'A valid public HTTP/HTTPS Webhook URL is required (private/local addresses are blocked).',
          },
          { status: 400 }
        );
      }

      const parsedUrl = String(webhookUrl)
        .replace(/{subid}/gi, encodeURIComponent(String(subId)))
        .replace(/{payout}/gi, encodeURIComponent(String(payoutAmount)))
        .replace(/{order_id}/gi, 'TEST_ORDER_9918');

      if (!isSafeExternalHttpUrl(parsedUrl)) {
        return NextResponse.json(
          { error: 'Invalid postback destination.' },
          { status: 400 }
        );
      }

      const startTime = Date.now();
      try {
        const pingRes = await fetch(parsedUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'DevHostCloud-Affiliate-Postback/2.0',
            'X-DevHost-Event': 'conversion_test_ping',
          },
        });
        const elapsedMs = Date.now() - startTime;

        return NextResponse.json({
          success: true,
          testedUrl: parsedUrl,
          statusCode: pingRes.status,
          statusText: pingRes.statusText,
          elapsedMs,
          message: `Postback ping delivered in ${elapsedMs}ms with status HTTP ${pingRes.status}`,
        });
      } catch (err: unknown) {
        return NextResponse.json({
          success: false,
          testedUrl: parsedUrl,
          error: err instanceof Error ? err.message : 'Failed to reach postback webhook endpoint',
        });
      }
    }

    return NextResponse.json({ error: 'Unsupported 2FA action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal 2FA engine error' },
      { status: 500 }
    );
  }
}
