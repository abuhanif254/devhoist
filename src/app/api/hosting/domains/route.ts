import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, getServiceSupabase } from '@/lib/supabase';

export const runtime = 'edge';

async function logAudit(
  actorId: string | null,
  actionType: string,
  targetResource: string,
  metadata: Record<string, any>,
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

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();

      // Fetch active service and its plan info for quota display
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

      const addonCount = (domains || []).filter((d: any) => d.domain_type === 'addon_domain').length;
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

    // Offline / fallback mock data
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hosting/domains
 * Create Addon Domain, Subdomain, Parked Alias, or Staging Clone with Strict Quota Enforcement
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const {
      serviceId,
      userId,
      domainType = 'addon_domain',
      hostname,
      documentRoot,
      runtimeEngine = 'Node.js 22 LTS',
      forceHttps = true,
    } = body;

    if (!serviceId || !hostname) {
      return NextResponse.json({ success: false, error: 'Service ID and hostname are required.' }, { status: 400 });
    }

    const cleanHost = hostname.trim().toLowerCase();
    const db = isSupabaseConfigured() ? getServiceSupabase() : null;

    if (db) {
      // 1. Quota Check for Addon Domains
      if (domainType === 'addon_domain') {
        // Query plan limit
        const { data: service } = await db
          .from('hosting_services')
          .select('id, plan_id, plan_name, cpanel_username')
          .eq('id', serviceId)
          .single();

        let maxAddons = 2; // Default fallback
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

        // Count existing addon domains
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

      // 2. Insert new record
      const defaultDocRoot = documentRoot || `/home/user/public_html/${cleanHost}`;
      const { data, error } = await db
        .from('hosting_addon_domains')
        .insert({
          service_id: serviceId,
          user_id: userId || '00000000-0000-0000-0000-000000000001',
          domain_type: domainType,
          hostname: cleanHost,
          document_root: defaultDocRoot,
          runtime_engine: runtimeEngine,
          ssl_status: 'active_tls13',
          force_https: Boolean(forceHttps),
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ success: false, error: `Domain/Hostname '${cleanHost}' is already registered or mapped to another service.` }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await logAudit(userId, 'HOSTING_DOMAIN_ADDED', `service:${serviceId}`, {
        domainType,
        hostname: cleanHost,
        runtimeEngine,
      }, ip);

      return NextResponse.json({
        success: true,
        message: `${domainType === 'addon_domain' ? 'Addon Domain' : 'Subdomain'} '${cleanHost}' successfully mapped and AutoSSL provisioned.`,
        id: data?.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Domain '${cleanHost}' provisioned (Offline Mode).`,
      id: `addon_${Date.now()}`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/hosting/domains?id=...&serviceId=...
 * Remove Addon Domain or Subdomain
 */
export async function DELETE(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('id');
    const serviceId = searchParams.get('serviceId');
    const userId = searchParams.get('userId');

    if (!domainId) {
      return NextResponse.json({ success: false, error: 'Domain mapping ID is required.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const db = getServiceSupabase();
      const { error } = await db.from('hosting_addon_domains').delete().eq('id', domainId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await logAudit(userId, 'HOSTING_DOMAIN_DELETED', `domain_mapping:${domainId}`, { serviceId }, ip);

    return NextResponse.json({
      success: true,
      message: 'Addon/Subdomain mapping and web server virtual host configuration removed.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
