/**
 * Wholesale Domain Registrar Adapter (Cloudflare Workers / Edge Runtime Compatible)
 * Supports Live ResellerClub (LogicBoxes) & Namecheap APIs, plus dedicated .bd BTCL manual queue routing.
 * Strictly fails closed outside DEV_SANDBOX_MODE when registrar API credentials are missing.
 */

import { isDevSandboxMode } from './supabase';

export type RegistrarProvider = 'resellerclub' | 'namecheap' | 'btcl_manual' | 'sandbox' | 'unconfigured';

export interface RegistrarConfig {
  provider: 'resellerclub' | 'namecheap';
  apiUser: string;
  apiKey: string;
  clientIp: string;
  sandbox: boolean;
  customerId: string;
  defaultContactId: string;
  configured: boolean;
}

export interface RegistrarAvailabilityResult {
  domain: string;
  available: boolean;
  isPremium?: boolean;
  premiumPriceUSD?: number;
  source: RegistrarProvider;
}

export interface RegistrarOperationResult<T = Record<string, unknown>> {
  ok: boolean;
  configured: boolean;
  mode: 'live' | 'manual_btcl_queue' | 'sandbox' | 'unconfigured';
  provider: RegistrarProvider;
  statusCode?: number;
  orderId?: string;
  message: string;
  error?: string;
  data?: T;
}

export interface DomainContactInput {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

const BD_TLD_PATTERN = /\.(?:com\.bd|net\.bd|org\.bd|edu\.bd|gov\.bd|ac\.bd|info\.bd|bd)$/i;

export function isBdManualTld(domain: string): boolean {
  return BD_TLD_PATTERN.test(domain.trim().toLowerCase());
}

export function getRegistrarConfig(): RegistrarConfig {
  const providerRaw = (process.env.REGISTRAR_PROVIDER || 'resellerclub').trim().toLowerCase();
  const provider: 'resellerclub' | 'namecheap' =
    providerRaw === 'namecheap' ? 'namecheap' : 'resellerclub';

  const apiUser = (
    process.env.REGISTRAR_API_USER ||
    process.env.NAMECHEAP_API_USER ||
    ''
  ).trim();
  const apiKey = (
    process.env.REGISTRAR_API_KEY ||
    process.env.NAMECHEAP_API_KEY ||
    ''
  ).trim();

  const looksPlaceholder =
    !apiUser ||
    !apiKey ||
    apiUser.includes('your-resellerclub') ||
    apiKey.includes('your-resellerclub');

  return {
    provider,
    apiUser,
    apiKey,
    clientIp: (process.env.REGISTRAR_CLIENT_IP || '103.151.102.45').trim(),
    sandbox: process.env.REGISTRAR_SANDBOX === 'true',
    customerId: (process.env.REGISTRAR_CUSTOMER_ID || '').trim(),
    defaultContactId: (process.env.REGISTRAR_DEFAULT_CONTACT_ID || '').trim(),
    configured: !looksPlaceholder,
  };
}

export function isRegistrarConfigured(): boolean {
  return getRegistrarConfig().configured;
}

function getLogicBoxesBaseUrl(sandbox: boolean): string {
  return sandbox ? 'https://test.httpapi.com/api' : 'https://httpapi.com/api';
}

function getNamecheapBaseUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://api.sandbox.namecheap.com/xml.response'
    : 'https://api.namecheap.com/xml.response';
}

function splitDomainLabelAndTld(fqdn: string): { sld: string; tld: string } {
  const clean = fqdn.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const idx = clean.indexOf('.');
  if (idx <= 0) return { sld: clean, tld: 'com' };
  return {
    sld: clean.slice(0, idx),
    tld: clean.slice(idx + 1),
  };
}

function unconfiguredFailure<T = Record<string, unknown>>(
  actionLabel: string
): RegistrarOperationResult<T> {
  return {
    ok: false,
    configured: false,
    mode: 'unconfigured',
    provider: 'unconfigured',
    statusCode: 503,
    message: `Wholesale Domain Registrar API is not configured for ${actionLabel}. Set REGISTRAR_API_USER and REGISTRAR_API_KEY, or enable DEV_SANDBOX_MODE=true for local simulation.`,
    error: `Registrar credentials missing for ${actionLabel}.`,
  };
}

