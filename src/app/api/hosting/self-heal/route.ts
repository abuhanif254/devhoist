import { NextRequest, NextResponse } from 'next/server';
import { executeSelfHealingSequence, probeServiceHealth } from '@/lib/selfHealingEngine';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceId, domain, incidentType, probeOnly } = body;

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required for self-healing probe.' }, { status: 400 });
    }

    if (probeOnly) {
      const probe = await probeServiceHealth(domain);
      return NextResponse.json({ success: true, probe });
    }

    const result = await executeSelfHealingSequence({
      serviceId: serviceId || `srv_${Date.now()}`,
      domain,
      userId: body.userId,
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
