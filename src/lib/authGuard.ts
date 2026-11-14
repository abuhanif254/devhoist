import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  supabase,
  getServiceSupabase,
  isSupabaseConfigured,
  hasServiceRoleKey,
} from '@/lib/supabase';

export const AUTH_TOKEN_COOKIE = 'devhost_sb_token';
export const SUDO_TOKEN_COOKIE = 'devhost_sudo_token';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPROMISED_DEFAULT_CRON_SECRET = 'devhost_cron_secret_key';

export interface AuthenticatedProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'client' | 'admin';
  wallet_balance_bdt: number;
  phone?: string;
  referral_code?: string;
}

export interface AuthSuccess {
  ok: true;
  user: User;
  profile: AuthenticatedProfile;
  role: 'client' | 'admin';
  token: string;
}

export interface AuthFailure {
  ok: false;
  response: NextResponse;
}

export interface ServiceAuthSuccess extends AuthSuccess {
  serviceId: string;
  isAdmin: boolean;
  isTeamMember: boolean;
}

export interface DomainAuthSuccess extends AuthSuccess {
  domainId?: string;
  domainName?: string;
  isAdmin: boolean;
}

/**
 * Constant-time string equality check using UTF-8 byte XOR to avoid timing side-channels.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

/**
 * Parses a named cookie value from an HTTP Cookie header safely.
 */
export function extractCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const rawVal = trimmed.slice(prefix.length);
      try {
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }
  return null;
}

/**
 * Extracts Supabase access JWT from either Authorization Bearer header or HttpOnly session cookie.
 */
export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieToken = extractCookie(req, AUTH_TOKEN_COOKIE);
  if (cookieToken && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

/**
 * Verifies a caller's Supabase JWT via supabase.auth.getUser() and resolves their DB profile role.
 */
export async function requireUser(req: Request): Promise<AuthSuccess | AuthFailure> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Service Unavailable', message: 'Authentication backend is not configured.' },
        { status: 503 }
      ),
    };
  }

  const token = extractAccessToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication session is required.' },
        { status: 401 }
      ),
    };
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired authentication session.' },
        { status: 401 }
      ),
    };
  }

  const user = authData.user;
  const db = getServiceSupabase();

  let profileRow: Record<string, unknown> | null = null;
  if (hasServiceRoleKey() || process.env.NODE_ENV !== 'production') {
    const { data } = await db
      .from('profiles')
      .select('id, email, full_name, role, wallet_balance_bdt, phone, referral_code')
      .eq('id', user.id)
      .maybeSingle();
    profileRow = data;
  } else {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'Server service role key is missing in production.',
        },
        { status: 503 }
      ),
    };
  }

  const resolvedRole: 'client' | 'admin' =
    profileRow?.role === 'admin' || profileRow?.role === 'superadmin' ? 'admin' : 'client';
  const profile: AuthenticatedProfile = {
    id: user.id,
    email: String(profileRow?.email || user.email || '').toLowerCase(),
    full_name: String(
      profileRow?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'DevHost User'
    ),
    role: resolvedRole,
    wallet_balance_bdt: Number(profileRow?.wallet_balance_bdt || 0),
    phone: profileRow?.phone ? String(profileRow.phone) : undefined,
    referral_code: profileRow?.referral_code ? String(profileRow.referral_code) : undefined,
  };

  return {
    ok: true,
    user,
    profile,
    role: resolvedRole,
    token,
  };
}

/**
 * Enforces both valid authenticated session AND strictly verified profiles.role === 'admin'.
 */
