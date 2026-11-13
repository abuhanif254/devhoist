'use client';

import React, { useCallback, useRef, useState } from 'react';
import { zipSync } from 'fflate';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileArchive,
  FolderUp,
  Loader2,
  Rocket,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import type { DeployTargetPreference } from '@/lib/archiveSecurity';

export interface DirectUploadDeployResult {
  uploadId: string;
  deploymentId: string;
  releaseId: string;
  status: string;
  deploymentTarget: 'static_edge' | 'container';
  detectedStack: string;
  runtimeFamily: string;
  stackSlug: string;
  publishSubdir: string;
  deploymentMode: string;
  liveUrl: string;
  edgeRouterUrl: string | null;
  filesCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  quotaUsage?: {
    diskUsedGb: number;
    diskLimitGb: number;
    inodeUsed: number;
    inodeLimit: number;
  };
}

interface DirectUploadDeployPanelProps {
  serviceId: string;
  domain: string;
  onDeployed?: (result: DirectUploadDeployResult) => void;
  onNotify?: (msg: string, isError?: boolean) => void;
  compact?: boolean;
}

type UploadPhase =
  | 'idle'
  | 'packing'
  | 'presigning'
  | 'uploading'
  | 'scanning'
  | 'deployed'
  | 'error';

const MAX_COMPRESSED_CLIENT_BYTES = 100 * 1024 * 1024;
const SKIPPED_LOCAL_FOLDER_PREFIXES = ['.git/', 'node_modules/', '/node_modules/', '/.git/'];

interface CollectedLocalFile {
  relativePath: string;
  file: File;
}

function shouldSkipLocalPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  if (!normalized || normalized.endsWith('/.ds_store') || normalized === '.ds_store') {
    return true;
  }
  if (normalized.endsWith('/thumbs.db') || normalized === 'thumbs.db') {
    return true;
  }
  return SKIPPED_LOCAL_FOLDER_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) || normalized.includes(prefix)
  );
}

async function readDroppedEntries(items: DataTransferItemList): Promise<CollectedLocalFile[]> {
  const results: CollectedLocalFile[] = [];

  async function walkEntry(entry: FileSystemEntry, parentPath: string): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      const relPath = parentPath ? `${parentPath}/${file.name}` : file.name;
      if (!shouldSkipLocalPath(relPath)) {
        results.push({ relativePath: relPath, file });
      }
      return;
    }

    if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirName = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      if (shouldSkipLocalPath(`${dirName}/`)) return;
      const reader = dirEntry.createReader();
      const allEntries: FileSystemEntry[] = [];
      let batch: FileSystemEntry[] = [];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        allEntries.push(...batch);
      } while (batch.length > 0);

      for (const child of allEntries) {
        await walkEntry(child, dirName);
      }
    }
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const webkitEntry =
      typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (webkitEntry) {
      await walkEntry(webkitEntry, '');
    } else {
      const f = item.getAsFile();
      if (f && !shouldSkipLocalPath(f.name)) {
        results.push({ relativePath: f.name, file: f });
      }
    }
  }

  return results;
}

function uploadBytesWithProgress(
  url: string,
  bytes: Uint8Array,
  onProgress: (pct: number) => void
): Promise<{ status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', 'application/zip');

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      }
    };

    xhr.onload = () => {
      resolve({ status: xhr.status, bodyText: xhr.responseText || '' });
    };

    xhr.onerror = () => {
      reject(new Error('Network transfer interrupted while uploading bundle.'));
    };

    xhr.send(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }));
  });
}

const FOLDER_INPUT_EXTRA_PROPS = {
  webkitdirectory: '',
  directory: '',
} as unknown as React.InputHTMLAttributes<HTMLInputElement>;

