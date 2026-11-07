import { NextRequest, NextResponse } from 'next/server';
import {
  sendTransactionalEmail,
  getEmailOutboxLogs,
  renderWelcomeVerifyEmail,
  renderHostingProvisionedEmail,
  renderInvoicePaidEmail,
  renderRenewalReminderEmail,
  renderServiceSuspendedEmail,
  renderAffiliateEmail,
  renderMigrationStatusEmail,
  renderSecurityThreatEmail,
  EmailTemplateId,
} from '@/lib/emailEngine';


export async function GET() {
  const outbox = getEmailOutboxLogs();
  return NextResponse.json({
    success: true,
    count: outbox.length,
    outbox,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, template, data } = body as {
      to: string;
      template: EmailTemplateId;
      data: any;
    };

    if (!to || !template) {
      return NextResponse.json(
        { error: 'Missing required fields: to, template' },
        { status: 400 }
      );
    }

    let subject = 'DevHost Cloud Notification';
    let html = '';
    let previewText = '';

    switch (template) {
      case 'welcome_and_verify':
        subject = '🚀 Welcome to DevHost Cloud — Verify Your Account';
        previewText = `Your 2FA PIN is ${data.verificationCode || '849201'}`;
        html = renderWelcomeVerifyEmail({
          name: data.name || 'Valued Customer',
          email: to,
          verificationCode: data.verificationCode || '849201',
          loginUrl: data.loginUrl,
        });
        break;

      case 'hosting_provisioned_credentials':
        subject = `⚡ cPanel Credentials & Server Provisioning — ${data.domain || 'Cloud Service'}`;
        previewText = `Your hosting is live on ${data.serverIp || 'Singapore SG1'}. Login link inside.`;
        html = renderHostingProvisionedEmail({
          name: data.name || 'Developer',
          packageName: data.packageName || 'Developer Pro NVMe',
          domain: data.domain || 'mysite.com',
          serverIp: data.serverIp || '103.205.71.18',
          datacenter: data.datacenter || 'Singapore SG1 (Equinix)',
          nameservers: data.nameservers || ['ns1.devhostcloud.com', 'ns2.devhostcloud.com'],
          cpanelUsername: data.cpanelUsername || 'cp_user',
          ssoLoginUrl: data.ssoLoginUrl || 'https://devhostcloud.com/dashboard',
          sshPort: data.sshPort || 22,
          sshHost: data.sshHost || '103.205.71.18',
          webhookGuideUrl: data.webhookGuideUrl,
        });
        break;

      case 'invoice_paid_receipt':
        subject = `Receipt for Invoice ${data.invoiceNumber || 'INV-2026-9021'} ✅`;
        previewText = `৳${data.amountBDT || 450} paid via ${data.paymentMethod || 'bKash'}.`;
        html = renderInvoicePaidEmail({
          name: data.name || 'Customer',
          invoiceNumber: data.invoiceNumber || 'INV-2026-9021',
          amountBDT: data.amountBDT || 450,
          paymentMethod: data.paymentMethod || 'bKash',
          trxId: data.trxId || '9K72LM89QP',
          paidDate: data.paidDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          items: data.items || [{ desc: 'Developer Pro NVMe (1 Month)', amount: data.amountBDT || 450 }],
          viewInvoiceUrl: data.viewInvoiceUrl,
        });
        break;

      case 'renewal_reminder_notice':
        subject = `Urgent: ${data.domain || 'Service'} Renewal Due Notice (${data.daysRemaining || 3} days left)`;
        previewText = `Renew now to avoid service interruption for ${data.domain}.`;
        html = renderRenewalReminderEmail({
          name: data.name || 'Customer',
          serviceName: data.serviceName || 'Cloud Hosting',
          domain: data.domain || 'mysite.com',
          expiryDate: data.expiryDate || 'In 3 days',
          daysRemaining: data.daysRemaining || 3,
          renewalAmountBDT: data.renewalAmountBDT || 450,
          walletBalanceBDT: data.walletBalanceBDT || 0,
          renewUrl: data.renewUrl,
        });
        break;

      case 'service_suspended_alert':
        subject = `Critical: Service Suspended for ${data.domain || 'Account'} 🛑`;
        previewText = `Payment overdue. Unfreeze within ${data.terminationGraceDays || 14} days.`;
        html = renderServiceSuspendedEmail({
          name: data.name || 'Customer',
          serviceName: data.serviceName || 'NVMe Hosting',
          domain: data.domain || 'mysite.com',
          overdueDays: data.overdueDays || 3,
          outstandingAmountBDT: data.outstandingAmountBDT || 450,
          terminationGraceDays: data.terminationGraceDays || 14,
          payUnlockUrl: data.payUnlockUrl,
        });
        break;

      case 'affiliate_commission_and_payout':
        subject = data.type === 'payout_sent' ? '💸 Payout Sent to Your Mobile Wallet!' : '🎉 New Affiliate Commission Credited!';
        previewText = `৳${data.amountBDT || 150} BDT update on your DevHost Partner account.`;
        html = renderAffiliateEmail({
          name: data.name || 'Partner',
          type: data.type || 'commission_earned',
          amountBDT: data.amountBDT || 150,
          details: data.details || 'Commission from referred customer order',
          trxId: data.trxId,
          holdDaysRemaining: data.holdDaysRemaining,
          dashboardUrl: data.dashboardUrl,
        });
        break;

      case 'migration_status_update':
        subject = `Website Migration Update: ${data.domain || 'Your Site'} 🚚`;
        previewText = `Status: ${data.status || 'in_progress'}. Next steps inside.`;
        html = renderMigrationStatusEmail({
          name: data.name || 'Customer',
          domain: data.domain || 'mysite.com',
          status: data.status || 'completed',
          sourceHost: data.sourceHost || 'Previous cPanel Provider',
          temporaryUrl: data.temporaryUrl,
          nameservers: data.nameservers || ['ns1.devhostcloud.com', 'ns2.devhostcloud.com'],
        });
        break;

      case 'security_threat_alert':
        subject = `Security Notice: New Login Detected (${data.ipAddress || '103.205.71.18'}) 🛡️`;
        previewText = `Unrecognized device signed in to your account.`;
        html = renderSecurityThreatEmail({
          name: data.name || 'Customer',
          alertType: data.alertType || 'New Device Sign-In',
          ipAddress: data.ipAddress || '103.205.71.18',
          location: data.location || 'Dhaka, Bangladesh',
          deviceBrowser: data.deviceBrowser || 'Chrome 122 on Windows',
          timestamp: data.timestamp || new Date().toISOString(),
          freezeAccountUrl: data.freezeAccountUrl,
        });
        break;

      default:
        subject = data.subject || 'DevHost Cloud Alert';
        html = `<div style="padding:20px; font-family:sans-serif;">${data.message || 'Notification'}</div>`;
        break;
    }

    const result = await sendTransactionalEmail({
      to,
      subject,
      html,
      template,
      previewText,
    });

    return NextResponse.json({
      success: true,
      result,
      subject,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch email' },
      { status: 500 }
    );
  }
}
