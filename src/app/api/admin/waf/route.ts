import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { triggerAutoWafRule, getSecurityLockdown, updateCmsConfig } from '@/lib/wafEngine';


async function logAdminAudit(
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
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
export async function GET() {
  try {
    const lockdown = await getSecurityLockdown();

    if (!isSupabaseConfigured()) {
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Create WAF rule, 1-Click Ban Entity, or Toggle Emergency Lockdown
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sudoVerified } = body;

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Emergency Toggle
    if (action === 'toggle_lockdown') {
      const { lockdownSettings } = body;
      const current = await getSecurityLockdown();
      const updated = { ...current, ...lockdownSettings };

      await updateCmsConfig('security_lockdown', updated);
      await logAdminAudit('SECURITY_LOCKDOWN_TOGGLED', 'cms_global_config:security_lockdown', updated, 'critical', ip);

      return NextResponse.json({
        success: true,
        message: 'Global emergency security lockdown state updated.',
        lockdown: updated,
      });
    }

    // Add or Update WAF Rule
    if (action === 'add_rule' || action === 'ban_entity') {
      const { ruleType, targetValue, ruleAction = 'block_403', reason, expiresAt } = body;

      if (!targetValue || !ruleType || !reason) {
        return NextResponse.json({ success: false, error: 'targetValue, ruleType, and reason are required.' }, { status: 400 });
      }

      await triggerAutoWafRule(
        targetValue.trim(),
        ruleType,
        reason.trim(),
        ruleAction,
        'founder_admin'
      );

      if (isSupabaseConfigured() && expiresAt) {
        const db = getServiceSupabase();
        await db
          .from('edge_waf_rules')
          .update({ expires_at: expiresAt })
          .eq('target_value', targetValue.trim());
      }

      await logAdminAudit(
        'WAF_RULE_CREATED',
        `${ruleType}:${targetValue}`,
        { ruleAction, reason, expiresAt, sudoVerified },
        'high',
        ip
      );

      return NextResponse.json({
        success: true,
        message: `Edge WAF rule applied to ${targetValue} (${ruleAction}).`,
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: Remove WAF Rule (Unban IP or Entity)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('id');
    const targetValue = searchParams.get('targetValue');

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!ruleId && !targetValue) {
      return NextResponse.json({ success: false, error: 'Rule ID or targetValue is required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      if (ruleId) {
        await db.from('edge_waf_rules').delete().eq('id', ruleId);
      } else if (targetValue) {
        await db.from('edge_waf_rules').delete().eq('target_value', targetValue);
      }
    }

    await logAdminAudit('WAF_RULE_DELETED', `rule:${ruleId || targetValue}`, { ruleId, targetValue }, 'medium', ip);

    return NextResponse.json({
      success: true,
      message: 'Edge WAF rule removed successfully. Entity is unbanned.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
