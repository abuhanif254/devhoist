// ==============================================================================
// DEVHOST CLOUD - LIVE MULTI-GATEWAY ADAPTERS & WEBHOOK CRYPTOGRAPHY
// Strictly Cloudflare Workers / Edge Runtime Compatible (Web fetch + crypto.subtle)
// Gateways: UddoktaPay, Official bKash Tokenized, Official Nagad Merchant PG, Stripe
// ==============================================================================

import { timingSafeEqualStr, verifyHmacSha256Hex } from '@/lib/authGuard';

const COMPROMISED_WEBHOOK_SECRETS = new Set([
  'devhost_webhook_secret_key',
  'generate-64-char-random-hex-key',
]);

export type LiveGatewayMethod = 'uddoktapay' | 'bkash' | 'nagad' | 'stripe';

export interface GatewaySessionInput {
  invoiceNumber: string;
  amountBDT: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  userId: string;
  planName?: string;
  referralCode?: string;
  siteUrl: string;
  clientIp?: string;
  currency?: 'BDT' | 'USD';
}

export interface GatewaySessionResult {
  configured: boolean;
  paymentUrl?: string;
  providerRef?: string;
  error?: string;
  statusCode?: number;
}

export interface VerifiedWebhookEvent {
  ok: boolean;
  status: number;
  provider: 'stripe' | 'uddoktapay' | 'devhost_hmac' | 'unknown';
  eventStatus: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'IGNORED';
  invoiceNumber: string;
  trxId: string;
  amountBDT: number;
  gateway: string;
  senderPhone?: string;
  cardFingerprint?: string;
  customerEmail?: string;
  remoteInvoiceId?: string;
  error?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * Checks whether an environment credential is missing or still set to an .env.example placeholder.
 */
export function isConfiguredSecret(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('your-') ||
    trimmed.startsWith('generate-') ||
    trimmed.startsWith('sk_live_your_') ||
    trimmed.startsWith('whsec_your_')
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves canonical site origin for gateway success/cancel/callback URLs.
 */
export function resolveSiteOrigin(reqOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && configured.startsWith('http')) {
    return configured.replace(/\/+$/, '');
  }
  if (reqOrigin && reqOrigin.startsWith('http')) {
    return reqOrigin.replace(/\/+$/, '');
  }
  return 'https://devhostcloud.com';
}

/**
 * Returns configured manual Merchant MFS wallet numbers for manual TrxID fallback instructions.
 */
export function getMerchantMfsNumbers(): {
  bkash: string;
  nagad: string;
  rocket: string;
  isConfigured: boolean;
} {
  const bkash =
    process.env.MERCHANT_BKASH_NUMBER?.trim() ||
    process.env.NEXT_PUBLIC_MERCHANT_BKASH_NUMBER?.trim() ||
    '';
  const nagad =
    process.env.MERCHANT_NAGAD_NUMBER?.trim() ||
    process.env.NEXT_PUBLIC_MERCHANT_NAGAD_NUMBER?.trim() ||
    '';
  const rocket =
    process.env.MERCHANT_ROCKET_NUMBER?.trim() ||
    process.env.NEXT_PUBLIC_MERCHANT_ROCKET_NUMBER?.trim() ||
    '';

  return {
    bkash: bkash || '01700-000000',
    nagad: nagad || '01800-000000',
    rocket: rocket || '01900-000000',
    isConfigured: Boolean(bkash || nagad),
  };
}

// ==============================================================================
// 1. UDDOKTAPAY AGGREGATE GATEWAY (CHECKOUT + SERVER VERIFY-PAYMENT)
// ==============================================================================

function resolveUddoktaEndpoints(): { checkoutUrl: string; verifyUrl: string } {
  const checkoutUrl =
    process.env.UDDOKTAPAY_API_URL?.trim() || 'https://sandbox.uddoktapay.com/api/checkout-v2';
  const explicitVerify = process.env.UDDOKTAPAY_VERIFY_URL?.trim();
  const verifyUrl =
    explicitVerify ||
    checkoutUrl
      .replace(/\/checkout-v2\/?$/i, '/verify-payment')
      .replace(/\/checkout\/?$/i, '/verify-payment');
  return { checkoutUrl, verifyUrl };
}

export async function createUddoktaPayCheckout(
  input: GatewaySessionInput
): Promise<GatewaySessionResult> {
  const apiKey = process.env.UDDOKTAPAY_API_KEY;
  if (!isConfiguredSecret(apiKey)) {
    return { configured: false, error: 'UDDOKTAPAY_API_KEY is not configured.' };
  }

  const { checkoutUrl } = resolveUddoktaEndpoints();
  try {
    const res = await fetch(checkoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'RT-UDDOKTAPAY-API-KEY': apiKey.trim(),
      },
      body: JSON.stringify({
        full_name: input.customerName,
        email: input.customerEmail,
        amount: String(input.amountBDT),
        metadata: {
          invoice_id: input.invoiceNumber,
          user_id: input.userId,
          referral_code: input.referralCode || '',
        },
        redirect_url: `${input.siteUrl}/dashboard?payment=success&invoice=${encodeURIComponent(input.invoiceNumber)}`,
        return_type: 'GET',
        cancel_url: `${input.siteUrl}/dashboard?payment=cancelled&invoice=${encodeURIComponent(input.invoiceNumber)}`,
        webhook_url: `${input.siteUrl}/api/payments/webhook`,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      payment_url?: string;
      message?: string;
    };

    if (res.ok && data.payment_url) {
      return {
        configured: true,
        paymentUrl: data.payment_url,
      };
    }

    return {
      configured: true,
      statusCode: res.status >= 400 ? res.status : 502,
      error: data.message || `UddoktaPay checkout rejected request (HTTP ${res.status}).`,
    };
  } catch (err) {
    return {
      configured: true,
      statusCode: 502,
      error: err instanceof Error ? err.message : 'UddoktaPay network failure.',
    };
  }
}

export async function verifyUddoktaPayPayment(uddoktaInvoiceId: string): Promise<{
  ok: boolean;
  status: string;
  amountBDT: number;
  trxId: string;
  senderNumber?: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  raw?: Record<string, unknown>;
  error?: string;
}> {
  const apiKey = process.env.UDDOKTAPAY_API_KEY;
  if (!isConfiguredSecret(apiKey)) {
    return { ok: false, status: 'UNCONFIGURED', amountBDT: 0, trxId: '', error: 'Missing UDDOKTAPAY_API_KEY' };
  }

  const { verifyUrl } = resolveUddoktaEndpoints();
  try {
    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'RT-UDDOKTAPAY-API-KEY': apiKey.trim(),
      },
      body: JSON.stringify({ invoice_id: uddoktaInvoiceId }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const status = String(data.status || '').toUpperCase();
    const metadata = (data.metadata as Record<string, unknown> | undefined) || {};
    const verified = res.ok && status === 'COMPLETED';

    return {
      ok: verified,
      status: status || `HTTP_${res.status}`,
      amountBDT: Number(data.amount || 0),
      trxId: String(data.transaction_id || data.trx_id || ''),
      senderNumber: data.sender_number ? String(data.sender_number) : undefined,
      paymentMethod: data.payment_method ? String(data.payment_method).toLowerCase() : undefined,
      invoiceNumber: metadata.invoice_id ? String(metadata.invoice_id) : undefined,
      raw: data,
      error: verified ? undefined : String(data.message || `Verification status: ${status || res.status}`),
    };
  } catch (err) {
    return {
      ok: false,
      status: 'ERROR',
      amountBDT: 0,
      trxId: '',
      error: err instanceof Error ? err.message : 'UddoktaPay verify-payment network error.',
    };
  }
}

// ==============================================================================
// 2. OFFICIAL bKASH TOKENIZED CHECKOUT (GRANT -> CREATE -> EXECUTE)
// ==============================================================================

function getBkashConfig() {
  const appKey = process.env.BKASH_APP_KEY;
  const appSecret = process.env.BKASH_APP_SECRET;
  const username = process.env.BKASH_USERNAME;
  const password = process.env.BKASH_PASSWORD;
  const baseUrl = (
    process.env.BKASH_BASE_URL?.trim() || 'https://tokenized.pay.bka.sh/v1.2.0-beta'
  ).replace(/\/+$/, '');

  const configured =
    isConfiguredSecret(appKey) &&
    isConfiguredSecret(appSecret) &&
    isConfiguredSecret(username) &&
    isConfiguredSecret(password);

  return {
    configured,
    appKey: appKey?.trim() || '',
    appSecret: appSecret?.trim() || '',
    username: username?.trim() || '',
    password: password?.trim() || '',
    baseUrl,
  };
}

export async function getBkashGrantToken(): Promise<{
  ok: boolean;
  idToken?: string;
  error?: string;
}> {
  const cfg = getBkashConfig();
  if (!cfg.configured) {
    return { ok: false, error: 'bKash Tokenized Checkout credentials are not configured.' };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: cfg.username,
        password: cfg.password,
      },
      body: JSON.stringify({
        app_key: cfg.appKey,
        app_secret: cfg.appSecret,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id_token?: string;
      statusMessage?: string;
      msg?: string;
    };

    if (res.ok && data.id_token) {
      return { ok: true, idToken: data.id_token };
    }

    return {
      ok: false,
      error: data.statusMessage || data.msg || `bKash token/grant failed (HTTP ${res.status}).`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'bKash token grant network error.',
    };
  }
}

export async function createBkashCheckoutPayment(
  input: GatewaySessionInput
): Promise<GatewaySessionResult> {
  const cfg = getBkashConfig();
  if (!cfg.configured) {
    return { configured: false, error: 'bKash Tokenized Checkout credentials are missing.' };
  }

  const grant = await getBkashGrantToken();
  if (!grant.ok || !grant.idToken) {
    return { configured: true, statusCode: 502, error: grant.error || 'bKash token grant failed.' };
  }

  try {
    const callbackUrl = `${input.siteUrl}/api/payments/bkash/callback?invoice=${encodeURIComponent(input.invoiceNumber)}`;
    const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        authorization: grant.idToken,
        'x-app-key': cfg.appKey,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: input.customerPhone || input.customerEmail || input.userId,
        callbackURL: callbackUrl,
        amount: String(Number(input.amountBDT.toFixed(2))),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: input.invoiceNumber,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      paymentID?: string;
      bkashURL?: string;
      statusCode?: string;
      statusMessage?: string;
    };

    if (res.ok && data.bkashURL && data.paymentID) {
      return {
        configured: true,
        paymentUrl: data.bkashURL,
        providerRef: data.paymentID,
      };
    }

    return {
      configured: true,
      statusCode: 502,
      error: data.statusMessage || `bKash create failed (statusCode=${data.statusCode || res.status}).`,
    };
  } catch (err) {
    return {
      configured: true,
      statusCode: 502,
      error: err instanceof Error ? err.message : 'bKash checkout create network error.',
    };
  }
}

export async function executeBkashPayment(paymentID: string): Promise<{
  ok: boolean;
  trxID: string;
  amountBDT: number;
  customerMsisdn?: string;
  merchantInvoiceNumber?: string;
  transactionStatus?: string;
  error?: string;
}> {
  const cfg = getBkashConfig();
  if (!cfg.configured) {
    return { ok: false, trxID: '', amountBDT: 0, error: 'bKash credentials not configured.' };
  }

  const grant = await getBkashGrantToken();
  if (!grant.ok || !grant.idToken) {
    return { ok: false, trxID: '', amountBDT: 0, error: grant.error };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        authorization: grant.idToken,
        'x-app-key': cfg.appKey,
      },
      body: JSON.stringify({ paymentID }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      paymentID?: string;
      trxID?: string;
      amount?: string | number;
      customerMsisdn?: string;
      payerAccount?: string;
      merchantInvoiceNumber?: string;
      transactionStatus?: string;
      statusCode?: string;
      statusMessage?: string;
    };

    const isCompleted =
      res.ok &&
      (data.transactionStatus === 'Completed' || data.statusCode === '0000') &&
      Boolean(data.trxID);

    return {
      ok: isCompleted,
      trxID: data.trxID || '',
      amountBDT: Number(data.amount || 0),
      customerMsisdn: data.customerMsisdn || data.payerAccount,
      merchantInvoiceNumber: data.merchantInvoiceNumber,
      transactionStatus: data.transactionStatus,
      error: isCompleted ? undefined : data.statusMessage || `bKash execute status: ${data.transactionStatus || res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      trxID: '',
      amountBDT: 0,
      error: err instanceof Error ? err.message : 'bKash execute network error.',
    };
  }
}

// ==============================================================================
// 3. OFFICIAL STRIPE CHECKOUT SESSIONS (PURE FETCH — NO NODE SDK)
// ==============================================================================

export async function createStripeCheckoutSession(
  input: GatewaySessionInput
): Promise<GatewaySessionResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!isConfiguredSecret(secretKey)) {
    return {
      configured: false,
      statusCode: 503,
      error: 'Stripe checkout is not configured (STRIPE_SECRET_KEY missing).',
    };
  }

  const currency = input.currency === 'USD' ? 'usd' : 'bdt';
  const unitAmountMajor =
    currency === 'usd' ? Math.max(1, input.amountBDT / 120) : Math.max(1, input.amountBDT);
  const unitAmountMinor = Math.round(unitAmountMajor * 100);

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('payment_method_types[0]', 'card');
  form.set('customer_email', input.customerEmail);
  form.set('client_reference_id', input.invoiceNumber);
  form.set(
    'success_url',
    `${input.siteUrl}/dashboard?payment=success&gateway=stripe&invoice=${encodeURIComponent(input.invoiceNumber)}&session_id={CHECKOUT_SESSION_ID}`
  );
  form.set(
    'cancel_url',
    `${input.siteUrl}/dashboard?payment=cancelled&gateway=stripe&invoice=${encodeURIComponent(input.invoiceNumber)}`
  );
  form.set('line_items[0][price_data][currency]', currency);
  form.set('line_items[0][price_data][unit_amount]', String(unitAmountMinor));
  form.set(
    'line_items[0][price_data][product_data][name]',
    input.planName || `DevHost Cloud Invoice ${input.invoiceNumber}`
  );
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[invoice_number]', input.invoiceNumber);
  form.set('metadata[user_id]', input.userId);
  form.set('metadata[amount_bdt]', String(input.amountBDT));
  if (input.referralCode) {
    form.set('metadata[referral_code]', input.referralCode);
  }
  form.set('payment_intent_data[metadata][invoice_number]', input.invoiceNumber);

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (res.ok && data.url && data.id) {
      return {
        configured: true,
        paymentUrl: data.url,
        providerRef: data.id,
      };
    }

    return {
      configured: true,
      statusCode: res.status >= 400 ? res.status : 502,
      error: data.error?.message || `Stripe Checkout error (HTTP ${res.status}).`,
    };
  } catch (err) {
    return {
      configured: true,
      statusCode: 502,
      error: err instanceof Error ? err.message : 'Stripe network failure.',
    };
  }
}

// ==============================================================================
// 4. OFFICIAL NAGAD MERCHANT PG API (WEB CRYPTO RSA + BIGINT PKCS#1 v1.5)
// ==============================================================================

function pemToBytes(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function readAsn1Length(buf: Uint8Array, offset: number): { length: number; next: number } {
  const first = buf[offset];
  if ((first & 0x80) === 0) {
    return { length: first, next: offset + 1 };
  }
  const numBytes = first & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | buf[offset + 1 + i];
  }
  return { length, next: offset + 1 + numBytes };
}

function parseSpkiRsaPublicKey(spkiBytes: Uint8Array): { n: bigint; e: bigint; keyBytes: number } {
  // SubjectPublicKeyInfo SEQUENCE
  if (spkiBytes[0] !== 0x30) throw new Error('Invalid SPKI outer sequence');
  let pos = readAsn1Length(spkiBytes, 1).next;

  // Skip AlgorithmIdentifier SEQUENCE (0x30)
  if (spkiBytes[pos] !== 0x30) throw new Error('Invalid SPKI algorithm identifier');
  const algLen = readAsn1Length(spkiBytes, pos + 1);
  pos = algLen.next + algLen.length;

  // BIT STRING (0x03) + unused bits byte (0x00)
  if (spkiBytes[pos] !== 0x03) throw new Error('Invalid SPKI bit string');
  const bitLen = readAsn1Length(spkiBytes, pos + 1);
  pos = bitLen.next + 1;

  // Inner RSAPublicKey SEQUENCE (0x30)
  if (spkiBytes[pos] !== 0x30) throw new Error('Invalid RSAPublicKey sequence');
  pos = readAsn1Length(spkiBytes, pos + 1).next;

  // Modulus INTEGER (0x02)
  if (spkiBytes[pos] !== 0x02) throw new Error('Invalid RSA modulus integer');
  const modLen = readAsn1Length(spkiBytes, pos + 1);
  const modBytes = spkiBytes.slice(modLen.next, modLen.next + modLen.length);
  pos = modLen.next + modLen.length;

  // Exponent INTEGER (0x02)
  if (spkiBytes[pos] !== 0x02) throw new Error('Invalid RSA exponent integer');
  const expLen = readAsn1Length(spkiBytes, pos + 1);
  const expBytes = spkiBytes.slice(expLen.next, expLen.next + expLen.length);

  const bytesToBigInt = (arr: Uint8Array) => {
    let hex = '';
    for (const b of arr) hex += b.toString(16).padStart(2, '0');
    return BigInt('0x' + (hex || '0'));
  };

  const n = bytesToBigInt(modBytes);
  const e = bytesToBigInt(expBytes);
  const cleanModLen = modBytes[0] === 0 ? modBytes.length - 1 : modBytes.length;

  return { n, e, keyBytes: cleanModLen };
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  let result = ONE;
  let b = base % mod;
  let e = exp;
  while (e > ZERO) {
    if ((e & ONE) === ONE) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= ONE;
  }
  return result;
}

function rsaPkcs1EncryptBase64(plaintextUtf8: string, publicKeyPem: string): string {
  const spki = pemToBytes(publicKeyPem);
  const { n, e, keyBytes } = parseSpkiRsaPublicKey(spki);
  const msg = new TextEncoder().encode(plaintextUtf8);

  if (msg.length > keyBytes - 11) {
    throw new Error('Nagad payload exceeds RSA key block capacity');
  }

  const psLen = keyBytes - msg.length - 3;
  const em = new Uint8Array(keyBytes);
  em[0] = 0x00;
  em[1] = 0x02;

  const rand = new Uint8Array(psLen);
  crypto.getRandomValues(rand);
  for (let i = 0; i < psLen; i++) {
    em[2 + i] = rand[i] === 0 ? 0xff : rand[i];
  }
  em[2 + psLen] = 0x00;
  em.set(msg, 3 + psLen);

  let mHex = '';
  for (const b of em) mHex += b.toString(16).padStart(2, '0');
  const c = modPow(BigInt('0x' + mHex), e, n);
  const cHex = c.toString(16).padStart(keyBytes * 2, '0');
  const cBytes = new Uint8Array(keyBytes);
  for (let i = 0; i < keyBytes; i++) {
    cBytes[i] = parseInt(cHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytesToBase64(cBytes);
}

async function rsaSignSha256Base64(plaintextUtf8: string, privateKeyPem: string): Promise<string> {
  const pkcs8 = pemToBytes(privateKeyPem);
  const exactBuffer = new ArrayBuffer(pkcs8.byteLength);
  new Uint8Array(exactBuffer).set(pkcs8);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    exactBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(plaintextUtf8)
  );
  return bytesToBase64(new Uint8Array(sig));
}

function getNagadConfig() {
  const merchantId = process.env.NAGAD_MERCHANT_ID;
  const publicKey = process.env.NAGAD_PUBLIC_KEY;
  const privateKey = process.env.NAGAD_PRIVATE_KEY;
  const baseUrl = (
    process.env.NAGAD_BASE_URL?.trim() || 'https://api.mynagad.com/api/dfs'
  ).replace(/\/+$/, '');

  const configured =
    isConfiguredSecret(merchantId) &&
    isConfiguredSecret(publicKey) &&
    isConfiguredSecret(privateKey);

  return {
    configured,
    merchantId: merchantId?.trim() || '',
    publicKey: publicKey?.trim() || '',
    privateKey: privateKey?.trim() || '',
    baseUrl,
  };
}

export async function createNagadCheckoutSession(
  input: GatewaySessionInput
): Promise<GatewaySessionResult> {
  const cfg = getNagadConfig();
  if (!cfg.configured) {
    return { configured: false, error: 'Nagad Merchant PG credentials are not configured.' };
  }

  try {
    const orderId = input.invoiceNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || `INV${Date.now()}`;
    const now = new Date();
    const dateTime = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
      now.getUTCDate()
    ).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(
      now.getUTCMinutes()
    ).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;

    const randBytes = new Uint8Array(20);
    crypto.getRandomValues(randBytes);
    const challenge = Array.from(randBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const sensitiveInitObj = {
      merchantId: cfg.merchantId,
      datetime: dateTime,
      orderId,
      challenge,
    };
    const sensitiveInitStr = JSON.stringify(sensitiveInitObj);
    const encryptedInit = rsaPkcs1EncryptBase64(sensitiveInitStr, cfg.publicKey);
    const signatureInit = await rsaSignSha256Base64(sensitiveInitStr, cfg.privateKey);

    const commonHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-KM-Api-Version': 'v-0.2.0',
      'X-KM-IP-V4': input.clientIp || '103.205.71.1',
      'X-KM-Client-Type': 'PC_WEB',
    };

    const initRes = await fetch(
      `${cfg.baseUrl}/check-out/initialize/${encodeURIComponent(cfg.merchantId)}/${encodeURIComponent(orderId)}`,
      {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          accountNumber: getMerchantMfsNumbers().nagad.replace(/[^0-9]/g, ''),
          dateTime,
          sensitiveData: encryptedInit,
          signature: signatureInit,
        }),
      }
    );

    const initData = (await initRes.json().catch(() => ({}))) as {
      sensitiveData?: string;
      paymentReferenceId?: string;
      challenge?: string;
      message?: string;
    };

    const paymentRefId = initData.paymentReferenceId || '';
    const resChallenge = initData.challenge || challenge;

    if (!initRes.ok || !paymentRefId) {
      return {
        configured: true,
        statusCode: 502,
        error: initData.message || `Nagad initialize failed (HTTP ${initRes.status}).`,
      };
    }

    const completeSensitive = JSON.stringify({
      merchantId: cfg.merchantId,
      orderId,
      currencyCode: '050',
      amount: Number(input.amountBDT.toFixed(2)),
      challenge: resChallenge,
    });

    const completeRes = await fetch(
      `${cfg.baseUrl}/check-out/complete/${encodeURIComponent(paymentRefId)}`,
      {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          sensitiveData: rsaPkcs1EncryptBase64(completeSensitive, cfg.publicKey),
          signature: await rsaSignSha256Base64(completeSensitive, cfg.privateKey),
          merchantCallbackURL: `${input.siteUrl}/api/payments/nagad/callback?invoice=${encodeURIComponent(input.invoiceNumber)}`,
          additionalMerchantInfo: {
            invoiceNumber: input.invoiceNumber,
            userId: input.userId,
          },
        }),
      }
    );

    const completeData = (await completeRes.json().catch(() => ({}))) as {
      callBackUrl?: string;
      status?: string;
      message?: string;
    };

    if (completeRes.ok && completeData.callBackUrl) {
      return {
        configured: true,
        paymentUrl: completeData.callBackUrl,
        providerRef: paymentRefId,
      };
    }

    return {
      configured: true,
      statusCode: 502,
      error: completeData.message || `Nagad checkout complete failed (HTTP ${completeRes.status}).`,
    };
  } catch (err) {
    return {
      configured: true,
      statusCode: 502,
      error: err instanceof Error ? err.message : 'Nagad PG initialization error.',
    };
  }
}

export async function verifyNagadPayment(paymentRefId: string): Promise<{
  ok: boolean;
  trxId: string;
  amountBDT: number;
  orderId?: string;
  clientMobileNo?: string;
  invoiceNumber?: string;
  error?: string;
}> {
  const cfg = getNagadConfig();
  if (!cfg.configured) {
    return { ok: false, trxId: '', amountBDT: 0, error: 'Nagad credentials not configured.' };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/verify/payment/${encodeURIComponent(paymentRefId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      issuerPaymentRefNo?: string;
      amount?: string | number;
      orderId?: string;
      clientMobileNo?: string;
      additionalMerchantInfo?: { invoiceNumber?: string };
      message?: string;
    };

    const isSuccess = res.ok && String(data.status || '').toLowerCase() === 'success';
    return {
      ok: isSuccess,
      trxId: data.issuerPaymentRefNo || paymentRefId,
      amountBDT: Number(data.amount || 0),
      orderId: data.orderId,
      clientMobileNo: data.clientMobileNo,
      invoiceNumber: data.additionalMerchantInfo?.invoiceNumber,
      error: isSuccess ? undefined : data.message || `Nagad verify status: ${data.status || res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      trxId: '',
      amountBDT: 0,
      error: err instanceof Error ? err.message : 'Nagad verify network error.',
    };
  }
}

// ==============================================================================
// 5. UNIFIED WEBHOOK SIGNATURE + SERVER VERIFICATION DISPATCHER
// ==============================================================================

async function verifyStripeWebhookEvent(
  rawBody: string,
  sigHeader: string,
  secret: string
): Promise<VerifiedWebhookEvent> {
  const parts = sigHeader.split(',').map((s) => s.trim());
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    if (part.startsWith('t=')) timestamp = part.slice(2);
    if (part.startsWith('v1=')) signatures.push(part.slice(3));
  }

