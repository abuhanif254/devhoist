'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  GitBranch,
  Terminal,
  Database,
  History,
  Clock,
  Shield,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  Play,
  Pause,
  UploadCloud,
  FileCode,
  CheckCircle2,
  ChevronDown,
  Layers,
  Cpu,
  RefreshCw,
  HardDrive,
  X,
  Lock,
} from 'lucide-react';
import { useSudoGate } from '@/components/security/SudoGateModal';
import {
  FRAMEWORK_PRESETS,
  describeCronExpression,
  getMaskedPreview,
} from '@/lib/projectEngine';
import {
  UNIVERSAL_MARKETPLACE_STACKS,
  MarketplaceStackBlueprint,
} from '@/lib/stackProvisioner';

interface HostingProjectControlStudioProps {
  serviceId: string;
  serviceDomain: string;
  cpanelUser: string;
  serverIp?: string;
  activeTab?: 'overview' | 'git' | 'databases' | 'domains_staging' | 'backups' | 'cron_logs';
  onTabChange?: (tab: any) => void;
}

export default function HostingProjectControlStudio({
  serviceId,
  serviceDomain,
  cpanelUser,
  serverIp = '103.151.102.45',
  activeTab = 'git',
  onTabChange,
}: HostingProjectControlStudioProps) {
  const { requireSudo } = useSudoGate();

  // Navigation SubTab
  const [currentTab, setCurrentTab] = useState<
    'settings_env' | 'deployments' | 'databases' | 'backups_cron' | 'stack_installer'
  >('deployments');
  const [selectedInstallSlug, setSelectedInstallSlug] = useState<string>('nextjs-15-standalone');
  const [isInstallingStack, setIsInstallingStack] = useState<boolean>(false);
  const [lastProvisionResult, setLastProvisionResult] = useState<any | null>(null);

  // Sync with parent prop if provided
  useEffect(() => {
    if (activeTab === 'git') setCurrentTab('deployments');
    else if (activeTab === 'databases') setCurrentTab('databases');
    else if (activeTab === 'backups') setCurrentTab('backups_cron');
    else if (activeTab === 'cron_logs') setCurrentTab('backups_cron');
  }, [activeTab]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // TAB 1: PROJECT SETTINGS & .ENV VAULT STATE
  // ---------------------------------------------------------------------------
  const [frameworkPreset, setFrameworkPreset] = useState('nextjs_standalone');
  const [runtimeVersion, setRuntimeVersion] = useState('Node.js 22 LTS');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [installCommand, setInstallCommand] = useState('npm ci');
  const [outputDir, setOutputDir] = useState('.next/standalone');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [webhookToken, setWebhookToken] = useState('whsec_placeholder');
  const [litespeedCache, setLitespeedCache] = useState(true);
  const [redisCache, setRedisCache] = useState(true);

  // Env Vars
  const [envVars, setEnvVars] = useState<any[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newEnvTarget, setNewEnvTarget] = useState<'production' | 'staging' | 'all'>('all');
  const [isBulkEnvModalOpen, setIsBulkEnvModalOpen] = useState(false);
  const [bulkEnvText, setBulkEnvText] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // TAB 2: DEPLOYMENTS & LIVE LOGS
  // ---------------------------------------------------------------------------
  const [deployments, setDeployments] = useState<any[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  // ---------------------------------------------------------------------------
  // TAB 3: DATABASES & REMOTE ACCESS
  // ---------------------------------------------------------------------------
  const [databases, setDatabases] = useState<any[]>([]);
  const [newDbSuffix, setNewDbSuffix] = useState('');
  const [newDbEngine, setNewDbEngine] = useState('MySQL 8.0');
  const [newDbPassword, setNewDbPassword] = useState('');
  const [newDbIps, setNewDbIps] = useState('103.151.102.45, 127.0.0.1');

  // ---------------------------------------------------------------------------
  // TAB 4: JETBACKUP & CRON JOBS
  // ---------------------------------------------------------------------------
  const [backups, setBackups] = useState<any[]>([]);
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [newCronLabel, setNewCronLabel] = useState('');
  const [newCronExpr, setNewCronExpr] = useState('0 * * * *');
  const [newCronCmd, setNewCronCmd] = useState('');
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronOutputLog, setCronOutputLog] = useState<{ id: string; log: string } | null>(null);

  // Load live data from Edge APIs
  const fetchAllData = async () => {
    if (!serviceId) return;
    try {
      // 1. Fetch Project & Env
      const pRes = await fetch(`/api/hosting/project?serviceId=${encodeURIComponent(serviceId)}`);
      const pData = await pRes.json();
      if (pData.success) {
        if (pData.settings) {
          setFrameworkPreset(pData.settings.framework_preset || 'nextjs_standalone');
          setRuntimeVersion(pData.settings.runtime_version || 'Node.js 22 LTS');
          setBuildCommand(pData.settings.build_command || 'npm run build');
          setInstallCommand(pData.settings.install_command || 'npm ci');
          setOutputDir(pData.settings.output_directory || '.next/standalone');
          setGitRepoUrl(pData.settings.git_repo_url || '');
          setGitBranch(pData.settings.production_branch || 'main');
          setAutoDeploy(pData.settings.auto_deploy_on_push ?? true);
          setWebhookToken(pData.settings.webhook_secret_token || '');
          setLitespeedCache(pData.settings.litespeed_cache_enabled ?? true);
          setRedisCache(pData.settings.redis_object_cache_enabled ?? true);
        }
        if (pData.envVariables) setEnvVars(pData.envVariables);
      }

      // 2. Fetch Deployments
      const dRes = await fetch(`/api/hosting/deployments?serviceId=${encodeURIComponent(serviceId)}`);
      const dData = await dRes.json();
      if (dData.success && Array.isArray(dData.deployments)) {
        setDeployments(dData.deployments);
      }

      // 3. Fetch Databases
      const dbRes = await fetch(`/api/hosting/databases?serviceId=${encodeURIComponent(serviceId)}`);
      const dbData = await dbRes.json();
      if (dbData.success && Array.isArray(dbData.databases)) {
        setDatabases(dbData.databases);
      }

      // 4. Fetch Backups & Cron
      const bcRes = await fetch(`/api/hosting/backups-cron?serviceId=${encodeURIComponent(serviceId)}`);
      const bcData = await bcRes.json();
      if (bcData.success) {
        if (Array.isArray(bcData.backups)) setBackups(bcData.backups);
        if (Array.isArray(bcData.cronJobs)) setCronJobs(bcData.cronJobs);
      }
    } catch (err) {
      console.warn('Using baseline state for project controls:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [serviceId]);

  // Handle Preset Change
  const handleFrameworkChange = (presetKey: string) => {
    setFrameworkPreset(presetKey);
    const cfg = FRAMEWORK_PRESETS[presetKey];
    if (cfg) {
      setBuildCommand(cfg.buildCommand);
      setInstallCommand(cfg.installCommand);
      setOutputDir(cfg.outputDirectory);
      setRuntimeVersion(cfg.runtimeVersion);
    }
  };

  // Save Project Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    try {
      const res = await fetch('/api/hosting/project', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          settings: {
            framework_preset: frameworkPreset,
            runtime_version: runtimeVersion,
            build_command: buildCommand,
            install_command: installCommand,
            output_directory: outputDir,
            git_repo_url: gitRepoUrl,
            production_branch: gitBranch,
            auto_deploy_on_push: autoDeploy,
            litespeed_cache_enabled: litespeedCache,
            redis_object_cache_enabled: redisCache,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Project build settings updated.');
    } catch (err: any) {
      setSettingsError(err.message);
    }
  };

  // Add Env Var
  const handleAddEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvKey || !newEnvVal) return;
    try {
      const res = await fetch('/api/hosting/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_env',
          serviceId,
          key: newEnvKey,
          value: newEnvVal,
          targetEnvironment: newEnvTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEnvVars((prev) => [
        ...prev.filter((v) => v.env_key !== newEnvKey),
        {
          id: data.id || `env_${Date.now()}`,
          env_key: newEnvKey.toUpperCase(),
          masked_preview: data.maskedPreview || getMaskedPreview(newEnvVal),
          target_environment: newEnvTarget,
          is_secret: true,
        },
      ]);
      setNewEnvKey('');
      setNewEnvVal('');
      showToast(`Key ${newEnvKey} encrypted into AES-256 vault.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Bulk Import .Env
  const handleBulkImportEnv = async () => {
    if (!bulkEnvText.trim()) return;
    try {
      const res = await fetch('/api/hosting/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_import_env',
          serviceId,
          rawEnvText: bulkEnvText,
          targetEnvironment: 'all',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsBulkEnvModalOpen(false);
      setBulkEnvText('');
      showToast(data.message || 'Bulk environment variables imported.');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reveal Secret (Guarded by Sudo)
  const handleRevealSecret = (envItem: any) => {
    if (revealedSecrets[envItem.id]) {
      setRevealedSecrets((prev) => {
        const copy = { ...prev };
        delete copy[envItem.id];
        return copy;
      });
      return;
    }

    requireSudo(async () => {
      try {
        const res = await fetch('/api/hosting/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reveal_secret',
            envId: envItem.id,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (data.success && data.plaintextValue) {
          setRevealedSecrets((prev) => ({
            ...prev,
            [envItem.id]: data.plaintextValue,
          }));
        }
      } catch {
        alert('Failed to decrypt secret.');
      }
    }, `Decrypt secret value for ${envItem.env_key}`);
  };

  // Trigger Manual Deploy
  const handleTriggerDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await fetch('/api/hosting/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_manual',
          serviceId,
          commitMessage: 'Manual build release triggered via dashboard',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('New production build deployed!');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  // Rollback Release
  const handleRollback = (depId: string, commitSha: string) => {
    requireSudo(async () => {
      try {
        const res = await fetch('/api/hosting/deployments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rollback',
            serviceId,
            targetDeploymentId: depId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(`Rolled back to release ${commitSha}!`);
        fetchAllData();
      } catch (err: any) {
        alert(err.message);
      }
    }, `Execute Instant Rollback to release ${commitSha}`);
  };

  // Create Database
  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbSuffix) return;
    try {
      const res = await fetch('/api/hosting/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_database',
          serviceId,
          cpanelUser,
          dbEngine: newDbEngine,
          dbSuffix: newDbSuffix,
          dbPassword: newDbPassword,
          remoteIps: newDbIps.split(',').map((ip) => ip.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Database ${data.dbName} created!`);
      setNewDbSuffix('');
      setNewDbPassword('');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Sync Database URL to Env
  const handleSyncDbUrl = async (connStr: string) => {
    try {
      const res = await fetch('/api/hosting/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_to_env',
          serviceId,
          connectionString: connStr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('DATABASE_URL encrypted & saved into .env vault!');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Drop Database (Guarded by Sudo)
  const handleDropDatabase = (dbItem: any) => {
    requireSudo(async () => {
      try {
        const res = await fetch('/api/hosting/databases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'drop_database',
            databaseId: dbItem.id,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(`Database ${dbItem.db_name} purged.`);
        setDatabases((prev) => prev.filter((d) => d.id !== dbItem.id));
      } catch (err: any) {
        alert(err.message);
      }
    }, `Permanently DROP production database ${dbItem.db_name}`);
  };

  // Create JetBackup Snapshot
  const handleCreateSnapshot = async (scope: string) => {
    try {
      const res = await fetch('/api/hosting/backups-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_snapshot',
          serviceId,
          scope,
          label: `Manual Snapshot (${new Date().toLocaleDateString()})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || 'Snapshot created!');
      fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Restore Snapshot (Guarded by Sudo)
  const handleRestoreSnapshot = (backupItem: any) => {
    requireSudo(async () => {
      try {
        const res = await fetch('/api/hosting/backups-cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'restore_snapshot',
            snapshotId: backupItem.id,
            sudoVerified: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast('Point-in-Time restore finalized!');
      } catch (err: any) {
        alert(err.message);
      }
    }, `Authorize Point-in-Time Restore from ${backupItem.snapshot_label}`);
  };

  // Create Cron
  const handleCreateCron = async (e: React.FormEvent) => {
    e.preventDefault();
    setCronError(null);
    try {
      const res = await fetch('/api/hosting/backups-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_cron',
          serviceId,
          label: newCronLabel,
          cronExpression: newCronExpr,
          command: newCronCmd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message || 'Cron job added.');
      setNewCronLabel('');
      setNewCronCmd('');
      fetchAllData();
    } catch (err: any) {
      setCronError(err.message);
    }
  };

  // Test Run Cron Now
  const handleTestRunCron = async (cronItem: any) => {
    try {
      const res = await fetch('/api/hosting/backups-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_run_cron',
          cronId: cronItem.id,
          command: cronItem.command,
        }),
      });
      const data = await res.json();
      if (data.success && data.outputLog) {
        setCronOutputLog({ id: cronItem.id, log: data.outputLog });
      }
    } catch {
      alert('Failed to execute test run.');
    }
  };

  // 1-Click Stack Installer Handler
  const handleInstallMarketplaceStack = async (stackSlug: string) => {
    setIsInstallingStack(true);
    setLastProvisionResult(null);
    try {
      const res = await fetch('/api/hosting/install-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          stackSlug,
          domain: serviceDomain,
          cpanelUser,
          gitRepoUrl: gitRepoUrl || undefined,
          gitBranch: gitBranch || 'main',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to provision stack');
      }
      setLastProvisionResult(data.result);
      showToast(data.message || 'Stack provisioned and deployed!');
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Stack installation failed');
    } finally {
      setIsInstallingStack(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{toast}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Nav Bar */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 overflow-x-auto font-mono text-xs">
        <button
          type="button"
          onClick={() => {
            setCurrentTab('deployments');
            onTabChange?.('git');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            currentTab === 'deployments'
              ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Git CI/CD &amp; Releases</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentTab('settings_env');
            onTabChange?.('git');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            currentTab === 'settings_env'
              ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Settings &amp; .ENV Vault</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentTab('databases');
            onTabChange?.('databases');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            currentTab === 'databases'
              ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Databases &amp; IP Whitelist</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentTab('backups_cron');
            onTabChange?.('backups');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            currentTab === 'backups_cron'
              ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>JetBackup &amp; Cron Jobs</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('stack_installer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            currentTab === 'stack_installer'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>1-Click Stack Installer (16)</span>
        </button>
      </div>

      {/* =======================================================================
          TAB 1: DEPLOYMENTS & LIVE ROLLBACK RELEASES
         ======================================================================= */}
      {currentTab === 'deployments' && (
        <div className="space-y-6 animate-in fade-in duration-150 font-mono text-xs">
          {/* Header Action Strip */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-600" />
                <strong className="text-slate-900 dark:text-white text-sm">
                  Production Branch: {gitBranch}
                </strong>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  Phusion Passenger LIVE
                </span>
              </div>
              <p className="text-slate-500 mt-1">
                Auto-deploy on push: <strong>{autoDeploy ? 'ACTIVE' : 'PAUSED'}</strong> • Retained Rollbacks: 3 releases
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerDeploy}
                disabled={isDeploying}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDeploying ? 'animate-spin' : ''}`} />
                <span>{isDeploying ? 'Building Release...' : 'Trigger Production Deploy'}</span>
              </button>
            </div>
          </div>

          {/* Webhook Endpoint Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-2">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              GitHub Webhook URL &amp; HMAC Secret
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300">
                <span className="truncate">https://devhost.cloud/api/webhooks/git/{serviceId}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://devhost.cloud/api/webhooks/git/${serviceId}`);
                    showToast('Webhook URL copied!');
                  }}
                  className="p-1 hover:text-blue-600 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300">
                <span className="truncate font-bold">Secret: {webhookToken.substring(0, 10)}••••••••</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookToken);
                    showToast('Secret token copied!');
                  }}
                  className="p-1 hover:text-blue-600 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Releases List */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Release History &amp; 1-Click Rollback</span>
              <span className="text-slate-400 text-[11px]">{deployments.length} deployments tracked</span>
            </div>

            {deployments.map((dep) => (
              <div key={dep.id} className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                        {dep.commit_sha}
                      </span>
                      <strong className="text-slate-900 dark:text-white">{dep.commit_message}</strong>
                      {dep.is_current_production ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-bold">
                          CURRENT PRODUCTION
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-bold">
                          SUPERSEDED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Author: {dep.author_name || 'Git'} • Duration: {dep.duration_seconds || '2.8'}s • Size: {dep.artifact_size_mb || '14.2'} MB • {new Date(dep.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(expandedLogId === dep.id ? null : dep.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
                    >
                      {expandedLogId === dep.id ? 'Hide Logs' : 'View Build Logs'}
                    </button>

                    {!dep.is_current_production && (
                      <button
                        type="button"
                        onClick={() => handleRollback(dep.id, dep.commit_sha)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Instant Rollback</span>
                      </button>
                    )}
                  </div>
                </div>

                {expandedLogId === dep.id && (
                  <div className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 animate-in fade-in duration-150">
                    {dep.build_logs || '[NO LOGS RECORDED]'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: PROJECT BUILD SETTINGS & AES-GCM .ENV VAULT
         ======================================================================= */}
      {currentTab === 'settings_env' && (
        <div className="space-y-6 animate-in fade-in duration-150 font-mono text-xs">
          {/* Framework Presets Form */}
          <form
            onSubmit={handleSaveSettings}
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>Runtime Engine &amp; Vercel-Style Build Presets</span>
              </h3>
              <span className="text-[11px] text-slate-400">cPanel Node/LiteSpeed Integration</span>
            </div>

            {settingsError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-500">Framework Preset:</label>
                <select
                  value={frameworkPreset}
                  onChange={(e) => handleFrameworkChange(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                >
                  {Object.entries(FRAMEWORK_PRESETS).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Runtime Version:</label>
                <input
                  type="text"
                  value={runtimeVersion}
                  onChange={(e) => setRuntimeVersion(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Install Command:</label>
                <input
                  type="text"
                  value={installCommand}
                  onChange={(e) => setInstallCommand(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Build Command (Turbopack / Artisan):</label>
                <input
                  type="text"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Output Directory:</label>
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Git Repository URL:</label>
                <input
                  type="text"
                  value={gitRepoUrl}
                  onChange={(e) => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDeploy}
                    onChange={(e) => setAutoDeploy(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Auto Deploy on Push</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={litespeedCache}
                    onChange={(e) => setLitespeedCache(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>LiteSpeed OPcache</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-md shadow-blue-600/20"
              >
                Save Project Configuration
              </button>
            </div>
          </form>

          {/* AES-256-GCM .ENV Vault */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-600" />
                  <span>AES-256-GCM Encrypted .ENV Vault</span>
                </h3>
                <p className="text-slate-500 mt-0.5">
                  All secrets are encrypted at rest with Web Crypto API and decrypted only inside worker runtime.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkEnvModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bulk Paste .ENV</span>
                </button>
              </div>
            </div>

            {/* Add Env Form */}
            <form onSubmit={handleAddEnv} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                placeholder="KEY (e.g. STRIPE_KEY)"
                required
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                placeholder="Secret Value"
                required
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
              <select
                value={newEnvTarget}
                onChange={(e) => setNewEnvTarget(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              >
                <option value="all">All Environments</option>
                <option value="production">Production Only</option>
                <option value="staging">Staging Only</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
              >
                + Add Secret
              </button>
            </form>

            {/* Env Table */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
              {envVars.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No environment variables stored yet.</div>
              ) : (
                envVars.map((v) => {
                  const isRevealed = Boolean(revealedSecrets[v.id]);
                  const displayVal = isRevealed ? revealedSecrets[v.id] : v.masked_preview;

                  return (
                    <div
                      key={v.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20"
                    >
                      <div className="flex items-center gap-3">
                        <strong className="text-slate-900 dark:text-white w-48 truncate">{v.env_key}</strong>
                        <span className="text-slate-500 font-bold">{displayVal}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-600 dark:text-zinc-400">
                          {v.target_environment}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRevealSecret(v)}
                          title="Requires 2FA Sudo Gate"
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-blue-600" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: IN-PORTAL DATABASES & REMOTE IP ACCESS
         ======================================================================= */}
      {currentTab === 'databases' && (
        <div className="space-y-6 animate-in fade-in duration-150 font-mono text-xs">
          {/* Create Database Form */}
          <form
            onSubmit={handleCreateDatabase}
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4"
          >
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Create In-Portal Database &amp; User</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-500">Database Engine:</label>
                <select
                  value={newDbEngine}
                  onChange={(e) => setNewDbEngine(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                >
                  <option value="MySQL 8.0">MySQL 8.0 (InnoDB)</option>
                  <option value="MariaDB 10.11">MariaDB 10.11</option>
                  <option value="PostgreSQL 16">PostgreSQL 16</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Database Name Suffix:</label>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-slate-400 font-bold">{cpanelUser}_</span>
                  <input
                    type="text"
                    value={newDbSuffix}
                    onChange={(e) => setNewDbSuffix(e.target.value)}
                    placeholder="shop_live"
                    required
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Database Password:</label>
                <input
                  type="text"
                  value={newDbPassword}
                  onChange={(e) => setNewDbPassword(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-400">
                User `{cpanelUser}_user` will be assigned ALL PRIVILEGES automatically.
              </span>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-md shadow-blue-600/20"
              >
                Create Database &amp; User
              </button>
            </div>
          </form>

          {/* Databases List */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Active Relational Databases</span>
              <span className="text-slate-400 text-[11px]">{databases.length} databases running</span>
            </div>

            {databases.map((db) => {
              const host = serverIp;
              const port = db.db_engine.includes('PostgreSQL') ? 5432 : 3306;
              const connStr = `mysql://${db.db_username}:[PASSWORD]@${host}:${port}/${db.db_name}`;

              return (
                <div key={db.id} className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        <strong className="text-slate-900 dark:text-white text-sm">{db.db_name}</strong>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {db.db_engine}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        User: {db.db_username} • Tables: {db.tables_count || 12} • Size: {db.size_mb || 12.4} MB • Remote IPs: {db.remote_access_ips?.join(', ') || '103.151.102.45'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSyncDbUrl(connStr)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Sync DATABASE_URL to .ENV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDropDatabase(db)}
                        title="Requires 2FA Sudo Gate"
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                    <span className="truncate">{connStr}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(connStr);
                        showToast('Connection string template copied!');
                      }}
                      className="p-1 hover:text-blue-600 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: JETBACKUP TIME-MACHINE & CRON JOBS
         ======================================================================= */}
      {currentTab === 'backups_cron' && (
        <div className="space-y-6 animate-in fade-in duration-150 font-mono text-xs">
          {/* JetBackup Section */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  <span>JetBackup Offsite Snapshots &amp; Point-in-Time Restore</span>
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Automated nightly snapshots encrypted in SG1 S3 storage with 14-day rolling retention.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateSnapshot('full_account')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Generate Manual Snapshot</span>
                </button>
              </div>
            </div>

            {/* Backups Table */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
              {backups.map((bk) => (
                <div key={bk.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <strong className="text-slate-900 dark:text-white">{bk.snapshot_label}</strong>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Scope: {bk.scope} • Size: {bk.size_mb} MB • Vault: {bk.storage_location} • Created: {new Date(bk.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(bk)}
                      title="Requires 2FA Sudo Verification"
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore to Live</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sanitized Cron Jobs Section */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Sanitized Cron Job Scheduler &amp; Test Runner</span>
            </h3>

            {cronError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{cronError}</span>
              </div>
            )}

            {/* Cron Form */}
            <form onSubmit={handleCreateCron} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newCronLabel}
                onChange={(e) => setNewCronLabel(e.target.value)}
                placeholder="Job Label (e.g. Daily Cleanup)"
                required
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newCronExpr}
                onChange={(e) => setNewCronExpr(e.target.value)}
                placeholder="0 * * * *"
                required
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newCronCmd}
                onChange={(e) => setNewCronCmd(e.target.value)}
                placeholder="/usr/local/bin/node /home/user/cron.js"
                required
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs"
              >
                + Register Cron
              </button>
            </form>

            <div className="text-[11px] text-slate-500">
              Schedule Preview: <strong>{describeCronExpression(newCronExpr).description}</strong>
            </div>

            {/* Cron Jobs Table */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
              {cronJobs.map((cj) => (
                <div key={cj.id} className="p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 dark:text-white">{cj.job_label}</strong>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                          {cj.cron_expression}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        $ {cj.command}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestRunCron(cj)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3 h-3 text-emerald-600" />
                        <span>Test Run Now</span>
                      </button>
                    </div>
                  </div>

                  {cronOutputLog && cronOutputLog.id === cj.id && (
                    <div className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 text-[11px] font-mono whitespace-pre-wrap border border-slate-800 animate-in fade-in duration-150">
                      {cronOutputLog.log}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 5: 1-CLICK UNIVERSAL STACK INSTALLER (16 PRODUCTION STACKS)
         ======================================================================= */}
      {currentTab === 'stack_installer' && (
        <div className="space-y-6 animate-in fade-in duration-150 font-mono text-xs">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Universal 1-Click Application &amp; Stack Installer (16 Stacks)</span>
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Automatically configures runtime engine, provisions MySQL 8.0 / PostgreSQL 16 database, encrypts AES-256-GCM .env secrets, and deploys onto{' '}
                  <strong className="text-slate-800 dark:text-zinc-200">{serviceDomain}</strong>.
                </p>
              </div>
            </div>

            {lastProvisionResult && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Provisioned: {lastProvisionResult.stack?.name} ({lastProvisionResult.runtimeVersion})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                    Commit #{lastProvisionResult.deploymentCommitHash} LIVE
                  </span>
                </div>
                {lastProvisionResult.provisionedDatabase && (
                  <div className="text-[11px] text-slate-700 dark:text-zinc-300">
                    Auto-Provisioned DB:{' '}
                    <strong>
                      {lastProvisionResult.provisionedDatabase.engine} ({lastProvisionResult.provisionedDatabase.dbName})
                    </strong>{' '}
                    — <code className="text-emerald-600 dark:text-emerald-400">{lastProvisionResult.provisionedDatabase.connectionUriMasked}</code>
                  </div>
                )}
                <div className="text-[11px] text-slate-600 dark:text-zinc-400">
                  Injected {lastProvisionResult.injectedEnvKeys?.length || 0} Encrypted .ENV Keys:{' '}
                  {lastProvisionResult.injectedEnvKeys?.map((k: any) => k.key).join(', ')}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {UNIVERSAL_MARKETPLACE_STACKS.map((stk: MarketplaceStackBlueprint) => {
                const isSelected = selectedInstallSlug === stk.slug;
                return (
                  <div
                    key={stk.slug}
                    onClick={() => setSelectedInstallSlug(stk.slug)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-600'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-950/40 hover:border-blue-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                          {stk.category}
                        </span>
                        <span className="text-[10px] text-slate-500">{stk.default_runtime_version}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white mt-1.5 text-xs">
                        {stk.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2 font-sans">
                        {stk.tagline_en}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-white/5">
                      <span className="text-[10px] text-slate-500">
                        DB: <strong>{stk.requires_database}</strong> • .env: <strong>{stk.default_env_schema.length} keys</strong>
                      </span>

                      <button
                        type="button"
                        disabled={isInstallingStack}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInstallSlug(stk.slug);
                          handleInstallMarketplaceStack(stk.slug);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                      >
                        {isInstallingStack && selectedInstallSlug === stk.slug
                          ? 'Provisioning...'
                          : 'Auto-Configure & Deploy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bulk .ENV Import Modal */}
      {isBulkEnvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Bulk Import .ENV File</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkEnvModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-500">
              Paste the entire contents of your `.env` or `.env.production` file. All secrets will be encrypted at rest with AES-256-GCM.
            </p>

            <textarea
              rows={8}
              value={bulkEnvText}
              onChange={(e) => setBulkEnvText(e.target.value)}
              placeholder={`# Database\nDATABASE_URL="mysql://user:pass@103.151.102.45:3306/db"\n\n# API Keys\nSTRIPE_SECRET_KEY="sk_live_xxxx"\nNEXT_PUBLIC_APP_URL="https://${serviceDomain}"`}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsBulkEnvModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkEnvText.trim()}
                onClick={handleBulkImportEnv}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-md shadow-blue-600/20"
              >
                Encrypt &amp; Import All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
