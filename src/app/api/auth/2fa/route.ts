import { NextRequest, NextResponse } from 'next/server';
import {
  generateBase32Secret,
  generateTotpUri,
  generateTotpToken,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
  hashSecurityPin,
  verifySecurityPin,
  generateQrCodeSvg,
  sha256Hex,
} from '@/lib/totpEngine';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // -------------------------------------------------------------------------
    // ACTION 1: SETUP 2FA (Generate Secret, OTP URI, SVG QR Code & Recovery Codes)
    // -------------------------------------------------------------------------
    if (action === 'setup') {
      const email = body.email || 'client@devhostcloud.com';
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
    // ACTION 2: ENABLE 2FA (Confirm initial code & activate in database)
    // -------------------------------------------------------------------------
    if (action === 'enable') {
      const { secretBase32, token, backupHashes, sudoPin, userId } = body;

      if (!secretBase32 || !token) {
        return NextResponse.json(
          { error: 'Secret and verification code are required' },
          { status: 400 }
        );
      }

      // Verify the code against the newly generated secret
      const isValid = await verifyTotpCode(secretBase32, token);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid 6-digit verification code. Please check your authenticator clock and try again.' },
          { status: 422 }
        );
      }

      let pinHash = null;
      if (sudoPin && /^\d{6}$/.test(sudoPin)) {
        pinHash = await hashSecurityPin(sudoPin);
      }

      // Update in Supabase if configured and userId provided
      if (isSupabaseConfigured() && userId) {
        const db = getServiceSupabase();
        try {
          await db
            .from('user_security_credentials')
            .upsert({
              user_id: userId,
              totp_enabled: true,
              totp_secret_base32: secretBase32,
              backup_recovery_hashes: backupHashes || [],
              sudo_security_pin_hash: pinHash,
              last_sudo_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
        } catch (err: any) {
          console.warn('[2FA Enable DB Error]:', err);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Two-Step Verification (TOTP) successfully activated.',
        totpEnabled: true,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: VERIFY 2FA (Login Challenge or Sudo Verification)
    // -------------------------------------------------------------------------
    if (action === 'verify' || action === 'verify_sudo') {
      const { token, secretBase32, backupCode, sudoPin, storedPinHash, storedBackupHashes, userId } = body;

      let verified = false;
      let verificationMethod = '';
      let remainingHashes = storedBackupHashes || [];

      // Method 1: TOTP Code
      if (token && secretBase32) {
        verified = await verifyTotpCode(secretBase32, token);
        if (verified) verificationMethod = 'totp';
      }

      // Method 2: Sudo PIN
      if (!verified && sudoPin && storedPinHash) {
        verified = await verifySecurityPin(sudoPin, storedPinHash);
        if (verified) verificationMethod = 'sudo_pin';
      }

      // Method 3: Backup Recovery Code
      if (!verified && backupCode && storedBackupHashes && storedBackupHashes.length > 0) {
        const backupResult = await verifyBackupCode(backupCode, storedBackupHashes);
        if (backupResult.valid) {
          verified = true;
          verificationMethod = 'backup_code';
          remainingHashes = backupResult.remainingHashedCodes;

          // Update consumed backup code in Supabase
          if (isSupabaseConfigured() && userId) {
            const db = getServiceSupabase();
            try {
              await db
                .from('user_security_credentials')
                .update({
                  backup_recovery_hashes: remainingHashes,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);
            } catch {}
          }
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

      // Update last sudo verified time
      if (isSupabaseConfigured() && userId) {
        const db = getServiceSupabase();
        try {
          await db
            .from('user_security_credentials')
            .update({
              last_sudo_verified_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
        } catch {}
      }

      const sudoExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return NextResponse.json({
        success: true,
        verificationMethod,
        sudoExpiresAt,
        remainingBackupCodesCount: remainingHashes.length,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 4: DISABLE 2FA
    // -------------------------------------------------------------------------
    if (action === 'disable') {
      const { userId, sudoPin, storedPinHash, token, secretBase32 } = body;

      let authorized = false;
      if (token && secretBase32) {
        authorized = await verifyTotpCode(secretBase32, token);
      }
      if (!authorized && sudoPin && storedPinHash) {
        authorized = await verifySecurityPin(sudoPin, storedPinHash);
      }

      if (!authorized) {
        return NextResponse.json(
          { error: 'Security authorization required to disable 2FA' },
          { status: 403 }
        );
      }

      if (isSupabaseConfigured() && userId) {
        const db = getServiceSupabase();
        try {
          await db
            .from('user_security_credentials')
            .update({
              totp_enabled: false,
              totp_secret_base32: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'Two-Step Verification (TOTP) disabled.',
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 5: TEST S2S CONVERSION POSTBACK WEBHOOK (Affiliate Partner Tools)
    // -------------------------------------------------------------------------
    if (action === 'test_postback') {
      const { webhookUrl, subId = 'fb_campaign_devhost', payoutAmount = 450 } = body;

      if (!webhookUrl || !webhookUrl.startsWith('http')) {
        return NextResponse.json(
          { error: 'A valid HTTP/HTTPS Webhook URL is required' },
          { status: 400 }
        );
      }

      // Format test URL by replacing macro placeholders
      const parsedUrl = webhookUrl
        .replace(/{subid}/gi, encodeURIComponent(subId))
        .replace(/{payout}/gi, encodeURIComponent(payoutAmount.toString()))
        .replace(/{order_id}/gi, 'TEST_ORDER_9918');

      const startTime = Date.now();
      try {
        const pingRes = await fetch(parsedUrl, {
          method: 'GET',
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
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          testedUrl: parsedUrl,
          error: err?.message || 'Failed to reach postback webhook endpoint',
        });
      }
    }

    return NextResponse.json({ error: 'Unsupported 2FA action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal 2FA engine error' },
      { status: 500 }
    );
  }
}
