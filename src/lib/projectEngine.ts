/**
 * DevHost Project & CI/CD Engine
 * AES-256-GCM .ENV Vault, Command Security Firewall, Cron Validator & GitHub HMAC Verifier
 */

import { validateContainerCommand } from '@/lib/security';

// ==============================================================================
// 1. AES-256-GCM WEB CRYPTO .ENV VAULT
// ==============================================================================

const MASTER_ENV_SALT = 'devhost_env_vault_aes_gcm_2026_salt';

async function getEnvVaultKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const configuredSecret =
    (typeof process !== 'undefined' && process.env?.DEVHOST_ENV_ENCRYPTION_KEY?.trim()) || '';

  if (!configuredSecret && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    throw new Error('DEVHOST_ENV_ENCRYPTION_KEY is required in production.');
  }

  const rawSecret = configuredSecret || 'devhost-super-secure-env-vault-master-key-32b!';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(rawSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(MASTER_ENV_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext environment variable value into Base64 AES-GCM ciphertext with 12-byte IV
 */
export async function encryptEnvValue(plaintext: string): Promise<string> {
  try {
    const key = await getEnvVaultKey();
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (err) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      throw err instanceof Error ? err : new Error('AES-256-GCM encryption failed.');
    }
    return `ENC_${Buffer.from(plaintext).toString('base64')}`;
  }
}

/**
 * Decrypts Base64 AES-GCM environment variable value back to plaintext
 */
export async function decryptEnvValue(encryptedBase64: string): Promise<string> {
  try {
    if (encryptedBase64.startsWith('ENC_')) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
        throw new Error('Refusing unencrypted ENC_ payload in production.');
      }
      return Buffer.from(encryptedBase64.replace('ENC_', ''), 'base64').toString('utf-8');
    }

    const binary = atob(encryptedBase64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const cipherBytes = combined.slice(12);
    const key = await getEnvVaultKey();

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error(
      `AES-256-GCM decryption failed: ${err instanceof Error ? err.message : 'invalid ciphertext'}`
    );
  }
}

/**
 * Generates safe masked preview for UI (e.g., sk_live_••••••••4f2b)
 */
export function getMaskedPreview(value: string): string {
  if (!value) return '••••••••';
  if (value.length <= 6) return '••••••';
  
  if (value.startsWith('sk_live_') || value.startsWith('pk_live_') || value.startsWith('whsec_')) {
    const prefix = value.substring(0, 8);
    const suffix = value.substring(value.length - 4);
    return `${prefix}••••••••${suffix}`;
  }

  const suffix = value.substring(value.length - 4);
  return `••••••••${suffix}`;
}

// ==============================================================================
// 2. BULK .ENV FILE PARSER
// ==============================================================================

export interface ParsedEnvItem {
  key: string;
  value: string;
  isValid: boolean;
  error?: string;
}

export function parseDotEnvFile(fileContent: string): ParsedEnvItem[] {
  const lines = fileContent.split(/\r?\n/);
  const items: ParsedEnvItem[] = [];
  const keyRegex = /^[A-Z_][A-Z0-9_]*$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      items.push({
        key: line,
        value: '',
        isValid: false,
        error: 'Missing "=" assignment delimiter.',
      });
      continue;
    }

    const key = line.substring(0, eqIdx).trim();
    let value = line.substring(eqIdx + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.substring(1, value.length - 1);
    }

    if (!keyRegex.test(key)) {
      items.push({
        key,
        value,
        isValid: false,
        error: 'Key must only contain uppercase letters, numbers, and underscores (e.g., DATABASE_URL).',
      });
    } else {
      items.push({
        key,
        value,
        isValid: true,
      });
    }
  }

  return items;
}

// ==============================================================================
// 3. COMMAND INJECTION SECURITY FIREWALL & CRON VALIDATOR
// ==============================================================================

export interface CommandValidationResult {
  allowed: boolean;
  reason?: string;
  isMalicious?: boolean;
}

export function validateShellCommand(cmd: string): CommandValidationResult {
  const result = validateContainerCommand(cmd, 'cron');
  if (!result.valid) {
    return {
      allowed: false,
      reason:
        result.error ||
        'CRITICAL SECURITY ALERT: Command rejected by DevHost Security Shield.',
      isMalicious: true,
    };
  }
  return { allowed: true };
}

