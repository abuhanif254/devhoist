/**
 * DevHost Cloud - Edge-Native RFC 6238 TOTP, Backup Codes & Sudo Security Engine
 * Uses Web Crypto API (crypto.subtle) with zero binary dependencies.
 * Fully compatible with Cloudflare Edge Runtime and modern browsers.
 */

import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes Uint8Array bytes to RFC 4648 Base32 string (without padding)
 */
export function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes RFC 4648 Base32 string to Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${clean[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Generates cryptographically random 20-byte Base32 secret key
 */
export function generateBase32Secret(lengthBytes = 20): string {
  const buffer = new Uint8Array(lengthBytes);
  crypto.getRandomValues(buffer);
  return bytesToBase32(buffer);
}

/**
 * Formats standard otpauth:// URI for Google Authenticator / Authy
 */
export function generateTotpUri(
  email: string,
  secretBase32: string,
  issuer = 'DevHost Cloud'
): string {
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanEmail = encodeURIComponent(email.trim());
  return `otpauth://totp/${cleanIssuer}:${cleanEmail}?secret=${secretBase32}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates RFC 6238 6-digit TOTP token using Web Crypto HMAC-SHA1
 */
export async function generateTotpToken(
  secretBase32: string,
  timestampMs = Date.now()
): Promise<string> {
  const keyBytes = base32ToBytes(secretBase32);
  const timeStep = Math.floor(timestampMs / 1000 / 30);

  // 8-byte big-endian time counter buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // Upper 4 bytes: 0 for times until year 2038+
  counterView.setUint32(0, 0, false);
  counterView.setUint32(4, timeStep, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hashBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const binaryCode =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const otp = (binaryCode % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies a 6-digit user-entered TOTP code with time-window drift tolerance
 */
export async function verifyTotpCode(
  secretBase32: string,
  userCode: string,
  windowTolerance = 1
): Promise<boolean> {
  const cleanCode = userCode.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const now = Date.now();
  for (let drift = -windowTolerance; drift <= windowTolerance; drift++) {
    const testTimestamp = now + drift * 30 * 1000;
    try {
      const expectedCode = await generateTotpToken(secretBase32, testTimestamp);
      if (constantTimeEquals(cleanCode, expectedCode)) {
        return true;
      }
    } catch {
      // Continue checking next drift window
    }
  }

  return false;
}

/**
 * Hashes a string using Web Crypto SHA-256 and outputs hex string
 */
export async function sha256Hex(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates 10 human-readable recovery backup codes (XXXX-XXXX-XXXX)
 * Returns plaintext for user download and SHA-256 hashes for database storage.
 */
export async function generateBackupCodes(count = 10): Promise<{
  plaintextCodes: string[];
  hashedCodes: string[];
}> {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Unambiguous chars
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const randomBytes = new Uint8Array(12);
    crypto.getRandomValues(randomBytes);

    let raw = '';
    for (let j = 0; j < 12; j++) {
      raw += chars[randomBytes[j] % chars.length];
    }

    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    plaintextCodes.push(formatted);

    const hash = await sha256Hex(formatted.toUpperCase());
    hashedCodes.push(hash);
  }

  return { plaintextCodes, hashedCodes };
}

/**
 * Verifies and consumes a 1-time backup recovery code
 */
export async function verifyBackupCode(
  inputCode: string,
  storedHashedCodes: string[]
): Promise<{ valid: boolean; remainingHashedCodes: string[] }> {
  const clean = inputCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 12) {
    return { valid: false, remainingHashedCodes: storedHashedCodes };
  }

  const formatted = `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  const inputHash = await sha256Hex(formatted);

  const matchIndex = storedHashedCodes.findIndex((h) => constantTimeEquals(h, inputHash));
  if (matchIndex === -1) {
    return { valid: false, remainingHashedCodes: storedHashedCodes };
  }

  // Remove the consumed code
  const remainingHashedCodes = storedHashedCodes.filter((_, idx) => idx !== matchIndex);
  return { valid: true, remainingHashedCodes };
}

const PIN_PBKDF2_ITERATIONS = 100000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derivePinPbkdf2Hex(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`devhost_sudo_pin_${pin}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Hashes a 6-digit Master Sudo PIN using salted PBKDF2-SHA256 (100,000 iterations)
 */
export async function hashSecurityPin(pin: string): Promise<string> {
  const clean = pin.trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new Error('Sudo PIN must be exactly 6 digits');
  }
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derivedHex = await derivePinPbkdf2Hex(clean, salt, PIN_PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PIN_PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${derivedHex}`;
}

/**
 * Verifies a 6-digit Master Sudo PIN against stored salted PBKDF2 hash (with legacy SHA-256 fallback)
 */
export async function verifySecurityPin(pin: string, storedHash: string): Promise<boolean> {
  const clean = pin.trim();
  if (!/^\d{6}$/.test(clean) || !storedHash) return false;

  if (storedHash.startsWith('pbkdf2_sha256$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const expectedHex = parts[3];
    if (!Number.isFinite(iterations) || iterations < 10000 || !saltHex || !expectedHex) {
      return false;
    }
    const derivedHex = await derivePinPbkdf2Hex(clean, hexToBytes(saltHex), iterations);
    return constantTimeEquals(derivedHex, expectedHex);
  }

  // Backward-compatible check for legacy unsalted SHA-256 PIN rows
  const legacyHash = await sha256Hex(`devhost_sudo_pin_${clean}`);
  return constantTimeEquals(legacyHash, storedHash);
}

/**
 * Generates an SVG string representation of an otpauth:// QR code
 */
export async function generateQrCodeSvg(otpauthUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toString(
      otpauthUri,
      {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#0f172a', // Deep slate for high contrast
          light: '#ffffff',
        },
      },
      (err, svg) => {
        if (err) reject(err);
        else resolve(svg);
      }
    );
  });
}