export function DirectUploadDeployPanel({
  serviceId,
  domain,
  onDeployed,
  onNotify,
  compact = false,
}: DirectUploadDeployPanelProps) {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const [errorDetail, setErrorDetail] = useState<{
    message: string;
    code?: string;
    offendingEntry?: string;
  } | null>(null);
  const [lastResult, setLastResult] = useState<DirectUploadDeployResult | null>(null);
  const [deployTarget, setDeployTarget] = useState<DeployTargetPreference>('auto');
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy =
    phase === 'packing' ||
    phase === 'presigning' ||
    phase === 'uploading' ||
    phase === 'scanning';

  const executeDeployPipeline = useCallback(
    async (collected: CollectedLocalFile[]) => {
      if (!serviceId) {
        setErrorDetail({ message: 'Select an active hosting project before deploying.' });
        setPhase('error');
        return;
      }

      if (collected.length === 0) {
        setErrorDetail({ message: 'No deployable files were selected.' });
        setPhase('error');
        return;
      }

      setErrorDetail(null);
      setLastResult(null);
      setProgressPct(0);

      try {
        let zipBytes: Uint8Array;
        let bundleFileName = 'project-bundle.zip';
        let uploadMode: 'zip_upload' | 'folder_upload' | 'file_upload' = 'zip_upload';

        const singleFile = collected.length === 1 ? collected[0] : null;
        if (singleFile && singleFile.file.name.toLowerCase().endsWith('.zip')) {
          setPhase('packing');
          setStatusLabel(`Inspecting ${singleFile.file.name}...`);
          bundleFileName = singleFile.file.name;
          uploadMode = 'zip_upload';
          zipBytes = new Uint8Array(await singleFile.file.arrayBuffer());
        } else {
          const isFolder = collected.some((item) => item.relativePath.includes('/'));
          uploadMode = isFolder ? 'folder_upload' : 'file_upload';
          bundleFileName = isFolder ? 'folder-bundle.zip' : `${singleFile?.file.name || 'files'}.zip`;
          setPhase('packing');
          setStatusLabel(`Bundling ${collected.length} file${collected.length === 1 ? '' : 's'} into ZIP...`);

          const zipMap: Record<string, Uint8Array> = {};
          for (const item of collected) {
            const cleanRel = item.relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
            if (!cleanRel || shouldSkipLocalPath(cleanRel)) continue;
            zipMap[cleanRel] = new Uint8Array(await item.file.arrayBuffer());
          }
          if (Object.keys(zipMap).length === 0) {
            throw new Error('Selected files contained only ignored workspace artifacts (.git/node_modules).');
          }
          zipBytes = zipSync(zipMap, { level: 6 });
        }

        if (zipBytes.byteLength > MAX_COMPRESSED_CLIENT_BYTES) {
          throw new Error(
            `Compressed archive (${(zipBytes.byteLength / (1024 * 1024)).toFixed(
              1
            )} MB) exceeds 100 MB upload ceiling.`
          );
        }

        setPhase('presigning');
        setStatusLabel('Verifying plan quota & requesting signed R2 upload token...');
        const presignRes = await fetch('/api/hosting/uploads/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId,
            fileName: bundleFileName,
            sizeBytes: zipBytes.byteLength,
            uploadMode,
            deployTarget,
          }),
        });
        const presignJson = await presignRes.json();
        if (!presignRes.ok || !presignJson.success) {
          setErrorDetail({
            message: presignJson.error || 'Upload preflight rejected.',
            code: presignJson.code,
          });
          setPhase('error');
          onNotify?.(presignJson.error || 'Upload preflight rejected.', true);
          return;
        }

        setPhase('uploading');
        setStatusLabel(
          `Uploading ${(zipBytes.byteLength / 1024).toFixed(1)} KB to edge object storage...`
        );
        const transferRes = await uploadBytesWithProgress(
          presignJson.uploadUrl,
          zipBytes,
          (pct) => setProgressPct(pct)
        );

        let transferJson: Record<string, unknown> = {};
        try {
          transferJson = JSON.parse(transferRes.bodyText || '{}') as Record<string, unknown>;
        } catch {
          transferJson = {};
        }

        if (transferRes.status < 200 || transferRes.status >= 300 || !transferJson.success) {
          const msg = String(transferJson.error || `Upload failed (HTTP ${transferRes.status}).`);
          setErrorDetail({
            message: msg,
            code: transferJson.code ? String(transferJson.code) : undefined,
          });
          setPhase('error');
          onNotify?.(msg, true);
          return;
        }

        setPhase('scanning');
        setProgressPct(100);
        setStatusLabel('Running anti-exploit archive scan & auto-detecting project runtime...');
        const completeRes = await fetch('/api/hosting/uploads/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId,
            uploadId: presignJson.uploadId,
            uploadMode,
            deployTarget,
          }),
        });
        const completeJson = await completeRes.json();
        if (!completeRes.ok || !completeJson.success) {
          setErrorDetail({
            message: completeJson.error || 'Archive scan or deployment failed.',
            code: completeJson.code,
            offendingEntry: completeJson.offendingEntry,
          });
          setPhase('error');
          onNotify?.(completeJson.error || 'Archive scan or deployment failed.', true);
          return;
        }

        const deployedResult = completeJson as DirectUploadDeployResult;
        setLastResult(deployedResult);
        setPhase('deployed');
        setStatusLabel(
          `Deployed ${deployedResult.detectedStack} (${deployedResult.filesCount} files) to ${domain}.`
        );
        onNotify?.(`Live release ${deployedResult.releaseId} published cleanly.`);
        onDeployed?.(deployedResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Direct upload deployment failed.';
        setErrorDetail({ message: msg });
        setPhase('error');
        onNotify?.(msg, true);
      }
    },
    [serviceId, domain, deployTarget, onDeployed, onNotify]
  );

  const handleFileListSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || isBusy) return;
    const collected: CollectedLocalFile[] = [];
    for (let i = 0; i < fileList.length; i += 1) {
      const f = fileList[i];
      const rel =
        ('webkitRelativePath' in f && f.webkitRelativePath ? f.webkitRelativePath : f.name) ||
        f.name;
      if (!shouldSkipLocalPath(rel)) {
        collected.push({ relativePath: rel, file: f });
      }
    }
    await executeDeployPipeline(collected);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (isBusy) return;

    const collected = await readDroppedEntries(e.dataTransfer.items);
    if (collected.length > 0) {
      await executeDeployPipeline(collected);
    } else if (e.dataTransfer.files.length > 0) {
      await handleFileListSelected(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900/70 ${
        compact ? 'p-4' : 'p-5'
      } space-y-4 font-mono text-xs`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Direct ZIP, Folder & File Instant Deploy
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            Drop a <code>.zip</code>, built folder (<code>dist/</code>, <code>out/</code>), or project directory. Zero-trust Zip-Slip, symlink & webshell scan runs automatically before going live.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor={`deploy-target-${serviceId}`}
            className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400"
          >
            Target
          </label>
          <select
            id={`deploy-target-${serviceId}`}
            value={deployTarget}
            disabled={isBusy}
            onChange={(e) => setDeployTarget(e.target.value as DeployTargetPreference)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-black/40 text-slate-900 dark:text-white text-[11px] font-bold focus:outline-none"
          >
            <option value="auto">Auto-Detect Stack</option>
            <option value="static_edge">Static / Edge CDN (R2)</option>
            <option value="container">Container Runtime (Node/PHP/Py)</option>
          </select>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed transition-colors ${
          compact ? 'p-4' : 'p-6'
        } text-center ${
          isDragActive
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-black/30 hover:border-blue-500/50'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            {isBusy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Rocket className="w-5 h-5" />
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {isBusy
                ? statusLabel
                : 'Drag & drop a .zip archive, project folder, or files here'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Max 100 MB compressed • Auto-skips node_modules & .git metadata • 1-Click Rollback Ready
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => zipInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-[11px] flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
            >
              <FileArchive className="w-3.5 h-3.5" />
              Select .ZIP Bundle
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => folderInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 font-bold text-[11px] flex items-center gap-1.5 hover:border-emerald-500/60 disabled:opacity-50"
            >
              <FolderUp className="w-3.5 h-3.5 text-emerald-500" />
              Select Folder
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => filesInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 font-bold text-[11px] flex items-center gap-1.5 hover:border-blue-500/60 disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
              Select Files
            </button>
          </div>
        </div>

        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            void handleFileListSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={filesInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFileListSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...FOLDER_INPUT_EXTRA_PROPS}
          className="hidden"
          onChange={(e) => {
            void handleFileListSelected(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Real XHR Progress Bar */}
      {isBusy && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-300 font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              {statusLabel}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${Math.max(phase === 'scanning' ? 100 : progressPct, 8)}%` }}
            />
          </div>
        </div>
      )}

      {/* Security / Quota Rejection Banner */}
      {errorDetail && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-black text-[11px] uppercase tracking-wider">
              {errorDetail.code ? `Blocked (${errorDetail.code})` : 'Deployment Blocked'}
            </p>
            <p className="text-[11px] leading-relaxed">{errorDetail.message}</p>
            {errorDetail.offendingEntry && (
              <p className="text-[10px] opacity-85">
                Offending entry: <code>{errorDetail.offendingEntry}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Live Deployed Summary */}
      {lastResult && phase === 'deployed' && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div className="space-y-0.5">
              <p className="font-black text-[11px] uppercase tracking-wider">
                {lastResult.status === 'live_production'
                  ? `Live on ${lastResult.deploymentTarget === 'static_edge' ? 'Isolated Edge CDN' : 'Compute Container'}`
                  : `Queued / Building (${lastResult.status})`}
              </p>
              <p className="text-[11px]">
                Stack: <b>{lastResult.detectedStack}</b> • Release <code>{lastResult.releaseId}</code> • {lastResult.filesCount} files ({(lastResult.uncompressedBytes / 1024).toFixed(1)} KB)
              </p>
              {lastResult.quotaUsage && (
                <p className="text-[10px] opacity-85">
                  Plan Usage: {lastResult.quotaUsage.diskUsedGb.toFixed(4)} / {lastResult.quotaUsage.diskLimitGb} GB Disk • {lastResult.quotaUsage.inodeUsed.toLocaleString()} / {lastResult.quotaUsage.inodeLimit.toLocaleString()} Inodes
                </p>
              )}
            </div>
          </div>

          <a
            href={lastResult.edgeRouterUrl || lastResult.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0 hover:bg-emerald-500"
          >
            Open Live Preview
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