function extractXmlErrors(xml: string): string | null {
  if (/Status=["']OK["']/i.test(xml)) return null;
  const errMatch = xml.match(/<Error[^>]*>([\s\S]*?)<\/Error>/i);
  if (errMatch?.[1]) return errMatch[1].trim();
  const cmdErr = xml.match(/<Description>([\s\S]*?)<\/Description>/i);
  return cmdErr?.[1]?.trim() || 'Namecheap API returned an error response.';
}

function parseXmlAttr(tag: string, attr: string): string {
  const regex = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const m = tag.match(regex);
  return m?.[1] ?? '';
}

async function resolveLogicBoxesOrderId(
  cfg: RegistrarConfig,
  domain: string
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const url = new URL(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/orderid.json`);
  url.searchParams.set('auth-userid', cfg.apiUser);
  url.searchParams.set('api-key', cfg.apiKey);
  url.searchParams.set('domain-name', domain);

  const res = await fetch(url.toString(), { method: 'GET' });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Plain numeric string is normal from ResellerClub /orderid.json
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (String(obj.status || '').toUpperCase() === 'ERROR' || obj.message) {
      return { ok: false, error: String(obj.message || 'Order lookup failed') };
    }
  }

  const orderId = String(parsed).replace(/["\s]/g, '');
  if (!orderId || orderId === 'null' || orderId === 'undefined') {
    return { ok: false, error: `No registrar order ID found for ${domain}.` };
  }
  return { ok: true, orderId };
}

/**
 * Queries real Wholesale Registrar Availability & Premium pricing across up to N domains.
 * Returns null if registrar is unconfigured (caller decides DoH vs 503).
 */
export async function checkDomainsAvailability(domains: string[]): Promise<{
  configured: boolean;
  provider: RegistrarProvider;
  results: Record<string, RegistrarAvailabilityResult>;
  error?: string;
} | null> {
  const cfg = getRegistrarConfig();
  if (!cfg.configured || domains.length === 0) {
    return null;
  }

  const cleanList = Array.from(
    new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))
  );

  try {
    if (cfg.provider === 'namecheap') {
      const url = new URL(getNamecheapBaseUrl(cfg.sandbox));
      url.searchParams.set('ApiUser', cfg.apiUser);
      url.searchParams.set('ApiKey', cfg.apiKey);
      url.searchParams.set('UserName', cfg.apiUser);
      url.searchParams.set('ClientIp', cfg.clientIp);
      url.searchParams.set('Command', 'namecheap.domains.check');
      url.searchParams.set('DomainList', cleanList.join(','));

      const res = await fetch(url.toString(), { method: 'GET' });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          configured: true,
          provider: 'namecheap',
          results: {},
          error: xmlErr || `Namecheap HTTP ${res.status}`,
        };
      }

      const results: Record<string, RegistrarAvailabilityResult> = {};
      const tags = xml.match(/<DomainCheckResult\b[^>]*>/gi) || [];
      for (const tag of tags) {
        const domain = parseXmlAttr(tag, 'Domain').toLowerCase();
        if (!domain) continue;
        const available = parseXmlAttr(tag, 'Available').toLowerCase() === 'true';
        const isPremium = parseXmlAttr(tag, 'IsPremiumName').toLowerCase() === 'true';
        const premRaw = Number(parseXmlAttr(tag, 'PremiumRegistrationPrice') || '0');
        results[domain] = {
          domain,
          available,
          isPremium,
          premiumPriceUSD: isPremium && premRaw > 0 ? premRaw : undefined,
          source: 'namecheap',
        };
      }

      return { configured: true, provider: 'namecheap', results };
    }

    // ResellerClub / LogicBoxes API
    const nonBdDomains = cleanList.filter((d) => !isBdManualTld(d));
    const results: Record<string, RegistrarAvailabilityResult> = {};

    if (nonBdDomains.length > 0) {
      const slds = new Set<string>();
      const tlds = new Set<string>();
      for (const fqdn of nonBdDomains) {
        const { sld, tld } = splitDomainLabelAndTld(fqdn);
        if (sld && tld) {
          slds.add(sld);
          tlds.add(tld);
        }
      }

      const url = new URL(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/available.json`);
      url.searchParams.set('auth-userid', cfg.apiUser);
      url.searchParams.set('api-key', cfg.apiKey);
      for (const sld of slds) url.searchParams.append('domain-name', sld);
      for (const tld of tlds) url.searchParams.append('tlds', tld);

      const res = await fetch(url.toString(), { method: 'GET' });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
        return {
          configured: true,
          provider: 'resellerclub',
          results: {},
          error: String(data.message || `ResellerClub HTTP ${res.status}`),
        };
      }

      for (const [fqdn, entryRaw] of Object.entries(data)) {
        const entry = entryRaw as Record<string, unknown> | null;
        if (!entry || typeof entry !== 'object') continue;
        const statusStr = String(entry.status || '').toLowerCase();
        const available = statusStr === 'available';
        results[fqdn.toLowerCase()] = {
          domain: fqdn.toLowerCase(),
          available,
          isPremium: Boolean(entry.classkey && String(entry.classkey).includes('premium')),
          source: 'resellerclub',
        };
      }
    }

    return { configured: true, provider: 'resellerclub', results };
  } catch (err: unknown) {
    return {
      configured: true,
      provider: cfg.provider,
      results: {},
      error: err instanceof Error ? err.message : 'Registrar availability request failed',
    };
  }
}

