import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  AUTH_TOKEN_COOKIE,
  SUDO_TOKEN_COOKIE,
  timingSafeEqualStr,
  extractCookie,
  extractAccessToken,
  signSudoToken,
  verifySudoToken,
  verifyHmacSha256Hex,
  isSafeExternalHttpUrl,
} from '@/lib/authGuard';
import { GET as networkToolsGet } from '@/app/api/network-tools/route';
import { POST as cronLifecyclePost } from '@/app/api/cron/lifecycle/route';
import { POST as v1DeployPost } from '@/app/api/v1/deploy/route';
import { POST as paymentWebhookPost } from '@/app/api/payments/webhook/route';
import { POST as createSessionPost } from '@/app/api/payments/create-session/route';
import { POST as walletPayPost } from '@/app/api/payments/wallet-pay/route';
import { POST as submitTrxIdPost } from '@/app/api/payments/submit-trxid/route';
import { GET as adminCmsGet, PUT as adminCmsPut } from '@/app/api/admin/cms-config/route';
import { GET as adminNodesGet, POST as adminNodesPost, PUT as adminNodesPut } from '@/app/api/admin/nodes-crm/route';
import { GET as adminWafGet, POST as adminWafPost, DELETE as adminWafDelete } from '@/app/api/admin/waf/route';
import { GET as adminLedgerGet, POST as adminLedgerPost } from '@/app/api/admin/ledger/route';
import { GET as adminLiveGet, POST as adminLivePost } from '@/app/api/admin/live-integrations/route';
import { GET as adminAuditGet } from '@/app/api/admin/system-audit/route';
import { POST as whmManagePost } from '@/app/api/whm/manage/route';
import { POST as whmSsoPost } from '@/app/api/whm/sso/route';
import { PUT as catalogPut } from '@/app/api/catalog/route';
import { GET as emailSendGet, POST as emailSendPost } from '@/app/api/email/send/route';
import { GET as abuseGet, POST as abusePost } from '@/app/api/abuse/route';
import { POST as docsPost, DELETE as docsDelete } from '@/app/api/docs/route';
import { POST as affiliatePost } from '@/app/api/affiliate/route';
import { GET as teamGet, POST as teamPost } from '@/app/api/team/route';
import { GET as handoverGet, POST as handoverPost, PUT as handoverPut } from '@/app/api/agency/handover/route';
import { POST as registrarPost } from '@/app/api/registrar/route';
import { GET as domainsDnsGet, POST as domainsDnsPost, PUT as domainsDnsPut, DELETE as domainsDnsDelete } from '@/app/api/domains/dns/route';
import { POST as domainsManagePost } from '@/app/api/domains/manage/route';
import { POST as installStackPost } from '@/app/api/hosting/install-stack/route';
import { GET as hostingFilesGet, POST as hostingFilesPost } from '@/app/api/hosting/files/route';
import { GET as hostingDeploymentsGet, POST as hostingDeploymentsPost } from '@/app/api/hosting/deployments/route';
import { GET as hostingProjectGet, POST as hostingProjectPost, PUT as hostingProjectPut, DELETE as hostingProjectDelete } from '@/app/api/hosting/project/route';
import { GET as hostingDatabasesGet, POST as hostingDatabasesPost } from '@/app/api/hosting/databases/route';
import { GET as hostingBackupsGet, POST as hostingBackupsPost, DELETE as hostingBackupsDelete } from '@/app/api/hosting/backups-cron/route';
import { GET as hostingDomainsGet, POST as hostingDomainsPost, DELETE as hostingDomainsDelete } from '@/app/api/hosting/domains/route';
import { GET as hostingEmailGet, POST as hostingEmailPost } from '@/app/api/hosting/email/route';
import { GET as hostingAutoscalerGet, POST as hostingAutoscalerPost } from '@/app/api/hosting/autoscaler/route';
import { GET as hostingPreviewsGet, POST as hostingPreviewsPost } from '@/app/api/hosting/previews/route';
import { GET as hostingConsoleGet, POST as hostingConsolePost } from '@/app/api/hosting/console/route';
import { GET as hostingLogDoctorGet, POST as hostingLogDoctorPost } from '@/app/api/hosting/log-doctor/route';
import { POST as selfHealPost } from '@/app/api/hosting/self-heal/route';

