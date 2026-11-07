/**
 * DevHost Cloud - Anti-Phishing & Upstream Server Reputation Abuse Shield
 * Proactively blocks and quarantines phishing domains, brand spoofing, and scam sites.
 * 100% Edge-Compatible (Cloudflare Workers & Web Standards)
 */

import { getServiceSupabase, isSupabaseConfigured } from './supabase';
import { sendTelegramAlert } from './adminNotifier';

export interface PhishingScanResult {
  isThreat: boolean;
  riskScore: number; // 0 - 100
  threatCategory: 'phishing_brand_spoof' | 'crypto_scam_pattern' | 'malware_signature' | 'outbound_smtp_spam' | null;
  matchedRule: string | null;
  matchedBrand: string | null;
  matchedDeceptiveTerm: string | null;
  recommendedAction: 'allow' | 'quarantined_abuse' | 'block_immediately';
  reason: string;
}

// Protected financial, banking and high-profile target brands
const HIGH_RISK_BRANDS = [
  { name: 'bKash', pattern: /bkash/i, category: 'phishing_brand_spoof' as const },
  { name: 'Nagad', pattern: /nagad/i, category: 'phishing_brand_spoof' as const },
  { name: 'Rocket DBBL', pattern: /(?:rocket|dbbl)/i, category: 'phishing_brand_spoof' as const },
  { name: 'Upay', pattern: /upay/i, category: 'phishing_brand_spoof' as const },
  { name: 'PayPal', pattern: /paypal/i, category: 'phishing_brand_spoof' as const },
  { name: 'Binance', pattern: /binance/i, category: 'crypto_scam_pattern' as const },
  { name: 'MetaMask', pattern: /metamask/i, category: 'crypto_scam_pattern' as const },
  { name: 'Sonali Bank', pattern: /sonalibank/i, category: 'phishing_brand_spoof' as const },
  { name: 'Islami Bank', pattern: /islami[-]?bank/i, category: 'phishing_brand_spoof' as const },
  { name: 'BRAC Bank', pattern: /brac[-]?bank/i, category: 'phishing_brand_spoof' as const },
  { name: 'City Bank', pattern: /city[-]?bank/i, category: 'phishing_brand_spoof' as const },
  { name: 'Facebook Login', pattern: /facebook[-]?login/i, category: 'phishing_brand_spoof' as const },
  { name: 'Google Security', pattern: /google[-]?security/i, category: 'phishing_brand_spoof' as const },
  { name: 'Trust Wallet', pattern: /trust[-]?wallet/i, category: 'crypto_scam_pattern' as const },
];

// Deceptive / action verbs typically used in credential harvesting
const DECEPTIVE_ACTION_TERMS = [
  'claim', 'reward', 'bonus', 'verify', 'verification', 'pin', 'login', 'signin',
  'security', 'update', 'recover', 'wallet', 'airdrop', 'free', 'giveaway',
  'portal', 'auth', 'account-update', 'otp', 'unlock', 'prize',
];

// High-abuse TLDs commonly used by disposable scammers
const HIGH_ABUSE_TLDS = new Set(['.top', '.xyz', '.buzz', '.click', '.tk', '.ml', '.ga', '.cf', '.gq', '.shop']);

/**
 * Deterministic Phishing & Brand-Spoofing Hostname Scanner
 */
export function scanDomainForPhishing(hostname: string): PhishingScanResult {
  const clean = hostname.toLowerCase().trim().replace(/^www\./, '');
  let riskScore = 0;
  let matchedBrand: string | null = null;
  let matchedCategory: 'phishing_brand_spoof' | 'crypto_scam_pattern' | null = null;
  let matchedTerm: string | null = null;

  // 1. Check for brand names
  for (const brand of HIGH_RISK_BRANDS) {
    if (brand.pattern.test(clean)) {
      matchedBrand = brand.name;
      matchedCategory = brand.category;
      riskScore += 50;
      break;
    }
  }

  // 2. Check for deceptive action terms
  if (matchedBrand) {
    for (const term of DECEPTIVE_ACTION_TERMS) {
      if (clean.includes(term)) {
        matchedTerm = term;
        riskScore += 35;
        break;
      }
    }
  }

  // 3. Check for high-abuse TLDs
  const ext = '.' + clean.split('.').pop();
  if (matchedBrand && HIGH_ABUSE_TLDS.has(ext)) {
    riskScore += 15;
  }

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  const isThreat = riskScore >= 85;

  if (isThreat) {
    const rule = `Brand Spoofing: ${matchedBrand} + Deceptive Action: ${matchedTerm || 'Suspicious Subdomain'}`;
    return {
      isThreat: true,
      riskScore,
      threatCategory: matchedCategory || 'phishing_brand_spoof',
      matchedRule: rule,
      matchedBrand,
      matchedDeceptiveTerm: matchedTerm,
      recommendedAction: 'quarantined_abuse',
      reason: `High-risk phishing signature detected: Domain "${clean}" combines trusted brand "${matchedBrand}" with credential-harvesting keyword "${matchedTerm}". Auto-quarantined to protect upstream server reputation.`,
    };
  }

  return {
    isThreat: false,
    riskScore,
    threatCategory: null,
    matchedRule: null,
    matchedBrand,
    matchedDeceptiveTerm: matchedTerm,
    recommendedAction: 'allow',
    reason: 'Domain name passed automated phishing heuristic checks.',
  };
}

/**
 * Quarantines an abusive domain and dispatches alerts to the admin/founder
 */
export async function quarantineAbuseDomain({
  hostname,
  userId,
  serviceId,
  scanResult,
}: {
  hostname: string;
  userId?: string;
  serviceId?: string;
  scanResult: PhishingScanResult;
}): Promise<void> {
  const alertMsg = `🚨 <b>CRITICAL PHISHING ATTEMPT BLOCKED</b>\n\n` +
    `• <b>Hostname:</b> <code>${hostname}</code>\n` +
    `• <b>Risk Score:</b> ${scanResult.riskScore}/100\n` +
    `• <b>Category:</b> ${scanResult.threatCategory}\n` +
    `• <b>Matched Rule:</b> ${scanResult.matchedRule}\n` +
    `• <b>Enforcement:</b> Quarantined pending admin review. Zero activation permitted.`;

  // 1. Send Telegram Alert to Founder
  sendTelegramAlert(alertMsg).catch(() => {});

  // 2. Persist to Supabase
  if (isSupabaseConfigured()) {
    try {
      const db = getServiceSupabase();
      await db.from('abuse_quarantine_events').insert({
        user_id: userId || null,
        service_id: serviceId || null,
        flagged_hostname: hostname,
        threat_category: scanResult.threatCategory || 'phishing_brand_spoof',
        matched_rule: scanResult.matchedRule || 'Brand heuristic match',
        risk_score: scanResult.riskScore,
        enforcement_action: 'quarantined_pending_review',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[AbuseShield Quarantine Event Write Notice]', err);
    }
  }
}
