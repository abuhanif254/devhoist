/**
 * DEVHOST CLOUD - AUTHENTICATION & SECURITY GUARDS
 * Disposable email prevention, brute-force lockout, and redirect sanitization
 */

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'trashmail.com',
  'throwawaymail.com',
  'getairmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'mytemp.email',
  'tempail.com',
  'mohmal.com',
  'crazymailing.com',
  'burnermail.io',
  'fakemailgenerator.com',
]);

/**
 * Checks if an email address belongs to a known temporary/disposable provider
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  // Pattern detection for dynamic temporary domains
  const suspiciousKeywords = ['tempmail', 'disposable', 'throwaway', 'burnermail', 'trashmail'];
  return suspiciousKeywords.some((keyword) => domain.includes(keyword));
}

/**
 * Strict Open-Redirect Sanitizer (Guarantees local relative paths only)
 */
export function sanitizeRedirect(target: string | null | undefined): string {
  if (!target) return '/dashboard';
  const trimmed = target.trim();
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

/**
 * Client-Side Brute-Force Lockout Tracker
 * Tracks consecutive failed attempts in localStorage.
 * Locks for 15 minutes after 5 consecutive failures.
 */
const ATTEMPTS_STORAGE_KEY = 'devhost_auth_failed_attempts';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutState {
  count: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

export function getClientLockoutState(): { isLocked: boolean; remainingSeconds: number; attemptCount: number } {
  if (typeof window === 'undefined') {
    return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
  }

  try {
    const raw = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };

    const state: LockoutState = JSON.parse(raw);
    const now = Date.now();

    if (state.lockedUntil && state.lockedUntil > now) {
      const remainingSeconds = Math.ceil((state.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attemptCount: state.count };
    }

    // Reset if lockout expired
    if (state.lockedUntil && state.lockedUntil <= now) {
      localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
      return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
    }

    return { isLocked: false, remainingSeconds: 0, attemptCount: state.count };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
  }
}

export function recordClientFailedAttempt(): { isLocked: boolean; remainingSeconds: number; attemptCount: number } {
  if (typeof window === 'undefined') {
    return { isLocked: false, remainingSeconds: 0, attemptCount: 1 };
  }

  try {
    const raw = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    const now = Date.now();
    let state: LockoutState = raw
      ? JSON.parse(raw)
      : { count: 0, lockedUntil: null, lastAttempt: now };

    state.count += 1;
    state.lastAttempt = now;

    if (state.count >= MAX_FAILED_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_DURATION_MS;
      localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(state));
      return {
        isLocked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attemptCount: state.count,
      };
    }

    localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(state));
    return { isLocked: false, remainingSeconds: 0, attemptCount: state.count };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attemptCount: 1 };
  }
}

export function resetClientFailedAttempts(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
  } catch {}
}
