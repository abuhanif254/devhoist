import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured, isDevSandboxMode } from '@/lib/supabase';
import { timingSafeEqualStr, serviceUnavailableResponse } from '@/lib/authGuard';
import { validateDnsRecord } from '@/lib/dnsEngine';
import type { DnsRecord } from '@/context/PortalContext';
import {
  ensureCloudflareZone,
  isCloudflareConfigured,
  purgeCloudflareCache,
  upsertCloudflareDnsRecord,
} from '@/lib/cloudflareClient';
import {
  deployStaticEdgeRelease,
  enqueueBuildJob,
  isBuildQueueConfigured,
  isR2ArtifactsConfigured,
} from '@/lib/cloudflareStorageQueue';
import {
  dispatchBuildAndDeploy,
  getComputeNodeConfig,
  isComputeAgentConfigured,
} from '@/lib/computeAgentClient';
import { loadDecryptedEnvMap, resolveServiceComputeTarget } from '@/lib/computeTargetResolver';


// Edge-native in-memory sliding window rate limiter (30 req / min)
const tokenRateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function sha256HexEdge(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface StoredPatToken {
  id?: string;
  token_hash?: string;
  token?: string;
  scopes?: string[];
  revoked?: boolean;
  status?: string;
  expires_at?: string;
}

async function resolveVerifiedPatUser(
  token: string,
  requiredScope: string
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, error: 'Authentication store unavailable.' };
  }

  const db = getServiceSupabase();
  const tokenHash = await sha256HexEdge(token);

  const { data: profiles, error } = await db
    .from('customer_developer_profiles')
    .select('user_id, personal_api_tokens');

  if (error || !profiles) {
    return { ok: false, status: 401, error: 'Invalid or unrecognized Personal Access Token.' };
  }

  for (const prof of profiles) {
    const tokens = Array.isArray(prof.personal_api_tokens)
      ? (prof.personal_api_tokens as StoredPatToken[])
      : [];

    for (const entry of tokens) {
      if (!entry || entry.revoked === true || entry.status === 'revoked') continue;
      if (entry.expires_at && new Date(entry.expires_at).getTime() <= Date.now()) continue;

      const hashMatches =
        typeof entry.token_hash === 'string' &&
        timingSafeEqualStr(entry.token_hash.toLowerCase(), tokenHash);
      const rawMatches =
        typeof entry.token === 'string' &&
        timingSafeEqualStr(entry.token, token);

      if (!hashMatches && !rawMatches) continue;

      const scopes = Array.isArray(entry.scopes) ? entry.scopes : [];
      if (scopes.length > 0 && !scopes.includes('*') && !scopes.includes(requiredScope)) {
        return {
          ok: false,
          status: 403,
          error: `Token missing required scope: '${requiredScope}'.`,
        };
      }

      return { ok: true, userId: prof.user_id };
    }
  }

  return { ok: false, status: 401, error: 'Invalid, revoked, or expired Personal Access Token.' };
}