export function describeCronExpression(expression: string): { valid: boolean; description: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, description: 'Invalid syntax. Standard cron requires exactly 5 parts: min hour day month weekday.' };
  }

  const [min, hour, dom] = parts;

  if (expression === '* * * * *') return { valid: true, description: 'Runs every minute' };
  if (expression === '*/5 * * * *') return { valid: true, description: 'Runs every 5 minutes' };
  if (expression === '*/15 * * * *') return { valid: true, description: 'Runs every 15 minutes' };
  if (expression === '0 * * * *') return { valid: true, description: 'Runs hourly at minute 0' };
  if (expression === '0 0 * * *') return { valid: true, description: 'Runs daily at midnight (00:00 UTC/BST)' };
  if (expression === '0 12 * * *') return { valid: true, description: 'Runs daily at noon (12:00 PM)' };
  if (expression === '0 0 * * 0') return { valid: true, description: 'Runs weekly every Sunday at midnight' };
  if (expression === '0 0 1 * *') return { valid: true, description: 'Runs monthly on the 1st day at midnight' };

  return { valid: true, description: `Custom schedule: minute ${min}, hour ${hour}, day ${dom}` };
}

// ==============================================================================
// 4. GITHUB WEBHOOK HMAC-SHA256 SIGNATURE VERIFIER
// ==============================================================================

export async function verifyGitHubSignature(
  secretToken: string,
  payloadText: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const calculatedSigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadText));
    const calculatedSigArray = Array.from(new Uint8Array(calculatedSigBuffer));
    const calculatedSigHex = 'sha256=' + calculatedSigArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Constant-time length & comparison
    if (calculatedSigHex.length !== signatureHeader.length) return false;
    let mismatch = 0;
    for (let i = 0; i < calculatedSigHex.length; i++) {
      mismatch |= calculatedSigHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

// ==============================================================================
// 5. FRAMEWORK PRESET CONFIGURATIONS
// ==============================================================================

export interface FrameworkConfig {
  name: string;
  runtimeVersion: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  startupFile: string;
  description: string;
}

export const FRAMEWORK_PRESETS: Record<string, FrameworkConfig> = {
  nextjs_standalone: {
    name: 'Next.js (App Router / Standalone)',
    runtimeVersion: 'Node.js 22 LTS',
    installCommand: 'npm ci',
    buildCommand: 'npm run build',
    outputDirectory: '.next/standalone',
    startupFile: 'server.js',
    description: 'High-performance zero-cold-start Next.js running via Phusion Passenger.',
  },
  nodejs_express: {
    name: 'Node.js / Express / Fastify / NestJS',
    runtimeVersion: 'Node.js 22 LTS',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    startupFile: 'index.js',
    description: 'Backend REST & GraphQL APIs with Passenger process supervision.',
  },
  laravel_php: {
    name: 'Laravel 11 / PHP 8.3 (LiteSpeed)',
    runtimeVersion: 'PHP 8.3 (LiteSpeed LSAPI)',
    installCommand: 'composer install --no-dev --optimize-autoloader',
    buildCommand: 'php artisan config:cache && php artisan route:cache',
    outputDirectory: 'public',
    startupFile: 'index.php',
    description: 'LiteSpeed OPcache accelerated Laravel stack with artisan automation.',
  },
  wordpress_lscache: {
    name: 'WordPress with LSCache Engine',
    runtimeVersion: 'PHP 8.3 (LiteSpeed LSAPI)',
    installCommand: '# No install step required',
    buildCommand: '# Static assets optimized by LSCache',
    outputDirectory: './',
    startupFile: 'index.php',
    description: 'BDIX-optimized WordPress with NVMe Redis object caching.',
  },
  python_wsgi: {
    name: 'Python 3.12 (FastAPI / Django / Flask)',
    runtimeVersion: 'Python 3.12 (WSGI)',
    installCommand: 'pip install -r requirements.txt',
    buildCommand: '# WSGI production bundle compiled',
    outputDirectory: './',
    startupFile: 'app.py',
    description: 'Python asynchronous apps managed by Phusion Passenger WSGI daemon.',
  },
  static_site: {
    name: 'Static HTML / Vite / Astro / React SSG',
    runtimeVersion: 'Static / LiteSpeed Web Server',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDirectory: 'out',
    startupFile: 'index.html',
    description: 'Pure static edge delivery with Brotli and HTTP/3 QUIC.',
  },
};
