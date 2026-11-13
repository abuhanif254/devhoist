import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { renderHostingProvisionedEmail } from '@/lib/emailEngine';
import { requireAdmin } from '@/lib/authGuard';


const CONFIG_KEY = 'live_integrations';

interface LiveIntegrationsConfig {
  telegram_bot_token: string;
  telegram_chat_id: string;
  resend_api_key: string;
  resend_from_email: string;
  founder_email: string;
}

const DEFAULT_CONFIG: LiveIntegrationsConfig = {
  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
  telegram_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  resend_api_key: process.env.RESEND_API_KEY || '',
  resend_from_email: 'DevHost Cloud <onboarding@resend.dev>',
  founder_email: 'mohammadbitullah@gmail.com',
};

async function getLiveIntegrationsConfig(): Promise<LiveIntegrationsConfig> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_CONFIG;
  }
  try {
    const db = getServiceSupabase();
    const { data } = await db
      .from('cms_global_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEY)
      .maybeSingle();

    if (data?.config_value) {
      return {
        ...DEFAULT_CONFIG,
        ...data.config_value,
      };
    }
  } catch (err) {
    console.warn('[Live Integrations Config Warning]:', err);
  }
  return DEFAULT_CONFIG;
}

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const config = await getLiveIntegrationsConfig();

    return NextResponse.json({
      success: true,
      config: {
        telegram_bot_token: config.telegram_bot_token ? `${config.telegram_bot_token.slice(0, 8)}...` : '',
        telegram_chat_id: config.telegram_chat_id,
        resend_api_key: config.resend_api_key ? `${config.resend_api_key.slice(0, 6)}...` : '',
        resend_from_email: config.resend_from_email || 'DevHost Cloud <onboarding@resend.dev>',
        founder_email: config.founder_email || 'mohammadbitullah@gmail.com',
        is_telegram_connected: Boolean(config.telegram_bot_token && config.telegram_chat_id),
        is_resend_connected: Boolean(config.resend_api_key),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) return adminAuth.response;

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action parameter is required.' }, { status: 400 });
    }

    // 1. SAVE INTEGRATION CREDENTIALS
    if (action === 'save') {
      const { telegram_bot_token, telegram_chat_id, resend_api_key, resend_from_email, founder_email } = body;

      const currentConfig = await getLiveIntegrationsConfig();
      const updatedConfig: LiveIntegrationsConfig = {
        telegram_bot_token: telegram_bot_token !== undefined && !telegram_bot_token.includes('...') ? telegram_bot_token.trim() : currentConfig.telegram_bot_token,
        telegram_chat_id: telegram_chat_id !== undefined ? telegram_chat_id.trim() : currentConfig.telegram_chat_id,
        resend_api_key: resend_api_key !== undefined && !resend_api_key.includes('...') ? resend_api_key.trim() : currentConfig.resend_api_key,
        resend_from_email: resend_from_email ? resend_from_email.trim() : currentConfig.resend_from_email,
        founder_email: founder_email ? founder_email.trim() : currentConfig.founder_email,
      };

      if (isSupabaseConfigured()) {
        const db = getServiceSupabase();
        await db.from('cms_global_config').upsert({
          config_key: CONFIG_KEY,
          config_value: updatedConfig,
          description: 'Live Zero-Cost Telegram Bot & Resend Email Integrations',
          updated_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Live Integration credentials saved successfully!',
      });
    }

    // 2. DISPATCH REAL TELEGRAM TEST ALERT
    if (action === 'test_telegram') {
      const currentConfig = await getLiveIntegrationsConfig();
      const token = (body.telegram_bot_token && !body.telegram_bot_token.includes('...') ? body.telegram_bot_token.trim() : '') || currentConfig.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = (body.telegram_chat_id ? body.telegram_chat_id.trim() : '') || currentConfig.telegram_chat_id || process.env.TELEGRAM_ADMIN_CHAT_ID;

      if (!token || !chatId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing Telegram Credentials. Please enter your Bot Token (from @BotFather) and Chat ID.',
          },
          { status: 400 }
        );
      }

      const text = `
⚡ <b>[DevHost Cloud] Real Telegram Alert Active!</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Founder NOC Alert:</b> Connected Successfully!
<b>Chat ID:</b> <code>${chatId}</code>
<b>Time:</b> ${new Date().toLocaleString()}
<b>Zero-Touch Engine:</b> 100% Operational on Cloudflare Edge ⚡
<i>You will receive instant alerts whenever an invoice is paid or a cPanel container is provisioned.</i>
`.trim();

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const tgData = await tgRes.json().catch(() => ({}));

      if (!tgRes.ok || !tgData.ok) {
        return NextResponse.json(
          {
            success: false,
            error: tgData.description || `Telegram API returned status HTTP ${tgRes.status}`,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Real test message sent to your Telegram chat (Message ID: ${tgData.result?.message_id})! Check your phone.`,
        messageId: tgData.result?.message_id,
      });
    }

    // 3. DISPATCH REAL RESEND TEST INVOICE & WELCOME EMAIL
    if (action === 'test_resend') {
      const currentConfig = await getLiveIntegrationsConfig();
      const apiKey = (body.resend_api_key && !body.resend_api_key.includes('...') ? body.resend_api_key.trim() : '') || currentConfig.resend_api_key || process.env.RESEND_API_KEY;
      const toEmail = (body.founder_email ? body.founder_email.trim() : '') || currentConfig.founder_email || 'mohammadbitullah@gmail.com';
      const fromEmail = (body.resend_from_email ? body.resend_from_email.trim() : '') || currentConfig.resend_from_email || 'DevHost Cloud <onboarding@resend.dev>';

      if (!apiKey) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing Resend API Key. Please enter your API Key from resend.com (free 3,000 emails/mo tier).',
          },
          { status: 400 }
        );
      }

      const htmlContent = renderHostingProvisionedEmail({
        name: 'Abu Hanif (Founder & Lead Developer)',
        domain: 'devhostcloud.com',
        packageName: 'Developer Pro Cloud (Live Test Verification)',
        serverIp: '103.151.102.45',
        datacenter: 'Singapore (Equinix SG1)',
        nameservers: ['ns1.devhost.cloud', 'ns2.devhost.cloud'],
        cpanelUsername: 'abuhanif',
        ssoLoginUrl: 'https://cpanel.devhost.net:2083',
      });

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: '🚀 [DevHost Cloud] Real Live Email Integration Operational — Welcome & Service Active',
          html: htmlContent,
        }),
      });

      const resendData = await resendRes.json().catch(() => ({}));

      if (!resendRes.ok || resendData.error) {
        return NextResponse.json(
          {
            success: false,
            error: resendData.error?.message || resendData.message || `Resend API returned status HTTP ${resendRes.status}`,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Real test email successfully sent to ${toEmail} via Resend (ID: ${resendData.id})! Check your inbox or spam folder.`,
        emailId: resendData.id,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
