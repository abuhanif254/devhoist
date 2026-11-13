'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderCode,
  Terminal,
  Database,
  GitPullRequest,
  Mail,
  Zap,
  ShieldCheck,
  Save,
  Plus,
  Trash2,
  Play,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Sparkles,
  FileText,
  ArrowUpRight,
  Globe,
} from 'lucide-react';
import { DirectUploadDeployPanel } from '@/components/hosting/DirectUploadDeployPanel';

export type WorkspaceExpansionTab =
  | 'files'
  | 'terminal_sql'
  | 'previews'
  | 'email'
  | 'autoscaler';

interface VirtualFileItem {
  id: string;
  file_path: string;
  file_name: string;
  size_bytes: number;
  permissions_octal: string;
  mime_type: string;
  content_text: string;
  updated_at: string;
}

interface SqlSchemaItem {
  tableName: string;
  engine: string;
  rowCount: number;
  sizeKB: number;
  columns: { name: string; type: string; key?: string }[];
}

interface PreviewItem {
  id: string;
  branch_name: string;
  pr_number: number | null;
  commit_sha: string;
  commit_message: string;
  preview_url: string;
  isolated_db_clone: boolean;
  status: 'building' | 'ready_live' | 'promoted_to_prod' | 'destroyed';
  created_at: string;
}

interface MailboxItem {
  id: string;
  email_address: string;
  quota_mb: number;
  used_mb: number;
  forward_to_email: string | null;
  autoresponder_enabled: boolean;
  autoresponder_subject: string | null;
  autoresponder_body: string | null;
  status: string;
}

interface DeliverabilityHealth {
  spfConfigured: boolean;
  dkimConfigured: boolean;
  dmarcConfigured: boolean;
  mxConfigured: boolean;
  mailTesterScore: string;
  records: {
    type: string;
    name: string;
    content: string;
    verified: boolean;
  }[];
}

interface ProRataPreview {
  currentPlanMonthlyBDT: number;
  targetPlanMonthlyBDT: number;
  remainingDaysInCycle: number;
  proRataChargeBDT: number;
  customerMaxBudgetCapBDT: number;
  isWithinBudgetCap: boolean;
  hasSufficientWalletBalance: boolean;
}

interface CloudWorkspaceExpansionStudioProps {
  activeSubTab: WorkspaceExpansionTab;
  onSelectSubTab: (tab: WorkspaceExpansionTab) => void;
  serviceId: string;
  domain: string;
  username: string;
  userId?: string;
  walletBalanceBDT?: number;
  onRequireSudo: (reason: string, callback: () => void) => void;
  onNotify: (msg: string) => void;
}

