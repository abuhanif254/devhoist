import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireServiceAccess, serviceUnavailableResponse } from '@/lib/authGuard';
import { checkKeyedRateLimit } from '@/lib/edgeRateLimit';
import { logSecurityAudit } from '@/lib/security';
import {
  deleteR2Artifact,
  deployStaticEdgeRelease,
  enqueueBuildJob,
  getR2Artifact,
  isBuildQueueConfigured,
  isR2ArtifactsConfigured,
  putR2Artifact,
} from '@/lib/cloudflareStorageQueue';
import {
  dispatchBuildAndDeploy,
  getComputeNodeConfig,
  isComputeAgentConfigured,
} from '@/lib/computeAgentClient';
import { loadDecryptedEnvMap, resolveServiceComputeTarget } from '@/lib/computeTargetResolver';
import { getServiceSupabase, isDevSandboxMode, isSupabaseConfigured } from '@/lib/supabase';
import {
  ArchiveSecurityError,
  buildStaticReleaseFileMap,
  extractAndScanZipArchive,
  hasZipMagic,
  MAX_COMPRESSED_UPLOAD_BYTES,
  type DeployTargetPreference,
  type ExtractedArchiveFile,
} from '@/lib/archiveSecurity';
import {
  buildSignedArtifactDownloadUrl,
  createUploadSessionRecord,
  getUploadSessionRecord,
  resolveServiceUploadQuota,
  updateUploadSessionRecord,
  type UploadSessionRecord,
} from '@/lib/uploadToken';

const BYTES_PER_GB = 1024 * 1024 * 1024;
const VALID_UPLOAD_MODES = new Set(['zip_upload', 'folder_upload', 'file_upload']);
const VALID_DEPLOY_TARGETS = new Set(['auto', 'static_edge', 'container']);

const VFS_TEXT_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '.md',
  '.txt',
  '.xml',
  '.svg',
  '.env',
  '.example',
  '.php',
  '.py',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.htaccess',
]);

function isTextFileForVfs(filePath: string, bytes: Uint8Array): boolean {
  if (bytes.byteLength > 256 * 1024) return false;
  const slashIdx = filePath.lastIndexOf('/');
  const base = (slashIdx >= 0 ? filePath.slice(slashIdx + 1) : filePath).toLowerCase();
  const dotIdx = base.lastIndexOf('.');
  const ext = dotIdx >= 0 ? base.slice(dotIdx) : '';
  if (VFS_TEXT_EXTENSIONS.has(ext) || base === 'dockerfile' || base === 'procfile') {
    for (let i = 0; i < Math.min(bytes.byteLength, 512); i += 1) {
      if (bytes[i] === 0) return false;
    }
    return true;
  }
  return false;
}

