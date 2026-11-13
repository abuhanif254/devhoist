import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import {
  triggerAutoWafRule,
  getSecurityLockdown,
  updateCmsConfig,
  EdgeWafRule,
  SecurityLockdownConfig,
} from '@/lib/wafEngine';
import { requireAdmin, verifySudoToken, serviceUnavailableResponse } from '@/lib/authGuard';
import {
  deleteCloudflareIpAccessRule,
  isCloudflareConfigured,
  setCloudflareSecurityLevel,
  upsertCloudflareIpAccessRule,
} from '@/lib/cloudflareClient';

async function logAdminAudit(
  actionType: string,
  targetResource: string,
  metadata: Record<string, unknown>,
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ip: string = '127.0.0.1'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_role: 'admin',
      action_type: actionType,
      target_resource: targetResource,
      ip_address: ip,
      risk_level: riskLevel,
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}

/**
 * GET: Lists active WAF rules, fraud alerts, and security audit logs
 */
export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const lockdown = await getSecurityLockdown();

    if (!isSupabaseConfigured()) {
      if (!isDevSandboxMode()) {
        return serviceUnavailableResponse('Edge WAF & Fraud Shield');
      }
      return NextResponse.json({
        success: true,
        rules: [
          {
            id: 'mock-1',
            rule_type: 'ip_address',
            target_value: '185.220.101.45',
            action: 'block_403',
            reason: 'Repeated fake bKash trxID brute-force submission',
            triggered_count: 14,
            is_active: true,
            cloudflare_sync_status: 'local_only',
            created_at: new Date().toISOString(),
          },
          {
            id: 'mock-2',
            rule_type: 'payment_wallet_number',
            target_value: '01999999999',
            action: 'freeze_withdrawals',
            reason: 'Known fraudulent wallet reported across chargeback alerts',
            triggered_count: 3,
            is_active: true,
            cloudflare_sync_status: 'local_only',
            created_at: new Date().toISOString(),
          },
        ],
        alerts: [
          {
            id: 'alert-1',
            severity: 'critical',
            alert_type: 'FAILED_ADMIN_LOGIN',
            description: '5 failed login attempts from IP 185.220.101.45',
            created_at: new Date().toISOString(),
          },
        ],
        auditLogs: [],
        lockdown,
      });
    }

    const db = getServiceSupabase();

    const [rulesRes, alertsRes, auditRes] = await Promise.all([
      db.from('edge_waf_rules').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('fraud_alerts').select('*').order('created_at', { ascending: false }).limit(50),
      db.from('security_audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    return NextResponse.json({
      success: true,
      rules: rulesRes.data || [],
      alerts: alertsRes.data || [],
      auditLogs: auditRes.data || [],
      lockdown,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create WAF rule, 1-Click Ban Entity, or Toggle Emergency Lockdown (+ Cloudflare Sync)
 */
export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      lockdownSettings?: Partial<SecurityLockdownConfig>;
      ruleType?: EdgeWafRule['rule_type'];
      targetValue?: string;
      ruleAction?: EdgeWafRule['action'];
      reason?: string;
      expiresAt?: string | null;
      alertId?: string;
      zoneId?: string;
    };
    const { action } = body;

    if (action === 'toggle_lockdown' || action === 'add_rule' || action === 'ban_entity') {
      const sudoValid = await verifySudoToken(req, adminAuth.user.id);
      if (!sudoValid) {
        return NextResponse.json(
          { success: false, requireSudo: true, error: 'Admin Sudo elevation required for WAF & lockdown rules.' },
          { status: 403 }
        );
      }
    }

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Edge WAF & Fraud Shield');
    }

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Emergency Toggle -> updates DB + pushes Cloudflare Under Attack / High security level
    if (action === 'toggle_lockdown') {
      const current = await getSecurityLockdown();
      const updated: SecurityLockdownConfig = { ...current, ...(body.lockdownSettings || {}) };

      await updateCmsConfig('security_lockdown', updated);

      let cloudflareSync: { attempted: boolean; ok: boolean; error?: string } = {
        attempted: false,
        ok: false,
      };
      if (isCloudflareConfigured()) {
        cloudflareSync.attempted = true;
        const cfLevel = updated.under_attack_mode ? 'under_attack' : 'high';
        const cfRes = await setCloudflareSecurityLevel(cfLevel, body.zoneId);
        cloudflareSync = { attempted: true, ok: cfRes.ok, error: cfRes.error };
      }

      await logAdminAudit('SECURITY_LOCKDOWN_TOGGLED', 'cms_global_config:security_lockdown', {
        ...updated,
        cloudflareSync,
      }, 'critical', ip);

      return NextResponse.json({
        success: true,
        message: cloudflareSync.ok
          ? `Global emergency lockdown updated and Cloudflare security_level pushed (${updated.under_attack_mode ? 'under_attack' : 'high'}).`
          : 'Global emergency security lockdown state updated.',
        lockdown: updated,
        cloudflareSync,
      });
    }

    // Add or Update WAF Rule -> DB + Cloudflare IP Access Rule
    if (action === 'add_rule' || action === 'ban_entity') {
      const { ruleType, targetValue, ruleAction = 'block_403', reason, expiresAt, zoneId } = body;

      if (!targetValue || !ruleType || !reason) {
        return NextResponse.json({ success: false, error: 'targetValue, ruleType, and reason are required.' }, { status: 400 });
      }

      const cleanTarget = targetValue.trim();
      const cleanReason = reason.trim();
      const wafRuleType: 'ip_address' | 'payment_wallet_number' | 'email_domain' | 'user_account' =
        ruleType === 'country_code' ? 'ip_address' : ruleType;
      const wafRuleAction: 'block_403' | 'freeze_withdrawals' | 'challenge_2fa' =
        ruleAction === 'whitelist_bypass' ? 'block_403' : ruleAction;

      await triggerAutoWafRule(
        cleanTarget,
        wafRuleType,
        cleanReason,
        wafRuleAction,
        'founder_admin'
      );

      let cloudflareRuleId: string | null = null;
      let cloudflareSyncStatus: 'synced' | 'pending' | 'failed' | 'local_only' = 'local_only';
      let cloudflareError: string | undefined;

      if (ruleType === 'ip_address' && isCloudflareConfigured()) {
        const cfMode =
          ruleAction === 'challenge_2fa'
            ? 'managed_challenge'
            : ruleAction === 'whitelist_bypass'
            ? 'whitelist'
            : 'block';
        const cfRes = await upsertCloudflareIpAccessRule({
          ipOrCidr: cleanTarget,
          mode: cfMode,
          notes: `[DevHost WAF] ${cleanReason}`,
          zoneId,
        });
        if (cfRes.ok) {
          cloudflareRuleId = cfRes.cloudflareRuleId || null;
          cloudflareSyncStatus = 'synced';
        } else {
          cloudflareSyncStatus = 'failed';
          cloudflareError = cfRes.error;
        }
      }

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        const patch: Record<string, unknown> = {
          cloudflare_rule_id: cloudflareRuleId,
          cloudflare_sync_status: cloudflareSyncStatus,
        };
        if (expiresAt) patch.expires_at = expiresAt;
        await db.from('edge_waf_rules').update(patch).eq('target_value', cleanTarget);
      }

      await logAdminAudit(
        'WAF_RULE_CREATED',
        `${ruleType}:${cleanTarget}`,
        {
          ruleAction,
          reason: cleanReason,
          expiresAt,
          adminId: adminAuth.user.id,
          cloudflareRuleId,
          cloudflareSyncStatus,
        },
        'high',
        ip
      );

      if (cloudflareSyncStatus === 'failed') {
        return NextResponse.json(
          {
            success: false,
            error: `Local WAF rule saved, but Cloudflare IP Access Rule failed: ${cloudflareError}`,
            cloudflareSyncStatus,
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          cloudflareSyncStatus === 'synced'
            ? `Edge WAF rule applied to ${cleanTarget} (${ruleAction}) and synced live to Cloudflare Firewall (${cloudflareRuleId}).`
            : `Edge WAF rule applied to ${cleanTarget} (${ruleAction}).`,
        cloudflareRuleId,
        cloudflareSyncStatus,
      });
    }

    // Dismiss Fraud Alert
    if (action === 'dismiss_alert') {
      const { alertId } = body;
      if (isSupabaseConfigured() && alertId) {
        const db = getServiceSupabase();
        await db.from('fraud_alerts').delete().eq('id', alertId);
      }
      return NextResponse.json({ success: true, message: 'Alert dismissed.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove WAF Rule (Unban IP/Entity from Cloudflare & DB)
 */
export async function DELETE(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('id');
    const targetValue = searchParams.get('targetValue');
    const zoneId = searchParams.get('zoneId') || undefined;

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!ruleId && !targetValue) {
      return NextResponse.json({ success: false, error: 'Rule ID or targetValue is required.' }, { status: 400 });
    }

    let cfRuleIdToDelete: string | null = null;
    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const lookup = ruleId
        ? await db.from('edge_waf_rules').select('id, cloudflare_rule_id').eq('id', ruleId).maybeSingle()
        : await db.from('edge_waf_rules').select('id, cloudflare_rule_id').eq('target_value', targetValue!).maybeSingle();
      cfRuleIdToDelete = lookup.data?.cloudflare_rule_id || null;

      if (isCloudflareConfigured() && cfRuleIdToDelete) {
        const cfDel = await deleteCloudflareIpAccessRule(cfRuleIdToDelete, zoneId);
        if (!cfDel.ok) {
          return NextResponse.json(
            { success: false, error: cfDel.error || 'Failed removing Cloudflare IP access rule.' },
            { status: 502 }
          );
        }
      }

      if (ruleId) {
        await db.from('edge_waf_rules').delete().eq('id', ruleId);
      } else if (targetValue) {
        await db.from('edge_waf_rules').delete().eq('target_value', targetValue);
      }
    }

    await logAdminAudit('WAF_RULE_DELETED', `rule:${ruleId || targetValue}`, {
      ruleId,
      targetValue,
      cloudflareRuleId: cfRuleIdToDelete,
    }, 'medium', ip);

    return NextResponse.json({
      success: true,
      message: cfRuleIdToDelete
        ? 'Edge WAF rule removed from Cloudflare Firewall & database. Entity is unbanned.'
        : 'Edge WAF rule removed successfully. Entity is unbanned.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
