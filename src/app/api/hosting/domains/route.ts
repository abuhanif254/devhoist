import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { requireUser, requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import { scanDomainForPhishing } from '@/lib/abuseShieldEngine';
import {
  createCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  ensureCloudflareZone,
  getCloudflareConfig,
  getCloudflareCustomHostnameStatus,
  isCloudflareConfigured,
  isCloudflareSaasConfigured,
  isValidCustomHostname,
  verifyDomainTxtRecord,
} from '@/lib/cloudflareClient';

async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, unknown>,
  ip: string = '127.0.0.1',
  riskLevel: 'low' | 'medium' | 'high' = 'medium'
) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = getServiceSupabase();
    await db.from('security_audit_logs').insert({
      actor_id: actorId,
      actor_role: 'client',
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

async function resolveAllowedOriginServer(
  db: ReturnType<typeof getServiceSupabase> | null,
  requestedOrigin: string | null | undefined,
  fallbackOrigin: string | null | undefined
): Promise<{ allowed: boolean; originServer?: string; error?: string }> {
  const cleanFallback = String(fallbackOrigin || '').trim().toLowerCase() || undefined;
  const cleanRequested = String(requestedOrigin || '').trim().toLowerCase();

  if (!cleanRequested) {
    return { allowed: true, originServer: cleanFallback };
  }

  if (cleanFallback && cleanRequested === cleanFallback) {
    return { allowed: true, originServer: cleanRequested };
  }

  if (db) {
    try {
      const { data: nodes } = await db
        .from('whm_server_nodes')
        .select('hostname, ip_address, is_active')
        .eq('is_active', true);

      const matched = ((nodes || []) as Array<{ hostname?: string; ip_address?: string; is_active?: boolean }>).some(
        (n) => {
          if (n.is_active === false) return false;
          const h = String(n.hostname || '').trim().toLowerCase();
          const ip = String(n.ip_address || '').trim().toLowerCase();
          return cleanRequested === h || cleanRequested === ip;
        }
      );

      if (matched) {
        return { allowed: true, originServer: cleanRequested };
      }
    } catch {
      // Fail closed if node lookup cannot confirm custom origin override
    }
  }

  return {
    allowed: false,
    error:
      'Arbitrary custom origin overrides are forbidden. Leave origin empty or target a verified DevHost server node.',
  };
}

async function provisionCloudflareForDomainHost(
  hostname: string,
  originServer?: string
): Promise<{
  ok: boolean;
  error?: string;
  cfHostnameId: string | null;
  sslStatus: 'pending_validation' | 'provisioning' | 'active_tls13' | 'failed' | 'expired';
  sslDcvMethod: string;
  dcvRecordName: string | null;
  dcvRecordValue: string | null;
}> {
  let cfHostnameId: string | null = null;
  let sslStatus: 'pending_validation' | 'provisioning' | 'active_tls13' | 'failed' | 'expired' = 'pending_validation';
  let sslDcvMethod = 'txt';
  let dcvRecordName: string | null = null;
  let dcvRecordValue: string | null = null;

  if (isCloudflareSaasConfigured() || isDevSandboxMode()) {
    const cfHost = await createCloudflareCustomHostname(hostname, {
      dcvMethod: 'txt',
      customOriginServer: originServer,
    });
    if (!cfHost.ok) {
      return {
        ok: false,
        error: cfHost.error || 'Failed creating Cloudflare Custom Hostname.',
        cfHostnameId: null,
        sslStatus: 'failed',
        sslDcvMethod: 'txt',
        dcvRecordName: null,
        dcvRecordValue: null,
      };
    }
    cfHostnameId = cfHost.hostnameId || null;
    sslStatus = cfHost.sslStatus || 'pending_validation';
    sslDcvMethod = cfHost.dcvMethod || 'txt';
    dcvRecordName = cfHost.dcvRecordName || null;
    dcvRecordValue = cfHost.dcvRecordValue || null;
  } else if (isCloudflareConfigured()) {
    const cfZone = await ensureCloudflareZone(hostname);
    if (!cfZone.ok) {
      return {
        ok: false,
        error: cfZone.error || 'Cloudflare zone setup failed.',
        cfHostnameId: null,
        sslStatus: 'failed',
        sslDcvMethod: 'txt',
        dcvRecordName: null,
        dcvRecordValue: null,
      };
    }
    sslStatus = cfZone.status === 'active' ? 'active_tls13' : 'provisioning';
  }

  return {
    ok: true,
    cfHostnameId,
    sslStatus,
    sslDcvMethod,
    dcvRecordName,
    dcvRecordValue,
  };
}

/**
 * GET /api/hosting/domains?serviceId=...
 * Fetch all addon domains, subdomains, parked aliases and staging clones for a hosting service
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required' }, { status: 400 });
    }

    const access = await requireServiceAccess(request, serviceId, 'domains:read');
    if (!access.ok) return access.response;

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();

      const { data: service } = await db
        .from('hosting_services')
        .select('*, catalog_hosting_plans(*)')
        .eq('id', serviceId)
        .single();

      const { data: domains, error } = await db
        .from('hosting_addon_domains')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const rows = (domains || []) as Array<{ domain_type?: string }>;
      const addonCount = rows.filter((d) => d.domain_type === 'addon_domain').length;
      const maxAddons = service?.catalog_hosting_plans?.max_addon_domains ?? 5;

      return NextResponse.json({
        success: true,
        domains: domains || [],
        quota: {
          addonCount,
          maxAddons,
          planName: service?.plan_name || 'Developer Pro Cloud',
          isQuotaExceeded: addonCount >= maxAddons,
        },
      });
    }

    if (!isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Domains Router');
    }

    return NextResponse.json({
      success: true,
      domains: [
        {
          id: 'sub_1',
          service_id: serviceId,
          domain_type: 'subdomain',
          hostname: 'api.devhost.cloud',
          document_root: '/home/devhost/public_html/api',
          runtime_engine: 'Node.js 22 LTS',
          ssl_status: 'active_tls13',
          force_https: true,
          ssl_dcv_method: 'txt',
          dcv_record_name: '_cf-custom-hostname.api.devhost.cloud',
          dcv_record_value: 'devhost-sandbox-dcv-token',
        },
        {
          id: 'sub_2',
          service_id: serviceId,
          domain_type: 'staging_clone',
          hostname: 'staging.devhost.cloud',
          document_root: '/home/devhost/public_html/staging',
          runtime_engine: 'Node.js 22 LTS',
          ssl_status: 'active_tls13',
          force_https: true,
        },
      ],
      quota: {
        addonCount: 1,
        maxAddons: 5,
        planName: 'Developer Cloud Pro',
        isQuotaExceeded: false,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hosting/domains
 * Create Addon Domain, Subdomain, Parked Alias, or Staging Clone with Quota & Cloudflare SaaS Custom Hostname SSL
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await request.json().catch(() => ({}))) as {
      serviceId?: string;
      domainType?: string;
      hostname?: string;
      documentRoot?: string;
      runtimeEngine?: string;
      forceHttps?: boolean;
      customOriginServer?: string;
    };
    const {
      serviceId,
      domainType = 'addon_domain',
      hostname,
      documentRoot,
      runtimeEngine = 'Node.js 22 LTS',
      forceHttps = true,
      customOriginServer,
    } = body;

    if (!serviceId || !hostname) {
      return NextResponse.json({ success: false, error: 'Service ID and hostname are required.' }, { status: 400 });
    }

    const access = await requireServiceAccess(request, serviceId, 'services:write');
    if (!access.ok) return access.response;
    const userId = access.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Domains Router');
    }

    if (!isCloudflareConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Cloudflare SaaS Edge Custom Hostnames & SSL');
    }

    const cleanHost = hostname.trim().toLowerCase().replace(/\.+$/, '');
    if (!isValidCustomHostname(cleanHost)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_HOSTNAME',
          error: `Invalid hostname format '${cleanHost}'. Provide a valid FQDN such as app.example.com.`,
        },
        { status: 400 }
      );
    }

    const phishingScan = scanDomainForPhishing(cleanHost);
    if (phishingScan.isThreat) {
      await logAudit(
        userId,
        'HOSTING_DOMAIN_PHISHING_BLOCKED',
        `hostname:${cleanHost}`,
        {
          serviceId,
          riskScore: phishingScan.riskScore,
          matchedRule: phishingScan.matchedRule,
          matchedBrand: phishingScan.matchedBrand,
          reason: phishingScan.reason,
        },
        ip,
        'high'
      );
      return NextResponse.json(
        {
          success: false,
          code: 'PHISHING_DOMAIN_BLOCKED',
          error: phishingScan.reason,
          riskScore: phishingScan.riskScore,
          matchedRule: phishingScan.matchedRule,
        },
        { status: 403 }
      );
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    const cfConfig = getCloudflareConfig();
    const originCheck = await resolveAllowedOriginServer(db, customOriginServer, cfConfig.fallbackOrigin);
    if (!originCheck.allowed) {
      await logAudit(
        userId,
        'ORIGIN_OVERRIDE_BLOCKED',
        `service:${serviceId}`,
        { hostname: cleanHost, requestedOrigin: customOriginServer || null },
        ip,
        'high'
      );
      return NextResponse.json(
        {
          success: false,
          code: 'ORIGIN_OVERRIDE_FORBIDDEN',
          error: originCheck.error || 'Arbitrary custom origin overrides are blocked.',
        },
        { status: 400 }
      );
    }
    const originServer = originCheck.originServer;

    if (db && domainType === 'addon_domain') {
      const { data: service } = await db
        .from('hosting_services')
        .select('id, plan_id, plan_name, cpanel_username')
        .eq('id', serviceId)
        .single();

      let maxAddons = 2;
      if (service?.plan_id) {
        const { data: plan } = await db
          .from('catalog_hosting_plans')
          .select('max_addon_domains, name_en')
          .eq('slug', service.plan_id)
          .single();

        if (plan) {
          maxAddons = plan.max_addon_domains;
        }
      }

      const { count } = await db
        .from('hosting_addon_domains')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId)
        .eq('domain_type', 'addon_domain');

      const currentAddonCount = count || 0;
      if (currentAddonCount >= maxAddons) {
        return NextResponse.json(
          {
            success: false,
            error: `Plan Quota Exceeded: Your plan (${service?.plan_name || 'Starter'}) allows a maximum of ${maxAddons} addon domains (currently using ${currentAddonCount}). Please upgrade to Developer Pro or Business Max.`,
            isQuotaExceeded: true,
            maxAddons,
            currentAddonCount,
          },
          { status: 403 }
        );
      }
    }

    // Verify internal registrar ownership; external domains must prove ownership via DNS TXT before Cloudflare provisioning.
    let isInternallyOwned = !db && isDevSandboxMode();
    if (db) {
      const { data: ownedRows } = await db
        .from('domains')
        .select('domain_name, status')
        .eq('user_id', userId)
        .eq('status', 'Active');

      isInternallyOwned = ((ownedRows || []) as Array<{ domain_name?: string; status?: string }>).some((d) => {
        if (d.status && d.status !== 'Active') return false;
        const dom = String(d.domain_name || '').trim().toLowerCase().replace(/\.+$/, '');
        return Boolean(dom && (cleanHost === dom || cleanHost.endsWith(`.${dom}`)));
      });
    }

    if (!isInternallyOwned && db) {
      const verificationToken = `devhost-site-verification=${randomBytes(16).toString('hex')}`;
      const verificationRecordName = `_devhost-verify.${cleanHost}`;
      const defaultDocRoot = documentRoot || `/home/user/public_html/${cleanHost}`;

      const { data, error } = await db
        .from('hosting_addon_domains')
        .insert({
          service_id: serviceId,
          user_id: userId,
          domain_type: domainType,
          hostname: cleanHost,
          document_root: defaultDocRoot,
          runtime_engine: runtimeEngine,
          ssl_status: 'pending_validation',
          force_https: Boolean(forceHttps),
          cloudflare_hostname_id: null,
          ssl_dcv_method: 'txt',
          dcv_record_name: null,
          dcv_record_value: null,
          custom_origin_server: originServer || null,
          verification_token: verificationToken,
          verification_status: 'pending_txt',
          verified_at: null,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { success: false, error: `Domain/Hostname '${cleanHost}' is already registered or mapped to another service.` },
            { status: 409 }
          );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(
        userId,
        'HOSTING_DOMAIN_PENDING_TXT',
        `service:${serviceId}`,
        {
          domainType,
          hostname: cleanHost,
          verificationRecordName,
        },
        ip
      );

      return NextResponse.json(
        {
          success: true,
          verificationRequired: true,
          verificationStatus: 'pending_txt',
          id: data?.id,
          hostname: cleanHost,
          cloudflareHostnameId: null,
          sslStatus: 'pending_validation',
          verification: {
            method: 'txt',
            recordName: verificationRecordName,
            recordValue: verificationToken,
          },
          dcv: null,
          message: `External domain '${cleanHost}' queued. Publish TXT ${verificationRecordName} = "${verificationToken}" and click Verify Domain Ownership before Cloudflare SSL provisioning.`,
        },
        { status: 202 }
      );
    }

    // Internally owned domain -> provision Cloudflare SaaS Custom Hostname / Zone immediately
    const prov = await provisionCloudflareForDomainHost(cleanHost, originServer);
    if (!prov.ok) {
      return NextResponse.json(
        { success: false, error: prov.error || 'Failed provisioning Cloudflare domain routing.' },
        { status: 502 }
      );
    }
    const { cfHostnameId, sslStatus, sslDcvMethod, dcvRecordName, dcvRecordValue } = prov;

    if (db) {
      const defaultDocRoot = documentRoot || `/home/user/public_html/${cleanHost}`;
      const { data, error } = await db
        .from('hosting_addon_domains')
        .insert({
          service_id: serviceId,
          user_id: userId,
          domain_type: domainType,
          hostname: cleanHost,
          document_root: defaultDocRoot,
          runtime_engine: runtimeEngine,
          ssl_status: sslStatus,
          force_https: Boolean(forceHttps),
          cloudflare_hostname_id: cfHostnameId,
          ssl_dcv_method: sslDcvMethod,
          dcv_record_name: dcvRecordName,
          dcv_record_value: dcvRecordValue,
          custom_origin_server: originServer || null,
          verification_token: null,
          verification_status: 'internal_owned',
          verified_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { success: false, error: `Domain/Hostname '${cleanHost}' is already registered or mapped to another service.` },
            { status: 409 }
          );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'HOSTING_DOMAIN_ADDED', `service:${serviceId}`, {
        domainType,
        hostname: cleanHost,
        runtimeEngine,
        cloudflareHostnameId: cfHostnameId,
        sslStatus,
        verificationStatus: 'internal_owned',
      }, ip);

      return NextResponse.json({
        success: true,
        verificationRequired: false,
        verificationStatus: 'internal_owned',
        message: dcvRecordValue
          ? `${domainType === 'addon_domain' ? 'Addon Domain' : 'Subdomain'} '${cleanHost}' mapped on Cloudflare Edge. Add TXT DCV record to complete Edge TLS 1.3.`
          : `${domainType === 'addon_domain' ? 'Addon Domain' : 'Subdomain'} '${cleanHost}' mapped and Edge SSL initiated.`,
        id: data?.id,
        cloudflareHostnameId: cfHostnameId,
        sslStatus,
        dcv: dcvRecordName
          ? { method: sslDcvMethod, recordName: dcvRecordName, recordValue: dcvRecordValue }
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Domain '${cleanHost}' provisioned in DEV_SANDBOX_MODE.`,
      id: `addon_${Date.now()}`,
      cloudflareHostnameId: cfHostnameId,
      sslStatus,
      dcv: dcvRecordName
        ? { method: sslDcvMethod, recordName: dcvRecordName, recordValue: dcvRecordValue }
        : null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hosting/domains
 * Poll & refresh Cloudflare Custom Hostname DCV / Edge TLS 1.3 validation status
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = (await request.json().catch(() => ({}))) as { id?: string; serviceId?: string };
    const { id } = body;
    let serviceId = body.serviceId;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Hosting domain ID is required.' }, { status: 400 });
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    let cfHostnameId: string | null = null;
    let hostname = '';
    let verificationToken: string | null = null;
    let verificationStatus: string = 'pending_txt';
    let customOriginFromRow: string | null = null;

    if (db) {
      const { data: row } = await db
        .from('hosting_addon_domains')
        .select('id, service_id, cloudflare_hostname_id, hostname, verification_token, verification_status, custom_origin_server')
        .eq('id', id)
        .maybeSingle();

      if (!row) {
        return NextResponse.json({ success: false, error: 'Hosting domain mapping not found.' }, { status: 404 });
      }

      if (serviceId && row.service_id && row.service_id !== serviceId) {
        return NextResponse.json({ success: false, error: 'Forbidden hosting domain access.' }, { status: 403 });
      }
      serviceId = row.service_id || serviceId;
      cfHostnameId = row.cloudflare_hostname_id || null;
      hostname = String(row.hostname || '').trim().toLowerCase();
      verificationToken = row.verification_token || null;
      verificationStatus = row.verification_status || (cfHostnameId ? 'verified' : 'pending_txt');
      customOriginFromRow = row.custom_origin_server || null;
    }

    const access = await requireServiceAccess(request, serviceId || null, 'services:write');
    if (!access.ok) return access.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Domains Router');
    }

    // Step 1: Enforce external DNS TXT ownership verification before creating any Cloudflare Custom Hostname / Zone.
    if (db && verificationStatus !== 'verified' && verificationStatus !== 'internal_owned') {
      if (!hostname || !isValidCustomHostname(hostname)) {
        return NextResponse.json({ success: false, error: 'Stored hostname is invalid.' }, { status: 400 });
      }

      const phishingScan = scanDomainForPhishing(hostname);
      if (phishingScan.isThreat) {
        return NextResponse.json(
          {
            success: false,
            code: 'PHISHING_DOMAIN_BLOCKED',
            error: phishingScan.reason,
          },
          { status: 403 }
        );
      }

      if (!verificationToken) {
        return NextResponse.json(
          {
            success: false,
            code: 'VERIFICATION_TOKEN_MISSING',
            error: 'Verification token missing for pending external domain.',
          },
          { status: 400 }
        );
      }

      const recordName = `_devhost-verify.${hostname}`;
      const txtResult = await verifyDomainTxtRecord(recordName, verificationToken);
      if (!txtResult.verified) {
        await logAudit(
          access.user.id,
          'HOSTING_DOMAIN_TXT_FAILED',
          `domain_mapping:${id}`,
          {
            hostname,
            recordName,
            observedValues: txtResult.observedValues,
            provider: txtResult.provider,
          },
          ip
        );

        return NextResponse.json(
          {
            success: false,
            code: 'OWNERSHIP_TXT_MISSING',
            verificationRequired: true,
            verificationStatus: 'pending_txt',
            recordName,
            expectedValue: verificationToken,
            observedValues: txtResult.observedValues,
            provider: txtResult.provider,
            error:
              txtResult.error ||
              `TXT ownership record not matched at ${recordName}. Expected "${verificationToken}".`,
          },
          { status: 422 }
        );
      }

      if (!isCloudflareConfigured() && !isDevSandboxMode()) {
        return serviceUnavailableResponse('Cloudflare SaaS Edge Custom Hostnames & SSL');
      }

      const cfConfig = getCloudflareConfig();
      const originCheck = await resolveAllowedOriginServer(db, customOriginFromRow, cfConfig.fallbackOrigin);
      if (!originCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            code: 'ORIGIN_OVERRIDE_FORBIDDEN',
            error: originCheck.error || 'Origin server validation failed.',
          },
          { status: 400 }
        );
      }

      const prov = await provisionCloudflareForDomainHost(hostname, originCheck.originServer);
      if (!prov.ok) {
        return NextResponse.json(
          { success: false, error: prov.error || 'Failed creating Cloudflare Custom Hostname after TXT verification.' },
          { status: 502 }
        );
      }

      const verifiedAt = new Date().toISOString();
      await db
        .from('hosting_addon_domains')
        .update({
          verification_status: 'verified',
          verified_at: verifiedAt,
          cloudflare_hostname_id: prov.cfHostnameId,
          ssl_status: prov.sslStatus,
          ssl_dcv_method: prov.sslDcvMethod,
          dcv_record_name: prov.dcvRecordName,
          dcv_record_value: prov.dcvRecordValue,
        })
        .eq('id', id)
        .eq('service_id', access.serviceId);

      await logAudit(
        access.user.id,
        'HOSTING_DOMAIN_VERIFIED',
        `domain_mapping:${id}`,
        {
          hostname,
          cloudflareHostnameId: prov.cfHostnameId,
          sslStatus: prov.sslStatus,
          provider: txtResult.provider,
        },
        ip
      );

      return NextResponse.json({
        success: true,
        verified: true,
        verificationRequired: false,
        verificationStatus: 'verified',
        cloudflareHostnameId: prov.cfHostnameId,
        sslStatus: prov.sslStatus,
        dcv: prov.dcvRecordName
          ? { method: prov.sslDcvMethod, recordName: prov.dcvRecordName, recordValue: prov.dcvRecordValue }
          : null,
        message: `Ownership verified via ${recordName} TXT! Cloudflare Edge SSL provisioning initiated for ${hostname}.`,
      });
    }

    if (!isCloudflareSaasConfigured()) {
      if (isDevSandboxMode()) {
        if (db) {
          await db
            .from('hosting_addon_domains')
            .update({ ssl_status: 'active_tls13' })
            .eq('id', id)
            .eq('service_id', access.serviceId);
        }
        return NextResponse.json({
          success: true,
          sslStatus: 'active_tls13',
          message: `SSL DCV verified in DEV_SANDBOX_MODE for ${hostname || id}.`,
        });
      }
      return serviceUnavailableResponse('Cloudflare SaaS Custom Hostname Validation');
    }

    if (!cfHostnameId) {
      return NextResponse.json(
        { success: false, error: 'Domain does not have an attached Cloudflare Custom Hostname ID.' },
        { status: 400 }
      );
    }

    const statusRes = await getCloudflareCustomHostnameStatus(cfHostnameId);
    if (!statusRes.ok) {
      return NextResponse.json(
        { success: false, error: statusRes.error || 'Failed to poll Cloudflare Custom Hostname status.' },
        { status: 502 }
      );
    }

    if (db) {
      await db
        .from('hosting_addon_domains')
        .update({
          ssl_status: statusRes.sslStatus || 'pending_validation',
          dcv_record_name: statusRes.dcvRecordName || undefined,
          dcv_record_value: statusRes.dcvRecordValue || undefined,
        })
        .eq('id', id)
        .eq('service_id', access.serviceId);
    }

    return NextResponse.json({
      success: true,
      sslStatus: statusRes.sslStatus,
      hostnameStatus: statusRes.status,
      dcv: statusRes.dcvRecordName
        ? {
            method: statusRes.dcvMethod || 'txt',
            recordName: statusRes.dcvRecordName,
            recordValue: statusRes.dcvRecordValue,
          }
        : null,
      message:
        statusRes.sslStatus === 'active_tls13'
          ? 'Edge TLS 1.3 + HTTP/3 certificate is active on Cloudflare Anycast.'
          : 'DCV validation still pending. Verify DNS TXT/CNAME propagation and re-check shortly.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hosting/domains?id=...&serviceId=...
 * Remove Addon Domain / Subdomain & deprovision Cloudflare Custom Hostname
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('id');
    let serviceId = searchParams.get('serviceId');

    if (!domainId) {
      return NextResponse.json({ success: false, error: 'Domain mapping ID is required.' }, { status: 400 });
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    let cfHostnameId: string | null = null;
    if (db) {
      const { data: domainRow } = await db
        .from('hosting_addon_domains')
        .select('service_id, cloudflare_hostname_id')
        .eq('id', domainId)
        .maybeSingle();
      if (!domainRow) {
        return NextResponse.json({ success: false, error: 'Hosting domain mapping not found.' }, { status: 404 });
      }
      if (serviceId && domainRow.service_id && domainRow.service_id !== serviceId) {
        return NextResponse.json({ success: false, error: 'Forbidden hosting domain access.' }, { status: 403 });
      }
      serviceId = domainRow.service_id || serviceId;
      cfHostnameId = domainRow.cloudflare_hostname_id || null;
    }

    const access = await requireServiceAccess(request, serviceId, 'services:write');
    if (!access.ok) return access.response;
    const userId = access.user.id;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Domains Router');
    }

    if (isCloudflareSaasConfigured() && cfHostnameId) {
      const delCf = await deleteCloudflareCustomHostname(cfHostnameId);
      if (!delCf.ok) {
        return NextResponse.json(
          { success: false, error: delCf.error || 'Failed to delete Cloudflare Custom Hostname.' },
          { status: 502 }
        );
      }
    }

    if (db) {
      const { error } = await db
        .from('hosting_addon_domains')
        .delete()
        .eq('id', domainId)
        .eq('service_id', access.serviceId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await logAudit(userId, 'HOSTING_DOMAIN_DELETED', `domain_mapping:${domainId}`, {
      serviceId,
      cloudflareHostnameId: cfHostnameId,
    }, ip);

    return NextResponse.json({
      success: true,
      message: 'Addon/Subdomain mapping and Cloudflare Custom Hostname removed.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