/**
 * Registers a domain with Wholesale Registrar, or queues `.bd` domains for BTCL manual provisioning.
 */
export async function registerDomainWithRegistrar(params: {
  domain: string;
  years?: number;
  nameservers?: string[];
  protectPrivacy?: boolean;
  contact?: DomainContactInput;
}): Promise<RegistrarOperationResult<{ status: 'Active' | 'Pending'; nameservers: string[] }>> {
  const domain = params.domain.trim().toLowerCase();
  const years = Math.max(1, Math.min(10, Number(params.years || 1)));
  const nameservers =
    Array.isArray(params.nameservers) && params.nameservers.length >= 2
      ? params.nameservers
      : ['ns1.devhost.net', 'ns2.devhost.net'];
  const protectPrivacy = params.protectPrivacy !== false;

  // Dedicated .bd / BTCL manual provisioning queue (never fake instant EPP activation)
  if (isBdManualTld(domain)) {
    const manualOrderId = `BTCL-${Date.now().toString(36).toUpperCase()}`;
    return {
      ok: true,
      configured: true,
      mode: 'manual_btcl_queue',
      provider: 'btcl_manual',
      orderId: manualOrderId,
      message: `${domain} queued for BTCL manual verification & NID/trade-license compliance (Status: Pending).`,
      data: { status: 'Pending', nameservers },
    };
  }

  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        orderId: `SBX-REG-${Date.now().toString(36).toUpperCase()}`,
        message: `Domain ${domain} registered in DEV_SANDBOX_MODE simulation.`,
        data: { status: 'Active', nameservers },
      };
    }
    return unconfiguredFailure('domain registration');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const contact = params.contact || {};
      const fullName = (contact.name || process.env.REGISTRAR_CONTACT_NAME || 'DevHost Registrant').trim();
      const [firstName, ...rest] = fullName.split(/\s+/);
      const lastName = rest.join(' ') || 'Cloud';
      const email = contact.email || process.env.REGISTRAR_CONTACT_EMAIL || 'domains@devhost.net';
      const phone = contact.phone || process.env.REGISTRAR_CONTACT_PHONE || '+880.1700000000';

      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.create',
        DomainName: domain,
        Years: String(years),
        Nameservers: nameservers.join(','),
        AddFreeWhoisguard: protectPrivacy ? 'yes' : 'no',
        WGEnabled: protectPrivacy ? 'yes' : 'no',
      });

      const rolePrefixes = ['Registrant', 'Tech', 'Admin', 'AuxBilling'];
      for (const prefix of rolePrefixes) {
        form.set(`${prefix}FirstName`, firstName);
        form.set(`${prefix}LastName`, lastName);
        form.set(`${prefix}Address1`, contact.address || process.env.REGISTRAR_CONTACT_ADDRESS || 'Banani Road 11');
        form.set(`${prefix}City`, contact.city || process.env.REGISTRAR_CONTACT_CITY || 'Dhaka');
        form.set(`${prefix}StateProvince`, contact.state || process.env.REGISTRAR_CONTACT_STATE || 'Dhaka');
        form.set(`${prefix}PostalCode`, contact.postalCode || process.env.REGISTRAR_CONTACT_ZIP || '1213');
        form.set(`${prefix}Country`, contact.country || process.env.REGISTRAR_CONTACT_COUNTRY || 'BD');
        form.set(`${prefix}Phone`, phone);
        form.set(`${prefix}EmailAddress`, email);
      }

      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: res.ok ? 422 : res.status,
          message: xmlErr || `Namecheap registration failed (${res.status})`,
          error: xmlErr || 'Namecheap registration failed',
        };
      }

      const createTag = xml.match(/<DomainCreateResult\b[^>]*>/i)?.[0] || '';
      const orderId = parseXmlAttr(createTag, 'OrderID') || parseXmlAttr(createTag, 'DomainID') || `NC-${Date.now()}`;
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        orderId,
        message: `${domain} registered live via Namecheap (Order #${orderId}).`,
        data: { status: 'Active', nameservers },
      };
    }

    // ResellerClub (LogicBoxes) registration
    if (!cfg.customerId || !cfg.defaultContactId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 503,
        message:
          'REGISTRAR_CUSTOMER_ID and REGISTRAR_DEFAULT_CONTACT_ID must be configured for automated ResellerClub registrations.',
        error: 'MISSING_REGISTRAR_CONTACT_IDS',
      };
    }

    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'domain-name': domain,
      years: String(years),
      'customer-id': cfg.customerId,
      'reg-contact-id': cfg.defaultContactId,
      'admin-contact-id': cfg.defaultContactId,
      'tech-contact-id': cfg.defaultContactId,
      'billing-contact-id': cfg.defaultContactId,
      'invoice-option': 'NoInvoice',
      'protect-privacy': protectPrivacy ? 'true' : 'false',
    });
    for (const ns of nameservers) form.append('ns', ns);

    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/register.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: res.ok ? 422 : res.status,
        message: String(data.message || `ResellerClub error HTTP ${res.status}`),
        error: String(data.message || 'ResellerClub registration rejected'),
      };
    }

    const orderId = String(data.entityid || data.orderid || `RC-${Date.now()}`);
    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId,
      message: `${domain} registered live via ResellerClub (Order #${orderId}).`,
      data: { status: 'Active', nameservers },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Registrar request failed',
      error: err instanceof Error ? err.message : 'Registrar request failed',
    };
  }
}

