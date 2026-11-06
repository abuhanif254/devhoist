/**
 * DevHost Cloud - Enterprise Transactional Email Engine
 * Next.js Edge Runtime Compatible (Zero Node-specific dependencies)
 * Integrates Resend REST API (https://api.resend.com/emails) with graceful offline/dev simulation outbox.
 */

export type EmailTemplateId =
  | 'welcome_and_verify'
  | 'hosting_provisioned_credentials'
  | 'invoice_paid_receipt'
  | 'renewal_reminder_notice'
  | 'service_suspended_alert'
  | 'affiliate_commission_and_payout'
  | 'migration_status_update'
  | 'security_threat_alert';

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: EmailTemplateId | string;
  status: 'delivered' | 'simulated' | 'failed';
  sentAt: string;
  html: string;
  previewText: string;
  error?: string;
}

// In-memory outbox log for edge & local development
const globalOutbox: EmailLogEntry[] = [
  {
    id: 'eml-init-1',
    to: 'founder@devhostcloud.com',
    subject: '🚀 Welcome to DevHost Cloud — Verify Your Enterprise Account',
    template: 'welcome_and_verify',
    status: 'delivered',
    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    previewText: 'Your verification code is 849201. Get started with NVMe hosting.',
    html: '<div style="font-family:sans-serif;padding:20px;"><h3>Welcome to DevHost Cloud</h3><p>Your 6-digit verification code: <strong>849201</strong></p></div>',
  },
  {
    id: 'eml-init-2',
    to: 'customer@ecommerce-bd.com',
    subject: '⚡ cPanel Credentials & Server Provisioning Complete — ecommerce-bd.com',
    template: 'hosting_provisioned_credentials',
    status: 'delivered',
    sentAt: new Date(Date.now() - 3600000).toISOString(),
    previewText: 'Your developer hosting account is live on Singapore SG1 NVMe cluster.',
    html: '<div style="font-family:sans-serif;padding:20px;"><h3>cPanel Provisioned</h3><p>Domain: ecommerce-bd.com | Server: 103.205.71.18</p></div>',
  },
];

export function getEmailOutboxLogs(): EmailLogEntry[] {
  return [...globalOutbox];
}