export async function requireAdmin(req: Request): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  if (auth.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Administrator privileges are required.' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Verifies user session and ownership (or granted organization team membership) for a hosting service.
 */
export async function requireServiceAccess(
  req: Request,
  serviceId: string | null | undefined,
  requiredScope?: string
): Promise<ServiceAuthSuccess | AuthFailure> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const cleanId = (serviceId || '').trim();
  if (!cleanId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Bad Request', message: 'Service ID is required.' },
        { status: 400 }
      ),
    };
  }

  if (auth.role === 'admin') {
    return {
      ...auth,
      serviceId: cleanId,
      isAdmin: true,
      isTeamMember: false,
    };
  }

  if (!UUID_REGEX.test(cleanId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Invalid or unauthorized service identifier.' },
        { status: 403 }
      ),
    };
  }

  const db = getServiceSupabase();
  const { data: srv } = await db
    .from('hosting_services')
    .select('id, user_id')
    .eq('id', cleanId)
    .maybeSingle();

  if (!srv) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Service not found or access denied.' },
        { status: 403 }
      ),
    };
  }

  if (srv.user_id === auth.user.id) {
    return {
      ...auth,
      serviceId: cleanId,
      isAdmin: false,
      isTeamMember: false,
    };
  }

  // Check active organization team membership with optional RBAC scope guard
  const { data: teamMember } = await db
    .from('organization_team_members')
    .select('invite_status, allowed_scopes, allowed_service_ids')
    .eq('owner_user_id', srv.user_id)
    .eq('member_email', auth.profile.email)
    .in('invite_status', ['accepted', 'active'])
    .maybeSingle();

  if (teamMember) {
    const allowedServices: string[] = Array.isArray(teamMember.allowed_service_ids)
      ? teamMember.allowed_service_ids
      : [];
    const allowedScopes: string[] = Array.isArray(teamMember.allowed_scopes)
      ? teamMember.allowed_scopes
      : [];

    const serviceAllowed = allowedServices.length === 0 || allowedServices.includes(cleanId);
    const scopeAllowed = !requiredScope || allowedScopes.includes(requiredScope);

    if (serviceAllowed && scopeAllowed) {
      return {
        ...auth,
        serviceId: cleanId,
        isAdmin: false,
        isTeamMember: true,
      };
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Forbidden', message: 'You do not have permission to access this hosting service.' },
      { status: 403 }
    ),
  };
}

/**
 * Verifies user session and ownership for a domain record by domainId or domainName.
 */
export async function requireDomainAccess(
  req: Request,
  identifier: { domainId?: string | null; domainName?: string | null }
): Promise<DomainAuthSuccess | AuthFailure> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const cleanDomainId = (identifier.domainId || '').trim();
  const cleanDomainName = (identifier.domainName || '').trim().toLowerCase();

  if (!cleanDomainId && !cleanDomainName) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Bad Request', message: 'Domain ID or domain name is required.' },
        { status: 400 }
      ),
    };
  }

  if (auth.role === 'admin') {
    return {
      ...auth,
      domainId: cleanDomainId || undefined,
      domainName: cleanDomainName || undefined,
      isAdmin: true,
    };
  }

  const db = getServiceSupabase();
  let query = db.from('domains').select('id, user_id, domain_name');

  if (cleanDomainId && UUID_REGEX.test(cleanDomainId)) {
    query = query.eq('id', cleanDomainId);
  } else if (cleanDomainName) {
    query = query.eq('domain_name', cleanDomainName);
  } else {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Invalid or unauthorized domain identifier.' },
        { status: 403 }
      ),
    };
  }

  const { data: domainRow } = await query.maybeSingle();
  if (!domainRow || domainRow.user_id !== auth.user.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'You do not own this domain resource.' },
        { status: 403 }
      ),
    };
  }

  return {
    ...auth,
    domainId: domainRow.id,
    domainName: domainRow.domain_name,
    isAdmin: false,
  };
}

/**
 * Authorizes scheduled cron invocations (via CRON_SECRET Bearer/header) OR verified Admin session.
 * Never accepts query-string secrets, client trigger headers, or compromised fallback secrets.
 */
export async function verifyCronOrAdmin(
  req: Request
): Promise<{ ok: true; via: 'cron_secret' | 'admin'; auth?: AuthSuccess } | AuthFailure> {
  const configuredSecret = process.env.CRON_SECRET?.trim() || '';
  const authHeader = req.headers.get('authorization') || '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const bearerSecret = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const candidate = bearerSecret || headerSecret;
  if (
    configuredSecret &&
    configuredSecret !== COMPROMISED_DEFAULT_CRON_SECRET &&
    candidate &&
    timingSafeEqualStr(candidate, configuredSecret)
  ) {
    return { ok: true, via: 'cron_secret' };
  }

  const adminCheck = await requireAdmin(req);
  if (adminCheck.ok) {
    return { ok: true, via: 'admin', auth: adminCheck };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Unauthorized', message: 'Valid CRON_SECRET or administrator session required.' },
      { status: 401 }
    ),
  };
}

// ==============================================================================
// HMAC-SHA256 SUDO STEP-UP TOKEN & WEBHOOK VERIFICATION (WEB CRYPTO)
// ==============================================================================

function getSudoSigningSecret(): string {
  const secret =
    process.env.DEVHOST_SUDO_HMAC_SECRET ||
    process.env.DEVHOST_ENV_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing server secret for cryptographic Sudo token signing.');
    }
    return 'devhost-local-dev-sudo-signing-key-nonprod';
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function computeHmacBytes(payload: string, secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return new Uint8Array(sig);
}

/**
 * Generates an HMAC-SHA256 signed token asserting verified Sudo elevation for userId.
 */