export async function renewDomainWithRegistrar(params: {
  domain: string;
  years?: number;
  currentExpiryUnix?: number;
}): Promise<RegistrarOperationResult> {
  const domain = params.domain.trim().toLowerCase();
  const years = Math.max(1, Math.min(10, Number(params.years || 1)));

  if (isBdManualTld(domain)) {
    return {
      ok: true,
      configured: true,
      mode: 'manual_btcl_queue',
      provider: 'btcl_manual',
      orderId: `BTCL-REN-${Date.now().toString(36).toUpperCase()}`,
      message: `${domain} renewal queued for BTCL manual billing processing.`,
    };
  }

  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        orderId: `SBX-REN-${Date.now().toString(36).toUpperCase()}`,
        message: `${domain} renewed for ${years} year(s) in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('domain renewal');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.renew',
        DomainName: domain,
        Years: String(years),
      });
      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap renewal failed',
          error: xmlErr || 'Namecheap renewal failed',
        };
      }
      const tag = xml.match(/<DomainRenewResult\b[^>]*>/i)?.[0] || '';
      const orderId = parseXmlAttr(tag, 'OrderID') || `NC-REN-${Date.now()}`;
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        orderId,
        message: `${domain} renewed live via Namecheap (+${years} yr).`,
      };
    }

    const orderLookup = await resolveLogicBoxesOrderId(cfg, domain);
    if (!orderLookup.ok || !orderLookup.orderId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 404,
        message: orderLookup.error || 'Order lookup failed',
        error: orderLookup.error,
      };
    }

    const expDate = String(
      params.currentExpiryUnix || Math.floor(Date.now() / 1000) + 86400 * 30
    );
    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'order-id': orderLookup.orderId,
      years: String(years),
      'exp-date': expDate,
      'invoice-option': 'NoInvoice',
    });

    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/renew.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub renewal error'),
        error: String(data.message || 'ResellerClub renewal error'),
      };
    }

    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: orderLookup.orderId,
      message: `${domain} renewed live via ResellerClub (+${years} yr).`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Domain renewal error',
      error: err instanceof Error ? err.message : 'Domain renewal error',
    };
  }
}

export async function transferDomainWithRegistrar(params: {
  domain: string;
  eppCode: string;
}): Promise<RegistrarOperationResult> {
  const domain = params.domain.trim().toLowerCase();
  const eppCode = params.eppCode.trim();

  if (isBdManualTld(domain)) {
    return {
      ok: true,
      configured: true,
      mode: 'manual_btcl_queue',
      provider: 'btcl_manual',
      orderId: `BTCL-TRF-${Date.now().toString(36).toUpperCase()}`,
      message: `${domain} queued for BTCL manual transfer processing.`,
    };
  }

  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        orderId: `SBX-TRF-${Date.now().toString(36).toUpperCase()}`,
        message: `Inbound transfer initiated for ${domain} in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('domain transfer');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.transfer.create',
        DomainName: domain,
        Years: '1',
        EPPCode: eppCode,
      });

      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap transfer failed',
          error: xmlErr || 'Namecheap transfer failed',
        };
      }
      const tag = xml.match(/<DomainTransferCreateResult\b[^>]*>/i)?.[0] || '';
      const orderId = parseXmlAttr(tag, 'TransferID') || parseXmlAttr(tag, 'OrderID') || `NC-TRF-${Date.now()}`;
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        orderId,
        message: `Inbound transfer submitted to Namecheap (Transfer #${orderId}).`,
      };
    }

    if (!cfg.customerId || !cfg.defaultContactId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 503,
        message: 'REGISTRAR_CUSTOMER_ID and REGISTRAR_DEFAULT_CONTACT_ID are required for transfers.',
        error: 'MISSING_REGISTRAR_CONTACT_IDS',
      };
    }

    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'domain-name': domain,
      'auth-code': eppCode,
      'customer-id': cfg.customerId,
      'reg-contact-id': cfg.defaultContactId,
      'admin-contact-id': cfg.defaultContactId,
      'tech-contact-id': cfg.defaultContactId,
      'billing-contact-id': cfg.defaultContactId,
      'invoice-option': 'NoInvoice',
      'protect-privacy': 'true',
    });

    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/transfer.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub transfer rejected'),
        error: String(data.message || 'ResellerClub transfer rejected'),
      };
    }

    const orderId = String(data.entityid || data.orderid || `RC-TRF-${Date.now()}`);
    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId,
      message: `Inbound transfer submitted to ResellerClub (Order #${orderId}).`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Transfer error',
      error: err instanceof Error ? err.message : 'Transfer error',
    };
  }
}