  if (!timestamp || signatures.length === 0) {
    return {
      ok: false,
      status: 401,
      provider: 'stripe',
      eventStatus: 'FAILED',
      invoiceNumber: '',
      trxId: '',
      amountBDT: 0,
      gateway: 'stripe',
      error: 'Malformed Stripe-Signature header.',
    };
  }

  const tsNum = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > 300) {
    return {
      ok: false,
      status: 401,
      provider: 'stripe',
      eventStatus: 'FAILED',
      invoiceNumber: '',
      trxId: '',
      amountBDT: 0,
      gateway: 'stripe',
      error: 'Stripe-Signature timestamp expired or skewed.',
    };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  let matched = false;
  for (const v1 of signatures) {
    if (await verifyHmacSha256Hex(signedPayload, v1, secret)) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return {
      ok: false,
      status: 401,
      provider: 'stripe',
      eventStatus: 'FAILED',
      invoiceNumber: '',
      trxId: '',
      amountBDT: 0,
      gateway: 'stripe',
      error: 'Invalid Stripe webhook HMAC signature.',
    };
  }

  const event = JSON.parse(rawBody) as {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  const eventType = String(event.type || '');
  const obj = (event.data?.object || {}) as Record<string, unknown>;
  const metadata = (obj.metadata as Record<string, unknown> | undefined) || {};
  const customerDetails = (obj.customer_details as Record<string, unknown> | undefined) || {};
  const chargesData = (obj.charges as { data?: Array<Record<string, unknown>> } | undefined)?.data;
  const chargePmd = (chargesData?.[0]?.payment_method_details as Record<string, unknown> | undefined)?.card as
    | { fingerprint?: string }
    | undefined;
  const directPmd = (obj.payment_method_details as { card?: { fingerprint?: string } } | undefined)?.card;

  const isPaidSession =
    eventType === 'checkout.session.completed' &&
    String(obj.payment_status || 'paid').toLowerCase() === 'paid';
  const isPaidIntent = eventType === 'payment_intent.succeeded';
  const isRefundOrFailure =
    eventType === 'charge.refunded' ||
    eventType === 'payment_intent.payment_failed' ||
    eventType === 'checkout.session.expired';

  if (!isPaidSession && !isPaidIntent) {
    return {
      ok: true,
      status: 200,
      provider: 'stripe',
      eventStatus: isRefundOrFailure ? 'FAILED' : 'IGNORED',
      invoiceNumber: String(metadata.invoice_number || obj.client_reference_id || ''),
      trxId: String(obj.payment_intent || obj.id || ''),
      amountBDT: Number(metadata.amount_bdt || 0),
      gateway: 'stripe',
      rawPayload: event as unknown as Record<string, unknown>,
    };
  }

  const currency = String(obj.currency || 'bdt').toLowerCase();
  const minorAmount = Number(obj.amount_total ?? obj.amount_received ?? obj.amount ?? 0);
  const amountFromObj =
    currency === 'usd' ? Math.round((minorAmount / 100) * 120) : Math.round(minorAmount / 100);
  const amountBDT = Number(metadata.amount_bdt || amountFromObj || 0);

  return {
    ok: true,
    status: 200,
    provider: 'stripe',
    eventStatus: 'COMPLETED',
    invoiceNumber: String(metadata.invoice_number || obj.client_reference_id || ''),
    trxId: String(obj.payment_intent || obj.id || `STR-${Date.now()}`),
    amountBDT,
    gateway: 'stripe',
    cardFingerprint: directPmd?.fingerprint || chargePmd?.fingerprint || (metadata.card_fingerprint ? String(metadata.card_fingerprint) : undefined),
    customerEmail: customerDetails.email ? String(customerDetails.email) : obj.customer_email ? String(obj.customer_email) : undefined,
    rawPayload: event as unknown as Record<string, unknown>,
  };
}

export async function verifyPaymentWebhookRequest(
  req: Request,
  rawBody: string,
  parsedPayload: Record<string, unknown>
): Promise<VerifiedWebhookEvent> {
  const uddoktaKeyHeader = req.headers.get('rt-uddoktapay-api-key');
  const stripeSigHeader = req.headers.get('stripe-signature');
  const customHmacHeader =
    req.headers.get('x-webhook-signature') || req.headers.get('x-devhost-signature');

  const expectedUddoktaKey = process.env.UDDOKTAPAY_API_KEY?.trim() || '';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';
  const customWebhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || '';
  const validCustomSecret =
    customWebhookSecret && !COMPROMISED_WEBHOOK_SECRETS.has(customWebhookSecret)
      ? customWebhookSecret
      : '';

  if (!isConfiguredSecret(expectedUddoktaKey) && !isConfiguredSecret(stripeWebhookSecret) && !validCustomSecret) {
    return {
      ok: false,
      status: 503,
      provider: 'unknown',
      eventStatus: 'FAILED',
      invoiceNumber: '',
      trxId: '',
      amountBDT: 0,
      gateway: 'unknown',
      error: 'No payment webhook verification secrets are configured on this server.',
    };
  }

  // Branch A: Stripe Webhook
  if (stripeSigHeader) {
    if (!isConfiguredSecret(stripeWebhookSecret)) {
      return {
        ok: false,
        status: 503,
        provider: 'stripe',
        eventStatus: 'FAILED',
        invoiceNumber: '',
        trxId: '',
        amountBDT: 0,
        gateway: 'stripe',
        error: 'STRIPE_WEBHOOK_SECRET is not configured.',
      };
    }
    return verifyStripeWebhookEvent(rawBody, stripeSigHeader, stripeWebhookSecret);
  }

  // Branch B: UddoktaPay Webhook + Mandatory Server-to-Server verify-payment when invoice_id present
  if (uddoktaKeyHeader) {
    if (!isConfiguredSecret(expectedUddoktaKey) || !timingSafeEqualStr(uddoktaKeyHeader.trim(), expectedUddoktaKey)) {
      return {
        ok: false,
        status: 401,
        provider: 'uddoktapay',
        eventStatus: 'FAILED',
        invoiceNumber: '',
        trxId: '',
        amountBDT: 0,
        gateway: 'uddoktapay',
        error: 'Invalid UddoktaPay webhook API key.',
      };
    }

    const remoteInvoiceId = parsedPayload.invoice_id ? String(parsedPayload.invoice_id) : '';
    const metadata = (parsedPayload.metadata as Record<string, unknown> | undefined) || {};
    let invoiceNumber = String(metadata.invoice_id || parsedPayload.invoice_number || '');
    let trxId = String(parsedPayload.transaction_id || parsedPayload.trx_id || '');
    let amountBDT = Number(parsedPayload.amount || 0);
    let eventStatus = (String(parsedPayload.status || 'PENDING').toUpperCase() ||
      'PENDING') as VerifiedWebhookEvent['eventStatus'];
    let gateway = String(parsedPayload.payment_method || 'uddoktapay').toLowerCase();
    let senderPhone = parsedPayload.sender_number ? String(parsedPayload.sender_number) : undefined;

    if (remoteInvoiceId) {
      const serverCheck = await verifyUddoktaPayPayment(remoteInvoiceId);
      if (!serverCheck.ok) {
        return {
          ok: false,
          status: 401,
          provider: 'uddoktapay',
          eventStatus: 'FAILED',
          invoiceNumber,
          trxId,
          amountBDT,
          gateway,
          remoteInvoiceId,
          error: serverCheck.error || 'UddoktaPay server-to-server verification failed.',
        };
      }
      eventStatus = 'COMPLETED';
      if (serverCheck.amountBDT > 0) amountBDT = serverCheck.amountBDT;
      if (serverCheck.trxId) trxId = serverCheck.trxId;
      if (serverCheck.invoiceNumber) invoiceNumber = serverCheck.invoiceNumber;
      if (serverCheck.senderNumber) senderPhone = serverCheck.senderNumber;
      if (serverCheck.paymentMethod) gateway = serverCheck.paymentMethod;
    }

    return {
      ok: true,
      status: 200,
      provider: 'uddoktapay',
      eventStatus,
      invoiceNumber,
      trxId: trxId || `UDK-${remoteInvoiceId || Date.now()}`,
      amountBDT,
      gateway,
      senderPhone,
      customerEmail: parsedPayload.email ? String(parsedPayload.email) : undefined,
      remoteInvoiceId: remoteInvoiceId || undefined,
      rawPayload: parsedPayload,
    };
  }

  // Branch C: Signed DevHost Gateway HMAC Webhook
  if (customHmacHeader && validCustomSecret) {
    const valid = await verifyHmacSha256Hex(rawBody, customHmacHeader, validCustomSecret);
    if (!valid) {
      return {
        ok: false,
        status: 401,
        provider: 'devhost_hmac',
        eventStatus: 'FAILED',
        invoiceNumber: '',
        trxId: '',
        amountBDT: 0,
        gateway: 'unknown',
        error: 'Invalid HMAC webhook signature.',
      };
    }

    const metadata = (parsedPayload.metadata as Record<string, unknown> | undefined) || {};
    return {
      ok: true,
      status: 200,
      provider: 'devhost_hmac',
      eventStatus: (String(parsedPayload.status || 'COMPLETED').toUpperCase() ||
        'COMPLETED') as VerifiedWebhookEvent['eventStatus'],
      invoiceNumber: String(metadata.invoice_id || parsedPayload.invoice_id || parsedPayload.invoice_number || ''),
      trxId: String(parsedPayload.transaction_id || parsedPayload.trx_id || ''),
      amountBDT: Number(parsedPayload.amount || 0),
      gateway: String(parsedPayload.payment_method || 'gateway').toLowerCase(),
      senderPhone: parsedPayload.sender_number ? String(parsedPayload.sender_number) : undefined,
      cardFingerprint: parsedPayload.card_fingerprint ? String(parsedPayload.card_fingerprint) : undefined,
      rawPayload: parsedPayload,
    };
  }

  return {
    ok: false,
    status: 401,
    provider: 'unknown',
    eventStatus: 'FAILED',
    invoiceNumber: '',
    trxId: '',
    amountBDT: 0,
    gateway: 'unknown',
    error: 'Missing or unrecognized gateway signature.',
  };
}
