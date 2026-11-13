import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase, isDevSandboxMode } from '@/lib/supabase';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import {
  createCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  ensureCloudflareZone,
  getCloudflareConfig,
  getCloudflareCustomHostnameStatus,
  isCloudflareConfigured,
  isCloudflareSaasConfigured,
} from '@/lib/cloudflareClient';

async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, unknown>,
  ip: string = '127.0.0.1'
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
      risk_level: 'medium',
      metadata,
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
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

    const cleanHost = hostname.trim().toLowerCase();
    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

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

    // Provision Cloudflare SaaS Custom Hostname (Edge TLS 1.3 + HTTP/3 + DCV Validation)
    const cfConfig = getCloudflareConfig();
    const originServer = customOriginServer || cfConfig.fallbackOrigin || undefined;
    let cfHostnameId: string | null = null;
    let sslStatus: 'pending_validation' | 'provisioning' | 'active_tls13' | 'failed' | 'expired' = 'pending_validation';
    let sslDcvMethod = 'txt';
    let dcvRecordName: string | null = null;
    let dcvRecordValue: string | null = null;

    if (isCloudflareSaasConfigured() || isDevSandboxMode()) {
      const cfHost = await createCloudflareCustomHostname(cleanHost, {
        dcvMethod: 'txt',
        customOriginServer: originServer,
      });
      if (!cfHost.ok) {
        return NextResponse.json(
          { success: false, error: cfHost.error || 'Failed creating Cloudflare Custom Hostname.' },
          { status: 502 }
        );
      }
      cfHostnameId = cfHost.hostnameId || null;
      sslStatus = cfHost.sslStatus || 'pending_validation';
      sslDcvMethod = cfHost.dcvMethod || 'txt';
      dcvRecordName = cfHost.dcvRecordName || null;
      dcvRecordValue = cfHost.dcvRecordValue || null;
    } else if (isCloudflareConfigured()) {
      const cfZone = await ensureCloudflareZone(cleanHost);
      if (!cfZone.ok) {
        return NextResponse.json(
          { success: false, error: cfZone.error || 'Cloudflare zone setup failed.' },
          { status: 502 }
        );
      }
      sslStatus = cfZone.status === 'active' ? 'active_tls13' : 'provisioning';
    }

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
      }, ip);

      return NextResponse.json({
        success: true,
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
    const body = (await request.json().catch(() => ({}))) as { id?: string; serviceId?: string };
    const { id } = body;
    let serviceId = body.serviceId;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Hosting domain ID is required.' }, { status: 400 });
    }

    const db = isSupabaseConfigured() ? getServiceSupabase() : null;
    let cfHostnameId: string | null = null;
    let hostname = '';
    if (db) {
      const { data: row } = await db
        .from('hosting_addon_domains')
        .select('service_id, cloudflare_hostname_id, hostname')
        .eq('id', id)
        .maybeSingle();
      if (!serviceId) serviceId = row?.service_id;
      cfHostnameId = row?.cloudflare_hostname_id || null;
      hostname = row?.hostname || '';
    }

    const access = await requireServiceAccess(request, serviceId || null, 'services:write');
    if (!access.ok) return access.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Hosting Domains Router');
    }

    if (!isCloudflareSaasConfigured()) {
      if (isDevSandboxMode()) {
        if (db) {
          await db
            .from('hosting_addon_domains')
            .update({ ssl_status: 'active_tls13' })
            .eq('id', id);
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
        .eq('id', id);
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
      if (!serviceId) serviceId = domainRow?.service_id || null;
      cfHostnameId = domainRow?.cloudflare_hostname_id || null;
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
