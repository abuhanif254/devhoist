import { NextRequest, NextResponse } from 'next/server';
import {
  diagnoseServiceHealth,
  executeLogDoctorAutoFix,
  ServiceDiagnosticInput,
} from '@/lib/logDoctorEngine';
import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import { fetchContainerTelemetryAndLogs, isComputeAgentConfigured } from '@/lib/computeAgentClient';
import { resolveServiceComputeTarget } from '@/lib/computeTargetResolver';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId') || '';
    const domain = searchParams.get('domain') || 'ecommerce-live.com';

    const access = await requireServiceAccess(request, serviceId, 'logs:read');
    if (!access.ok) return access.response;

    if (!isSupabaseConfigured() && !isDevSandboxMode()) {
      return serviceUnavailableResponse('Log Doctor Diagnostics');
    }

    const diagnosticInput: ServiceDiagnosticInput = {
      serviceId,
      domain,
      serverIp: searchParams.get('serverIp') || '',
      dnsARecordIp: searchParams.get('dnsARecordIp') || '',
      startupFile: searchParams.get('startupFile') || 'server.js',
      inodesUsed: Number(searchParams.get('inodesUsed') || 0),
      inodeLimit: Number(searchParams.get('inodeLimit') || 250000),
      sslStatus: searchParams.get('sslStatus') || 'active_tls13',
      forceHttps: searchParams.get('forceHttps') !== 'false',
      hasDatabasesWithoutEnvUrl: searchParams.get('missingDbEnv') === 'true',
      ramUsedMB: Number(searchParams.get('ramUsedMB') || 0),
      ramLimitMB: Number(searchParams.get('ramLimitMB') || 2048),
    };

    if (isSupabaseConfigured() && serviceId !== 'srv_default') {
      try {
        const db = getServiceSupabase();
        const { data: srv } = await db.from('hosting_services').select('*').eq('id', serviceId).single();
        if (srv) {
          diagnosticInput.domain = srv.domain;
          diagnosticInput.serverIp = srv.ip_address || '';
          diagnosticInput.dnsARecordIp = srv.ip_address || diagnosticInput.dnsARecordIp;
          diagnosticInput.inodesUsed = Number(srv.inode_used ?? 0);
          diagnosticInput.inodeLimit = Number(srv.inode_limit ?? 250000);
          diagnosticInput.sslStatus = srv.ssl_status || diagnosticInput.sslStatus;
          diagnosticInput.forceHttps = srv.force_https ?? diagnosticInput.forceHttps;
          diagnosticInput.ramUsedMB = Number(srv.ram_used_mb ?? 0);
          diagnosticInput.ramLimitMB = Number(srv.ram_limit_mb ?? 2048);
          diagnosticInput.userId = srv.user_id;
        }

        const { data: aRecord } = await db
          .from('domain_dns_records')
          .select('content')
          .eq('service_id', serviceId)
          .eq('record_type', 'A')
          .in('name', ['@', diagnosticInput.domain])
          .limit(1)
          .maybeSingle();
        if (aRecord?.content) {
          diagnosticInput.dnsARecordIp = aRecord.content;
        }

        const { data: settingsRow } = await db
          .from('hosting_project_settings')
          .select('startup_file')
          .eq('service_id', serviceId)
          .maybeSingle();
        if (settingsRow?.startup_file) {
          diagnosticInput.startupFile = settingsRow.startup_file;
        }

        const [{ data: dbList }, { data: dbUrlEnv }] = await Promise.all([
          db.from('hosting_databases').select('id').eq('service_id', serviceId).limit(1),
          db
            .from('project_env_variables')
            .select('id')
            .eq('service_id', serviceId)
            .eq('env_key', 'DATABASE_URL')
            .limit(1),
        ]);
        if (dbList && dbList.length > 0 && (!dbUrlEnv || dbUrlEnv.length === 0)) {
          diagnosticInput.hasDatabasesWithoutEnvUrl = true;
        }

        const target = await resolveServiceComputeTarget(db, serviceId, access.user.id);
        if (isComputeAgentConfigured(target.agentEndpoint)) {
          const liveTel = await fetchContainerTelemetryAndLogs(
            serviceId,
            diagnosticInput.domain,
            target.agentEndpoint || undefined
          );
          if (liveTel.ok && liveTel.data) {
            diagnosticInput.ramUsedMB = liveTel.data.ramUsedMb;
            diagnosticInput.ramLimitMB = liveTel.data.ramLimitMb;
            diagnosticInput.inodesUsed = liveTel.data.inodesUsed;
          }
        }
      } catch (err) {
        console.warn('[LogDoctor DB lookup fallback]:', err);
      }
    }

    const report = diagnoseServiceHealth(diagnosticInput);
    return NextResponse.json({
      success: true,
      report,
      metricsSummary: {
        inodesUsed: diagnosticInput.inodesUsed,
        inodeLimit: diagnosticInput.inodeLimit,
        ramUsedMB: diagnosticInput.ramUsedMB,
        ramLimitMB: diagnosticInput.ramLimitMB,
      },
    });
  } catch (error: unknown) {
    console.error('[Log Doctor Scan Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run diagnostic scan' },
      { status: 500 }
    );
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
      serverIp: serviceData?.serverIp || '',
      dnsARecordIp: serviceData?.dnsARecordIp || '',
      startupFile: serviceData?.startupFile || 'server.js',
      inodesUsed: Number(serviceData?.inodesUsed ?? 0),
      inodeLimit: Number(serviceData?.inodeLimit ?? 250000),
      sslStatus: serviceData?.sslStatus || 'active_tls13',
      forceHttps: serviceData?.forceHttps ?? true,
      hasDatabasesWithoutEnvUrl: serviceData?.hasDatabasesWithoutEnvUrl ?? false,
      ramUsedMB: Number(serviceData?.ramUsedMB ?? 0),
      ramLimitMB: Number(serviceData?.ramLimitMB ?? 2048),
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
  } catch (error: unknown) {
    console.error('[Log Doctor Auto-Fix Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-fix action failed' },
      { status: 500 }
    );
  }
}