export default function CloudWorkspaceExpansionStudio({
  activeSubTab,
  onSelectSubTab,
  serviceId,
  domain,
  username,
  userId,
  walletBalanceBDT = 1500,
  onRequireSudo,
  onNotify,
}: CloudWorkspaceExpansionStudioProps) {
  // ---------------------------------------------------------------------------
  // 1. CLOUD FILE MANAGER & CODE EDITOR STATE
  // ---------------------------------------------------------------------------
  const [files, setFiles] = useState<VirtualFileItem[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('/public_html/server.js');
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorPermissions, setEditorPermissions] = useState<string>('0755');
  const [newFilePathInput, setNewFilePathInput] = useState<string>('');
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [fileFeedback, setFileFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadFiles = useCallback(async () => {
    setFileLoading(true);
    try {
      const res = await fetch(
        `/api/hosting/files?serviceId=${encodeURIComponent(serviceId)}&domain=${encodeURIComponent(domain)}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFiles(data.files);
        const first =
          data.files.find((f: VirtualFileItem) => f.file_path === selectedFilePath) ||
          data.files[0];
        if (first) {
          setSelectedFilePath(first.file_path);
          setEditorContent(first.content_text);
          setEditorPermissions(first.permissions_octal || '0644');
        }
      }
    } catch {
      // ignore network error in offline mode
    } finally {
      setFileLoading(false);
    }
  }, [serviceId, domain, selectedFilePath]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadFiles();
    });
    return () => {
      cancelled = true;
    };
  }, [loadFiles]);

  const handleSelectFile = (file: VirtualFileItem) => {
    setSelectedFilePath(file.file_path);
    setEditorContent(file.content_text);
    setEditorPermissions(file.permissions_octal || '0644');
    setFileFeedback(null);
  };

  const handleSaveFile = async () => {
    setFileLoading(true);
    setFileFeedback(null);
    try {
      const res = await fetch('/api/hosting/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_file',
          serviceId,
          userId,
          filePath: selectedFilePath,
          contentText: editorContent,
          permissionsOctal: editorPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFileFeedback({ type: 'err', text: data.error || 'Failed to save file.' });
      } else {
        setFiles((prev) => {
          const exists = prev.some((f) => f.file_path === data.file.file_path);
          if (exists) {
            return prev.map((f) => (f.file_path === data.file.file_path ? data.file : f));
          }
          return [...prev, data.file];
        });
        setFileFeedback({ type: 'ok', text: data.message });
        onNotify(data.message);
      }
    } catch {
      setFileFeedback({ type: 'err', text: 'Network error while saving file.' });
    } finally {
      setFileLoading(false);
    }
  };

  const handleCreateNewFile = async () => {
    if (!newFilePathInput.trim()) return;
    setFileLoading(true);
    setFileFeedback(null);
    try {
      const res = await fetch('/api/hosting/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_file',
          serviceId,
          userId,
          filePath: newFilePathInput.trim(),
          contentText: `// Created in DevHost Cloud File Studio (${new Date().toISOString()})\n`,
          permissionsOctal: '0644',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFileFeedback({ type: 'err', text: data.error || 'Path rejected by container sandbox.' });
      } else {
        setFiles((prev) => [...prev.filter((f) => f.file_path !== data.file.file_path), data.file]);
        setSelectedFilePath(data.file.file_path);
        setEditorContent(data.file.content_text);
        setEditorPermissions(data.file.permissions_octal);
        setNewFilePathInput('');
        setFileFeedback({ type: 'ok', text: `Created ${data.file.file_path}` });
        onNotify(`Created file ${data.file.file_path}`);
      }
    } finally {
      setFileLoading(false);
    }
  };

  const handleDeleteFile = (filePathToDelete: string) => {
    onRequireSudo(`Delete container file ${filePathToDelete}`, async () => {
      const res = await fetch('/api/hosting/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_file',
          serviceId,
          userId,
          filePath: filePathToDelete,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const remaining = files.filter((f) => f.file_path !== filePathToDelete);
        setFiles(remaining);
        if (remaining.length > 0) {
          handleSelectFile(remaining[0]);
        }
        onNotify(data.message);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // 2. BROWSER SSH TERMINAL & SQL QUERY LAB STATE
  // ---------------------------------------------------------------------------
  const [consoleMode, setConsoleMode] = useState<'jailed_ssh' | 'sql_runner'>('jailed_ssh');
  const [sshInput, setSshInput] = useState<string>('ls -la');
  const [sshHistory, setSshHistory] = useState<
    { cmd: string; output: string; blocked?: boolean; timeMs?: number }[]
  >([
    {
      cmd: 'whoami && node -v',
      output: `${username} (uid=1042 gid=1042 groups=1042,cagefs-jail)\nv20.12.2 (CloudLinux CageFS Isolated)`,
      timeMs: 5,
    },
  ]);
  const [sqlSchemas, setSqlSchemas] = useState<SqlSchemaItem[]>([]);
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT id, order_no, total_bdt, payment_gateway, status, created_at FROM orders ORDER BY id DESC LIMIT 10;'
  );
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [sqlRows, setSqlRows] = useState<Record<string, unknown>[]>([]);
  const [sqlExecTimeMs, setSqlExecTimeMs] = useState<number>(0);
  const [consoleBusy, setConsoleBusy] = useState<boolean>(false);

  const loadConsoleMetadata = useCallback(async () => {
    try {
      const res = await fetch(`/api/hosting/console?serviceId=${encodeURIComponent(serviceId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.schemas)) {
        setSqlSchemas(data.schemas);
      }
    } catch {
      // ignore
    }
  }, [serviceId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadConsoleMetadata();
    });
    return () => {
      cancelled = true;
    };
  }, [loadConsoleMetadata]);

  const handleRunSshCommand = async (cmdOverride?: string) => {
    const commandToRun = (cmdOverride ?? sshInput).trim();
    if (!commandToRun) return;
    if (commandToRun.toLowerCase() === 'clear') {
      setSshHistory([]);
      setSshInput('');
      return;
    }

    setConsoleBusy(true);
    try {
      const res = await fetch('/api/hosting/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          userId,
          domain,
          username,
          consoleType: 'jailed_ssh',
          commandOrQuery: commandToRun,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSshHistory((prev) => [
          ...prev,
          {
            cmd: commandToRun,
            output: data.error || 'Command blocked by shell firewall.',
            blocked: true,
            timeMs: 1,
          },
        ]);
      } else {
        setSshHistory((prev) => [
          ...prev,
          {
            cmd: commandToRun,
            output: data.output,
            blocked: false,
            timeMs: data.executionTimeMs,
          },
        ]);
      }
      if (!cmdOverride) setSshInput('');
    } finally {
      setConsoleBusy(false);
    }
  };

  const handleRunSqlQuery = async (queryOverride?: string) => {
    const q = (queryOverride ?? sqlQuery).trim();
    if (!q) return;
    setConsoleBusy(true);
    try {
      const res = await fetch('/api/hosting/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          userId,
          domain,
          username,
          consoleType: 'sql_runner',
          commandOrQuery: q,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSqlColumns(data.columns || []);
        setSqlRows(data.rows || []);
        setSqlExecTimeMs(data.executionTimeMs || 4);
        onNotify(`SQL query returned ${data.rowCount} rows in ${data.executionTimeMs}ms.`);
      } else {
        onNotify(data.error || 'SQL query blocked.');
      }
    } finally {
      setConsoleBusy(false);
    }
  };

  const handleExportSqlResult = (format: 'json' | 'csv') => {
    if (sqlRows.length === 0) return;
    let content = '';
    let mime = 'application/json';
    let ext = 'json';

    if (format === 'json') {
      content = JSON.stringify(sqlRows, null, 2);
    } else {
      mime = 'text/csv';
      ext = 'csv';
      const header = sqlColumns.join(',');
      const lines = sqlRows.map((row) =>
        sqlColumns.map((col) => JSON.stringify(row[col] ?? '')).join(',')
      );
      content = [header, ...lines].join('\n');
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${domain}-query-export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Exported ${sqlRows.length} rows as ${ext.toUpperCase()}.`);
  };

  // ---------------------------------------------------------------------------
  // 3. GIT PR PREVIEW ENVIRONMENTS STATE
  // ---------------------------------------------------------------------------
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [newBranchName, setNewBranchName] = useState<string>('feat/one-click-checkout-v2');
  const [newPrNumber, setNewPrNumber] = useState<number>(48);
  const [isolatedDbClone, setIsolatedDbClone] = useState<boolean>(true);
  const [previewBusy, setPreviewBusy] = useState<boolean>(false);

  const loadPreviews = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/hosting/previews?serviceId=${encodeURIComponent(serviceId)}&domain=${encodeURIComponent(domain)}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.previews)) {
        setPreviews(data.previews);
      }
    } catch {
      // ignore
    }
  }, [serviceId, domain]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadPreviews();
    });
    return () => {
      cancelled = true;
    };
  }, [loadPreviews]);

  const handleCreatePreview = async () => {
    if (!newBranchName.trim()) return;
    setPreviewBusy(true);
    try {
      const res = await fetch('/api/hosting/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_preview',
          serviceId,
          userId,
          domain,
          branchName: newBranchName.trim(),
          prNumber: newPrNumber,
          isolatedDbClone,
        }),
      });
      const data = await res.json();
      if (data.success && data.preview) {
        setPreviews((prev) => [data.preview, ...prev]);
        setNewPrNumber((n) => n + 1);
        onNotify(data.message);
      }
    } finally {
      setPreviewBusy(false);
    }
  };

  const handlePromotePreviewToProd = (preview: PreviewItem) => {
    onRequireSudo(
      `Promote PR #${preview.pr_number} (${preview.branch_name}) to Live Production (${domain})`,
      async () => {
        setPreviewBusy(true);
        try {
          const res = await fetch('/api/hosting/previews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'promote_to_prod',
              serviceId,
              userId,
              domain,
              previewId: preview.id,
              branchName: preview.branch_name,
              commitSha: preview.commit_sha,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setPreviews((prev) =>
              prev.map((p) => (p.id === preview.id ? { ...p, status: 'promoted_to_prod' } : p))
            );
            onNotify(data.message);
          }
        } finally {
          setPreviewBusy(false);
        }
      }
    );
  };

  // ---------------------------------------------------------------------------
  // 4. BUSINESS EMAIL SUITE & DELIVERABILITY DOCTOR STATE
  // ---------------------------------------------------------------------------
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [deliverability, setDeliverability] = useState<DeliverabilityHealth | null>(null);
  const [newMailboxLocal, setNewMailboxLocal] = useState<string>('sales');
  const [newMailboxQuotaMb, setNewMailboxQuotaMb] = useState<number>(2048);
  const [newMailboxForward, setNewMailboxForward] = useState<string>('');
  const [newMailboxAutoresponder, setNewMailboxAutoresponder] = useState<boolean>(false);
  const [emailBusy, setEmailBusy] = useState<boolean>(false);
  const [activeWebmailSessionUrl, setActiveWebmailSessionUrl] = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/hosting/email?serviceId=${encodeURIComponent(serviceId)}&domain=${encodeURIComponent(domain)}`
      );
      const data = await res.json();
      if (data.success) {
        setMailboxes(data.mailboxes || []);
        setDeliverability(data.deliverability || null);
      }
    } catch {
      // ignore
    }
  }, [serviceId, domain]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadEmails();
    });
    return () => {
      cancelled = true;
    };
  }, [loadEmails]);

  const handleCreateMailbox = async () => {
    if (!newMailboxLocal.trim()) return;
    setEmailBusy(true);
    try {
      const res = await fetch('/api/hosting/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_mailbox',
          serviceId,
          userId,
          domain,
          localPart: newMailboxLocal.trim(),
          quotaMb: newMailboxQuotaMb,
          forwardToEmail: newMailboxForward.trim() || null,
          autoresponderEnabled: newMailboxAutoresponder,
          autoresponderSubject: `Thank you for contacting ${domain}`,
          autoresponderBody: `We have received your email and will respond shortly.`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onNotify(data.error || 'Failed to provision mailbox.');
        return;
      }
      if (data.mailbox) {
        setMailboxes((prev) => [...prev, data.mailbox]);
        setNewMailboxLocal('');
        setNewMailboxForward('');
        onNotify(data.message);
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleFixDeliverabilityDns = async () => {
    setEmailBusy(true);
    try {
      const res = await fetch('/api/hosting/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fix_deliverability_dns',
          serviceId,
          userId,
          domain,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onNotify(data.error || 'Failed to apply deliverability DNS records.');
        return;
      }
      setDeliverability(data.deliverability);
      onNotify(data.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const handleLaunchWebmailSso = async (emailAddress: string) => {
    const res = await fetch('/api/hosting/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'webmail_sso',
        serviceId,
        domain,
        emailAddress,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      onNotify(data.error || 'Webmail SSO session unavailable.');
      return;
    }
    setActiveWebmailSessionUrl(data.ssoUrl);
    onNotify(data.message);
  };

  // ---------------------------------------------------------------------------
  // 5. SMART RESOURCE AUTO-SCALER & PROJECT EDGE WAF STATE
  // ---------------------------------------------------------------------------
  const [autoscaleEnabled, setAutoscaleEnabled] = useState<boolean>(true);
  const [ramThresholdPercent, setRamThresholdPercent] = useState<number>(85);
  const [maxBudgetCapBdt, setMaxBudgetCapBdt] = useState<number>(1200);
  const [edgeWafMode, setEdgeWafMode] = useState<
    'standard' | 'under_attack_js_challenge' | 'bot_fight_strict'
  >('standard');
  const [rateLimitReqPerMin, setRateLimitReqPerMin] = useState<number>(300);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [proRataPreview, setProRataPreview] = useState<ProRataPreview | null>(null);
  const [autoscaleTelemetry, setAutoscaleTelemetry] = useState<string[]>([]);
  const [autoscaleBusy, setAutoscaleBusy] = useState<boolean>(false);

  const loadAutoscaler = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/hosting/autoscaler?serviceId=${encodeURIComponent(serviceId)}&maxBudgetCapBDT=${maxBudgetCapBdt}&walletBalanceBDT=${walletBalanceBDT}`
      );
      const data = await res.json();
      if (data.success) {
        if (data.rules) {
          setAutoscaleEnabled(Boolean(data.rules.autoscale_enabled));
          setRamThresholdPercent(data.rules.ram_threshold_percent || 85);
          setMaxBudgetCapBdt(Number(data.rules.max_monthly_budget_cap_bdt) || 1200);
          setEdgeWafMode(data.rules.edge_waf_mode || 'standard');
          setRateLimitReqPerMin(data.rules.rate_limit_req_per_min || 300);
          setBlockedCountries(data.rules.blocked_countries || []);
        }
        if (data.proRataPreview) {
          setProRataPreview(data.proRataPreview);
        }
      }
    } catch {
      // ignore
    }
  }, [serviceId, maxBudgetCapBdt, walletBalanceBDT]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadAutoscaler();
    });
    return () => {
      cancelled = true;
    };
  }, [loadAutoscaler]);

  const handleSaveAutoscalerRules = async () => {
    setAutoscaleBusy(true);
    try {
      const res = await fetch('/api/hosting/autoscaler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_rules',
          serviceId,
          userId,
          domain,
          autoscaleEnabled,
          ramThresholdPercent,
          maxMonthlyBudgetCapBdt: maxBudgetCapBdt,
          edgeWafMode,
          blockedCountries,
          rateLimitReqPerMin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onNotify(data.message);
      }
    } finally {
      setAutoscaleBusy(false);
    }
  };

  const handleSimulateSpikeAutoscale = async () => {
    setAutoscaleBusy(true);
    setAutoscaleTelemetry([]);
    try {
      const res = await fetch('/api/hosting/autoscaler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_spike_autoscale',
          serviceId,
          userId,
          domain,
          ramThresholdPercent,
          maxMonthlyBudgetCapBdt: maxBudgetCapBdt,
          rateLimitReqPerMin,
          currentPlanMonthlyBDT: 499,
          targetPlanMonthlyBDT: 999,
          remainingDaysInCycle: 18,
          walletBalanceBDT,
        }),
      });
      const data = await res.json();
      if (data.proRata) {
        setProRataPreview(data.proRata);
      }
      if (data.success) {
        setAutoscaleTelemetry(data.telemetrySteps || []);
        onNotify(data.message);
      } else {
        setAutoscaleTelemetry([data.error || 'Auto-scale blocked by customer budget cap.']);
        onNotify(data.error || 'Auto-scale paused by budget guard.');
      }
    } finally {
      setAutoscaleBusy(false);
    }
  };

  const toggleCountryBlock = (code: string) => {
    setBlockedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const lineCount = Math.max(1, editorContent.split('\n').length);

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar for the 5 Cloud Workspace Expansion modules */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-slate-900/80 border border-slate-800">
        {[
          {
            id: 'files' as const,
            label: 'Cloud File Manager & IDE',
            icon: FolderCode,
            badge: `${files.length} files`,
          },
          {
            id: 'terminal_sql' as const,
            label: 'Web SSH & SQL Query Lab',
            icon: Terminal,
            badge: 'CageFS + SQL',
          },
          {
            id: 'previews' as const,
            label: 'Git PR Preview Deployments',
            icon: GitPullRequest,
            badge: `${previews.length} PRs`,
          },
          {
            id: 'email' as const,
            label: 'Business Email & DKIM Doctor',
            icon: Mail,
            badge: deliverability?.mailTesterScore || '10/10',
          },
          {
            id: 'autoscaler' as const,
            label: 'Smart Auto-Scaler & Edge WAF',
            icon: Zap,
            badge: autoscaleEnabled ? 'Armed' : 'Manual',
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  isActive ? 'bg-blue-500/40 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: IN-PORTAL CLOUD FILE MANAGER & SYNTAX CODE EDITOR              */}
      {/* ===================================================================== */}
      {activeSubTab === 'files' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800 bg-slate-950/40">
            <DirectUploadDeployPanel
              serviceId={serviceId}
              domain={domain}
              compact
              onDeployed={() => {
                void loadFiles();
              }}
              onNotify={onNotify}
            />
          </div>
          <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FolderCode className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  In-Portal Cloud File Studio & Syntax Code Editor
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Path Traversal Sandbox Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Directly edit <code className="text-slate-200">/public_html</code> configuration
                files, adjust octal permissions (<code className="text-slate-200">chmod</code>), and
                hot-reload Phusion Passenger without FTP.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFilePathInput}
                onChange={(e) => setNewFilePathInput(e.target.value)}
                placeholder="/public_html/config.json"
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono w-56"
              />
              <button
                onClick={handleCreateNewFile}
                disabled={fileLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                New File
              </button>
            </div>
          </div>

          {fileFeedback && (
            <div
              className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
                fileFeedback.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              }`}
            >
              {fileFeedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{fileFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
            {/* Left File Tree */}
            <div className="lg:col-span-4 border-r border-slate-800 bg-slate-950/60 p-3 space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Container Filesystem (/home/{username})</span>
                <button
                  onClick={loadFiles}
                  className="text-slate-400 hover:text-white"
                  title="Refresh files"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {files.map((file) => {
                const isSelected = file.file_path === selectedFilePath;
                return (
                  <div
                    key={file.file_path}
                    onClick={() => handleSelectFile(file)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                        : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs font-mono font-semibold truncate">
                          {file.file_path}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                        <span>{file.size_bytes} B</span>
                        <span>•</span>
                        <span className="text-amber-400">chmod {file.permissions_octal}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.file_path);
                      }}
                      className="opacity-70 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                      title="Delete file (2FA Sudo Guarded)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right Monospace Syntax Editor */}
            <div className="lg:col-span-8 flex flex-col bg-slate-950">
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {selectedFilePath}
                  </span>
                  <span className="text-[11px] text-slate-400">({lineCount} lines)</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400 font-semibold">Octal Chmod:</label>
                  <select
                    value={editorPermissions}
                    onChange={(e) => setEditorPermissions(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-amber-300"
                  >
                    <option value="0644">0644 (rw-r--r--)</option>
                    <option value="0755">0755 (rwxr-xr-x)</option>
                    <option value="0600">0600 (rw------- Secret)</option>
                  </select>

                  <button
                    onClick={handleSaveFile}
                    disabled={fileLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save & Reload Passenger
                  </button>
                </div>
              </div>

              <div className="flex flex-1 min-h-[340px] font-mono text-xs">
                <div className="select-none py-3 px-2.5 bg-slate-900/50 text-slate-600 text-right border-r border-slate-800/80">
                  {Array.from({ length: lineCount }).map((_, idx) => (
                    <div key={idx} className="leading-6">
                      {idx + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  spellCheck={false}
                  className="flex-1 p-3 bg-slate-950 text-emerald-300 font-mono text-xs leading-6 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: INTERACTIVE BROWSER JAILED SSH TERMINAL & SQL QUERY LAB        */}
      {/* ===================================================================== */}
      {activeSubTab === 'terminal_sql' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Browser Jailed SSH Web Terminal & In-Portal SQL Query Lab
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Execute CageFS sandboxed developer CLI commands or run live SQL queries with 1-click
                JSON/CSV export.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setConsoleMode('jailed_ssh')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  consoleMode === 'jailed_ssh'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Mode A: Jailed SSH Terminal
              </button>
              <button
                onClick={() => {
                  setConsoleMode('sql_runner');
                  if (sqlRows.length === 0) handleRunSqlQuery();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  consoleMode === 'sql_runner'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Mode B: SQL Query Lab
              </button>
            </div>
          </div>

          {consoleMode === 'jailed_ssh' ? (
            <div className="space-y-3">
              {/* Quick Developer CLI Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  'ls -la',
                  'npm list',
                  'npm run build',
                  'php artisan migrate --status',
                  'php artisan cache:clear',
                  'pm2 status',
                  'top',
                  'git log -n 5',
                  'help',
                ].map((quickCmd) => (
                  <button
                    key={quickCmd}
                    onClick={() => handleRunSshCommand(quickCmd)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-emerald-300 transition"
                  >
                    $ {quickCmd}
                  </button>
                ))}
              </div>

              {/* Terminal Viewport */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs space-y-3 max-h-80 overflow-y-auto">
                <div className="text-slate-400">
                  Connected to CloudLinux CageFS Sandbox ({username}@{domain}) — Shell Firewall
                  Active.
                </div>
                {sshHistory.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2 text-blue-400">
                      <span>
                        {username}@{domain}:~/public_html$
                      </span>
                      <span className="text-white font-bold">{item.cmd}</span>
                      {item.timeMs !== undefined && (
                        <span className="text-[10px] text-slate-400">({item.timeMs}ms)</span>
                      )}
                    </div>
                    <pre
                      className={`whitespace-pre-wrap pl-3 border-l-2 ${
                        item.blocked
                          ? 'border-rose-500 text-rose-400'
                          : 'border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {item.output}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Command Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunSshCommand();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs">
                  <span className="text-emerald-400 font-bold">
                    {username}@{domain}:$
                  </span>
                  <input
                    type="text"
                    value={sshInput}
                    onChange={(e) => setSshInput(e.target.value)}
                    placeholder="Type a developer command (e.g. php artisan migrate --status, npm run build)..."
                    className="flex-1 bg-transparent text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={consoleBusy}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  Execute
                </button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Schema Sidebar */}
              <div className="lg:col-span-4 rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-2.5">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Database Tables (NVMe InnoDB)</span>
                  <span className="text-[10px] text-emerald-400">UTF8MB4</span>
                </div>
                {sqlSchemas.map((tb) => (
                  <div
                    key={tb.tableName}
                    onClick={() => {
                      const q = `SELECT * FROM ${tb.tableName} LIMIT 10;`;
                      setSqlQuery(q);
                      handleRunSqlQuery(q);
                    }}
                    className="p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-blue-400">
                      <span>{tb.tableName}</span>
                      <span className="text-[10px] text-slate-400">{tb.rowCount} rows</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tb.columns.map((c) => (
                        <span
                          key={c.name}
                          className="px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono text-slate-300"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* SQL Runner & Results Grid */}
              <div className="lg:col-span-8 space-y-3">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-blue-300 focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunSqlQuery()}
                      disabled={consoleBusy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Run SQL Query
                    </button>
                    <button
                      onClick={() =>
                        handleRunSqlQuery(
                          'EXPLAIN SELECT * FROM orders WHERE status = "paid" ORDER BY created_at DESC;'
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      Run EXPLAIN Plan
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportSqlResult('json')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export JSON
                    </button>
                    <button
                      onClick={() => handleExportSqlResult('csv')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-blue-300"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Result Table */}
                {sqlColumns.length > 0 && (
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Returned {sqlRows.length} rows</span>
                      <span className="text-emerald-400 font-mono">
                        Query latency: {sqlExecTimeMs}ms (NVMe Pool)
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-300">
                          {sqlColumns.map((col) => (
                            <th key={col} className="py-2 px-3 font-bold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlRows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="border-b border-slate-900 hover:bg-slate-900/40 text-slate-200"
                          >
                            {sqlColumns.map((col) => (
                              <td key={col} className="py-2 px-3 whitespace-nowrap">
                                {String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: VERCEL-STYLE GIT PR PREVIEW ENVIRONMENTS                       */}
      {/* ===================================================================== */}
      {activeSubTab === 'previews' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Vercel-Style Git PR Preview Environments & 1-Click Production Promotion
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Every Git branch or Pull Request receives an isolated staging URL (
                <code className="text-purple-300">https://pr-42-staging.{domain}</code>) with an
                optional cloned database before you promote to live production.
              </p>
            </div>
          </div>

          {/* Create PR Preview Bar */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Git Branch Name
              </label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feat/bkash-checkout-v2"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">PR #</label>
              <input
                type="number"
                value={newPrNumber}
                onChange={(e) => setNewPrNumber(Number(e.target.value) || 42)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white"
              />
            </div>
            <div className="md:col-span-3 flex items-center gap-2 pb-2">
              <input
                id="isolated-db-toggle"
                type="checkbox"
                checked={isolatedDbClone}
                onChange={(e) => setIsolatedDbClone(e.target.checked)}
                className="rounded border-slate-700"
              />
              <label htmlFor="isolated-db-toggle" className="text-xs text-slate-300 cursor-pointer">
                Clone Isolated Staging DB
              </label>
            </div>
            <div className="md:col-span-2">
              <button
                onClick={handleCreatePreview}
                disabled={previewBusy}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Deploy PR Preview
              </button>
            </div>
          </div>

          {/* PR Preview Cards */}
          <div className="space-y-3">
            {previews.map((prev) => (
              <div
                key={prev.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold">
                      PR #{prev.pr_number ?? 42} • {prev.branch_name}
                    </span>
                    <span className="text-xs font-mono text-slate-400">#{prev.commit_sha}</span>
                    {prev.isolated_db_clone && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-semibold">
                        Isolated DB Clone
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        prev.status === 'promoted_to_prod'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {prev.status === 'promoted_to_prod'
                        ? 'Promoted to Live Prod'
                        : 'Staging Ready'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{prev.commit_message}</p>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-blue-400">
                    <Globe className="w-3.5 h-3.5" />
                    <a
                      href={prev.preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      {prev.preview_url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {prev.status !== 'promoted_to_prod' && (
                    <button
                      onClick={() => handlePromotePreviewToProd(prev)}
                      disabled={previewBusy}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Promote to Production
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: BUSINESS EMAIL SUITE & 10/10 DELIVERABILITY DOCTOR             */}
      {/* ===================================================================== */}
      {activeSubTab === 'email' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Business Email Suite, Webmail SSO & 10/10 Deliverability Doctor
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Mail-Tester Score: {deliverability?.mailTesterScore || '10/10'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Create custom <code className="text-slate-200">@{domain}</code> mailboxes, launch
                1-click passwordless Roundcube Webmail, and verify SPF, 2048-bit DKIM & DMARC.
              </p>
            </div>

            <button
              onClick={handleFixDeliverabilityDns}
              disabled={emailBusy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition"
            >
              <ShieldCheck className="w-4 h-4" />
              1-Click Verify & Inject SPF/DKIM/DMARC (10/10)
            </button>
          </div>

          {activeWebmailSessionUrl && (
            <div className="p-3.5 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between gap-3">
              <div className="text-xs text-blue-200">
                <span className="font-bold text-white">Roundcube Webmail SSO Ready:</span> Signed
                session token generated (valid for 5 minutes).
                <div className="font-mono text-[11px] text-blue-300 mt-0.5 truncate max-w-xl">
                  {activeWebmailSessionUrl}
                </div>
              </div>
              <a
                href={activeWebmailSessionUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shrink-0 flex items-center gap-1"
              >
                Open Webmail Inbox <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Create Mailbox Form */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Mailbox Address
              </label>
              <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 overflow-hidden">
                <input
                  type="text"
                  value={newMailboxLocal}
                  onChange={(e) => setNewMailboxLocal(e.target.value)}
                  placeholder="sales"
                  className="w-full px-3 py-2 bg-transparent text-xs font-mono text-white focus:outline-none"
                />
                <span className="px-2.5 text-xs font-mono text-slate-400 bg-slate-800/80 py-2">
                  @{domain}
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                NVMe Quota
              </label>
              <select
                value={newMailboxQuotaMb}
                onChange={(e) => setNewMailboxQuotaMb(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value={512}>512 MB</option>
                <option value={2048}>2 GB (2048 MB)</option>
                <option value={5120}>5 GB (5120 MB)</option>
                <option value={10240}>10 GB Max</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Auto-Forward To (Optional)
              </label>
              <input
                type="email"
                value={newMailboxForward}
                onChange={(e) => setNewMailboxForward(e.target.value)}
                placeholder="founder@gmail.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMailboxAutoresponder}
                  onChange={(e) => setNewMailboxAutoresponder(e.target.checked)}
                />
                Auto-Responder
              </label>
              <button
                onClick={handleCreateMailbox}
                disabled={emailBusy}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Create
              </button>
            </div>
          </div>

          {/* Mailbox List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mailboxes.map((mb) => (
              <div
                key={mb.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-mono font-bold text-white">{mb.email_address}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Storage: {mb.used_mb} MB / {mb.quota_mb} MB NVMe Maildir
                    </div>
                    {mb.forward_to_email && (
                      <div className="text-[11px] text-blue-400 mt-1">
                        Forwards to: {mb.forward_to_email}
                      </div>
                    )}
                    {mb.autoresponder_enabled && (
                      <div className="text-[11px] text-emerald-400 mt-0.5">
                        ✓ Vacation Auto-Responder Active
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleLaunchWebmailSso(mb.email_address)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    1-Click Webmail SSO
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Deliverability Records Table */}
          {deliverability && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2">
              <div className="text-xs font-bold text-slate-300">
                Authenticated Email Deliverability DNS Records (SPF, 2048-Bit DKIM & Strict DMARC)
              </div>
              <div className="space-y-1.5">
                {deliverability.records.map((rec, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900/80 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                        {rec.type}
                      </span>
                      <span className="text-amber-300">{rec.name}</span>
                      <span className="text-slate-400 truncate max-w-md">{rec.content}</span>
                    </div>
                    <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: SMART RESOURCE AUTO-SCALER & PROJECT EDGE WAF SHIELD           */}
      {/* ===================================================================== */}
      {activeSubTab === 'autoscaler' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Autonomous Resource Auto-Scaler & Per-Project Edge WAF Shield
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Profit-Protected Pro-Rata Math
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Prevent HTTP 503 crashes during viral traffic spikes by automatically expanding
                container DDR5 RAM & vCPU within your strict monthly budget cap.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateSpikeAutoscale}
                disabled={autoscaleBusy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition shadow-lg shadow-amber-500/20"
              >
                <Sparkles className="w-4 h-4" />
                Simulate Viral Traffic Spike & Test Auto-Scaler
              </button>
              <button
                onClick={handleSaveAutoscalerRules}
                disabled={autoscaleBusy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition"
              >
                <Save className="w-3.5 h-3.5" />
                Save Policy
              </button>
            </div>
          </div>

          {autoscaleTelemetry.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5 font-mono text-xs">
              <div className="text-amber-300 font-bold">
                Autonomous Auto-Scaler Execution Ledger:
              </div>
              {autoscaleTelemetry.map((line, idx) => (
                <div key={idx} className="text-emerald-300">
                  {line}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Auto-Scaler & Pro-Rata Budget Guard */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">
                    Zero-Downtime LVE Container Auto-Scaler
                  </div>
                  <div className="text-xs text-slate-400">
                    Hot-scales DDR5 RAM from 2048 MB to 4096 MB when memory exceeds threshold
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoscaleEnabled}
                  onChange={(e) => setAutoscaleEnabled(e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    RAM Trigger Threshold (%)
                  </label>
                  <input
                    type="number"
                    min={65}
                    max={95}
                    value={ramThresholdPercent}
                    onChange={(e) => setRamThresholdPercent(Number(e.target.value) || 85)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Max Monthly Budget Cap (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min={499}
                    max={5000}
                    value={maxBudgetCapBdt}
                    onChange={(e) => setMaxBudgetCapBdt(Number(e.target.value) || 999)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300"
                  />
                </div>
              </div>

              {proRataPreview && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                  <div className="font-bold text-slate-200 flex items-center justify-between">
                    <span>Pro-Rata Upgrade Calculation (18 Days Remaining)</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        proRataPreview.isWithinBudgetCap
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {proRataPreview.isWithinBudgetCap
                        ? 'Within Budget Cap'
                        : 'Exceeds Budget Cap'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Current Plan (DevPro 2GB):</span>
                    <span className="font-mono text-white">
                      ৳{proRataPreview.currentPlanMonthlyBDT}/mo
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Target Burst Tier (Business Max 4GB):</span>
                    <span className="font-mono text-white">
                      ৳{proRataPreview.targetPlanMonthlyBDT}/mo
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300 font-bold pt-1 border-t border-slate-800">
                    <span>Exact Pro-Rata Charge Today:</span>
                    <span className="font-mono text-amber-300">
                      ৳{proRataPreview.proRataChargeBDT} BDT
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Per-Project Edge WAF & Geo-Block Shield */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  Per-Project Cloudflare / LiteSpeed Edge WAF Mode
                </div>
                <div className="text-xs text-slate-400">
                  Mitigate Layer-7 DDoS floods, credential stuffing, and scraper bots at the edge
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'standard' as const, label: 'Standard WAF' },
                  { id: 'under_attack_js_challenge' as const, label: 'Under Attack (JS)' },
                  { id: 'bot_fight_strict' as const, label: 'Strict Bot Fight' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setEdgeWafMode(m.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      edgeWafMode === m.id
                        ? 'bg-blue-600/25 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Per-IP Edge Rate Limit (Requests / Minute)
                </label>
                <input
                  type="number"
                  value={rateLimitReqPerMin}
                  onChange={(e) => setRateLimitReqPerMin(Number(e.target.value) || 300)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  Geo-IP Country Firewall Blocklist
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: 'CN', name: 'China (CN)' },
                    { code: 'RU', name: 'Russia (RU)' },
                    { code: 'KP', name: 'North Korea (KP)' },
                    { code: 'IR', name: 'Iran (IR)' },
                    { code: 'VN', name: 'Vietnam Botnet (VN)' },
                  ].map((c) => {
                    const blocked = blockedCountries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        onClick={() => toggleCountryBlock(c.code)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          blocked
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {blocked ? `Blocked: ${c.name}` : c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
