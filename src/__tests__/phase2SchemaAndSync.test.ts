import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const controls = vi.hoisted(() => ({
  supabaseConfigured: true,
  authenticated: true,
}));

vi.mock('@/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase')>();
  return {
    ...actual,
    isSupabaseConfigured: () => controls.supabaseConfigured,
  };
});

vi.mock('@/lib/authGuard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/authGuard')>();
  const { NextResponse } = await import('next/server');
  const fakeUser = {
    id: '00000000-0000-0000-0000-000000000099',
    email: 'admin@devhost.cloud',
  } as unknown as import('@supabase/supabase-js').User;
  const fakeProfile = {
    id: '00000000-0000-0000-0000-000000000099',
    email: 'admin@devhost.cloud',
    full_name: 'Test Founder',
    role: 'admin' as const,
    wallet_balance_bdt: 5000,
  };
  const unauthResp = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return {
    ...actual,
    requireUser: async () =>
      controls.authenticated
        ? { ok: true, user: fakeUser, profile: fakeProfile, role: 'admin' as const }
        : { ok: false, response: unauthResp() },
    requireAdmin: async () =>
      controls.authenticated
        ? { ok: true, user: fakeUser, profile: fakeProfile, role: 'admin' as const }
        : { ok: false, response: unauthResp() },
    requireServiceAccess: async (_req: Request, serviceId: string | null) =>
      controls.authenticated
        ? { ok: true, user: fakeUser, profile: fakeProfile, role: 'admin' as const, serviceId: serviceId || 'srv-1' }
        : { ok: false, response: unauthResp() },
    requireDomainAccess: async (_req: Request, opts: { domainId?: string | null }) =>
      controls.authenticated
        ? { ok: true, user: fakeUser, profile: fakeProfile, role: 'admin' as const, domainId: opts.domainId || 'dom-1' }
        : { ok: false, response: unauthResp() },
    verifyCronOrAdmin: async () =>
      controls.authenticated
        ? { ok: true, isCron: false, user: fakeUser }
        : { ok: false, response: unauthResp() },
  };
});

import { isDevSandboxMode } from '@/lib/supabase';
import { WhmClient } from '@/lib/whmClient';
import { resolveCanonicalFrameworkPreset } from '@/lib/stackProvisioner';
import { GET as deploymentsGet } from '@/app/api/hosting/deployments/route';
import { GET as dnsGet } from '@/app/api/domains/dns/route';
import { GET as projectGet } from '@/app/api/hosting/project/route';
import { GET as databasesGet } from '@/app/api/hosting/databases/route';
import { GET as backupsGet } from '@/app/api/hosting/backups-cron/route';
import { GET as hostingDomainsGet } from '@/app/api/hosting/domains/route';
import { POST as affiliatePost } from '@/app/api/affiliate/route';
import { GET as ledgerGet } from '@/app/api/admin/ledger/route';
import { GET as wafGet } from '@/app/api/admin/waf/route';
import { GET as nodesCrmGet } from '@/app/api/admin/nodes-crm/route';
import { GET as handoverGet } from '@/app/api/agency/handover/route';
import { GET as catalogGet, PUT as catalogPut, DELETE as catalogDelete } from '@/app/api/catalog/route';
import { POST as whmManagePost } from '@/app/api/whm/manage/route';
import { POST as whmSsoPost } from '@/app/api/whm/sso/route';

