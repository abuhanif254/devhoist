import { NextRequest, NextResponse } from 'next/server';
import { executeSelfHealingSequence, probeServiceHealth } from '@/lib/selfHealingEngine';
import { requireUser, requireServiceAccess, isSafeExternalHttpUrl } from '@/lib/authGuard';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceId, domain, incidentType, probeOnly } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required for self-healing probe.' }, { status: 400 });
    }

    const normalizedProbeUrl = domain.startsWith('http') ? domain : `https://${domain.trim()}`;
    if (!isSafeExternalHttpUrl(normalizedProbeUrl)) {
      return NextResponse.json(
        { error: 'Forbidden Target', message: 'Self-healing cannot target private, loopback, or metadata hosts.' },
        { status: 400 }
      );
    }

    if (probeOnly) {
      const auth = await requireUser(request);
      if (!auth.ok) return auth.response;

      const probe = await probeServiceHealth(domain);
      return NextResponse.json({ success: true, probe });
    }

    const access = await requireServiceAccess(request, serviceId, 'services:write');
    if (!access.ok) return access.response;

    const result = await executeSelfHealingSequence({
      serviceId: access.serviceId,
      domain,
      userId: access.user.id,
      incidentType: incidentType || 'http_503_passenger_hang',
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      healingResult: result,
    });
  } catch (error: any) {
    console.error('[Self-Heal API Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute self-healing sequence.' },
      { status: 500 }
    );
  }
}
