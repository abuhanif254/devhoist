import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { updateCmsConfig } from '@/lib/wafEngine';
import { requireAdmin, verifySudoToken } from '@/lib/authGuard';

const PUBLIC_CMS_KEYS = new Set([
  'announcement_banner',
  'hero_cms_content',
  'currency_settings',
]);


async function logCmsAudit(
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
 * GET: Fetch all CMS Global Configurations
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key || !PUBLIC_CMS_KEYS.has(key)) {
      const adminAuth = await requireAdmin(req);
      if (!adminAuth.ok) return adminAuth.response;
    }

    const defaultConfigs: Record<string, any> = {
      currency_settings: {
        usd_exchange_rate_bdt: 120,
        default_currency: 'BDT',
        vat_percent: 0,
        supported_currencies: ['BDT', 'USD'],
      },
      announcement_banner: {
        enabled: true,
        badge_en: '99.99% Global Uptime SLA',
        badge_bn: '৯৯.৯৯% গ্লোবাল আপটাইম গ্যারান্টি',
        text_en: 'Instant bKash & Nagad Account Activation — Save 20% on Annual Plans with code LAUNCH20',
        text_bn: 'বিকাশ ও নগদে তাৎক্ষণিক অটোমেটিক হোস্টিং চালু — বার্ষিক প্ল্যানে ২০% ছাড় কোড LAUNCH20',
        promo_code: 'LAUNCH20',
        link_url: '/#pricing',
      },
      security_lockdown: {
        under_attack_mode: false,
        freeze_all_withdrawals: false,
        block_new_signups: false,
        require_2fa_for_all: false,
        maintenance_mode: false,
        strict_ip_country_whitelist: false,
      },
      payment_gateways_config: {
        bkash_active: true,
        bkash_merchant_label: '01789-234567 (Automated Merchant)',
        nagad_active: true,
        nagad_merchant_label: '01889-234567 (Automated Merchant)',
        stripe_active: true,
        manual_trxid_fallback: true,
      },
      hero_cms_content: {
        headline_line1: 'Developer Experience of Vercel.',
        headline_line2: 'Accessibility of cPanel.',
        subheadline_en: 'Deploy Git repos with LiteSpeed NVMe speed, instant automated bKash/Nagad checkout, and 1-click staging containers in Singapore & USA.',
        subheadline_bn: 'গিট রিপোজিটরি ডিপ্লয় করুন লাইটস্পিড NVMe স্পিডে, বিকাশ ও নগদে অটো অ্যাক্টিভেশন এবং সিঙ্গাপুর ও ইউএসএ ডাটা সেন্টারে ১-ক্লিকে হোস্টিং।',
        starting_price_badge: '৳200/mo',
        cta_button_en: 'Get Started — 30-Day Money Back',
        cta_button_bn: 'শুরু করুন — ৩০ দিনের মানিব্যাক',
      },
    };

    if (!isSupabaseConfigured()) {
      if (key && defaultConfigs[key]) {
        return NextResponse.json({ success: true, config: defaultConfigs[key] });
      }
      return NextResponse.json({ success: true, configs: defaultConfigs });
    }

    const db = getServiceSupabase();

    if (key) {
      const { data } = await db
        .from('cms_global_config')
        .select('*')
        .eq('config_key', key)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        config: data ? data.config_value : defaultConfigs[key] || {},
      });
    }

    const { data } = await db.from('cms_global_config').select('*');
    const configsMap: Record<string, any> = { ...defaultConfigs };

    (data || []).forEach((row) => {
      configsMap[row.config_key] = row.config_value;
    });

    return NextResponse.json({
      success: true,
      configs: configsMap,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT: Update CMS Config Key (Sudo-Verified Admin)
 */
export async function PUT(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const sudoValid = await verifySudoToken(req, adminAuth.user.id);
    if (!sudoValid) {
      return NextResponse.json(
        { success: false, requireSudo: true, error: 'Cryptographic 2FA Sudo elevation required to modify platform CMS config.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { key, value } = body;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: 'key and value are required.' }, { status: 400 });
    }

    const ok = await updateCmsConfig(key, value);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to update CMS config in Supabase.' }, { status: 500 });
    }

    await logCmsAudit(
      'CMS_CONFIG_UPDATED',
      `cms_global_config:${key}`,
      { key, value, adminId: adminAuth.user.id },
      key === 'security_lockdown' ? 'critical' : 'medium',
      ip
    );

    return NextResponse.json({
      success: true,
      message: `CMS configuration '${key}' updated live across platform.`,
      config: value,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