async function computeHmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Phase 1 Security Hardening Suite', () => {
  beforeAll(() => {
    if (!process.env.SUDO_SIGNING_SECRET) {
      process.env.SUDO_SIGNING_SECRET = 'vitest_phase1_sudo_hmac_secret_key_for_edge_runtime';
    }
  });

  describe('Timing-Safe Comparison & Token Extraction', () => {
    it('performs constant-time equality checks accurately', () => {
      expect(timingSafeEqualStr('secret_abc_123', 'secret_abc_123')).toBe(true);
      expect(timingSafeEqualStr('secret_abc_123', 'secret_abc_124')).toBe(false);
      expect(timingSafeEqualStr('short', 'much_longer_secret')).toBe(false);
    });

    it('extracts cookies safely even when values contain "=" padding', () => {
      const req = new Request('https://example.com', {
        headers: {
          cookie: `other=1; ${AUTH_TOKEN_COOKIE}=header.payload==; theme=dark`,
        },
      });
      expect(extractCookie(req, AUTH_TOKEN_COOKIE)).toBe('header.payload==');
      expect(extractCookie(req, 'missing_cookie')).toBeNull();
    });

    it('extracts Bearer token first and falls back to HttpOnly session cookie', () => {
      const reqWithBearer = new Request('https://example.com', {
        headers: {
          authorization: 'Bearer explicit_jwt_token',
          cookie: `${AUTH_TOKEN_COOKIE}=cookie_jwt_token`,
        },
      });
      expect(extractAccessToken(reqWithBearer)).toBe('explicit_jwt_token');

      const reqWithCookieOnly = new Request('https://example.com', {
        headers: {
          cookie: `${AUTH_TOKEN_COOKIE}=cookie_jwt_token`,
        },
      });
      expect(extractAccessToken(reqWithCookieOnly)).toBe('cookie_jwt_token');

      const reqUnauth = new Request('https://example.com');
      expect(extractAccessToken(reqUnauth)).toBeNull();
    });
  });

  describe('Cryptographic HttpOnly Sudo Token', () => {
    it('verifies a valid signed Sudo token bound to the expected user', async () => {
      const userId = 'user_uuid_1234';
      const token = await signSudoToken(userId, 300);
      const req = new Request('https://example.com', {
        headers: {
          cookie: `${SUDO_TOKEN_COOKIE}=${token}`,
        },
      });
      expect(await verifySudoToken(req, userId)).toBe(true);
    });

    it('rejects a Sudo token presented for a different userId', async () => {
      const token = await signSudoToken('user_victim', 300);
      const req = new Request('https://example.com', {
        headers: {
          cookie: `${SUDO_TOKEN_COOKIE}=${token}`,
        },
      });
      expect(await verifySudoToken(req, 'user_attacker')).toBe(false);
    });

    it('rejects tampered or expired Sudo tokens', async () => {
      const token = await signSudoToken('user_uuid_1234', 300);
      const tampered = token.slice(0, -4) + (token.endsWith('aaaa') ? 'bbbb' : 'aaaa');
      const tamperedReq = new Request('https://example.com', {
        headers: { cookie: `${SUDO_TOKEN_COOKIE}=${tampered}` },
      });
      expect(await verifySudoToken(tamperedReq, 'user_uuid_1234')).toBe(false);

      const expiredToken = await signSudoToken('user_uuid_1234', -10);
      const expiredReq = new Request('https://example.com', {
        headers: { cookie: `${SUDO_TOKEN_COOKIE}=${expiredToken}` },
      });
      expect(await verifySudoToken(expiredReq, 'user_uuid_1234')).toBe(false);
    });
  });

  describe('HMAC-SHA256 Hex Verification', () => {
    it('validates legitimate lowercase and uppercase HMAC signatures and rejects tampering', async () => {
      const payload = '{"event":"push","ref":"refs/heads/main"}';
      const secret = 'webhook_secret_key_001';
      const hex = await computeHmacHex(payload, secret);

      expect(await verifyHmacSha256Hex(payload, hex, secret)).toBe(true);
      expect(await verifyHmacSha256Hex(payload, hex.toUpperCase(), secret)).toBe(true);
      expect(await verifyHmacSha256Hex(payload + ' ', hex, secret)).toBe(false);
      expect(await verifyHmacSha256Hex(payload, hex, 'wrong_secret')).toBe(false);
      expect(await verifyHmacSha256Hex(payload, '', secret)).toBe(false);
      expect(await verifyHmacSha256Hex(payload, hex, '')).toBe(false);
    });
  });

  describe('SSRF External HTTP URL Guard', () => {
    it('blocks loopback, link-local metadata, private RFC1918, IPv6 local, and non-HTTP schemes', () => {
      const blockedUrls = [
        'http://127.0.0.1/admin',
        'http://127.0.0.1:8080',
        'http://localhost:3000/api',
        'http://0.0.0.0/',
        'http://169.254.169.254/latest/meta-data/',
        'http://10.0.0.1/internal',
        'http://172.16.0.12/status',
        'http://192.168.1.1/router',
        'http://[::1]:8080/',
        'file:///etc/passwd',
        'ftp://example.com/archive.zip',
        'not-a-valid-url',
      ];

      for (const target of blockedUrls) {
        expect(isSafeExternalHttpUrl(target), `Expected blocked URL: ${target}`).toBe(false);
      }
    });

    it('allows legitimate public HTTP/HTTPS URLs', () => {
      expect(isSafeExternalHttpUrl('https://example.com')).toBe(true);
      expect(isSafeExternalHttpUrl('https://api.github.com/repos/vercel/next.js')).toBe(true);
      expect(isSafeExternalHttpUrl('http://8.8.8.8/dns-query')).toBe(true);
    });
  });

  describe('Fail-Closed API Route Protections', () => {
    it('blocks SSRF targets on GET /api/network-tools?tool=headers with HTTP 400', async () => {
      const req = new NextRequest(
        'http://localhost/api/network-tools?tool=headers&url=http://169.254.169.254/latest/meta-data/',
        { headers: { 'x-forwarded-for': '203.0.113.10' } }
      );
      const res = await networkToolsGet(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(String(data.error)).toMatch(/SSRF|forbidden|blocked/i);
    });

    it('rejects hardcoded legacy cron secret bypass on POST /api/cron/lifecycle', async () => {
      const req = new NextRequest(
        'http://localhost/api/cron/lifecycle?secret=devhost_cron_secret_key',
        { method: 'POST' }
      );
      const res = await cronLifecyclePost(req);
      expect([401, 403]).toContain(res.status);
    });

    it('fails closed on spoofed PAT Bearer token in POST /api/v1/deploy', async () => {
      const req = new NextRequest('http://localhost/api/v1/deploy', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dh_live_fake_spoofed_token_999',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ domain: 'example.com' }),
      });
      const res = await v1DeployPost(req);
      expect([401, 503]).toContain(res.status);
    });

    it('fails closed on unsigned POST /api/payments/webhook', async () => {
      const req = new NextRequest('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          amount: '1500',
          invoice_id: 'INV-FAKE-1',
          transaction_id: 'TRX-FAKE-1',
        }),
      });
      const res = await paymentWebhookPost(req);
      expect([401, 503]).toContain(res.status);
    });

    it('rejects unauthenticated GET /api/admin/ledger', async () => {
      const req = new NextRequest('http://localhost/api/admin/ledger');
      const res = await adminLedgerGet(req);
      expect([401, 403, 503]).toContain(res.status);
    });

    it('blocks unauthenticated/SSRF POST /api/hosting/self-heal', async () => {
      const req = new NextRequest('http://localhost/api/hosting/self-heal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceId: 'svc-1',
          targetUrl: 'http://127.0.0.1:8080/health',
          probeOnly: true,
        }),
      });
      const res = await selfHealPost(req);
      expect([400, 401, 403, 503]).toContain(res.status);
    });

    it('enforces 401/403 fail-closed across every admin, WHM, billing, affiliate, domain, and hosting mutation route without JWT', async () => {
      const jsonPost = (url: string, body: Record<string, unknown>) =>
        new NextRequest(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      const jsonPut = (url: string, body: Record<string, unknown>) =>
        new NextRequest(url, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

      const protectedCalls: Array<[string, () => Promise<Response>]> = [
        ['GET /api/admin/cms-config?key=private_key', () => adminCmsGet(new NextRequest('http://localhost/api/admin/cms-config?key=private_key'))],
        ['PUT /api/admin/cms-config', () => adminCmsPut(jsonPut('http://localhost/api/admin/cms-config', { key: 'hero_cms_content', value: {} }))],
        ['GET /api/admin/nodes-crm', () => adminNodesGet(new NextRequest('http://localhost/api/admin/nodes-crm'))],
        ['POST /api/admin/nodes-crm', () => adminNodesPost(jsonPost('http://localhost/api/admin/nodes-crm', { action: 'save_node' }))],
        ['PUT /api/admin/nodes-crm', () => adminNodesPut(jsonPut('http://localhost/api/admin/nodes-crm', { id: 'node-1', status: 'maintenance' }))],
        ['GET /api/admin/waf', () => adminWafGet(new NextRequest('http://localhost/api/admin/waf'))],
        ['POST /api/admin/waf', () => adminWafPost(jsonPost('http://localhost/api/admin/waf', { action: 'toggle_lockdown' }))],
        ['DELETE /api/admin/waf', () => adminWafDelete(new NextRequest('http://localhost/api/admin/waf?id=1', { method: 'DELETE' }))],
        ['POST /api/admin/ledger', () => adminLedgerPost(jsonPost('http://localhost/api/admin/ledger', { action: 'process_refund', orderId: 'ord-1' }))],
        ['GET /api/admin/live-integrations', () => adminLiveGet(new NextRequest('http://localhost/api/admin/live-integrations'))],
        ['POST /api/admin/live-integrations', () => adminLivePost(jsonPost('http://localhost/api/admin/live-integrations', { provider: 'whm' }))],
        ['GET /api/admin/system-audit', () => adminAuditGet(new NextRequest('http://localhost/api/admin/system-audit'))],
        ['POST /api/whm/manage', () => whmManagePost(jsonPost('http://localhost/api/whm/manage', { action: 'list_accounts' }))],
        ['POST /api/whm/sso', () => whmSsoPost(jsonPost('http://localhost/api/whm/sso', { username: 'user1', service: 'cpaneld' }))],
        ['PUT /api/catalog', () => catalogPut(jsonPut('http://localhost/api/catalog', { id: 'starter', priceMonthlyBDT: 1 }))],
        ['GET /api/email/send', () => emailSendGet(new NextRequest('http://localhost/api/email/send'))],
        ['POST /api/email/send', () => emailSendPost(jsonPost('http://localhost/api/email/send', { to: 'test@example.com' }))],
        ['GET /api/abuse (admin queue)', () => abuseGet(new NextRequest('http://localhost/api/abuse?type=reports'))],
        ['POST /api/abuse (update_legal_doc)', () => abusePost(jsonPost('http://localhost/api/abuse', { action: 'update_legal_doc', slug: 'tos', content: 'hacked' }))],
        ['POST /api/docs (save_article)', () => docsPost(jsonPost('http://localhost/api/docs', { action: 'save_article', title: 'x' }))],
        ['DELETE /api/docs', () => docsDelete(new NextRequest('http://localhost/api/docs?id=doc-1&type=article', { method: 'DELETE' }))],
        ['POST /api/payments/create-session', () => createSessionPost(jsonPost('http://localhost/api/payments/create-session', { gateway: 'bkash', amountBDT: 500 }))],
        ['POST /api/payments/wallet-pay', () => walletPayPost(jsonPost('http://localhost/api/payments/wallet-pay', { invoiceNumber: 'INV-1', amountBDT: -5000 }))],
        ['POST /api/payments/submit-trxid', () => submitTrxIdPost(jsonPost('http://localhost/api/payments/submit-trxid', { invoiceNumber: 'INV-1', trxId: 'TRX1' }))],
        ['POST /api/affiliate (record_conversion)', () => affiliatePost(jsonPost('http://localhost/api/affiliate', { action: 'record_conversion', referralCode: 'REF1', invoiceId: 'inv-1' }))],
        ['POST /api/affiliate (mature_commissions)', () => affiliatePost(jsonPost('http://localhost/api/affiliate', { action: 'mature_commissions' }))],
        ['POST /api/affiliate (request_payout)', () => affiliatePost(jsonPost('http://localhost/api/affiliate', { action: 'request_payout', amountBDT: 500 }))],
        ['POST /api/affiliate (clawback_refund)', () => affiliatePost(jsonPost('http://localhost/api/affiliate', { action: 'clawback_refund', invoiceId: 'inv-1' }))],
        ['GET /api/team', () => teamGet(new NextRequest('http://localhost/api/team?ownerUserId=user-1'))],
        ['POST /api/team', () => teamPost(jsonPost('http://localhost/api/team', { action: 'invite', email: 'x@example.com' }))],
        ['GET /api/agency/handover (developer list)', () => handoverGet(new NextRequest('http://localhost/api/agency/handover?developerUserId=user-1'))],
        ['POST /api/agency/handover', () => handoverPost(jsonPost('http://localhost/api/agency/handover', { serviceId: 'svc-1', clientEmail: 'c@example.com' }))],
        ['PUT /api/agency/handover', () => handoverPut(jsonPut('http://localhost/api/agency/handover', { handoverToken: 'tok-1' }))],
        ['POST /api/registrar', () => registrarPost(jsonPost('http://localhost/api/registrar', { action: 'register', domain: 'example.com' }))],
        ['GET /api/domains/dns', () => domainsDnsGet(new NextRequest('http://localhost/api/domains/dns?domainId=dom-1'))],
        ['POST /api/domains/dns', () => domainsDnsPost(jsonPost('http://localhost/api/domains/dns', { domainId: 'dom-1', type: 'A', name: '@', content: '1.1.1.1' }))],
        ['PUT /api/domains/dns', () => domainsDnsPut(jsonPut('http://localhost/api/domains/dns', { recordId: 'rec-1', domainId: 'dom-1', record: { type: 'A', name: '@', content: '1.1.1.1' } }))],
        ['DELETE /api/domains/dns', () => domainsDnsDelete(new NextRequest('http://localhost/api/domains/dns?recordId=rec-1&domainId=dom-1', { method: 'DELETE' }))],
        ['POST /api/domains/manage', () => domainsManagePost(jsonPost('http://localhost/api/domains/manage', { action: 'get_epp', domainId: 'dom-1' }))],
        ['POST /api/hosting/install-stack', () => installStackPost(jsonPost('http://localhost/api/hosting/install-stack', { serviceId: 'svc-1', domain: 'example.com', stackSlug: 'nextjs-15-pro' }))],
        ['GET /api/hosting/files', () => hostingFilesGet(new NextRequest('http://localhost/api/hosting/files?serviceId=svc-1'))],
        ['POST /api/hosting/files', () => hostingFilesPost(jsonPost('http://localhost/api/hosting/files', { serviceId: 'svc-1', action: 'save_file', filePath: '/index.html', content: 'x' }))],
        ['GET /api/hosting/deployments', () => hostingDeploymentsGet(new NextRequest('http://localhost/api/hosting/deployments?serviceId=svc-1'))],
        ['POST /api/hosting/deployments', () => hostingDeploymentsPost(jsonPost('http://localhost/api/hosting/deployments', { serviceId: 'svc-1', action: 'trigger_deploy' }))],
        ['GET /api/hosting/project', () => hostingProjectGet(new NextRequest('http://localhost/api/hosting/project?serviceId=svc-1'))],
        ['POST /api/hosting/project', () => hostingProjectPost(jsonPost('http://localhost/api/hosting/project', { serviceId: 'svc-1', action: 'reveal_secret', envId: 'env-1' }))],
        ['PUT /api/hosting/project', () => hostingProjectPut(jsonPut('http://localhost/api/hosting/project', { serviceId: 'svc-1', settings: { framework_preset: 'nextjs_standalone' } }))],
        ['DELETE /api/hosting/project', () => hostingProjectDelete(new NextRequest('http://localhost/api/hosting/project?serviceId=svc-1&envId=env-1', { method: 'DELETE' }))],
        ['GET /api/hosting/databases', () => hostingDatabasesGet(new NextRequest('http://localhost/api/hosting/databases?serviceId=svc-1'))],
        ['POST /api/hosting/databases', () => hostingDatabasesPost(jsonPost('http://localhost/api/hosting/databases', { serviceId: 'svc-1', action: 'create_database', dbName: 'testdb' }))],
        ['GET /api/hosting/backups-cron', () => hostingBackupsGet(new NextRequest('http://localhost/api/hosting/backups-cron?serviceId=svc-1'))],
        ['POST /api/hosting/backups-cron', () => hostingBackupsPost(jsonPost('http://localhost/api/hosting/backups-cron', { serviceId: 'svc-1', action: 'create_backup' }))],
        ['DELETE /api/hosting/backups-cron', () => hostingBackupsDelete(new NextRequest('http://localhost/api/hosting/backups-cron?id=c-1&itemType=cron&serviceId=svc-1', { method: 'DELETE' }))],
        ['GET /api/hosting/domains', () => hostingDomainsGet(new NextRequest('http://localhost/api/hosting/domains?serviceId=svc-1'))],
        ['POST /api/hosting/domains', () => hostingDomainsPost(jsonPost('http://localhost/api/hosting/domains', { serviceId: 'svc-1', hostname: 'app.example.com', domainType: 'addon' }))],
        ['DELETE /api/hosting/domains', () => hostingDomainsDelete(new NextRequest('http://localhost/api/hosting/domains?id=hd-1&serviceId=svc-1', { method: 'DELETE' }))],
        ['GET /api/hosting/email', () => hostingEmailGet(new NextRequest('http://localhost/api/hosting/email?serviceId=svc-1'))],
        ['POST /api/hosting/email', () => hostingEmailPost(jsonPost('http://localhost/api/hosting/email', { serviceId: 'svc-1', action: 'create_mailbox', email: 'hi@example.com' }))],
        ['GET /api/hosting/autoscaler', () => hostingAutoscalerGet(new NextRequest('http://localhost/api/hosting/autoscaler?serviceId=svc-1'))],
        ['POST /api/hosting/autoscaler', () => hostingAutoscalerPost(jsonPost('http://localhost/api/hosting/autoscaler', { serviceId: 'svc-1', autoscale_enabled: true }))],
        ['GET /api/hosting/previews', () => hostingPreviewsGet(new NextRequest('http://localhost/api/hosting/previews?serviceId=svc-1'))],
        ['POST /api/hosting/previews', () => hostingPreviewsPost(jsonPost('http://localhost/api/hosting/previews', { serviceId: 'svc-1', branch_name: 'feat/x' }))],
        ['GET /api/hosting/console', () => hostingConsoleGet(new NextRequest('http://localhost/api/hosting/console?serviceId=svc-1'))],
        ['POST /api/hosting/console', () => hostingConsolePost(jsonPost('http://localhost/api/hosting/console', { serviceId: 'svc-1', consoleType: 'jailed_ssh', commandOrQuery: 'ls' }))],
        ['GET /api/hosting/log-doctor', () => hostingLogDoctorGet(new NextRequest('http://localhost/api/hosting/log-doctor?serviceId=svc-1'))],
        ['POST /api/hosting/log-doctor', () => hostingLogDoctorPost(jsonPost('http://localhost/api/hosting/log-doctor', { serviceId: 'svc-1', fixActionCode: 'CLEANUP_INODES' }))],
      ];

      for (const [label, invoke] of protectedCalls) {
        const res = await invoke();
        expect(
          [401, 403, 503],
          `Route ${label} unexpectedly returned HTTP ${res.status} without valid auth`
        ).toContain(res.status);
      }
    });
  });
});