async function syncExtractedFilesToVfs(params: {
  serviceId: string;
  userId: string;
  files: ExtractedArchiveFile[];
  publishSubdir: string;
}): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = getServiceSupabase();
  const prefix = params.publishSubdir
    ? `${params.publishSubdir.replace(/^\/+|\/+$/g, '')}/`
    : '';
  const rows: Array<{
    service_id: string;
    user_id: string;
    file_path: string;
    file_name: string;
    is_directory: boolean;
    size_bytes: number;
    permissions_octal: string;
    mime_type: string;
    content_text: string | null;
    last_modified_at: string;
  }> = [];

  const now = new Date().toISOString();
  const maxSyncFiles = 120;

  for (const file of params.files) {
    if (rows.length >= maxSyncFiles) break;
    let relPath = file.path;
    if (prefix && relPath.startsWith(prefix)) {
      relPath = relPath.slice(prefix.length);
    }
    const vfsPath = `/public_html/${relPath.replace(/^\/+/, '')}`;
    const segments = vfsPath.split('/');
    const fileName = segments[segments.length - 1] || 'file';
    const contentText = isTextFileForVfs(file.path, file.data)
      ? new TextDecoder('utf-8', { fatal: false }).decode(file.data)
      : null;

    rows.push({
      service_id: params.serviceId,
      user_id: params.userId,
      file_path: vfsPath,
      file_name: fileName,
      is_directory: false,
      size_bytes: file.sizeBytes,
      permissions_octal: '0644',
      mime_type: file.contentType,
      content_text: contentText,
      last_modified_at: now,
    });
  }

  if (rows.length === 0) return 0;

  try {
    await supabase
      .from('hosting_virtual_filesystem')
      .upsert(rows, { onConflict: 'service_id,file_path' });
    return rows.length;
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  let serviceId = '';
  let uploadId = '';
  let r2ObjectKey = '';
  let actorId = '';
  let actorIsAdmin = false;

  try {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    let uploadMode: 'zip_upload' | 'folder_upload' | 'file_upload' = 'zip_upload';
    let deployTarget: DeployTargetPreference = 'auto';
    let directFileBytes: Uint8Array | null = null;
    let directFileName = 'bundle.zip';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData().catch(() => null);
      if (!form) {
        return NextResponse.json(
          { success: false, error: 'Malformed multipart upload body.' },
          { status: 400 }
        );
      }
      serviceId = String(form.get('serviceId') || '').trim();
      uploadId = String(form.get('uploadId') || '').trim();
      const rawMode = String(form.get('uploadMode') || 'zip_upload').trim();
      if (VALID_UPLOAD_MODES.has(rawMode)) {
        uploadMode = rawMode as typeof uploadMode;
      }
      const rawTarget = String(form.get('deployTarget') || 'auto').trim();
      if (VALID_DEPLOY_TARGETS.has(rawTarget)) {
        deployTarget = rawTarget as DeployTargetPreference;
      }
      const filePart = form.get('file');
      if (filePart && typeof filePart === 'object' && 'arrayBuffer' in filePart) {
        directFileBytes = new Uint8Array(await (filePart as Blob).arrayBuffer());
        if ('name' in filePart && typeof filePart.name === 'string' && filePart.name.trim()) {
          directFileName = filePart.name.trim().slice(0, 128);
        }
      }
    } else {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON request payload.' },
          { status: 400 }
        );
      }
      serviceId = String(body.serviceId || '').trim();
      uploadId = String(body.uploadId || '').trim();
      const rawMode = String(body.uploadMode || '').trim();
      if (VALID_UPLOAD_MODES.has(rawMode)) {
        uploadMode = rawMode as typeof uploadMode;
      }
      const rawTarget = String(body.deployTarget || '').trim();
      if (VALID_DEPLOY_TARGETS.has(rawTarget)) {
        deployTarget = rawTarget as DeployTargetPreference;
      }
    }

    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'serviceId is required.' },
        { status: 400 }
      );
    }

    const access = await requireServiceAccess(req, serviceId, 'git:deploy');
    if (!access.ok) return access.response;
    actorId = access.user.id;
    actorIsAdmin = Boolean(access.isAdmin);

    const rate = checkKeyedRateLimit(`upload-complete:${actorId}:${serviceId}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many deployment requests. Please retry shortly.',
          retryAfterSeconds: Math.ceil((rate.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const sandbox = isDevSandboxMode();
    if (!isSupabaseConfigured() && !sandbox) {
      return serviceUnavailableResponse('Supabase Upload Session Store');
    }
    if (!isR2ArtifactsConfigured() && !sandbox) {
      return serviceUnavailableResponse('Cloudflare R2 Artifacts Storage');
    }

    const quota = await resolveServiceUploadQuota(serviceId);
    if (isSupabaseConfigured() && !quota.found) {
      return NextResponse.json(
        { success: false, error: 'Hosting service not found.' },
        { status: 404 }
      );
    }

    let session: UploadSessionRecord | null = null;
    let zipBytes: Uint8Array;

    if (directFileBytes) {
      if (directFileBytes.byteLength === 0) {
        return NextResponse.json(
          { success: false, code: 'EMPTY_ARCHIVE', error: 'Uploaded archive is empty.' },
          { status: 400 }
        );
      }
      if (directFileBytes.byteLength > MAX_COMPRESSED_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            success: false,
            code: 'DECOMPRESSION_BOMB',
            error: 'Uploaded archive exceeds 100 MB compressed limit.',
          },
          { status: 413 }
        );
      }
      if (!hasZipMagic(directFileBytes)) {
        return NextResponse.json(
          {
            success: false,
            code: 'INVALID_ARCHIVE',
            error: 'Only valid ZIP archives are supported.',
          },
          { status: 400 }
        );
      }

      uploadId = uploadId || randomUUID();
      const cleanServiceSegment = serviceId.replace(/[^a-zA-Z0-9._-]/g, '_');
      r2ObjectKey = `uploads/${cleanServiceSegment}/${uploadId}.zip`;
      session = await createUploadSessionRecord({
        id: uploadId,
        serviceId,
        userId: actorId,
        fileName: directFileName,
        uploadMode,
        deployTarget,
        r2ObjectKey,
        declaredSizeBytes: directFileBytes.byteLength,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        status: 'uploaded',
      });
      const stored = await putR2Artifact(r2ObjectKey, directFileBytes, 'application/zip');
      if (!stored.ok) {
        return serviceUnavailableResponse('Cloudflare R2 Artifacts Storage');
      }
      zipBytes = directFileBytes;
    } else {
      if (!uploadId) {
        return NextResponse.json(
          { success: false, error: 'uploadId (or multipart file) is required.' },
          { status: 400 }
        );
      }

      session = await getUploadSessionRecord(uploadId, serviceId);
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Upload session not found for this service.' },
          { status: 404 }
        );
      }

      if (session.status === 'rejected') {
        return NextResponse.json(
          {
            success: false,
            error: session.rejection_reason || 'This upload session was rejected.',
          },
          { status: 409 }
        );
      }

      if (session.status === 'deployed') {
        return NextResponse.json(
          { success: false, error: 'This upload session has already been deployed.' },
          { status: 409 }
        );
      }

      if (new Date(session.expires_at).getTime() < Date.now()) {
        await updateUploadSessionRecord(session.id, { status: 'expired' });
        return NextResponse.json(
          { success: false, error: 'Upload session expired. Please upload again.' },
          { status: 410 }
        );
      }

      r2ObjectKey = session.r2_object_key;
      uploadMode = session.upload_mode;
      if (deployTarget === 'auto') {
        deployTarget = session.deploy_target;
      }

      const r2Artifact = await getR2Artifact(r2ObjectKey);
      if (!r2Artifact.found || !r2Artifact.bodyBuffer) {
        return NextResponse.json(
          {
            success: false,
            error: 'Uploaded ZIP object was not found in storage. Transfer the file first.',
          },
          { status: 400 }
        );
      }
      zipBytes = new Uint8Array(r2Artifact.bodyBuffer);
    }

    await updateUploadSessionRecord(session.id, { status: 'scanning' });

    let scanned;
    try {
      scanned = extractAndScanZipArchive(zipBytes, {
        remainingDiskBytes: quota.remainingDiskBytes,
        remainingInodes: quota.remainingInodes,
        deployTarget,
      });
    } catch (scanErr) {
      const secErr =
        scanErr instanceof ArchiveSecurityError
          ? scanErr
          : new ArchiveSecurityError({
              code: 'INVALID_ARCHIVE',
              status: 400,
              message:
                scanErr instanceof Error ? scanErr.message : 'Failed to inspect ZIP archive.',
            });

      await updateUploadSessionRecord(session.id, {
        status: 'rejected',
        actual_size_bytes: zipBytes.byteLength,
        rejection_reason: secErr.message,
      });

      if (r2ObjectKey) {
        await deleteR2Artifact(r2ObjectKey).catch(() => false);
      }

      await logSecurityAudit({
        actorId,
        actorRole: actorIsAdmin ? 'admin' : 'client',
        actionType:
          secErr.code === 'QUOTA_EXCEEDED'
            ? 'UPLOAD_QUOTA_EXCEEDED'
            : 'ARCHIVE_SECURITY_REJECTED',
        targetResource: serviceId,
        riskLevel: secErr.status === 403 ? 'high' : 'medium',
        metadata: {
          uploadId: session.id,
          reasonCode: secErr.reasonCode,
          offendingEntry: secErr.offendingEntry,
          message: secErr.message,
        },
      });

      return NextResponse.json(
        {
          success: false,
          code: secErr.code,
          error: secErr.message,
          offendingEntry: secErr.offendingEntry,
        },
        { status: secErr.status }
      );
    }

    const releaseId = `rel_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const deploymentId = randomUUID();
    const supabaseAdmin = isSupabaseConfigured() ? getServiceSupabase() : null;
    const target = await resolveServiceComputeTarget(supabaseAdmin, serviceId, actorId);
    const domain = quota.domain || target.domain || 'app.devhost.cloud';
    const commitSha = releaseId.slice(4, 11);

    let deploymentStatus:
      | 'queued'
      | 'building'
      | 'deploying'
      | 'live_production'
      | 'failed' = 'live_production';
    let deploymentMode = 'r2_static_edge';
    let artifactKey = '';
    let liveUrl = target.livePreviewUrl || `https://${domain}`;
    let edgeRouterUrl: string | null = null;
    let buildJobId: string | null = null;
    let containerId: string | null = null;
    let agentDiskUsedGb: number | undefined;
    let agentInodesUsed: number | undefined;
    const logLines: string[] = [
      `[00:00.05] Archive verified cleanly (${scanned.entryCount} files, ${(
        scanned.totalUncompressedBytes / 1024
      ).toFixed(1)} KB uncompressed).`,
      `[00:00.12] Detected stack: ${scanned.detectedStack.detectedStack} (${scanned.detectedStack.runtimeFamily})`,
    ];

    if (scanned.detectedStack.deploymentTarget === 'static_edge') {
      const staticMap = buildStaticReleaseFileMap(
        scanned.files,
        scanned.detectedStack.publishSubdir
      );
      const fileEntries = Object.entries(staticMap).map(([relPath, item]) => ({
        path: relPath,
        content: item.data,
        contentType: item.contentType,
      }));

      if (fileEntries.length === 0) {
        return NextResponse.json(
          {
            success: false,
            code: 'EMPTY_ARCHIVE',
            error: 'No publishable static assets were found in the uploaded archive.',
          },
          { status: 400 }
        );
      }

      const staticRes = await deployStaticEdgeRelease({
        serviceId,
        domain,
        stackSlug: scanned.detectedStack.stackSlug,
        stackName: scanned.detectedStack.detectedStack,
        releaseId,
        files: fileEntries,
      });

      if (!staticRes.ok) {
        await updateUploadSessionRecord(session.id, {
          status: 'rejected',
          rejection_reason: staticRes.error || 'Failed to publish static edge release to R2.',
        });
        return serviceUnavailableResponse('Cloudflare R2 Static Edge Plane');
      }

      // Verify release manifest is readable from R2 before marking live
      const manifestCheck = await getR2Artifact(staticRes.manifestKey);
      if (!manifestCheck.found) {
        return NextResponse.json(
          { success: false, error: 'Edge manifest verification failed after upload.' },
          { status: 502 }
        );
      }

      const vfsSyncedCount = await syncExtractedFilesToVfs({
        serviceId,
        userId: target.userId || actorId,
        files: scanned.files,
        publishSubdir: scanned.detectedStack.publishSubdir,
      });

      // Clean up temporary ZIP archive once extracted static files are safely on R2
      if (r2ObjectKey) {
        await deleteR2Artifact(r2ObjectKey).catch(() => false);
      }

      deploymentMode =
        staticRes.mode === 'sandbox' && !isR2ArtifactsConfigured()
          ? 'sandbox'
          : 'r2_static_edge';
      artifactKey = staticRes.artifactKey;
      liveUrl = staticRes.edgeRouterUrl || staticRes.liveUrl;
      edgeRouterUrl = staticRes.edgeRouterUrl;
      deploymentStatus = 'live_production';

      logLines.push(
        `[00:00.40] Published ${staticRes.filesUploaded} assets to R2 release ${releaseId}.`,
        `[00:00.52] Edge manifest verified (${staticRes.manifestKey}); synced ${vfsSyncedCount} files to workspace IDE.`
      );
    } else {
      // Dynamic / Container runtime deployment
      const queueReady = isBuildQueueConfigured();
      const agentReady = isComputeAgentConfigured(target.agentEndpoint || undefined);

      if (!queueReady && !agentReady && !sandbox) {
        return serviceUnavailableResponse('Container Build Queue or Compute Node');
      }

      buildJobId = randomUUID();
      const nodeCfg = getComputeNodeConfig(target.agentEndpoint || undefined);
      const artifactDownloadUrl =
        buildSignedArtifactDownloadUrl(req.nextUrl.origin, {
          serviceId,
          r2Key: r2ObjectKey,
          ttlMs: 30 * 60_000,
        }) || undefined;

      const envVars = await loadDecryptedEnvMap(supabaseAdmin, serviceId);
      const runtimeVersion = target.runtimeVersion || '22.x LTS';
      const buildCmd = scanned.detectedStack.buildCommand || target.buildCommand || '';
      const startCmd = scanned.detectedStack.startCommand || '';
      const installCmd =
        scanned.detectedStack.runtimeFamily === 'nodejs_passenger'
          ? 'npm ci --prefer-offline || npm install'
          : scanned.detectedStack.runtimeFamily === 'php_litespeed'
            ? 'composer install --no-dev --optimize-autoloader'
            : scanned.detectedStack.runtimeFamily === 'python_wsgi_asgi'
              ? 'pip install -r requirements.txt'
              : target.installCommand;

      if (queueReady || sandbox) {
        const qRes = await enqueueBuildJob({
          jobId: buildJobId,
          serviceId,
          userId: target.userId || actorId,
          domain,
          cpanelUser: target.cpanelUser,
          stackSlug: scanned.detectedStack.stackSlug,
          runtimeFamily: scanned.detectedStack.runtimeFamily,
          runtimeVersion,
          triggerSource: uploadMode,
          gitRepoUrl: `upload://${session.file_name}`,
          gitBranch: 'direct-upload',
          commitSha,
          installCommand: installCmd,
          buildCommand: buildCmd,
          startupFile: scanned.detectedStack.entryFile || target.startupFile || 'index.js',
          outputDirectory: scanned.detectedStack.publishSubdir || '.',
          envVars,
          ramMb: target.ramLimitMb,
          cpuCores: target.cpuCores,
          diskGb: target.diskLimitGb,
          r2ArtifactKey: r2ObjectKey,
          artifactDownloadUrl,
          releaseId,
          deploymentId,
          targetNodeCode: target.serverNode,
          targetAgentEndpoint: target.agentEndpoint || undefined,
          callbackUrl: nodeCfg.controlPlaneCallbackUrl,
          requestedAt: new Date().toISOString(),
        });

        if (!qRes.ok && !agentReady && !sandbox) {
          return serviceUnavailableResponse('Cloudflare Build Queue');
        }
        logLines.push(
          `[00:00.38] Enqueued build job ${buildJobId} (${qRes.mode}) referencing artifact ${r2ObjectKey}.`
        );
      }

      artifactKey = r2ObjectKey;
      deploymentMode = 'docker_container';
      deploymentStatus = 'queued';

      if (agentReady || sandbox) {
        const agentRes = await dispatchBuildAndDeploy(
          {
            jobId: buildJobId,
            serviceId,
            cpanelUser: target.cpanelUser,
            domain,
            stackSlug: scanned.detectedStack.stackSlug,
            runtimeFamily: scanned.detectedStack.runtimeFamily,
            runtimeVersion,
            installCommand: installCmd,
            buildCommand: buildCmd,
            startCommand: startCmd,
            startupFile: scanned.detectedStack.entryFile || target.startupFile,
            outputDirectory: scanned.detectedStack.publishSubdir || '.',
            r2ArtifactKey: r2ObjectKey,
            artifactDownloadUrl,
            releaseId,
            deploymentId,
            ramLimitMb: target.ramLimitMb,
            cpuCores: target.cpuCores,
            diskLimitGb: target.diskLimitGb,
            envVars,
            callbackUrl: nodeCfg.controlPlaneCallbackUrl,
          },
          target.agentEndpoint || undefined
        );

        if (!agentRes.ok) {
          return NextResponse.json(
            {
              success: false,
              error: agentRes.error || 'Compute agent rejected ZIP build dispatch.',
            },
            { status: 502 }
          );
        }

        containerId = agentRes.data?.containerId || null;
        if (agentRes.data?.liveUrl) {
          liveUrl = agentRes.data.liveUrl;
        }
        agentDiskUsedGb = agentRes.data?.metrics?.diskUsedGb;
        agentInodesUsed = agentRes.data?.metrics?.inodesUsed;
        deploymentStatus = agentRes.data?.queuedAsync ? 'building' : 'live_production';
        logLines.push(
          agentRes.data?.buildLogs ||
            `[00:01.10] Compute agent accepted archive build (${deploymentStatus}).`
        );
      }
    }

    const updatedDiskUsedGb =
      typeof agentDiskUsedGb === 'number'
        ? Number(agentDiskUsedGb.toFixed(4))
        : Number(
            ((quota.diskUsedBytes + scanned.totalUncompressedBytes) / BYTES_PER_GB).toFixed(4)
          );
    const updatedInodesUsed =
      typeof agentInodesUsed === 'number'
        ? agentInodesUsed
        : quota.inodeUsed + scanned.entryCount;

    const now = new Date().toISOString();
    const isNowLive = deploymentStatus === 'live_production';

    if (isSupabaseConfigured()) {
      const supabase = getServiceSupabase();

      if (isNowLive) {
        await supabase
          .from('project_deployments')
          .update({ is_current_production: false, status: 'superseded' })
          .eq('service_id', serviceId)
          .eq('is_current_production', true);
      }

      await supabase.from('project_deployments').insert({
        id: deploymentId,
        service_id: serviceId,
        user_id: target.userId || actorId,
        environment: 'production',
        trigger_source: uploadMode,
        status: deploymentStatus,
        commit_sha: commitSha,
        commit_message: `Direct upload deploy (${session.file_name} • ${scanned.detectedStack.detectedStack})`,
        branch: 'direct-upload',
        release_id: releaseId,
        upload_session_id: session.id,
        detected_stack: scanned.detectedStack.detectedStack,
        r2_artifact_key: artifactKey || null,
        container_id: containerId,
        live_url: liveUrl,
        preview_url: edgeRouterUrl || liveUrl,
        build_logs: logLines.join('\n'),
        is_current_production: isNowLive,
        completed_at: isNowLive ? now : null,
        created_at: now,
      });

      await supabase
        .from('hosting_services')
        .update({
          disk_used_gb: updatedDiskUsedGb,
          inode_used: updatedInodesUsed,
          deployment_mode: deploymentMode,
          stack_slug: scanned.detectedStack.stackSlug,
          runtime_family: scanned.detectedStack.runtimeFamily,
          live_preview_url: liveUrl,
          r2_bucket_prefix:
            scanned.detectedStack.deploymentTarget === 'static_edge'
              ? `sites/${serviceId}`
              : null,
          container_id: containerId || undefined,
          health_check_status: isNowLive ? 'healthy' : 'starting',
          last_deployed_at: now,
          updated_at: now,
        })
        .eq('id', serviceId);
    }

    await updateUploadSessionRecord(session.id, {
      status: 'deployed',
      actual_size_bytes: zipBytes.byteLength,
      uncompressed_size_bytes: scanned.totalUncompressedBytes,
      entry_count: scanned.entryCount,
      detected_stack: scanned.detectedStack.detectedStack,
      deployment_id: deploymentId,
      completed_at: now,
    });

    await logSecurityAudit({
      actorId,
      actorRole: actorIsAdmin ? 'admin' : 'client',
      actionType: 'DIRECT_UPLOAD_DEPLOYED',
      targetResource: serviceId,
      riskLevel: 'low',
      metadata: {
        uploadId: session.id,
        deploymentId,
        releaseId,
        uploadMode,
        detectedStack: scanned.detectedStack.detectedStack,
        runtimeFamily: scanned.detectedStack.runtimeFamily,
        filesCount: scanned.entryCount,
        uncompressedBytes: scanned.totalUncompressedBytes,
      },
    });

    return NextResponse.json({
      success: true,
      uploadId: session.id,
      deploymentId,
      releaseId,
      buildJobId,
      status: deploymentStatus,
      deploymentTarget: scanned.detectedStack.deploymentTarget,
      detectedStack: scanned.detectedStack.detectedStack,
      runtimeFamily: scanned.detectedStack.runtimeFamily,
      stackSlug: scanned.detectedStack.stackSlug,
      publishSubdir: scanned.detectedStack.publishSubdir,
      deploymentMode,
      r2ArtifactKey: artifactKey,
      liveUrl,
      edgeRouterUrl,
      filesCount: scanned.entryCount,
      compressedBytes: scanned.totalCompressedBytes,
      uncompressedBytes: scanned.totalUncompressedBytes,
      unwrappedRootPrefix: scanned.unwrappedRootPrefix,
      quotaUsage: {
        diskUsedGb: updatedDiskUsedGb,
        diskLimitGb: quota.diskLimitGb,
        inodeUsed: updatedInodesUsed,
        inodeLimit: quota.inodeLimit,
      },
    });
  } catch (err) {
    console.error('[POST /api/hosting/uploads/complete]', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to complete upload deployment.',
      },
      { status: 500 }
    );
  }
}