export async function signSudoToken(userId: string, ttlSeconds = 900): Promise<string> {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = JSON.stringify({ sub: userId, exp });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const sigB64 = toBase64Url(await computeHmacBytes(payloadB64, getSudoSigningSecret()));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Validates the HttpOnly Sudo elevation cookie against expectedUserId and expiration timestamp.
 */
export async function verifySudoToken(req: Request, expectedUserId: string): Promise<boolean> {
  const rawToken = extractCookie(req, SUDO_TOKEN_COOKIE);
  if (!rawToken || !rawToken.includes('.')) return false;

  const [payloadB64, sigB64] = rawToken.split('.', 2);
  if (!payloadB64 || !sigB64) return false;

  const expectedSigB64 = toBase64Url(await computeHmacBytes(payloadB64, getSudoSigningSecret()));
  if (!timingSafeEqualStr(sigB64, expectedSigB64)) return false;

  const payloadBytes = fromBase64Url(payloadB64);
  if (!payloadBytes) return false;

  try {
    const decoded = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      sub?: string;
      exp?: number;
    };
    return (
      typeof decoded.sub === 'string' &&
      decoded.sub === expectedUserId &&
      typeof decoded.exp === 'number' &&
      decoded.exp > Date.now()
    );
  } catch {
    return false;
  }
}

/**
 * Verifies hexadecimal HMAC-SHA256 signature (used for webhooks such as Stripe/UddoktaPay/GitHub).
 */
export async function verifyHmacSha256Hex(
  payloadText: string,
  expectedHexSignature: string,
  secret: string
): Promise<boolean> {
  if (!secret || !expectedHexSignature) return false;
  const sigBytes = await computeHmacBytes(payloadText, secret);
  const actualHex = Array.from(sigBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqualStr(actualHex.toLowerCase(), expectedHexSignature.trim().toLowerCase());
}

function isPrivateOrReservedIpv4Octets(octets: number[]): boolean {
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * Escapes HTML meta-characters before interpolating untrusted values into HTML templates or messages.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates external webhook / postback URLs to prevent SSRF against localhost, metadata IPs, and RFC1918 subnets.
 */
export function isSafeExternalHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    if (parsed.username || parsed.password) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }

    // Reject single-integer or hex/octal IPv4 encodings (e.g., 2130706433, 0x7f000001)
    if (/^(?:\d+|0x[0-9a-f]+)$/i.test(host)) {
      return false;
    }

    // Block literal IPv6 loopback / unique-local / link-local / multicast / IPv4-mapped IPv4
    if (host.startsWith('[') || host.includes(':')) {
      const bareV6 = host.replace(/^\[|\]$/g, '').split('%')[0];
      if (
        bareV6 === '::1' ||
        bareV6 === '::' ||
        bareV6 === '0:0:0:0:0:0:0:1' ||
        bareV6 === '0:0:0:0:0:0:0:0' ||
        bareV6.startsWith('fe80:') ||
        bareV6.startsWith('fc') ||
        bareV6.startsWith('fd') ||
        bareV6.startsWith('ff')
      ) {
        return false;
      }

      // Check IPv4-mapped IPv6 in both dotted (::ffff:127.0.0.1) and hex (::ffff:7f00:1) forms
      const mappedDotted = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bareV6);
      if (mappedDotted) {
        return !isPrivateOrReservedIpv4Octets(mappedDotted.slice(1).map(Number));
      }
      const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(bareV6);
      if (mappedHex) {
        const hi = parseInt(mappedHex[1], 16);
        const lo = parseInt(mappedHex[2], 16);
        return !isPrivateOrReservedIpv4Octets([
          (hi >> 8) & 0xff,
          hi & 0xff,
          (lo >> 8) & 0xff,
          lo & 0xff,
        ]);
      }

      // Fail closed on other IPv4-compatible / transition addresses (::xxxx:xxxx or 64:ff9b::)
      if (bareV6.startsWith('::') || bareV6.startsWith('64:ff9b:')) {
        return false;
      }
    }

    // Block private/loopback/link-local IPv4 ranges (RFC1918, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8, 100.64.0.0/10)
    const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4Match) {
      if (ipv4Match.slice(1).some((part) => part.length > 1 && part.startsWith('0'))) {
        return false;
      }
      if (isPrivateOrReservedIpv4Octets(ipv4Match.slice(1).map((n) => Number(n)))) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Returns HTTP 503 Service Unavailable when a required backend database or
 * upstream provider is unconfigured outside explicit DEV_SANDBOX_MODE.
 */
export function serviceUnavailableResponse(serviceName: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `${serviceName} is currently unavailable because the backend database or upstream provider is not configured.`,
      code: 'SERVICE_UNAVAILABLE',
    },
    { status: 503 }
  );
}
