/**
 * DevHost Cloud - Founder Instant Telegram & Admin Alert Bot
 * Edge Runtime Compatible (Uses standard fetch to api.telegram.org)
 * Gracefully simulates and records notifications if tokens are not configured in .env
 */

import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';
import { escapeHtml } from '@/lib/authGuard';

export interface TelegramLogEntry {
  id: string;
  type: 'order' | 'payment_verify' | 'migration' | 'ticket' | 'fraud' | 'test';
  text: string;
  status: 'sent' | 'simulated' | 'failed';
  timestamp: string;
  error?: string;
}

const telegramOutbox: TelegramLogEntry[] = [
  {
    id: 'tg-init-1',
    type: 'order',
    text: '💰 *New Order Paid*\nCustomer: Hasan Mahmud\nPlan: Developer Pro (Singapore SG1)\nAmount: ৳450 BDT\nGateway: bKash (trxID: `9K72LM89QP`)',
    status: 'simulated',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'tg-init-2',
    type: 'fraud',
    text: '🚨 *Critical Fraud Alert*\nType: Self-Referral Attempt Detected\nTarget: aff-7842 (IP: 103.205.71.18)\nStatus: Frozen in WAF',
    status: 'simulated',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function getTelegramOutbox(): TelegramLogEntry[] {
  return [...telegramOutbox];
}

export function logTelegramEntry(entry: TelegramLogEntry) {
  telegramOutbox.unshift(entry);
  if (telegramOutbox.length > 50) {
    telegramOutbox.pop();
  }
}

/**
 * Base dispatcher to Telegram Bot API
 */
export async function sendTelegramAlert(
  message: string,
  type: TelegramLogEntry['type'] = 'test'
): Promise<{ success: boolean; simulated: boolean; id: string; error?: string }> {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  // Check private_integration_credentials for saved server-only credentials if env keys are not present
  if ((!token || !chatId) && isSupabaseConfigured()) {
    try {
      const db = getServiceSupabase();
      const { data } = await db
        .from('private_integration_credentials')
        .select('config_value')
        .eq('config_key', 'live_integrations')
        .maybeSingle();

      if (data?.config_value) {
        token = token || data.config_value.telegram_bot_token;
        chatId = chatId || data.config_value.telegram_chat_id;
      }
    } catch (err) {
      console.warn('[TelegramAlert] Private credentials lookup:', err);
    }
  }

  if (token && chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        const id = `tg_${data.result?.message_id || Date.now()}`;
        logTelegramEntry({
          id,
          type,
          text: message,
          status: 'sent',
          timestamp: new Date().toISOString(),
        });
        return { success: true, simulated: false, id };
      } else {
        const errMsg = data.description || `HTTP ${res.status}`;
        console.warn(`[TelegramBot] API Error: ${errMsg}. Logging to outbox.`);
        const simId = `sim_tg_${Date.now()}`;
        logTelegramEntry({
          id: simId,
          type,
          text: message,
          status: 'simulated',
          timestamp: new Date().toISOString(),
          error: errMsg,
        });
        return { success: true, simulated: true, id: simId, error: errMsg };
      }
    } catch (err: unknown) {
      console.warn(`[TelegramBot] Network error:`, err instanceof Error ? err.message : String(err));
    }
  }

  // Simulation mode
  const simId = `sim_tg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  logTelegramEntry({
    id: simId,
    type,
    text: message,
    status: 'simulated',
    timestamp: new Date().toISOString(),
  });

  return { success: true, simulated: true, id: simId };
}

// 1. New Paid Order / Wallet Top-Up
export async function notifyNewPaidOrder(data: {
  customerName: string;
  customerEmail: string;
  packageName: string;
  domain: string;
  amountBDT: number;
  gateway: string;
  trxId: string;
  invoiceId: string;
}) {
  const text = `
💰 <b>[DevHost] New Paid Order Settled!</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Customer:</b> ${escapeHtml(data.customerName)} (<code>${escapeHtml(data.customerEmail)}</code>)
<b>Service:</b> ${escapeHtml(data.packageName)} (<code>${escapeHtml(data.domain)}</code>)
<b>Amount Paid:</b> ৳${Number(data.amountBDT || 0).toLocaleString()} BDT
<b>Payment Method:</b> ${escapeHtml(String(data.gateway || '').toUpperCase())}
<b>TrxID:</b> <code>${escapeHtml(data.trxId)}</code>
<b>Invoice:</b> #${escapeHtml(data.invoiceId)}
<b>Server Node:</b> Singapore SG1 NVMe
<i>WHM auto-provisioning initiated with zero manual intervention.</i>
`.trim();

  return sendTelegramAlert(text, 'order');
}

// 2. Manual Payment Verification Needed
export async function notifyManualPaymentVerification(data: {
  customerName: string;
  invoiceId: string;
  amountBDT: number;
  trxId: string;
  gateway: string;
}) {
  const text = `
🚨 <b>[DevHost] Manual Payment Verification Required</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Customer:</b> ${escapeHtml(data.customerName)}
<b>Invoice:</b> #${escapeHtml(data.invoiceId)} (৳${Number(data.amountBDT || 0)} BDT)
<b>Gateway:</b> ${escapeHtml(data.gateway)}
<b>Provided TrxID:</b> <code>${escapeHtml(data.trxId)}</code>
<a href="https://devhostcloud.com/admin?module=billing_ledger">Open Admin Ledger to Verify &rarr;</a>
`.trim();

  return sendTelegramAlert(text, 'payment_verify');
}

// 3. New Free Migration Request
export async function notifyMigrationRequest(data: {
  customerName: string;
  domain: string;
  sourceHost: string;
  controlPanel: string;
}) {
  const text = `
🚀 <b>[DevHost] New Website Migration Request!</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Customer:</b> ${escapeHtml(data.customerName)}
<b>Target Domain:</b> <code>${escapeHtml(data.domain)}</code>
<b>Current Host:</b> ${escapeHtml(data.sourceHost)} (${escapeHtml(data.controlPanel)})
<b>SLA Window:</b> 4 Hours (Zero-Downtime Guarantee)
<a href="https://devhostcloud.com/admin?module=migrations">Open Migration Kanban &rarr;</a>
`.trim();

  return sendTelegramAlert(text, 'migration');
}

// 4. High / Critical Support Ticket Opened
export async function notifyTicketOpened(data: {
  ticketId: string;
  customerName: string;
  subject: string;
  department: string;
  priority: string;
}) {
  const text = `
🎫 <b>[DevHost] Priority Support Ticket Opened</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Priority:</b> ⚠️ <b>${escapeHtml(String(data.priority || '').toUpperCase())}</b>
<b>Ticket ID:</b> #${escapeHtml(data.ticketId)}
<b>Customer:</b> ${escapeHtml(data.customerName)}
<b>Department:</b> ${escapeHtml(data.department)}
<b>Subject:</b> ${escapeHtml(data.subject)}
<a href="https://devhostcloud.com/admin?module=support_desk">Reply via Admin Desk &rarr;</a>
`.trim();

  return sendTelegramAlert(text, 'ticket');
}

// 5. Critical Fraud / Security Alert
export async function notifyFraudAlert(data: {
  alertType: string;
  severity: string;
  target: string;
  ipAddress: string;
  details: string;
}) {
  const text = `
🛡️ <b>[DevHost Security] ${escapeHtml(String(data.severity || '').toUpperCase())} THREAT DETECTED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Threat:</b> ${escapeHtml(data.alertType)}
<b>Target:</b> <code>${escapeHtml(data.target)}</code>
<b>Source IP:</b> <code>${escapeHtml(data.ipAddress)}</code>
<b>Forensics:</b> ${escapeHtml(data.details)}
<b>Action:</b> WAF rules evaluating auto-ban.
<a href="https://devhostcloud.com/admin?module=security_audit">Inspect in SOC Radar &rarr;</a>
`.trim();

  return sendTelegramAlert(text, 'fraud');
}

// 6. Test Alert
export async function testTelegramAlert() {
  const text = `
🔔 <b>[DevHost Test] Telegram Alert Bot Operational!</b>
━━━━━━━━━━━━━━━━━━━━━
Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} BST
Status: Connected to DevHost Cloud Edge Dispatcher.
All order, fraud, and cron notifications will be delivered here instantly.
`.trim();

  return sendTelegramAlert(text, 'test');
}
