// ==============================================================================
// DEVHOST CLOUD PLATFORM - ZERO-TRUST ANTI-FRAUD & SECURITY ENGINE
// Compatible with Cloudflare Edge Runtime / Standard Web Crypto APIs
// ==============================================================================

import { getServiceSupabase, isSupabaseConfigured } from './supabase';

// ------------------------------------------------------------------------------
// 1. DISPOSABLE & TEMPORARY EMAIL DOMAINS BLOCKLIST (50+ DOMAINS)
// ------------------------------------------------------------------------------
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'sharklasers.com', 'dispostable.com', 'fakeinbox.com',
  'throwawaymail.com', 'trashmail.com', 'getnada.com', 'inboxkitten.com',
  'mytemp.email', 'tempail.com', 'mohmal.com', 'burnermail.io',
  'crazymailing.com', 'generator.email', 'temp-mail.org', 'dropmail.me',
  'nada.ltd', 'emailfake.com', 'emailondeck.com', 'fake-box.com',
  'tempmailaddress.com', 'minuteinbox.com', 'luxusmail.xyz', 'tempinbox.com',
  'maildrop.cc', 'harakirimail.com', 'trashmail.net', 'fakemailgenerator.com',
  'guerrillamailblock.com', 'guerrillamail.net', 'guerrillamail.org', 'pokemail.net',
  'grr.la', 'spam4.me', 'spambox.us', 'binkmail.com', 'safetymail.info',
  'disposablemail.com', 'tempmailer.com', 'throwawayemailaddress.com', 'mailsac.com',
  'armyspy.com', 'cuvox.de', 'dayrep.com', 'fleckens.hu', 'gustr.com',
  'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us', 'tinypulse.net',
]);

export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

// ------------------------------------------------------------------------------
// 2. STRONG PASSWORD POLICY & BREACH DEFENSE
// ------------------------------------------------------------------------------
const COMMON_WEAK_PASSWORDS = new Set([
  '12345678', 'password', 'password123', 'admin123', 'qwerty123',
  'devhost123', 'bangladesh', 'bangladesh123', '1234567890', 'admin@123',
  'welcome123', 'letmein123', 'changeme', 'iloveyou', 'pass1234',
]);

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0 - 100
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 25;
  }

  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common and easily guessed by hackers');
    return { valid: false, score: 10, errors };
  }

  if (/[A-Z]/.test(password)) {
    score += 25;
  } else {
    errors.push('Must contain at least one uppercase letter (A-Z)');
  }

  if (/[a-z]/.test(password)) {
    score += 20;
  } else {
    errors.push('Must contain at least one lowercase letter (a-z)');
  }

  if (/[0-9]/.test(password)) {
    score += 15;
  } else {
    errors.push('Must contain at least one number (0-9)');
  }

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    score += 15;
  } else {
    errors.push('Must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    score: Math.min(100, score),
    errors,
  };
}

// ------------------------------------------------------------------------------
// 3. BRUTE-FORCE RATE LIMITER & 15-MINUTE LOCKOUT
// ------------------------------------------------------------------------------
interface LockoutEntry {
  attempts: number;
  lockedUntil: number;
  lastAttemptAt: number;
}

// In-memory Edge sliding-window cache (per isolate)
const loginAttemptCache = new Map<string, LockoutEntry>();

export function checkBruteForceLockout(identifier: string): {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
} {
  const key = identifier.toLowerCase().trim();
  const entry = loginAttemptCache.get(key);
  const now = Date.now();

  if (!entry) {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }

  // Check if locked
  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds, attempts: entry.attempts };
  }

  // Reset if window expired (15 minutes of inactivity)
  if (now - entry.lastAttemptAt > 15 * 60 * 1000) {
    loginAttemptCache.delete(key);
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }

  return { isLocked: false, remainingSeconds: 0, attempts: entry.attempts };
}

export function recordFailedLogin(identifier: string): {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
} {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const entry = loginAttemptCache.get(key) || {
    attempts: 0,
    lockedUntil: 0,
    lastAttemptAt: now,
  };

  entry.attempts += 1;
  entry.lastAttemptAt = now;

  // 5 failed attempts within 15 minutes triggers a 15-minute lockout
  if (entry.attempts >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000;
    loginAttemptCache.set(key, entry);

    // Record high-severity fraud alert
    createFraudAlert({
      alertType: 'brute_force_ip',
      severity: 'critical',
      details: {
        target: identifier,
        attempts: entry.attempts,
        lockoutDurationMinutes: 15,
      },
    }).catch(() => {});

    return {
      isLocked: true,
      remainingSeconds: 15 * 60,
      attempts: entry.attempts,
    };
  }

  loginAttemptCache.set(key, entry);
  return {
    isLocked: false,
    remainingSeconds: 0,
    attempts: entry.attempts,
  };
}