export function logEmailToOutbox(entry: EmailLogEntry) {
  globalOutbox.unshift(entry);
  if (globalOutbox.length > 50) {
    globalOutbox.pop();
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  template: EmailLogEntry['template'];
  html: string;
}): Promise<{ success: boolean; id: string }> {
  const emailId = `eml-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  logEmailToOutbox({
    id: emailId,
    to: params.to,
    subject: params.subject,
    template: params.template,
    status: 'delivered',
    sentAt: new Date().toISOString(),
    previewText: params.subject,
    html: params.html,
  });
  return { success: true, id: emailId };
}

// ==============================================================================
// 8 BRANDED RESPONSIVE HTML EMAIL TEMPLATES
// ==============================================================================

const EMAIL_BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #09090b;
  color: #f4f4f5;
  margin: 0;
  padding: 0;
  line-height: 1.6;
`;

function getEmailWrapper(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevHost Cloud</title>
  <style>
    body { ${EMAIL_BASE_STYLES} }
    .btn { display: inline-block; padding: 12px 24px; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px; }
    .btn-primary { background-color: #2563eb; color: #ffffff !important; }
    .btn-emerald { background-color: #059669; color: #ffffff !important; }
    .btn-rose { background-color: #e11d48; color: #ffffff !important; }
    .card { background-color: #121215; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; margin: 20px 0; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body style="background-color: #09090b; padding: 24px 12px;">
  <!-- Preview snippet -->
  <div style="display:none; font-size:1px; color:#333; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    ${previewText}
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #121215; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden;">
    <!-- HEADER -->
    <tr>
      <td style="padding: 28px 32px; background: linear-gradient(180deg, #18181b 0%, #121215 100%); border-bottom: 1px solid rgba(255,255,255,0.08);">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                DevHost <span style="font-size: 10px; font-family: monospace; background: rgba(37,99,235,0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(37,99,235,0.4); vertical-align: middle;">CLOUD</span>
              </div>
            </td>
            <td align="right">
              <span style="font-size: 11px; font-family: monospace; color: #10b981; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 3px 8px; border-radius: 20px;">
                ● 99.99% BDIX NVMe
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY CONTENT -->
    <tr>
      <td style="padding: 32px; color: #e4e4e7; font-size: 14px;">
        ${content}
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="padding: 24px 32px; background-color: #0c0c0e; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #71717a; text-align: center;">
        <p style="margin: 0 0 8px 0;">DevHost Cloud Systems Ltd. • Singapore SG1 &amp; Dhaka BDIX Peering Node</p>
        <p style="margin: 0; font-size: 11px;">
          Instant bKash/Nagad Support • 24/7 Priority NOC Desk • 
          <a href="https://devhostcloud.com/dashboard" style="color: #60a5fa; text-decoration: none;">Client Portal</a> • 
          <a href="https://devhostcloud.com/docs" style="color: #60a5fa; text-decoration: none;">Docs</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 1. Welcome & Verify Email
export function renderWelcomeVerifyEmail(data: {
  name: string;
  email: string;
  verificationCode: string;
  loginUrl?: string;
}) {
  const content = `
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">Welcome to DevHost Cloud, ${data.name}! 👋</h1>
    <p style="color: #a1a1aa;">Thank you for registering with DevHost Cloud. To secure your account and verify your email address, please use the 6-digit authentication PIN below:</p>

    <div style="background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
      <div style="font-size: 12px; color: #93c5fd; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 2FA Verification Code</div>
      <div style="font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: 8px; font-family: monospace;">${data.verificationCode}</div>
      <div style="font-size: 11px; color: #60a5fa; margin-top: 8px;">Valid for 15 minutes. Never share this code with anyone.</div>
    </div>

    <p style="color: #a1a1aa;">Once verified, you will have instant access to high-performance NVMe cloud hosting, automated GitHub deployments, and real-time DNS management.</p>

    <div style="margin-top: 28px; text-align: center;">
      <a href="${data.loginUrl || 'https://devhostcloud.com/login'}" class="btn btn-primary" style="display:inline-block; padding:12px 28px; background:#2563eb; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">Complete Sign In &rarr;</a>
    </div>
  `;
  return getEmailWrapper(content, `Your DevHost Cloud verification code is ${data.verificationCode}`);
}

// 2. Hosting Provisioned & cPanel Credentials (Most Important)
export function renderHostingProvisionedEmail(data: {
  name: string;
  packageName: string;
  domain: string;
  serverIp: string;
  datacenter: string;
  nameservers: string[];
  cpanelUsername: string;
  ssoLoginUrl: string;
  sshPort?: number;
  sshHost?: string;
  webhookGuideUrl?: string;
}) {
  const content = `
    <div style="display:inline-block; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      SERVICE PROVISIONED &bull; ACTIVE
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">Your NVMe Hosting is Live! 🚀</h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, your cloud hosting service for <strong>${data.domain}</strong> has been provisioned on our high-speed NVMe infrastructure.</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; margin:20px 0;">
      <div style="font-size:13px; font-weight:bold; color:#ffffff; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; margin-bottom:12px;">
        Account &amp; Server Specifications
      </div>
      <table width="100%" border="0" cellspacing="4" cellpadding="4" style="font-size:13px;">
        <tr><td style="color:#71717a; width:35%;">Plan / Package:</td><td style="color:#ffffff; font-weight:600;">${data.packageName}</td></tr>
        <tr><td style="color:#71717a;">Target Domain:</td><td style="color:#60a5fa; font-family:monospace;">${data.domain}</td></tr>
        <tr><td style="color:#71717a;">Dedicated IP / Server:</td><td style="color:#ffffff; font-family:monospace;">${data.serverIp} (${data.datacenter})</td></tr>
        <tr><td style="color:#71717a;">cPanel Username:</td><td style="color:#10b981; font-family:monospace; font-weight:bold;">${data.cpanelUsername}</td></tr>
        <tr><td style="color:#71717a;">Jailed SSH Access:</td><td style="color:#ffffff; font-family:monospace;">Port ${data.sshPort || 22} (Host: ${data.sshHost || data.serverIp})</td></tr>
      </table>
    </div>

    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:16px; margin:16px 0;">
      <div style="font-size:12px; font-weight:bold; color:#fbbf24; margin-bottom:6px;">Point Your Nameservers:</div>
      <div style="font-size:12px; color:#d4d4d8; font-family:monospace;">
        1. ${data.nameservers[0] || 'ns1.devhostcloud.com'}<br/>
        2. ${data.nameservers[1] || 'ns2.devhostcloud.com'}
      </div>
    </div>

    <div style="margin: 28px 0; text-align: center;">
      <a href="${data.ssoLoginUrl}" class="btn btn-emerald" style="display:inline-block; padding:12px 28px; background:#059669; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        1-Click cPanel SSO Login &rarr;
      </a>
      <div style="font-size:11px; color:#71717a; margin-top:8px;">No password required. Authenticates securely via your client portal.</div>
    </div>

    <p style="color:#a1a1aa; font-size:12px;">Deploying Next.js or Node.js? Check our <a href="${data.webhookGuideUrl || 'https://devhostcloud.com/docs/deploy-nextjs-github-cpanel-zero-bloat'}" style="color:#60a5fa; text-decoration:none;">GitHub Actions Auto-Deployment Guide</a>.</p>
  `;
  return getEmailWrapper(content, `Your hosting for ${data.domain} is active. cPanel SSO & nameserver details inside.`);
}

// 3. Invoice Paid Receipt
export function renderInvoicePaidEmail(data: {
  name: string;
  invoiceNumber: string;
  amountBDT: number;
  paymentMethod: string;
  trxId: string;
  paidDate: string;
  items: { desc: string; amount: number }[];
  viewInvoiceUrl?: string;
}) {
  const rows = data.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0; color:#d4d4d8; border-bottom:1px solid rgba(255,255,255,0.04);">${it.desc}</td>
        <td style="padding:8px 0; color:#ffffff; font-weight:600; text-align:right; border-bottom:1px solid rgba(255,255,255,0.04);">৳${it.amount.toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const content = `
    <div style="display:inline-block; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      PAYMENT CONFIRMED
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">Payment Receipt & Invoice Paid ✅</h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, thank you for your payment. Invoice <strong>${data.invoiceNumber}</strong> has been successfully settled.</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; margin:20px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:13px; margin-bottom:16px;">
        <tr><td style="color:#71717a;">Payment Date:</td><td style="color:#ffffff; text-align:right;">${data.paidDate}</td></tr>
        <tr><td style="color:#71717a;">Payment Method:</td><td style="color:#ffffff; text-align:right; font-weight:600; text-transform:uppercase;">${data.paymentMethod}</td></tr>
        <tr><td style="color:#71717a;">Transaction ID (trxID):</td><td style="color:#10b981; text-align:right; font-family:monospace; font-weight:bold;">${data.trxId}</td></tr>
      </table>

      <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:12px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:13px;">
          ${rows}
          <tr>
            <td style="padding:12px 0 0 0; color:#ffffff; font-weight:bold; font-size:15px;">Total Paid:</td>
            <td style="padding:12px 0 0 0; color:#10b981; font-weight:bold; font-size:18px; text-align:right;">৳${data.amountBDT.toLocaleString()} BDT</td>
          </tr>
        </table>
      </div>
    </div>

    <div style="text-align: center; margin-top:24px;">
      <a href="${data.viewInvoiceUrl || 'https://devhostcloud.com/dashboard?tab=invoices'}" class="btn btn-primary" style="display:inline-block; padding:10px 24px; background:#2563eb; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        Download PDF Invoice &rarr;
      </a>
    </div>
  `;
  return getEmailWrapper(content, `Receipt for ${data.invoiceNumber} — ৳${data.amountBDT} paid via ${data.paymentMethod}`);
}

// 4. Renewal Reminder Notice (T-7, T-3, T-1)
export function renderRenewalReminderEmail(data: {
  name: string;
  serviceName: string;
  domain: string;
  expiryDate: string;
  daysRemaining: number;
  renewalAmountBDT: number;
  walletBalanceBDT: number;
  renewUrl?: string;
}) {
  const canAutoRenew = data.walletBalanceBDT >= data.renewalAmountBDT;
  const content = `
    <div style="display:inline-block; background:rgba(245,158,11,0.1); color:#f59e0b; border:1px solid rgba(245,158,11,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      UPCOMING RENEWAL &bull; ${data.daysRemaining} DAYS REMAINING
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">Renewal Notice: ${data.domain}</h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, your service <strong>${data.serviceName} (${data.domain})</strong> is scheduled to renew on <strong>${data.expiryDate}</strong>.</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; margin:20px 0;">
      <table width="100%" border="0" cellspacing="4" cellpadding="4" style="font-size:13px;">
        <tr><td style="color:#71717a;">Service / Domain:</td><td style="color:#ffffff; font-weight:600;">${data.domain}</td></tr>
        <tr><td style="color:#71717a;">Expiration Date:</td><td style="color:#f59e0b; font-weight:bold;">${data.expiryDate}</td></tr>
        <tr><td style="color:#71717a;">Renewal Amount:</td><td style="color:#ffffff; font-weight:bold; font-size:15px;">৳${data.renewalAmountBDT.toLocaleString()} BDT</td></tr>
        <tr><td style="color:#71717a;">Current Wallet Balance:</td><td style="color:${canAutoRenew ? '#10b981' : '#f43f5e'}; font-weight:600;">৳${data.walletBalanceBDT.toLocaleString()} BDT</td></tr>
      </table>
    </div>

    ${
      canAutoRenew
        ? `
      <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:12px 16px; font-size:12px; color:#6ee7b7;">
        ✓ <strong>Auto-Renewal Enabled:</strong> You have sufficient cloud wallet balance. Your service will renew automatically with zero downtime.
      </div>
    `
        : `
      <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); border-radius:8px; padding:12px 16px; font-size:12px; color:#fda4af;">
        ⚠ <strong>Action Required:</strong> Your prepaid wallet has insufficient balance. Please renew now via bKash or Nagad to prevent suspension.
      </div>
    `
    }

    <div style="margin: 28px 0; text-align: center;">
      <a href="${data.renewUrl || 'https://devhostcloud.com/dashboard?tab=billing'}" class="btn btn-primary" style="display:inline-block; padding:12px 28px; background:#2563eb; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        1-Click Renew via bKash/Nagad &rarr;
      </a>
    </div>
  `;
  return getEmailWrapper(content, `Urgent: ${data.domain} expires in ${data.daysRemaining} days. Renew now to avoid interruption.`);
}

// 5. Service Suspended Alert (T+3 Days Overdue)
export function renderServiceSuspendedEmail(data: {
  name: string;
  serviceName: string;
  domain: string;
  overdueDays: number;
  outstandingAmountBDT: number;
  terminationGraceDays: number;
  payUnlockUrl?: string;
}) {
  const content = `
    <div style="display:inline-block; background:rgba(225,29,72,0.1); color:#f43f5e; border:1px solid rgba(225,29,72,0.3); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      SERVICE SUSPENDED &bull; PAYMENT OVERDUE
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">Service Suspension Notice: ${data.domain} 🛑</h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, because invoice payment has not been received after ${data.overdueDays} days, access to <strong>${data.domain}</strong> has been temporarily suspended.</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(225,29,72,0.2); border-radius:12px; padding:20px; margin:20px 0;">
      <table width="100%" border="0" cellspacing="4" cellpadding="4" style="font-size:13px;">
        <tr><td style="color:#71717a;">Suspended Service:</td><td style="color:#ffffff; font-weight:600;">${data.serviceName} (${data.domain})</td></tr>
        <tr><td style="color:#71717a;">Outstanding Balance:</td><td style="color:#f43f5e; font-weight:bold; font-size:16px;">৳${data.outstandingAmountBDT.toLocaleString()} BDT</td></tr>
        <tr><td style="color:#71717a;">Data Preservation Window:</td><td style="color:#fbbf24; font-weight:600;">${data.terminationGraceDays} days remaining</td></tr>
      </table>
    </div>

    <div style="background:rgba(244,63,94,0.08); border-left:4px solid #e11d48; padding:12px 16px; font-size:12px; color:#fca5a5; margin-bottom:20px;">
      <strong>Data Safety Guarantee:</strong> All files, databases, and emails are currently preserved in our storage vaults. Pay now to unfreeze your cPanel and restore website uptime within 60 seconds.
    </div>

    <div style="margin: 28px 0; text-align: center;">
      <a href="${data.payUnlockUrl || 'https://devhostcloud.com/dashboard?tab=invoices'}" class="btn btn-rose" style="display:inline-block; padding:12px 28px; background:#e11d48; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        Pay Outstanding Balance &amp; Unlock Now &rarr;
      </a>
    </div>
  `;
  return getEmailWrapper(content, `Critical Notice: ${data.domain} is suspended due to unpaid invoice. Pay now to restore.`);
}

// 6. Affiliate Commission & Payout Notification
export function renderAffiliateEmail(data: {
  name: string;
  type: 'commission_earned' | 'payout_sent';
  amountBDT: number;
  details: string;
  trxId?: string;
  holdDaysRemaining?: number;
  dashboardUrl?: string;
}) {
  const isEarned = data.type === 'commission_earned';
  const content = `
    <div style="display:inline-block; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      ${isEarned ? 'COMMISSION EARNED' : 'PAYOUT PROCESSED'}
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">
      ${isEarned ? '🎉 New Affiliate Commission Credited!' : '💸 Payout Sent to Your Mobile Wallet!'}
    </h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, ${isEarned ? 'a visitor purchased hosting via your referral link!' : 'your affiliate withdrawal request has been approved and disbursed.'}</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; margin:20px 0;">
      <div style="font-size:12px; color:#71717a; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
        ${isEarned ? 'Commission Amount' : 'Disbursed Amount'}
      </div>
      <div style="font-size:32px; font-weight:800; color:#10b981;">৳${data.amountBDT.toLocaleString()} BDT</div>
      <p style="color:#d4d4d8; font-size:13px; margin:12px 0 0 0;">${data.details}</p>

      ${
        isEarned
          ? `
        <div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); font-size:12px; color:#9ca3af;">
          ⏳ <strong>35-Day Hold Started:</strong> Funds will mature and move to Available for Payout in ${data.holdDaysRemaining || 35} days.
        </div>
      `
          : `
        <div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); font-size:12px; color:#9ca3af;">
          MFS Transaction ID: <strong style="color:#ffffff; font-family:monospace;">${data.trxId || 'N/A'}</strong>
        </div>
      `
      }
    </div>

    <div style="text-align: center; margin-top:24px;">
      <a href="${data.dashboardUrl || 'https://devhostcloud.com/dashboard?tab=affiliate'}" class="btn btn-primary" style="display:inline-block; padding:10px 24px; background:#2563eb; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        View Affiliate Dashboard &rarr;
      </a>
    </div>
  `;
  return getEmailWrapper(content, isEarned ? `You earned ৳${data.amountBDT} affiliate commission!` : `৳${data.amountBDT} payout sent!`);
}

// 7. Website Migration Status Update
export function renderMigrationStatusEmail(data: {
  name: string;
  domain: string;
  status: 'in_progress' | 'completed' | 'dns_pending';
  sourceHost: string;
  temporaryUrl?: string;
  nameservers: string[];
}) {
  const isCompleted = data.status === 'completed';
  const content = `
    <div style="display:inline-block; background:rgba(37,99,235,0.1); color:#60a5fa; border:1px solid rgba(37,99,235,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      MIGRATION DESK &bull; ${data.status.toUpperCase()}
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">
      ${isCompleted ? 'Migration Complete — Zero Downtime! 🎉' : `Migration Underway for ${data.domain} 🚚`}
    </h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, our DevOps migration engineers have transferred your website files, MySQL databases, and SSL certificates from <strong>${data.sourceHost}</strong> to DevHost Cloud.</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; margin:20px 0;">
      <div style="font-size:13px; font-weight:bold; color:#ffffff; margin-bottom:8px;">Next Step: Update Authoritative Nameservers</div>
      <p style="font-size:12px; color:#d4d4d8; margin-top:0;">To route live visitors to your new NVMe server, point your domain registrar to:</p>
      <div style="background:rgba(0,0,0,0.4); padding:10px 14px; border-radius:6px; font-family:monospace; font-size:12px; color:#60a5fa;">
        1. ${data.nameservers[0] || 'ns1.devhostcloud.com'}<br/>
        2. ${data.nameservers[1] || 'ns2.devhostcloud.com'}
      </div>
    </div>

    <div style="text-align: center; margin-top:24px;">
      <a href="https://devhostcloud.com/dashboard" class="btn btn-emerald" style="display:inline-block; padding:10px 24px; background:#059669; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        Test Preview &amp; Confirm Live &rarr;
      </a>
    </div>
  `;
  return getEmailWrapper(content, `Migration for ${data.domain} is ${data.status}. Nameserver update required.`);
}

// 8. Security & New Device Login Threat Alert
export function renderSecurityThreatEmail(data: {
  name: string;
  alertType: string;
  ipAddress: string;
  location: string;
  deviceBrowser: string;
  timestamp: string;
  freezeAccountUrl?: string;
}) {
  const content = `
    <div style="display:inline-block; background:rgba(225,29,72,0.1); color:#f43f5e; border:1px solid rgba(225,29,72,0.3); padding:3px 10px; border-radius:20px; font-size:11px; font-family:monospace; margin-bottom:12px;">
      SECURITY ALERT &bull; NEW SESSION DETECTED
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0;">New Sign-In from Unrecognized Device 🛡️</h1>
    <p style="color: #a1a1aa;">Hello ${data.name}, our intrusion detection system noticed a new authentication event on your DevHost Cloud account.</p>

    <div class="card" style="background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; margin:20px 0;">
      <table width="100%" border="0" cellspacing="4" cellpadding="4" style="font-size:13px;">
        <tr><td style="color:#71717a;">Event Type:</td><td style="color:#ffffff; font-weight:600;">${data.alertType}</td></tr>
        <tr><td style="color:#71717a;">IP Address:</td><td style="color:#60a5fa; font-family:monospace;">${data.ipAddress}</td></tr>
        <tr><td style="color:#71717a;">Approximate Location:</td><td style="color:#ffffff;">${data.location}</td></tr>
        <tr><td style="color:#71717a;">Browser / Device:</td><td style="color:#d4d4d8;">${data.deviceBrowser}</td></tr>
        <tr><td style="color:#71717a;">Timestamp:</td><td style="color:#a1a1aa; font-size:12px;">${data.timestamp}</td></tr>
      </table>
    </div>

    <div style="background:rgba(244,63,94,0.08); border-left:4px solid #e11d48; padding:12px 16px; font-size:12px; color:#fca5a5; margin-bottom:24px;">
      If this was you, you can safely ignore this email. If you did not authorize this login, click the button below immediately to terminate all sessions and lock account actions.
    </div>

    <div style="text-align: center;">
      <a href="${data.freezeAccountUrl || 'https://devhostcloud.com/dashboard?tab=security'}" class="btn btn-rose" style="display:inline-block; padding:12px 28px; background:#e11d48; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
        Not You? Freeze Account &amp; Kill Sessions &rarr;
      </a>
    </div>
  `;
  return getEmailWrapper(content, `Security Notice: New login from ${data.deviceBrowser} (${data.ipAddress})`);
}

// ==============================================================================
// CORE SEND FUNCTION WITH RESEND API & SIMULATION FALLBACK
// ==============================================================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  template: EmailTemplateId | string;
  previewText?: string;
}

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  id: string;
  simulated: boolean;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'DevHost Cloud <noreply@devhostcloud.com>';

  // 1. If API key is available, call Resend REST API
  if (apiKey && apiKey.startsWith('re_')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: options.subject,
          html: options.html,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.id) {
        logEmailToOutbox({
          id: data.id,
          to: options.to,
          subject: options.subject,
          template: options.template,
          status: 'delivered',
          sentAt: new Date().toISOString(),
          html: options.html,
          previewText: options.previewText || options.subject,
        });

        return { success: true, id: data.id, simulated: false };
      } else {
        const errorMsg = data.message || `Resend HTTP ${res.status}`;
        console.warn(`[EmailEngine] Resend API error: ${errorMsg}. Falling back to simulation outbox.`);

        const simId = `sim_${Date.now()}`;
        logEmailToOutbox({
          id: simId,
          to: options.to,
          subject: options.subject,
          template: options.template,
          status: 'simulated',
          sentAt: new Date().toISOString(),
          html: options.html,
          previewText: options.previewText || options.subject,
          error: errorMsg,
        });

        return { success: true, id: simId, simulated: true, error: errorMsg };
      }
    } catch (err: any) {
      console.warn(`[EmailEngine] Network error sending via Resend:`, err?.message);
    }
  }

  // 2. Fallback simulation (dev mode, or no RESEND_API_KEY)
  const simId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  logEmailToOutbox({
    id: simId,
    to: options.to,
    subject: options.subject,
    template: options.template,
    status: 'simulated',
    sentAt: new Date().toISOString(),
    html: options.html,
    previewText: options.previewText || options.subject,
  });

  return { success: true, id: simId, simulated: true };
}