function checkApiRateLimit(tokenKey: string, maxReqs = 30): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = tokenRateLimitMap.get(tokenKey);

  if (!entry || entry.resetAt < now) {
    tokenRateLimitMap.set(tokenKey, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: maxReqs - 1 };
  }

  if (entry.count >= maxReqs) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  tokenRateLimitMap.set(tokenKey, entry);
  return { allowed: true, remaining: maxReqs - entry.count };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const authHeader = request.headers.get('authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: 'Unauthorized: Missing or malformed Bearer token.',
        hint: 'Pass Authorization: Bearer dh_live_xxxxxxxx in your HTTP headers.',
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Validate format (must be dh_live_...)
  if (!token.startsWith('dh_live_') && !token.startsWith('dh_test_')) {
    return NextResponse.json(
      {
        error: 'Invalid API Key format.',
        hint: 'Generate a scoped personal access token in /dashboard -> Security & API.',
      },
      { status: 403 }
    );
  }

  // Rate Limiting
  const rateLimit = checkApiRateLimit(token.slice(0, 16));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate Limit Exceeded: Maximum 30 requests per minute reached.',
        retryAfterSeconds: 60,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'deploy';
    const targetDomain = body.domain || '';
    const serviceId = body.serviceId || '';

    const requiredScope =
      action === 'dns_record'
        ? 'dns:write'
        : action === 'cache_purge'
        ? 'services:write'
        : 'git:deploy';

    const patAuth = await resolveVerifiedPatUser(token, requiredScope);
    if (!patAuth.ok) {
      return NextResponse.json({ error: patAuth.error }, { status: patAuth.status });
    }

    const db = getServiceSupabase();
    let resolvedServiceId = String(serviceId || '');
    if (resolvedServiceId) {
      const { data: srv } = await db
        .from('hosting_services')
        .select('id, user_id')
        .eq('id', resolvedServiceId)
        .maybeSingle();
      if (!srv || srv.user_id !== patAuth.userId) {
        return NextResponse.json(
          { error: 'Forbidden: Token owner does not own requested serviceId.' },
          { status: 403 }
        );
      }
    } else if (targetDomain) {
      const cleanHost = String(targetDomain).trim().toLowerCase();
      const { data: srv } = await db
        .from('hosting_services')
        .select('id, user_id')
        .eq('domain', cleanHost)
        .eq('user_id', patAuth.userId)
        .maybeSingle();
      if (srv?.id) {
        resolvedServiceId = String(srv.id);
      }
      const { data: dom } = await db
        .from('domains')
        .select('id, user_id')
        .eq('domain_name', cleanHost)
        .eq('user_id', patAuth.userId)
        .maybeSingle();
      if (!srv && !dom) {
        return NextResponse.json(
          { error: 'Forbidden: Token owner does not own target domain.' },
          { status: 403 }
        );
      }
    }

    let message = '';
    const deploymentId = `dep_${Date.now().toString(36)}`;
    const resolvedDomain = String(targetDomain || 'app.devhost.cloud').trim().toLowerCase();
    let cloudflareZoneId: string | null = null;
    let cloudflareRecordId: string | null = null;
    let buildJobId: string | null = null;
    let r2ArtifactKey: string | null = null;
    let liveUrl: string | null = null;

    switch (action) {
      case 'cache_purge': {
        if (!isCloudflareConfigured() && !isDevSandboxMode()) {
          return serviceUnavailableResponse('Cloudflare Edge Cache Purge');
        }
        const files = Array.isArray(body.files) ? (body.files as string[]) : undefined;
        const purgeRes = await purgeCloudflareCache({
          domain: resolvedDomain,
          files,
          purgeEverything: !files || files.length === 0,
        });
        if (!purgeRes.ok) {
          return NextResponse.json(
            { error: `Cloudflare cache purge failed: ${purgeRes.error}` },
            { status: 502 }
          );
        }
        cloudflareZoneId = purgeRes.zoneId || null;
        message = files && files.length > 0
          ? `Purged ${files.length} asset URL(s) on Cloudflare Anycast Edge (${resolvedDomain}).`
          : `Entire Cloudflare Anycast Edge cache purged for ${resolvedDomain} (Zone ${cloudflareZoneId || 'sandbox'}).`;
        break;
      }

      case 'dns_record': {
        if (!isCloudflareConfigured() && !isDevSandboxMode()) {
          return serviceUnavailableResponse('Cloudflare Anycast DNS Edge');
        }
        const recordType = String(body.recordType || 'A').toUpperCase();
        const recordName = String(body.recordName || '@').trim();
        const recordContent = String(body.recordContent || '103.151.102.45').trim();
        const recordTtl = Number(body.ttl || 3600);
        const recordPriority =
          body.priority !== undefined && body.priority !== null ? Number(body.priority) : undefined;
        const proxied = body.proxied !== undefined ? Boolean(body.proxied) : recordType === 'A' || recordType === 'AAAA' || recordType === 'CNAME';

        const validation = validateDnsRecord({
          type: recordType as DnsRecord['type'],
          name: recordName,
          content: recordContent,
          ttl: recordTtl,
          priority: recordPriority,
        });
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error || 'Invalid DNS record payload.' }, { status: 422 });
        }

        if (isCloudflareConfigured()) {
          const { data: domRow } = await db
            .from('domains')
            .select('id, cloudflare_zone_id')
            .eq('domain_name', resolvedDomain)
            .maybeSingle();

          let zoneId = domRow?.cloudflare_zone_id as string | undefined;
          if (!zoneId) {
            const zone = await ensureCloudflareZone(resolvedDomain);
            if (!zone.ok || !zone.zoneId) {
              return NextResponse.json(
                { error: zone.error || 'Failed to resolve Cloudflare zone.' },
                { status: 502 }
              );
            }
            zoneId = zone.zoneId;
          }
          cloudflareZoneId = zoneId;

          const cfSync = await upsertCloudflareDnsRecord(
            zoneId,
            {
              type: recordType,
              name: recordName,
              content: recordContent,
              ttl: recordTtl,
              priority: recordPriority,
              proxied,
            },
            { apexDomain: resolvedDomain }
          );
          if (!cfSync.ok) {
            return NextResponse.json(
              { error: cfSync.error || 'Cloudflare DNS record upsert failed.' },
              { status: 502 }
            );
          }
          cloudflareRecordId = cfSync.cloudflareRecordId || null;

          if (domRow?.id) {
            await db.from('domain_dns_records').insert({
              domain_id: domRow.id,
              user_id: patAuth.userId,
              record_type: recordType,
              name: recordName,
              content: recordContent,
              ttl: recordTtl,
              priority: recordPriority ?? null,
              proxied: Boolean(cfSync.proxied),
              cloudflare_record_id: cloudflareRecordId,
              cloudflare_zone_id: cloudflareZoneId,
              sync_status: 'synced',
              comment: 'Created via Public API v1',
            });
          }
        }

        message = `DNS Record (${recordType} ${recordName} -> ${recordContent}) synchronized across Cloudflare Anycast Edge.`;
        break;
      }

      case 'deploy':
      default: {
        const sandbox = isDevSandboxMode();
        const target = resolvedServiceId
          ? await resolveServiceComputeTarget(db, resolvedServiceId, patAuth.userId)
          : await resolveServiceComputeTarget(null, `dom_${Date.now()}`, patAuth.userId);
        const deployDomain = resolvedDomain || target.domain;
        const commitSha = String(body.commitSha || Date.now().toString(16)).slice(0, 7);
        const branch = String(body.branch || target.gitBranch || 'main');

        if (target.runtimeFamily === 'static_edge') {
          if (!isR2ArtifactsConfigured() && !sandbox) {
            return serviceUnavailableResponse('Cloudflare R2 Artifacts Plane');
          }
          const releaseId = `rel_${commitSha}_${Date.now()}`;
          const staticRes = await deployStaticEdgeRelease({
            serviceId: resolvedServiceId || target.serviceId,
            domain: deployDomain,
            stackSlug: target.stackSlug,
            stackName: target.stackSlug,
            releaseId,
          });
          if (!staticRes.ok) {
            return NextResponse.json(
              { error: staticRes.error || 'Edge static release failed.' },
              { status: 502 }
            );
          }
          r2ArtifactKey = staticRes.artifactKey;
          liveUrl = staticRes.liveUrl;
          if (db && resolvedServiceId) {
            await db.from('project_deployments').insert({
              service_id: resolvedServiceId,
              user_id: patAuth.userId,
              commit_sha: commitSha,
              commit_message: String(body.commitMessage || 'CI/CD Public API v1 Edge Deploy'),
              branch,
              author_name: 'Public API v1 (PAT)',
              trigger_source: 'api_deploy',
              status: 'live_production',
              is_current_production: true,
              duration_seconds: 2,
              r2_artifact_key: r2ArtifactKey,
              live_url: liveUrl,
              build_logs: `[API v1] Uploaded ${staticRes.filesUploaded} assets to ${r2ArtifactKey}`,
            });
          }
          message = `Static Edge deployment published to R2 (${r2ArtifactKey}) for ${deployDomain}.`;
          break;
        }

        const agentConfigured = isComputeAgentConfigured(target.agentEndpoint);
        const queueConfigured = isBuildQueueConfigured();
        if (!agentConfigured && !queueConfigured && !sandbox) {
          return serviceUnavailableResponse('Compute & Build Plane');
        }

        const envVars = resolvedServiceId
          ? await loadDecryptedEnvMap(db, resolvedServiceId, 'production')
          : {};
        const jobId = `bld_${commitSha}_${Date.now()}`;
        const nodeCfg = getComputeNodeConfig(target.agentEndpoint);

        if (queueConfigured || sandbox) {
          const qRes = await enqueueBuildJob({
            jobId,
            serviceId: resolvedServiceId || target.serviceId,
            userId: patAuth.userId,
            domain: deployDomain,
            cpanelUser: target.cpanelUser,
            stackSlug: target.stackSlug,
            runtimeFamily: target.runtimeFamily,
            runtimeVersion: target.runtimeVersion,
            triggerSource: 'api_deploy',
            gitRepoUrl: target.gitRepoUrl,
            gitBranch: branch,
            commitSha,
            installCommand: target.installCommand,
            buildCommand: target.buildCommand,
            startupFile: target.startupFile,
            outputDirectory: target.outputDirectory,
            envVars,
            ramMb: target.ramLimitMb,
            cpuCores: target.cpuCores,
            diskGb: target.diskLimitGb,
            targetAgentEndpoint: target.agentEndpoint || undefined,
            requestedAt: new Date().toISOString(),
          });
          if (qRes.ok) buildJobId = qRes.jobId;
        }

        let agentBuildLogs = `[Queue] Enqueued build job ${jobId} for ${deployDomain}`;
        let containerId: string | null = target.containerId;
        let deployStatus: 'live_production' | 'building' = 'building';
        if (agentConfigured || sandbox) {
          const deployRes = await dispatchBuildAndDeploy(
            {
              jobId,
              serviceId: resolvedServiceId || target.serviceId,
              cpanelUser: target.cpanelUser,
              domain: deployDomain,
              stackSlug: target.stackSlug,
              runtimeFamily: target.runtimeFamily,
              runtimeVersion: target.runtimeVersion,
              gitRepoUrl: target.gitRepoUrl,
              gitBranch: branch,
              commitSha,
              installCommand: target.installCommand,
              buildCommand: target.buildCommand,
              startupFile: target.startupFile,
              outputDirectory: target.outputDirectory,
              envVars,
              callbackUrl: nodeCfg.controlPlaneCallbackUrl,
            },
            target.agentEndpoint || undefined
          );
          if (!deployRes.ok) {
            return NextResponse.json(
              { error: deployRes.error || 'Compute deploy failed.' },
              { status: 502 }
            );
          }
          containerId = deployRes.data?.containerId || containerId;
          liveUrl = deployRes.data?.liveUrl || `https://${deployDomain}`;
          agentBuildLogs = deployRes.data?.buildLogs || agentBuildLogs;
          deployStatus = deployRes.data?.queuedAsync ? 'building' : 'live_production';
        }

        if (db && resolvedServiceId) {
          await db.from('project_deployments').insert({
            service_id: resolvedServiceId,
            user_id: patAuth.userId,
            commit_sha: commitSha,
            commit_message: String(body.commitMessage || 'CI/CD Public API v1 Deploy'),
            branch,
            author_name: 'Public API v1 (PAT)',
            trigger_source: 'api_deploy',
            status: deployStatus,
            is_current_production: deployStatus === 'live_production',
            duration_seconds: 3,
            build_job_id: buildJobId,
            container_id: containerId,
            live_url: liveUrl || `https://${deployDomain}`,
            build_logs: agentBuildLogs,
          });
        }

        message = `CI/CD pipeline dispatched for ${deployDomain} (branch: ${branch}, job: ${buildJobId || jobId}).`;
        break;
      }
    }

    const durationMs = Date.now() - startTime + 35;

    // Log call in developer_api_logs
    if (isSupabaseConfigured()) {
      try {
        await db.from('developer_api_logs').insert({
          user_id: patAuth.userId,
          token_prefix: token.slice(0, 12) + '...',
          endpoint: '/api/v1/deploy',
          method: 'POST',
          target_domain: resolvedDomain,
          status_code: 200,
          ip_address: request.headers.get('cf-connecting-ip') || '127.0.0.1',
          duration_ms: durationMs,
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('[Developer API Audit Log Notice]', logErr);
      }
    }

    return NextResponse.json({
      status: 'success',
      action,
      domain: resolvedDomain,
      serviceId: resolvedServiceId || null,
      deploymentId,
      buildJobId,
      r2ArtifactKey,
      liveUrl,
      cloudflareZoneId,
      cloudflareRecordId,
      durationMs,
      message,
      rateLimitRemaining: rateLimit.remaining,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[Public API Error]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal API Error' },
      { status: 500 }
    );
  }
}