export async function setRegistrarNameservers(
  domainRaw: string,
  nameservers: string[]
): Promise<RegistrarOperationResult> {
  const domain = domainRaw.trim().toLowerCase();
  if (isBdManualTld(domain)) {
    return {
      ok: true,
      configured: true,
      mode: 'manual_btcl_queue',
      provider: 'btcl_manual',
      message: `Nameserver update for ${domain} queued for BTCL registrar update.`,
    };
  }

  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        message: `Nameservers for ${domain} updated in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('nameserver update');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const { sld, tld } = splitDomainLabelAndTld(domain);
      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.ns.setCustom',
        SLD: sld,
        TLD: tld,
        Nameservers: nameservers.join(','),
      });

      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap nameserver update failed',
          error: xmlErr || 'Namecheap nameserver update failed',
        };
      }
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        message: `Nameservers pushed live to Namecheap root registry for ${domain}.`,
      };
    }

    const orderLookup = await resolveLogicBoxesOrderId(cfg, domain);
    if (!orderLookup.ok || !orderLookup.orderId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 404,
        message: orderLookup.error || 'Domain order lookup failed',
        error: orderLookup.error,
      };
    }

    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'order-id': orderLookup.orderId,
    });
    for (const ns of nameservers) form.append('ns', ns);

    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/modify-ns.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub modify-ns failed'),
        error: String(data.message || 'ResellerClub modify-ns failed'),
      };
    }

    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: orderLookup.orderId,
      message: `Nameservers updated at ResellerClub registry for ${domain}.`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Nameserver API request failed',
      error: err instanceof Error ? err.message : 'Nameserver API request failed',
    };
  }
}

export async function addRegistrarChildNameserver(
  domainRaw: string,
  childHostname: string,
  ipv4Address: string
): Promise<RegistrarOperationResult> {
  const domain = domainRaw.trim().toLowerCase();
  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        message: `Glue record ${childHostname} -> ${ipv4Address} simulated in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('child nameserver glue creation');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const { sld, tld } = splitDomainLabelAndTld(domain);
      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.ns.create',
        SLD: sld,
        TLD: tld,
        Nameserver: childHostname,
        IP: ipv4Address,
      });
      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap glue record failed',
          error: xmlErr || 'Namecheap glue record failed',
        };
      }
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        message: `Glue record ${childHostname} -> ${ipv4Address} created at Namecheap registry.`,
      };
    }

    const orderLookup = await resolveLogicBoxesOrderId(cfg, domain);
    if (!orderLookup.ok || !orderLookup.orderId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 404,
        message: orderLookup.error || 'Domain order lookup failed',
        error: orderLookup.error,
      };
    }

    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'order-id': orderLookup.orderId,
      cns: childHostname,
      ip: ipv4Address,
    });
    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/add-cns.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub add-cns failed'),
        error: String(data.message || 'ResellerClub add-cns failed'),
      };
    }
    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: orderLookup.orderId,
      message: `Glue record ${childHostname} -> ${ipv4Address} registered at ResellerClub.`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Child NS API failed',
      error: err instanceof Error ? err.message : 'Child NS API failed',
    };
  }
}

