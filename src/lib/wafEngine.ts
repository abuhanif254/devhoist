import { isSupabaseConfigured, getServiceSupabase } from './supabase';

export interface EdgeWafRule {
  id: string;
  rule_type: 'ip_address' | 'email_domain' | 'payment_wallet_number' | 'user_account' | 'country_code';
  target_value: string;
  action: 'block_403' | 'challenge_2fa' | 'freeze_withdrawals' | 'whitelist_bypass';
  reason: string;
  triggered_count: number;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SecurityLockdownConfig {
  under_attack_mode: boolean;
  freeze_all_withdrawals: boolean;
  block_new_signups: boolean;
  require_2fa_for_all: boolean;
  maintenance_mode: boolean;
  strict_ip_country_whitelist?: boolean;
}

// -----------------------------------------------------------------------------
// IN-MEMORY FAST EDGE LRU/TTL CACHE (15-SECOND REFRESH TO PROTECT LATENCY)
// -----------------------------------------------------------------------------
let rulesCache: EdgeWafRule[] | null = null;
let rulesCacheTimestamp = 0;
const CACHE_TTL_MS = 15_000;

let lockdownCache: SecurityLockdownConfig | null = null;
let lockdownCacheTimestamp = 0;

/**
 * Extract clean client IP address from Edge request headers
 */
type HeaderContainer = Headers | Record<string, string | string[] | undefined>;

function readHeaderValue(headers: HeaderContainer, key: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(key) ?? undefined;
  }
  const val = (headers as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(val) ? val[0] : val;
}

export function getClientIp(request: Request | { headers: HeaderContainer }): string {
  const headers = request.headers;
  const cfConnectingIp = readHeaderValue(headers, 'cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.split(',')[0].trim();

  const xRealIp = readHeaderValue(headers, 'x-real-ip');
  if (xRealIp) return xRealIp.split(',')[0].trim();

  const xForwardedFor = readHeaderValue(headers, 'x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();

  return '127.0.0.1';
}

/**
 * Fetch all active WAF rules with cached fallback
 */
export async function getActiveWafRules(): Promise<EdgeWafRule[]> {
  const now = Date.now();
  if (rulesCache && now - rulesCacheTimestamp < CACHE_TTL_MS) {
    return rulesCache;
  }

  if (!isSupabaseConfigured()) {
    // Baseline simulated bad actors when database is offline
    return [
      {
        id: 'mock-waf-1',
        rule_type: 'ip_address',
        target_value: '185.220.101.45',
        action: 'block_403',
        reason: 'Repeated fake bKash trxID brute-force submission',
        triggered_count: 14,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'mock-waf-2',
        rule_type: 'email_domain',
        target_value: 'tempmail.org',
        action: 'block_403',
        reason: 'Disposable fake email domain',
        triggered_count: 42,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'mock-waf-3',
        rule_type: 'payment_wallet_number',
        target_value: '01999999999',
        action: 'freeze_withdrawals',
        reason: 'Known fraudulent wallet reported across multiple chargeback alerts',
        triggered_count: 3,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];
  }

  try {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('edge_waf_rules')
      .select('*')
      .eq('is_active', true);

    if (error || !data) {
      return rulesCache || [];
    }

    rulesCache = data as EdgeWafRule[];
    rulesCacheTimestamp = now;
    return rulesCache;
  } catch (err) {
    console.warn('[Edge WAF Fetch Warning]:', err);
    return rulesCache || [];
  }
}

/**
 * Fast Edge WAF evaluation against IP, email, or wallet
 */
export async function checkEdgeWaf(
  ip: string,
  email?: string,
  wallet?: string
): Promise<{ blocked: boolean; action?: string; reason?: string; rule?: EdgeWafRule }> {
  const rules = await getActiveWafRules();

  // 1. Check IP address
  const ipRule = rules.find((r) => r.rule_type === 'ip_address' && r.target_value === ip);
  if (ipRule) {
    if (ipRule.action === 'block_403') {
      return { blocked: true, action: 'block_403', reason: ipRule.reason, rule: ipRule };
    }
  }

  // 2. Check Email domain
  if (email && email.includes('@')) {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    const emailRule = rules.find(
      (r) => r.rule_type === 'email_domain' && (r.target_value.toLowerCase() === domain || r.target_value === email)
    );
    if (emailRule && emailRule.action === 'block_403') {
      return { blocked: true, action: 'block_403', reason: emailRule.reason, rule: emailRule };
    }
  }

  // 3. Check Wallet Number
  if (wallet) {
    const cleanWallet = wallet.replace(/[^0-9]/g, '');
    const walletRule = rules.find(
      (r) => r.rule_type === 'payment_wallet_number' && r.target_value === cleanWallet
    );
    if (walletRule) {
      if (walletRule.action === 'block_403') {
        return { blocked: true, action: 'block_403', reason: walletRule.reason, rule: walletRule };
      }
      if (walletRule.action === 'freeze_withdrawals') {
        return { blocked: true, action: 'freeze_withdrawals', reason: walletRule.reason, rule: walletRule };
      }
    }
  }

  return { blocked: false };
}

/**
 * Automatically ban/blacklist a bad actor entity and trigger fraud alerts
 */
export async function triggerAutoWafRule(
  targetValue: string,
  ruleType: 'ip_address' | 'email_domain' | 'payment_wallet_number' | 'user_account',
  reason: string,
  action: 'block_403' | 'challenge_2fa' | 'freeze_withdrawals' = 'block_403',
  createdBy?: string
): Promise<boolean> {
  // Invalidate cache immediately
  rulesCache = null;

  if (!isSupabaseConfigured()) {
    console.warn(`[Edge WAF Auto-Ban Offline]: ${ruleType}=${targetValue} action=${action} reason=${reason}`);
    return true;
  }

  try {
    const db = getServiceSupabase();

    // 1. Upsert WAF rule
    const { error: wafError } = await db
      .from('edge_waf_rules')
      .upsert(
        {
          rule_type: ruleType,
          target_value: targetValue.trim(),
          action,
          reason,
          is_active: true,
          created_by: createdBy || null,
        },
        { onConflict: 'rule_type, target_value' }
      );

    if (wafError) console.warn('[WAF Rule Upsert Warning]:', wafError);

    // 2. Record critical fraud alert
    await db.from('fraud_alerts').insert({
      user_id: createdBy || null,
      severity: 'critical',
      alert_type: 'WAF_AUTO_BAN',
      description: `Automated ${action} imposed on ${ruleType}: ${targetValue}. Reason: ${reason}`,
      metadata: { targetValue, ruleType, action, reason, timestamp: new Date().toISOString() },
    });

    // 3. Record security audit log
    await db.from('security_audit_logs').insert({
      actor_id: createdBy || null,
      actor_role: 'system',
      action_type: 'WAF_RULE_ENFORCED',
      target_resource: `${ruleType}:${targetValue}`,
      ip_address: ruleType === 'ip_address' ? targetValue : '127.0.0.1',
      risk_level: 'critical',
      metadata: { action, reason },
    });

    return true;
  } catch (err) {
    console.error('[Trigger Auto WAF Exception]:', err);
    return false;
  }
}

/**
 * Fetch sitewide emergency lockdown configuration
 */
export async function getSecurityLockdown(): Promise<SecurityLockdownConfig> {
  const defaultLockdown: SecurityLockdownConfig = {
    under_attack_mode: false,
    freeze_all_withdrawals: false,
    block_new_signups: false,
    require_2fa_for_all: false,
    maintenance_mode: false,
    strict_ip_country_whitelist: false,
  };

  const now = Date.now();
  if (lockdownCache && now - lockdownCacheTimestamp < CACHE_TTL_MS) {
    return lockdownCache;
  }

  if (!isSupabaseConfigured()) return defaultLockdown;

  try {
    const db = getServiceSupabase();
    const { data } = await db
      .from('cms_global_config')
      .select('config_value')
      .eq('config_key', 'security_lockdown')
      .maybeSingle();

    if (data && data.config_value) {
      const resolved: SecurityLockdownConfig = {
        ...defaultLockdown,
        ...(data.config_value as Partial<SecurityLockdownConfig>),
      };
      lockdownCache = resolved;
      lockdownCacheTimestamp = now;
      return resolved;
    }
  } catch (err) {
    console.warn('[Security Lockdown Fetch Warning]:', err);
  }

  return defaultLockdown;
}

/**
 * Fetch any CMS config with fallback
 */
export async function getCmsConfig<T>(key: string, fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    const db = getServiceSupabase();
    const { data } = await db
      .from('cms_global_config')
      .select('config_value')
      .eq('config_key', key)
      .maybeSingle();

    if (data && data.config_value) {
      return data.config_value as T;
    }
  } catch (err) {
    console.warn(`[CMS Config Fetch ${key} Warning]:`, err);
  }
  return fallback;
}

/**
 * Update any CMS config (requires admin)
 */
export async function updateCmsConfig(key: string, value: unknown): Promise<boolean> {
  if (key === 'security_lockdown') lockdownCache = null;

  if (!isSupabaseConfigured()) return true;
  try {
    const db = getServiceSupabase();
    const { error } = await db
      .from('cms_global_config')
      .upsert({
        config_key: key,
        config_value: value,
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch (err) {
    console.error(`[CMS Config Update ${key} Error]:`, err);
    return false;
  }
}