function jsonReq(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Phase 2: Schema Reconciliation, Fail-Closed 503 Guards & Dynamic Catalog Sync', () => {
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    DEV_SANDBOX_MODE: process.env.DEV_SANDBOX_MODE,
    WHM_HOST: process.env.WHM_HOST,
    WHM_USERNAME: process.env.WHM_USERNAME,
    WHM_API_TOKEN: process.env.WHM_API_TOKEN,
  };

  afterEach(() => {
    controls.supabaseConfigured = true;
    controls.authenticated = true;
    (process.env as Record<string, string | undefined>).NODE_ENV = envSnapshot.NODE_ENV;
    (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE = envSnapshot.DEV_SANDBOX_MODE;
    (process.env as Record<string, string | undefined>).WHM_HOST = envSnapshot.WHM_HOST;
    (process.env as Record<string, string | undefined>).WHM_USERNAME = envSnapshot.WHM_USERNAME;
    (process.env as Record<string, string | undefined>).WHM_API_TOKEN = envSnapshot.WHM_API_TOKEN;
  });

  describe('DEV_SANDBOX_MODE Fail-Closed Gate', () => {
    it('returns false by default when DEV_SANDBOX_MODE is unset', () => {
      delete (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE;
      expect(isDevSandboxMode()).toBe(false);
    });

    it('never permits sandbox mode when NODE_ENV === production', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE = 'true';
      expect(isDevSandboxMode()).toBe(false);
    });

    it('enables sandbox mode only outside production with DEV_SANDBOX_MODE=true', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE = 'true';
      expect(isDevSandboxMode()).toBe(true);
    });
  });

  describe('WhmClient Non-Sandbox Fail-Closed Behavior', () => {
    it('fails closed across all WHM methods when unconfigured and DEV_SANDBOX_MODE is false', async () => {
      delete (process.env as Record<string, string | undefined>).WHM_HOST;
      delete (process.env as Record<string, string | undefined>).WHM_USERNAME;
      delete (process.env as Record<string, string | undefined>).WHM_API_TOKEN;
      delete (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE;

      const client = new WhmClient();
      expect(client.getStatus().configured).toBe(false);
      expect(client.getStatus().host).toBe('Unconfigured');

      const acct = await client.createCpanelAccount({
        username: 'testusr',
        domain: 'example.com',
        plan: 'devpro',
        contactEmail: 'dev@example.com',
      });
      expect(acct.success).toBe(false);

      const sso = await client.createSsoSession('testusr', 'cpaneld');
      expect(sso.success).toBe(false);
      expect(sso.url).toBe('');

      const susp = await client.suspendAccount('testusr');
      expect(susp.success).toBe(false);

      const unsusp = await client.unsuspendAccount('testusr');
      expect(unsusp.success).toBe(false);

      const listed = await client.listAccounts();
      expect(listed.success).toBe(false);
      expect(listed.accounts).toEqual([]);

      const pkg = await client.syncPackageToWhmServer({
        name: 'devpro',
        storage_gb: 5,
        max_addon_domains: 5,
        cpu_cores: 2,
        ram_mb: 2048,
        io_speed_mbps: 50,
        entry_processes: 40,
        inode_limit: 300000,
      });
      expect(pkg.success).toBe(false);
      expect(pkg.action).toBe('error');

      const ssl = await client.triggerInstantAutoSsl('testusr');
      expect(ssl.success).toBe(false);
    });

    it('permits deterministic simulation payloads only when DEV_SANDBOX_MODE=true in non-production', async () => {
      delete (process.env as Record<string, string | undefined>).WHM_HOST;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE = 'true';

      const client = new WhmClient();
      const sso = await client.createSsoSession('testusr', 'cpaneld');
      expect(sso.success).toBe(true);
      expect(sso.url).toContain('cpanel.devhost.net');

      const ssl = await client.triggerInstantAutoSsl('testusr');
      expect(ssl.success).toBe(true);
    });
  });

  describe('HTTP 503 Enforcement When Backend Providers Are Unconfigured', () => {
    it('enforces auth fail-closed on DELETE /api/catalog before checking DB status', async () => {
      controls.authenticated = false;
      controls.supabaseConfigured = false;

      const res = await catalogDelete(
        new NextRequest('http://localhost/api/catalog?entityType=promo&code=DEVPRO20', { method: 'DELETE' })
      );
      expect(res.status).toBe(401);
    });

    it('returns HTTP 503 instead of fake 200 mocks across routes when unconfigured outside sandbox', async () => {
      controls.authenticated = true;
      controls.supabaseConfigured = false;
      delete (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE;

      const calls: Array<[string, () => Promise<Response>]> = [
        ['GET /api/hosting/deployments', () => deploymentsGet(new NextRequest('http://localhost/api/hosting/deployments?serviceId=srv-1'))],
        ['GET /api/domains/dns', () => dnsGet(new NextRequest('http://localhost/api/domains/dns?domainId=dom-1'))],
        ['GET /api/hosting/project', () => projectGet(new NextRequest('http://localhost/api/hosting/project?serviceId=srv-1'))],
        ['GET /api/hosting/databases', () => databasesGet(new NextRequest('http://localhost/api/hosting/databases?serviceId=srv-1'))],
        ['GET /api/hosting/backups-cron', () => backupsGet(new NextRequest('http://localhost/api/hosting/backups-cron?serviceId=srv-1'))],
        ['GET /api/hosting/domains', () => hostingDomainsGet(new NextRequest('http://localhost/api/hosting/domains?serviceId=srv-1'))],
        ['POST /api/affiliate (track_click)', () => affiliatePost(jsonReq('http://localhost/api/affiliate', 'POST', { action: 'track_click', referralCode: 'hanif' }))],
        ['POST /api/affiliate (record_conversion)', () => affiliatePost(jsonReq('http://localhost/api/affiliate', 'POST', { action: 'record_conversion', referralCode: 'hanif', buyerEmail: 'a@b.com' }))],
        ['GET /api/admin/ledger', () => ledgerGet(new NextRequest('http://localhost/api/admin/ledger'))],
        ['GET /api/admin/waf', () => wafGet(new NextRequest('http://localhost/api/admin/waf'))],
        ['GET /api/admin/nodes-crm', () => nodesCrmGet(new NextRequest('http://localhost/api/admin/nodes-crm'))],
        ['GET /api/agency/handover?token=x', () => handoverGet(new NextRequest('http://localhost/api/agency/handover?token=nonexistent'))],
        ['GET /api/catalog', () => catalogGet()],
        ['PUT /api/catalog', () => catalogPut(jsonReq('http://localhost/api/catalog', 'PUT', { entityType: 'promo', data: { code: 'TEST20', discount_value: 20 } }))],
        ['DELETE /api/catalog', () => catalogDelete(new NextRequest('http://localhost/api/catalog?entityType=promo&code=TEST20', { method: 'DELETE' }))],
        ['POST /api/whm/sso', () => whmSsoPost(jsonReq('http://localhost/api/whm/sso', 'POST', { username: 'devuser', service: 'cpaneld' }))],
        ['POST /api/whm/manage (list)', () => whmManagePost(jsonReq('http://localhost/api/whm/manage', 'POST', { action: 'list' }))],
      ];

      for (const [label, invoke] of calls) {
        const res = await invoke();
        expect(res.status, `${label} should fail closed with 503 when unconfigured`).toBe(503);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.code).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('returns HTTP 200 sandbox fixtures only when DEV_SANDBOX_MODE=true in non-production', async () => {
      controls.authenticated = true;
      controls.supabaseConfigured = false;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      (process.env as Record<string, string | undefined>).DEV_SANDBOX_MODE = 'true';

      const depRes = await deploymentsGet(new NextRequest('http://localhost/api/hosting/deployments?serviceId=srv-1'));
      expect(depRes.status).toBe(200);

      const dnsRes = await dnsGet(new NextRequest('http://localhost/api/domains/dns?domainId=dom-1'));
      expect(dnsRes.status).toBe(200);

      const catRes = await catalogGet();
      expect(catRes.status).toBe(200);
      const catJson = await catRes.json();
      expect(Array.isArray(catJson.promoCodes)).toBe(true);
      expect(Array.isArray(catJson.serverNodes)).toBe(true);
    });
  });

  describe('Canonical Schema Mappings & Migration Integrity', () => {
    it('maps marketplace stacks strictly to canonical framework_preset CHECK values', () => {
      expect(resolveCanonicalFrameworkPreset('nextjs-15-standalone', 'nodejs_passenger')).toBe('nextjs_standalone');
      expect(resolveCanonicalFrameworkPreset('laravel-11-saas', 'php_litespeed')).toBe('laravel_php');
      expect(resolveCanonicalFrameworkPreset('wordpress-woocommerce-lscache', 'php_litespeed')).toBe('wordpress_lscache');
      expect(resolveCanonicalFrameworkPreset('fastapi-ai-microservice', 'python_wsgi_asgi')).toBe('python_wsgi');
      expect(resolveCanonicalFrameworkPreset('react-vite-spa-edge', 'static_edge')).toBe('static_site');
      expect(resolveCanonicalFrameworkPreset('expressjs-api-starter', 'nodejs_passenger')).toBe('nodejs_express');
    });

    it('ensures reconcile_core_schemas.sql covers all reconciled tables, constraints, and RLS tightening', () => {
      const migrationSql = readFileSync(
        resolve(process.cwd(), 'supabase/migrations/reconcile_core_schemas.sql'),
        'utf8'
      );

      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.wallet_transactions');
      expect(migrationSql).toContain('uq_domain_dns_record_tuple UNIQUE (domain_id, name, record_type, content)');
      expect(migrationSql).toContain('uq_service_env_target UNIQUE (service_id, env_key, target_environment)');
      expect(migrationSql).toContain('uq_hosting_databases_service_dbname UNIQUE (service_id, db_name)');
      expect(migrationSql).toContain('FOR ALL TO service_role');
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "Public can view pending handover by token"');
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "Public can check referral slug existence"');
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.check_referral_slug_exists');
      expect(migrationSql).toContain('financial_profit_ledger_entry_type_check');
      expect(migrationSql).toContain("to_regclass('public.service_uptime_telemetry')");
      expect(migrationSql).toContain("to_regclass('public.security_audit_logs')");
      expect(migrationSql).toContain('auth.uid() = actor_id');
      expect(migrationSql).toContain('custom_referral_slug');
      expect(migrationSql).toContain('tax_vat_bin_number');

      const workflow2Sql = readFileSync(
        resolve(process.cwd(), 'supabase/workflow2_profiles_and_2fa.sql'),
        'utf8'
      );
      expect(workflow2Sql).toContain('ALTER TABLE public.customer_developer_profiles');
      expect(workflow2Sql).toContain('ADD COLUMN IF NOT EXISTS tax_vat_bin_number TEXT');
      expect(workflow2Sql).toContain('to_jsonb(NEW)');
      expect(workflow2Sql).toContain('to_jsonb(r)');
      expect(workflow2Sql).not.toContain('CREATE POLICY "Public can check referral slug existence"');
    });

    it('ensures PortalContext initializes static node/promo mocks empty and admin/ledger uses clawed_back_refunded', () => {
      const portalCtx = readFileSync(resolve(process.cwd(), 'src/context/PortalContext.tsx'), 'utf8');
      expect(portalCtx).toContain('const INITIAL_NODES: ServerNode[] = [];');
      expect(portalCtx).toContain('const INITIAL_PROMOS: PromoCode[] = [];');
      expect(portalCtx).toContain('/api/admin/nodes-crm');
      expect(portalCtx).toContain("entityType: 'promo'");

      const ledgerRoute = readFileSync(resolve(process.cwd(), 'src/app/api/admin/ledger/route.ts'), 'utf8');
      expect(ledgerRoute).toContain('clawed_back_refunded');
      expect(ledgerRoute).toContain('affiliate_user_id');
      expect(ledgerRoute).not.toContain("status: 'reversed'");
    });
  });
});