export async function deleteRegistrarChildNameserver(
  domainRaw: string,
  childHostname: string,
  ipv4Address?: string
): Promise<RegistrarOperationResult> {
  const domain = domainRaw.trim().toLowerCase();
  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        message: `Glue record ${childHostname} deletion simulated in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('child nameserver glue removal');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const { sld, tld } = splitDomainLabelAndTld(domain);
      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.ns.delete',
        SLD: sld,
        TLD: tld,
        Nameserver: childHostname,
      });
      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap ns.delete failed',
          error: xmlErr || 'Namecheap ns.delete failed',
        };
      }
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        message: `Glue record ${childHostname} deleted at Namecheap registry.`,
      };
    }

    const orderLookup = await resolveLogicBoxesOrderId(cfg, domain);
    if (!orderLookup.ok || !orderLookup.orderId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 404,
        message: orderLookup.error || 'Domain order lookup failed',
        error: orderLookup.error,
      };
    }

    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'order-id': orderLookup.orderId,
      cns: childHostname,
      ip: ipv4Address || '',
    });
    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/delete-cns-ip.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub delete-cns failed'),
        error: String(data.message || 'ResellerClub delete-cns failed'),
      };
    }

    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: orderLookup.orderId,
      message: `Glue record ${childHostname} deleted at ResellerClub.`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Child NS delete failed',
      error: err instanceof Error ? err.message : 'Child NS delete failed',
    };
  }
}

export async function setRegistrarLockState(
  domainRaw: string,
  locked: boolean
): Promise<RegistrarOperationResult> {
  const domain = domainRaw.trim().toLowerCase();
  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        message: `Registrar lock ${locked ? 'enabled' : 'disabled'} in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('registrar theft lock update');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: 'namecheap.domains.setRegistrarLock',
        DomainName: domain,
        LockAction: locked ? 'LOCK' : 'UNLOCK',
      });
      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap registrar lock failed',
          error: xmlErr || 'Namecheap registrar lock failed',
        };
      }
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        message: `Registrar lock ${locked ? 'ENABLED' : 'DISABLED'} live at Namecheap.`,
      };
    }

    const orderLookup = await resolveLogicBoxesOrderId(cfg, domain);
    if (!orderLookup.ok || !orderLookup.orderId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 404,
        message: orderLookup.error || 'Domain order lookup failed',
        error: orderLookup.error,
      };
    }

    const endpoint = locked
      ? '/domains/enable-theft-protection.json'
      : '/domains/disable-theft-protection.json';
    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'order-id': orderLookup.orderId,
    });
    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub theft protection update failed'),
        error: String(data.message || 'ResellerClub theft protection update failed'),
      };
    }
    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: orderLookup.orderId,
      message: `Theft protection ${locked ? 'ENABLED' : 'DISABLED'} live at ResellerClub.`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'Registrar lock failed',
      error: err instanceof Error ? err.message : 'Registrar lock failed',
    };
  }
}

