import { NextRequest, NextResponse } from 'next/server';
import { executeSelfHealingSequence, probeServiceHealth } from '@/lib/selfHealingEngine';
import { requireServiceAccess, isSafeExternalHttpUrl } from '@/lib/authGuard';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceId, domain, incidentType, probeOnly } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required for self-healing probe.' }, { status: 400 });
    }

    const access = await requireServiceAccess(
      request,
      typeof serviceId === 'string' ? serviceId : null,
      probeOnly ? 'services:read' : 'services:write'
    );
    if (!access.ok) return access.response;

    const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    const normalizedProbeUrl = domain.startsWith('http') ? domain : `https://${domain.trim()}`;
    if (!isSafeExternalHttpUrl(normalizedProbeUrl)) {
      return NextResponse.json(
        { error: 'Forbidden Target', message: 'Self-healing cannot target private, loopback, or metadata hosts.' },
        { status: 400 }
      );
    }

    let authoritativeDomain = cleanDomain;
    if (isSupabaseConfigured() && access.role !== 'admin') {
      const db = getServiceSupabase();
      const { data: srv } = await db
        .from('hosting_services')
        .select('domain')
        .eq('id', access.serviceId)
        .maybeSingle();
      const { data: addon } = await db
        .from('hosting_addon_domains')
        .select('hostname')
        .eq('service_id', access.serviceId)
        .eq('hostname', cleanDomain)
        .maybeSingle();

      const srvDomain = String(srv?.domain || '').trim().toLowerCase();
      if (srvDomain && cleanDomain !== srvDomain && !addon) {
        return NextResponse.json(
          { error: 'Forbidden: Target domain does not belong to the specified hosting service.' },
          { status: 403 }
        );
      }
      authoritativeDomain = addon ? String(addon.hostname).toLowerCase() : srvDomain || cleanDomain;
    }

    if (probeOnly) {
      const probe = await probeServiceHealth(authoritativeDomain);
      return NextResponse.json({ success: true, probe });
    }

    const result = await executeSelfHealingSequence({
      serviceId: access.serviceId,
      domain: authoritativeDomain,
      userId: access.user.id,
      incidentType: incidentType || 'http_503_passenger_hang',
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      healingResult: result,
    });
  } catch (error: unknown) {
    console.error('[Self-Heal API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute self-healing sequence.' },
      { status: 500 }
    );
  }
}