export function clearLoginAttempts(identifier: string) {
  loginAttemptCache.delete(identifier.toLowerCase().trim());
}

// ------------------------------------------------------------------------------
// 4. bKASH & NAGAD trxID ANTI-FRAUD VALIDATOR
// ------------------------------------------------------------------------------
const usedTrxIdCache = new Set<string>();
const failedTrxSubmissionCounter = new Map<string, number>();

export interface TrxValidationResult {
  valid: boolean;
  normalizedTrxId: string;
  gateway: 'bkash' | 'nagad' | 'stripe' | 'wallet' | 'unknown';
  error?: string;
  isHighRisk?: boolean;
}

export function validatePaymentTrxId(
  trxId: string,
  expectedGateway?: 'bkash' | 'nagad' | 'stripe' | 'wallet'
): TrxValidationResult {
  if (!trxId || typeof trxId !== 'string') {
    return { valid: false, normalizedTrxId: '', gateway: 'unknown', error: 'Transaction ID is required' };
  }

  const clean = trxId.trim().toUpperCase();

  // bKash format: Exactly 10 alphanumeric characters (e.g. "BK9A8F12X0" or "9A8F12X012")
  const isBkashFormat = /^[A-Z0-9]{10}$/.test(clean);

  // Nagad format: 8 to 14 alphanumeric characters (e.g. "NG9812A45" or "9812345678")
  const isNagadFormat = /^[A-Z0-9]{8,14}$/.test(clean);

  if (expectedGateway === 'bkash' && !isBkashFormat) {
    return {
      valid: false,
      normalizedTrxId: clean,
      gateway: 'bkash',
      error: 'Invalid bKash Transaction ID format. Must be exactly 10 alphanumeric characters (e.g. 9A8F12X012).',
    };
  }

  if (expectedGateway === 'nagad' && !isNagadFormat) {
    return {
      valid: false,
      normalizedTrxId: clean,
      gateway: 'nagad',
      error: 'Invalid Nagad Transaction ID format. Must be between 8 and 14 alphanumeric characters.',
    };
  }

  // Check for duplicate trxID reuse attempt
  if (usedTrxIdCache.has(clean)) {
    createFraudAlert({
      alertType: 'duplicate_trxid',
      severity: 'critical',
      details: {
        trxId: clean,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});

    return {
      valid: false,
      normalizedTrxId: clean,
      gateway: expectedGateway || 'bkash',
      error: 'This Transaction ID has already been claimed and used. Fraud alert logged.',
      isHighRisk: true,
    };
  }

  // Register clean trxID
  usedTrxIdCache.add(clean);

  return {
    valid: true,
    normalizedTrxId: clean,
    gateway: isBkashFormat ? 'bkash' : isNagadFormat ? 'nagad' : 'unknown',
  };
}

// ------------------------------------------------------------------------------
// 5. IMMUTABLE SECURITY AUDIT LOGGING HELPER
// ------------------------------------------------------------------------------
export interface SecurityAuditParams {
  actorId?: string;
  actorRole?: 'client' | 'admin' | 'system';
  actionType: string;
  targetResource: string;
  ipAddress?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export async function logSecurityAudit(params: SecurityAuditParams): Promise<void> {
  const payload = {
    actor_id: params.actorId || null,
    actor_role: params.actorRole || 'system',
    action_type: params.actionType,
    target_resource: params.targetResource,
    ip_address: params.ipAddress || '127.0.0.1',
    risk_level: params.riskLevel || 'low',
    metadata: params.metadata || {},
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = getServiceSupabase();
      await supabase.from('security_audit_logs').insert(payload);
    } catch (err) {
      console.warn('[Audit Log Write Notice]', err);
    }
  } else {
    // Console log fallback for local dev
    console.log(`[AUDIT_LOG] [${payload.risk_level.toUpperCase()}] ${payload.action_type} on ${payload.target_resource}`, payload);
  }
}

// ------------------------------------------------------------------------------
// 6. FRAUD & THREAT RADAR ALERT EMITTER
// ------------------------------------------------------------------------------
export interface FraudAlertParams {
  userId?: string;
  alertType: 'self_referral_attempt' | 'duplicate_trxid' | 'brute_force_ip' | 'disposable_email' | 'velocity_abuse';
  severity: 'warning' | 'critical';
  details: Record<string, unknown>;
}

export async function createFraudAlert(params: FraudAlertParams): Promise<void> {
  const payload = {
    user_id: params.userId || null,
    alert_type: params.alertType,
    severity: params.severity,
    details: params.details,
    status: 'open',
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = getServiceSupabase();
      await supabase.from('fraud_alerts').insert(payload);
    } catch (err) {
      console.warn('[Fraud Alert Write Notice]', err);
    }
  } else {
    console.warn(`[FRAUD_RADAR] [${payload.severity.toUpperCase()}] ${payload.alert_type}:`, payload.details);
  }
}