export async function setRegistrarWhoisPrivacy(
  domainRaw: string,
  enabled: boolean
): Promise<RegistrarOperationResult> {
  const domain = domainRaw.trim().toLowerCase();
  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        message: `WHOIS privacy ${enabled ? 'enabled' : 'disabled'} in DEV_SANDBOX_MODE.`,
      };
    }
    return unconfiguredFailure('WHOIS privacy shield update');
  }

  try {
    if (cfg.provider === 'namecheap') {
      const infoUrl = new URL(getNamecheapBaseUrl(cfg.sandbox));
      infoUrl.searchParams.set('ApiUser', cfg.apiUser);
      infoUrl.searchParams.set('ApiKey', cfg.apiKey);
      infoUrl.searchParams.set('UserName', cfg.apiUser);
      infoUrl.searchParams.set('ClientIp', cfg.clientIp);
      infoUrl.searchParams.set('Command', 'namecheap.domains.getInfo');
      infoUrl.searchParams.set('DomainName', domain);

      const infoRes = await fetch(infoUrl.toString());
      const infoXml = await infoRes.text();
      const wgTag = infoXml.match(/<Whoisguard\b[^>]*>/i)?.[0] || '';
      const wgId = parseXmlAttr(wgTag, 'ID');
      if (!wgId) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 404,
          message: `No Namecheap WhoisGuard subscription attached to ${domain}.`,
          error: 'MISSING_WHOISGUARD_ID',
        };
      }

      const form = new URLSearchParams({
        ApiUser: cfg.apiUser,
        ApiKey: cfg.apiKey,
        UserName: cfg.apiUser,
        ClientIp: cfg.clientIp,
        Command: enabled ? 'namecheap.whoisguard.enable' : 'namecheap.whoisguard.disable',
        WhoisguardID: wgId,
        ForwardedToEmail: process.env.REGISTRAR_CONTACT_EMAIL || 'privacy@devhost.net',
      });
      const res = await fetch(getNamecheapBaseUrl(cfg.sandbox), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap WhoisGuard toggle failed',
          error: xmlErr || 'Namecheap WhoisGuard toggle failed',
        };
      }

      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        message: `WhoisGuard privacy ${enabled ? 'ENABLED' : 'DISABLED'} live at Namecheap.`,
      };
    }

    const orderLookup = await resolveLogicBoxesOrderId(cfg, domain);
    if (!orderLookup.ok || !orderLookup.orderId) {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 404,
        message: orderLookup.error || 'Domain order lookup failed',
        error: orderLookup.error,
      };
    }

    const form = new URLSearchParams({
      'auth-userid': cfg.apiUser,
      'api-key': cfg.apiKey,
      'order-id': orderLookup.orderId,
      'protect-privacy': enabled ? 'true' : 'false',
      reason: 'Customer WHOIS privacy setting update',
    });
    const res = await fetch(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/modify-privacy-protection.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub WHOIS privacy update failed'),
        error: String(data.message || 'ResellerClub WHOIS privacy update failed'),
      };
    }

    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: orderLookup.orderId,
      message: `WHOIS privacy protection ${enabled ? 'ENABLED' : 'DISABLED'} live at ResellerClub.`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'WHOIS privacy request failed',
      error: err instanceof Error ? err.message : 'WHOIS privacy request failed',
    };
  }
}

