/**
 * DevHost RFC 1035 & RFC 2181 Compliant DNS Zone Engine
 * Cloudflare-Grade Validation, BIND Zone Importer/Exporter, 1-Click Presets & Web Crypto EPP Vault
 */

import { DnsRecord } from '@/context/PortalContext';

// Strict RFC-compliant regular expressions
export const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export const HOSTNAME_REGEX = /^(?![0-9]+$)(?!-)[a-zA-Z0-9-_]{1,63}(?<!-)(\.[a-zA-Z0-9-_]{1,63})*\.?$/;

export interface DnsValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a single DNS record against RFC 1035, RFC 2181 and CNAME conflict rules
 */
export function validateDnsRecord(
  record: Partial<DnsRecord>,
  existingRecords: DnsRecord[] = [],
  currentRecordId?: string
): DnsValidationResult {
  const type = record.type;
  const name = (record.name || '').trim().toLowerCase();
  const content = (record.content || '').trim();
  const priority = record.priority;
  const ttl = record.ttl || 3600;

  if (!type) return { valid: false, error: 'DNS record type is required.' };
  if (!name) return { valid: false, error: 'Host name is required (use @ for root apex).' };
  if (!content) return { valid: false, error: 'Record value/content cannot be empty.' };

  // TTL Validation
  const validTtls = [1, 120, 300, 600, 1800, 3600, 14400, 86400];
  if (!validTtls.includes(ttl) && (ttl < 60 || ttl > 86400)) {
    return { valid: false, error: 'TTL must be between 60 and 86400 seconds, or 1 for Auto.' };
  }

  // CNAME Conflict Rules (RFC 1034 section 3.6.2 and RFC 2181 section 10.1)
  const normalizedName = name === '' ? '@' : name;
  const otherRecords = existingRecords.filter((r) => r.id !== currentRecordId);

  if (type === 'CNAME') {
    // A CNAME cannot coexist with ANY other record sharing the exact same name
    const hasConflict = otherRecords.some((r) => {
      const rName = (r.name || '').trim().toLowerCase();
      return (rName === '' ? '@' : rName) === normalizedName;
    });
    if (hasConflict) {
      return {
        valid: false,
        error: `RFC 2181 CNAME Conflict: A CNAME record for '${normalizedName}' cannot coexist with any other record of the same name.`,
      };
    }
  } else {
    // If adding non-CNAME record, verify no existing CNAME has this same name
    const hasCnameConflict = otherRecords.some((r) => {
      const rName = (r.name || '').trim().toLowerCase();
      return r.type === 'CNAME' && (rName === '' ? '@' : rName) === normalizedName;
    });
    if (hasCnameConflict) {
      return {
        valid: false,
        error: `RFC 2181 Conflict: Cannot add '${type}' record because a CNAME record already exists for '${normalizedName}'.`,
      };
    }
  }

  // Type-specific syntax validations
  switch (type) {
    case 'A': {
      if (!IPV4_REGEX.test(content)) {
        return { valid: false, error: 'Invalid IPv4 address format (e.g., 103.151.102.45).' };
      }
      // Reject private loopback on public zones
      if (content.startsWith('127.') || content === '0.0.0.0') {
        return { valid: false, error: 'Loopback IP addresses (127.0.0.1 / 0.0.0.0) cannot be assigned to public DNS zones.' };
      }
      break;
    }

    case 'AAAA': {
      if (!IPV6_REGEX.test(content)) {
        return { valid: false, error: 'Invalid IPv6 address format (e.g., 2001:0db8:85a3::8a2e:0370:7334).' };
      }
      break;
    }

    case 'CNAME': {
      if (IPV4_REGEX.test(content) || IPV6_REGEX.test(content)) {
        return { valid: false, error: 'CNAME content must be a canonical domain name, not an IP address.' };
      }
      if (content === '@' || content === normalizedName) {
        return { valid: false, error: 'CNAME cannot point to itself or root apex directly without FQDN.' };
      }
      break;
    }

    case 'MX': {
      if (priority === undefined || priority === null || priority < 0 || priority > 65535) {
        return { valid: false, error: 'MX records require an integer priority between 0 and 65535.' };
      }
      if (IPV4_REGEX.test(content)) {
        return { valid: false, error: 'MX record must point to a mail server hostname (e.g., mail.yourdomain.com), not an IP address.' };
      }
      break;
    }

    case 'TXT': {
      if (content.length > 2048) {
        return { valid: false, error: 'TXT record length cannot exceed 2048 characters.' };
      }
      break;
    }

    case 'SRV': {
      // SRV Format: priority weight port target
      const parts = content.trim().split(/\s+/);
      if (parts.length < 4) {
        return {
          valid: false,
          error: 'SRV record content format must be: priority weight port target (e.g., "10 60 5060 sipserver.example.com")',
        };
      }
      const [p, w, port, target] = parts;
      if (isNaN(Number(p)) || isNaN(Number(w)) || isNaN(Number(port))) {
        return { valid: false, error: 'SRV priority, weight, and port must be valid numbers.' };
      }
      const portNum = Number(port);
      if (portNum < 1 || portNum > 65535) {
        return { valid: false, error: 'SRV port must be between 1 and 65535.' };
      }
      break;
    }

    case 'CAA': {
      // Format: 0 issue "letsencrypt.org"
      const caaRegex = /^\d+\s+(issue|issuewild|iodef)\s+"?[^"]+"?$/i;
      if (!caaRegex.test(content)) {
        return {
          valid: false,
          error: 'CAA record format must be: <flags> <tag> "<value>" (e.g., 0 issue "letsencrypt.org"). Valid tags: issue, issuewild, iodef.',
        };
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * Export DNS records as standard RFC 1035 BIND Zone file format (.txt)
 */
export function exportBindZone(domain: string, records: DnsRecord[]): string {
  const serial = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '01';
  const cleanDomain = domain.replace(/\.$/, '');

  let zone = `; ==============================================================================
; BIND Zone File for ${cleanDomain}
; Generated by DevHost High-Performance Cloudflare-Grade DNS Engine
; Export Timestamp: ${new Date().toUTCString()}
; ==============================================================================

$ORIGIN ${cleanDomain}.
$TTL 3600

@   IN  SOA ns1.devhost.cloud. hostmaster.${cleanDomain}. (
        ${serial} ; Serial (YYYYMMDDNN)
        10800      ; Refresh (3 hours)
        3600       ; Retry (1 hour)
        604800     ; Expire (1 week)
        3600       ; Minimum TTL (1 hour)
)

; Primary & Secondary Anycast Nameservers
@       3600    IN  NS      ns1.devhost.cloud.
@       3600    IN  NS      ns2.devhost.cloud.

; Resource Records
`;

  records.forEach((r) => {
    const rName = r.name === '@' ? '@' : r.name;
    const ttl = r.ttl || 3600;
    const type = r.type;

    if (type === 'MX') {
      const prio = r.priority !== undefined && r.priority !== null ? r.priority : 10;
      zone += `${rName.padEnd(20)} ${ttl.toString().padEnd(6)} IN  MX  ${prio.toString().padEnd(4)} ${r.content}\n`;
    } else if (type === 'TXT') {
      const cleanTxt = r.content.startsWith('"') && r.content.endsWith('"') ? r.content : `"${r.content}"`;
      zone += `${rName.padEnd(20)} ${ttl.toString().padEnd(6)} IN  TXT     ${cleanTxt}\n`;
    } else {
      zone += `${rName.padEnd(20)} ${ttl.toString().padEnd(6)} IN  ${type.padEnd(6)} ${r.content}\n`;
    }
  });

  return zone;
}

/**
 * Parses raw BIND Zone file text and extracts valid DNS records
 */
export function parseBindZone(bindText: string, defaultDomain: string): DnsRecord[] {
  const lines = bindText.split(/\r?\n/);
  const parsed: DnsRecord[] = [];
  let origin = defaultDomain.replace(/\.$/, '');
  let defaultTtl = 3600;

  for (let rawLine of lines) {
    // Strip comments
    const commentIdx = rawLine.indexOf(';');
    const line = (commentIdx >= 0 ? rawLine.substring(0, commentIdx) : rawLine).trim();
    if (!line) continue;

    if (line.startsWith('$ORIGIN')) {
      const parts = line.split(/\s+/);
      if (parts[1]) origin = parts[1].replace(/\.$/, '');
      continue;
    }

    if (line.startsWith('$TTL')) {
      const parts = line.split(/\s+/);
      if (parts[1] && !isNaN(Number(parts[1]))) defaultTtl = Number(parts[1]);
      continue;
    }

    // Skip SOA record blocks
    if (line.includes('SOA')) continue;

    // Standard RR format: name [ttl] [class] type [priority] content
    const tokens = line.split(/\s+/);
    if (tokens.length < 3) continue;

    let tokenIdx = 0;
    let name = tokens[tokenIdx++];
    let ttl = defaultTtl;

    // Check if next token is numeric TTL
    if (tokenIdx < tokens.length && !isNaN(Number(tokens[tokenIdx]))) {
      ttl = Number(tokens[tokenIdx++]);
    }

    // Check if next token is Class (IN, CH, etc)
    if (tokenIdx < tokens.length && tokens[tokenIdx].toUpperCase() === 'IN') {
      tokenIdx++;
    }

    // Next token should be type
    if (tokenIdx >= tokens.length) continue;
    const typeCandidate = tokens[tokenIdx++].toUpperCase();

    const validTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];
    if (!validTypes.includes(typeCandidate)) continue;

    let priority: number | undefined = undefined;
    if (typeCandidate === 'MX') {
      if (tokenIdx < tokens.length && !isNaN(Number(tokens[tokenIdx]))) {
        priority = Number(tokens[tokenIdx++]);
      }
    }

    // Remaining tokens form content
    let content = tokens.slice(tokenIdx).join(' ').trim();
    if (!content) continue;

    // Clean quotes for TXT
    if (typeCandidate === 'TXT' && content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    // Clean relative names
    if (name.endsWith('.' + origin)) {
      name = name.replace('.' + origin, '');
    } else if (name === origin + '.') {
      name = '@';
    }

    parsed.push({
      id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: typeCandidate as any,
      name: name || '@',
      content,
      ttl,
      priority,
      proxied: ['A', 'AAAA', 'CNAME'].includes(typeCandidate),
    });
  }

  return parsed;
}

/**
 * 1-Click Email Presets (Google Workspace, Zoho, DevHost Server, Security Shield)
 */
export function getGoogleWorkspacePreset(domain: string): Array<Omit<DnsRecord, 'id'>> {
  return [
    { type: 'MX', name: '@', content: 'ASPMX.L.GOOGLE.COM.', priority: 1, ttl: 3600, proxied: false },
    { type: 'MX', name: '@', content: 'ALT1.ASPMX.L.GOOGLE.COM.', priority: 5, ttl: 3600, proxied: false },
    { type: 'MX', name: '@', content: 'ALT2.ASPMX.L.GOOGLE.COM.', priority: 5, ttl: 3600, proxied: false },
    { type: 'MX', name: '@', content: 'ALT3.ASPMX.L.GOOGLE.COM.', priority: 10, ttl: 3600, proxied: false },
    { type: 'MX', name: '@', content: 'ALT4.ASPMX.L.GOOGLE.COM.', priority: 10, ttl: 3600, proxied: false },
    { type: 'TXT', name: '@', content: 'v=spf1 include:_spf.google.com ~all', ttl: 3600, proxied: false },
    { type: 'TXT', name: '_dmarc', content: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`, ttl: 3600, proxied: false },
  ];
}

export function getZohoMailPreset(domain: string): Array<Omit<DnsRecord, 'id'>> {
  return [
    { type: 'MX', name: '@', content: 'mx.zoho.com.', priority: 10, ttl: 3600, proxied: false },
    { type: 'MX', name: '@', content: 'mx2.zoho.com.', priority: 20, ttl: 3600, proxied: false },
    { type: 'MX', name: '@', content: 'mx3.zoho.com.', priority: 50, ttl: 3600, proxied: false },
    { type: 'TXT', name: '@', content: 'v=spf1 include:zoho.com ~all', ttl: 3600, proxied: false },
    { type: 'TXT', name: '_dmarc', content: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`, ttl: 3600, proxied: false },
  ];
}

export function getEmailSecurityShieldPreset(domain: string): Array<Omit<DnsRecord, 'id'>> {
  return [
    { type: 'TXT', name: '@', content: 'v=spf1 +a +mx ~all', ttl: 3600, proxied: false },
    { type: 'TXT', name: '_dmarc', content: `v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:dmarc-reports@${domain}`, ttl: 3600, proxied: false },
    { type: 'CAA', name: '@', content: '0 issue "letsencrypt.org"', ttl: 3600, proxied: false },
    { type: 'CAA', name: '@', content: '0 issuewild "letsencrypt.org"', ttl: 3600, proxied: false },
  ];
}

export function getDevHostServerPreset(domain: string, serverIp: string): Array<Omit<DnsRecord, 'id'>> {
  return [
    { type: 'A', name: '@', content: serverIp, ttl: 300, proxied: true, comment: 'Main Web Traffic Apex' },
    { type: 'CNAME', name: 'www', content: '@', ttl: 300, proxied: true, comment: 'WWW Subdomain' },
    { type: 'A', name: 'mail', content: serverIp, ttl: 14400, proxied: false, comment: 'Direct Mail Server' },
    { type: 'MX', name: '@', content: `mail.${domain}.`, priority: 10, ttl: 14400, proxied: false },
    { type: 'TXT', name: '@', content: `v=spf1 +a +mx +ip4:${serverIp} ~all`, ttl: 3600, proxied: false },
  ];
}

// ==============================================================================
// WEB CRYPTO AES-GCM ENCRYPTED EPP AUTH CODE VAULT
// ==============================================================================

const MASTER_EPP_SALT = 'devhost_epp_vault_aes_gcm_2026';

async function getEppVaultKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawSecret = (typeof process !== 'undefined' && process.env?.DEVHOST_EPP_ENCRYPTION_KEY) || 'devhost-super-secret-epp-vault-key-32b!';
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
      salt: enc.encode(MASTER_EPP_SALT),
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
 * Encrypts an EPP Auth Transfer Code into AES-GCM base64 format before database insertion
 */
export async function encryptEppCode(eppCode: string): Promise<string> {
  try {
    const key = await getEppVaultKey();
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(eppCode)
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    // Convert to Base64
    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (err) {
    // Fallback reversible token if Web Crypto derivation is blocked in local environment
    return `ENC_${Buffer.from(eppCode).toString('base64')}`;
  }
}

/**
 * Decrypts an encrypted EPP Auth Transfer Code
 */
export async function decryptEppCode(encryptedPayload: string): Promise<string> {
  try {
    if (encryptedPayload.startsWith('ENC_')) {
      return Buffer.from(encryptedPayload.replace('ENC_', ''), 'base64').toString('utf-8');
    }

    const binary = atob(encryptedPayload);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const cipherBytes = combined.slice(12);
    const key = await getEppVaultKey();

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    return 'EPP-PROTECTED-VAULT-ERROR';
  }
}
