import { NextRequest, NextResponse } from 'next/server';
import {
  diagnoseServiceHealth,
  executeLogDoctorAutoFix,
  ServiceDiagnosticInput,
} from '@/lib/logDoctorEngine';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireServiceAccess } from '@/lib/authGuard';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId') || '';
    const domain = searchParams.get('domain') || 'ecommerce-live.com';

    const access = await requireServiceAccess(request, serviceId, 'logs:read');
    if (!access.ok) return access.response;

    let diagnosticInput: ServiceDiagnosticInput = {
      serviceId,
      domain,
      serverIp: searchParams.get('serverIp') || '103.151.102.45',
      dnsARecordIp: searchParams.get('dnsARecordIp') || '103.151.102.45',
      startupFile: searchParams.get('startupFile') || 'server.js',
      inodesUsed: Number(searchParams.get('inodesUsed') || 38400),
      inodeLimit: Number(searchParams.get('inodeLimit') || 250000),
      sslStatus: searchParams.get('sslStatus') || 'active_tls13',
      forceHttps: searchParams.get('forceHttps') !== 'false',
      hasDatabasesWithoutEnvUrl: searchParams.get('missingDbEnv') === 'true',
      ramUsedMB: Number(searchParams.get('ramUsedMB') || 420),
      ramLimitMB: Number(searchParams.get('ramLimitMB') || 2048),
    };

    if (isSupabaseConfigured() && serviceId !== 'srv_default') {
      try {
        const db = getServiceSupabase();
        const { data: srv } = await db.from('hosting_services').select('*').eq('id', serviceId).single();
        if (srv) {
          diagnosticInput.domain = srv.domain;
          diagnosticInput.serverIp = srv.ip_address || '103.151.102.45';
          diagnosticInput.inodesUsed = srv.inode_used || 38400;
          diagnosticInput.inodeLimit = srv.inode_limit || 250000;
          diagnosticInput.ramUsedMB = srv.ram_used_mb || 420;
          diagnosticInput.ramLimitMB = srv.ram_limit_mb || 2048;
          diagnosticInput.userId = srv.user_id;
        }
      } catch (err) {
        console.warn('[LogDoctor DB lookup fallback]:', err);
      }
    }

    const report = diagnoseServiceHealth(diagnosticInput);
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('[Log Doctor Scan Error]', error);
    return NextResponse.json({ error: error?.message || 'Failed to run diagnostic scan' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceId, fixActionCode, serviceData } = body;

    if (!fixActionCode) {
      return NextResponse.json({ error: 'fixActionCode is required' }, { status: 400 });
    }

    const access = await requireServiceAccess(request, serviceId, 'services:write');
    if (!access.ok) return access.response;

    const defaultInput: ServiceDiagnosticInput = {
      serviceId: access.serviceId,
      domain: serviceData?.domain || 'ecommerce-live.com',
      serverIp: serviceData?.serverIp || '103.151.102.45',
      dnsARecordIp: serviceData?.dnsARecordIp || '103.151.102.45',
      startupFile: serviceData?.startupFile || 'server.js',
      inodesUsed: serviceData?.inodesUsed || 38400,
      inodeLimit: serviceData?.inodeLimit || 250000,
      sslStatus: serviceData?.sslStatus || 'active_tls13',
      forceHttps: serviceData?.forceHttps ?? true,
      hasDatabasesWithoutEnvUrl: serviceData?.hasDatabasesWithoutEnvUrl ?? false,
      ramUsedMB: serviceData?.ramUsedMB || 420,
      ramLimitMB: serviceData?.ramLimitMB || 2048,
      userId: access.user.id,
    };

    const autoFixResult = await executeLogDoctorAutoFix(
      access.serviceId,
      fixActionCode,
      defaultInput
    );

    return NextResponse.json({
      success: true,
      autoFixResult,
      updatedHealthScore: autoFixResult.healthScoreAfterFix,
    });
  } catch (error: any) {
    console.error('[Log Doctor Auto-Fix Error]', error);
    return NextResponse.json({ error: error?.message || 'Auto-fix action failed' }, { status: 500 });
  }
}