export async function getRegistrarEppCode(
  domainRaw: string
): Promise<RegistrarOperationResult<{ eppCode: string }>> {
  const domain = domainRaw.trim().toLowerCase();
  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    if (isDevSandboxMode()) {
      return {
        ok: true,
        configured: false,
        mode: 'sandbox',
        provider: 'sandbox',
        message: 'EPP auth code retrieved in DEV_SANDBOX_MODE.',
        data: { eppCode: 'EPP-SBX-AUTH99' },
      };
    }
    return unconfiguredFailure('EPP transfer code lookup');
  }

  try {
    if (cfg.provider === 'namecheap') {
      // Namecheap does not expose cleartext EPP via domains.getInfo directly; check OrderDetails if supported
      const infoUrl = new URL(getNamecheapBaseUrl(cfg.sandbox));
      infoUrl.searchParams.set('ApiUser', cfg.apiUser);
      infoUrl.searchParams.set('ApiKey', cfg.apiKey);
      infoUrl.searchParams.set('UserName', cfg.apiUser);
      infoUrl.searchParams.set('ClientIp', cfg.clientIp);
      infoUrl.searchParams.set('Command', 'namecheap.domains.getInfo');
      infoUrl.searchParams.set('DomainName', domain);

      const res = await fetch(infoUrl.toString());
      const xml = await res.text();
      const xmlErr = extractXmlErrors(xml);
      if (!res.ok || xmlErr) {
        return {
          ok: false,
          configured: true,
          mode: 'live',
          provider: 'namecheap',
          statusCode: 422,
          message: xmlErr || 'Namecheap getInfo failed',
          error: xmlErr || 'Namecheap getInfo failed',
        };
      }
      return {
        ok: true,
        configured: true,
        mode: 'live',
        provider: 'namecheap',
        message: 'Retrieved domain lock & authorization metadata from Namecheap.',
        data: { eppCode: '' },
      };
    }

    const url = new URL(`${getLogicBoxesBaseUrl(cfg.sandbox)}/domains/details-by-name.json`);
    url.searchParams.set('auth-userid', cfg.apiUser);
    url.searchParams.set('api-key', cfg.apiKey);
    url.searchParams.set('domain-name', domain);
    url.searchParams.set('options', 'OrderDetails');

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || String(data.status || '').toUpperCase() === 'ERROR') {
      return {
        ok: false,
        configured: true,
        mode: 'live',
        provider: 'resellerclub',
        statusCode: 422,
        message: String(data.message || 'ResellerClub details-by-name failed'),
        error: String(data.message || 'ResellerClub details-by-name failed'),
      };
    }

    const domSecret = String(data.domsecret || '').trim();
    return {
      ok: true,
      configured: true,
      mode: 'live',
      provider: 'resellerclub',
      orderId: String(data.orderid || ''),
      message: domSecret
        ? `Live EPP code retrieved from ResellerClub for ${domain}.`
        : 'ResellerClub domain details retrieved; falling back to encrypted local vault.',
      data: { eppCode: domSecret },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      mode: 'live',
      provider: cfg.provider,
      statusCode: 502,
      message: err instanceof Error ? err.message : 'EPP lookup failed',
      error: err instanceof Error ? err.message : 'EPP lookup failed',
    };
  }
}

export async function getRegistrarHealthStatus(): Promise<{
  configured: boolean;
  provider: RegistrarProvider;
  sandbox: boolean;
  healthy: boolean;
  message: string;
}> {
  const cfg = getRegistrarConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      provider: 'unconfigured',
      sandbox: cfg.sandbox,
      healthy: false,
      message: 'Registrar API credentials (REGISTRAR_API_USER / REGISTRAR_API_KEY) not configured.',
    };
  }

  const probe = await checkDomainsAvailability(['devhost-healthcheck-probe.com']);
  const ok = Boolean(probe && !probe.error);
  return {
    configured: true,
    provider: cfg.provider,
    sandbox: cfg.sandbox,
    healthy: ok,
    message: ok
      ? `Connected cleanly to ${cfg.provider} (${cfg.sandbox ? 'sandbox' : 'production'}).`
      : `Registrar check warning: ${probe?.error || 'Connectivity failure'}`,
  };
}
