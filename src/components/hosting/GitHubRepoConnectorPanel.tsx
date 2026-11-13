'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderGit2,
  GitBranch,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Unlink,
} from 'lucide-react';

interface RepoSummary {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
}

interface BranchSummary {
  name: string;
  protected: boolean;
}

interface GitConnectionClient {
  id: string;
  serviceId: string;
  repoFullName: string;
  repoHtmlUrl: string;
  defaultBranch: string;
  selectedBranch: string;
  isPrivate: boolean;
  autoDeployOnPush: boolean;
  prPreviewsEnabled: boolean;
  webhookId: number | null;
  webhookUrl: string | null;
  webhookConfigured: boolean;
  lastCommitSha: string | null;
  lastSyncedAt: string | null;
}

interface GitHubRepoConnectorPanelProps {
  serviceId: string;
  onNotify?: (message: string) => void;
  onConnectionUpdated?: () => void;
}

export function GitHubRepoConnectorPanel({
  serviceId,
  onNotify,
  onConnectionUpdated,
}: GitHubRepoConnectorPanelProps) {
  const [loading, setLoading] = useState(true);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [accountLogin, setAccountLogin] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [connection, setConnection] = useState<GitConnectionClient | null>(null);

  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [autoDeployOnPush, setAutoDeployOnPush] = useState(true);
  const [prPreviewsEnabled, setPrPreviewsEnabled] = useState(true);

  const [busyAction, setBusyAction] = useState<'connect' | 'branches' | 'bind' | 'unbind' | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchBranches = useCallback(
    async (repoFullName: string, fallbackBranch = 'main') => {
      if (!repoFullName) {
        setBranches([]);
        return;
      }
      setBusyAction('branches');
      try {
        const res = await fetch(
          `/api/integrations/github/repos?serviceId=${encodeURIComponent(
            serviceId
          )}&repo=${encodeURIComponent(repoFullName)}`
        );
        const data = await res.json();
        if (res.ok && Array.isArray(data.branches)) {
          setBranches(data.branches as BranchSummary[]);
          if (data.branches.length > 0) {
            const exists = (data.branches as BranchSummary[]).some((b) => b.name === fallbackBranch);
            setSelectedBranch(exists ? fallbackBranch : data.branches[0].name);
          } else {
            setSelectedBranch(fallbackBranch);
          }
        }
      } catch {
        setBranches([]);
      } finally {
        setBusyAction(null);
      }
    },
    [serviceId]
  );

  const loadGitState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/integrations/github/repos?serviceId=${encodeURIComponent(serviceId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to fetch GitHub connection status.');
        return;
      }

      setOauthConfigured(Boolean(data.oauthConfigured));
      setConnected(Boolean(data.connected));
      setAccountLogin(data.account?.githubLogin ? String(data.account.githubLogin) : null);

      const repoList = Array.isArray(data.repos) ? (data.repos as RepoSummary[]) : [];
      setRepos(repoList);

      const conn = (data.connection as GitConnectionClient | null) || null;
      setConnection(conn);

      if (conn) {
        setSelectedRepo(conn.repoFullName);
        setSelectedBranch(conn.selectedBranch);
        setAutoDeployOnPush(conn.autoDeployOnPush);
        setPrPreviewsEnabled(conn.prPreviewsEnabled);
        if (Array.isArray(data.branches)) {
          setBranches(data.branches as BranchSummary[]);
        }
      } else if (repoList.length > 0) {
        setSelectedRepo((prev) => prev || repoList[0].fullName);
        setSelectedBranch((prev) => prev || repoList[0].defaultBranch || 'main');
      }
    } catch {
      setErrorMsg('Failed to contact GitHub integration endpoint.');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        void loadGitState();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadGitState]);

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repoSearch, repos]);

  const handleConnectOAuth = async () => {
    setBusyAction('connect');
    setErrorMsg(null);
    try {
      const returnTo =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/dashboard';
      const res = await fetch(
        `/api/integrations/github/connect?serviceId=${encodeURIComponent(
          serviceId
        )}&returnTo=${encodeURIComponent(returnTo)}`
      );
      const data = await res.json();
      if (!res.ok || !data.authorizeUrl) {
        setErrorMsg(data.message || data.error || 'GitHub OAuth is not available.');
        setBusyAction(null);
        return;
      }
      window.location.assign(String(data.authorizeUrl));
    } catch {
      setErrorMsg('Failed to initiate GitHub OAuth sign-in.');
      setBusyAction(null);
    }
  };

  const handleSelectRepo = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    const matched = repos.find((r) => r.fullName === repoFullName);
    await fetchBranches(repoFullName, matched?.defaultBranch || 'main');
  };

  const handleBindRepository = async () => {
    if (!selectedRepo) {
      setErrorMsg('Select a repository before binding.');
      return;
    }
    setBusyAction('bind');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/integrations/github/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          repoFullName: selectedRepo,
          branch: selectedBranch,
          autoDeployOnPush,
          prPreviewsEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || data.message || 'Repository binding failed.');
        return;
      }
      setConnection(data.connection as GitConnectionClient);
      onNotify?.(
        data.message || `Repository ${selectedRepo} bound with automatic push & PR webhook.`
      );
      onConnectionUpdated?.();
      await loadGitState();
    } catch {
      setErrorMsg('Network failure while binding repository.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnbindRepository = async () => {
    setBusyAction('unbind');
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/integrations/github/bind?serviceId=${encodeURIComponent(serviceId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to unbind repository.');
        return;
      }
      setConnection(null);
      onNotify?.('GitHub repository & webhook removed cleanly.');
      onConnectionUpdated?.();
    } catch {
      setErrorMsg('Network failure while unbinding repository.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <FolderGit2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>GitHub OAuth CI/CD &amp; PR Previews</span>
              {connection && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Webhook Active
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500">
              {connected && accountLogin
                ? `Connected as @${accountLogin} — private repos use encrypted GIT_ASKPASS tokens`
                : 'Connect GitHub once to auto-install push & PR preview webhooks on your repositories.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <button
              type="button"
              onClick={() => void loadGitState()}
              disabled={loading || busyAction !== null}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleConnectOAuth()}
            disabled={busyAction === 'connect'}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {busyAction === 'connect' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderGit2 className="w-3.5 h-3.5" />
            )}
            <span>{connected ? 'Reconnect GitHub' : 'Connect GitHub'}</span>
          </button>
        </div>
      </div>

      {!oauthConfigured && !connected && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
          OAuth credentials (`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`) are not set on the server yet. Manual Git repository URL &amp; webhook verification remain usable below.
        </div>
      )}

      {errorMsg && (
        <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading GitHub repositories...</span>
        </div>
      ) : connected ? (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Filter Repositories
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  placeholder="owner/repo..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Repository
              </label>
              <select
                value={selectedRepo}
                onChange={(e) => void handleSelectRepo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
              >
                {filteredRepos.length === 0 ? (
                  <option value="">No repositories match filter</option>
                ) : (
                  filteredRepos.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName} {repo.private ? '(private)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Production Branch
              </label>
              {branches.length > 0 ? (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs font-mono"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-zinc-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDeployOnPush}
                  onChange={(e) => setAutoDeployOnPush(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Auto-deploy pushes</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prPreviewsEnabled}
                  onChange={(e) => setPrPreviewsEnabled(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Ephemeral PR Previews</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              {connection && (
                <button
                  type="button"
                  onClick={() => void handleUnbindRepository()}
                  disabled={busyAction === 'unbind'}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Unbind</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleBindRepository()}
                disabled={busyAction === 'bind' || !selectedRepo}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
              >
                {busyAction === 'bind' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                <span>{connection ? 'Update Repo Binding' : 'Bind & Install Webhook'}</span>
              </button>
            </div>
          </div>

          {connection && (
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-white/5 text-[11px] font-mono text-slate-600 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2">
              <span>
                Bound: <strong className="text-slate-900 dark:text-white">{connection.repoFullName}</strong> ({connection.selectedBranch})
              </span>
              <span>
                Webhook #{connection.webhookId ?? 'manual'}
                {connection.lastCommitSha ? ` • SHA ${connection.lastCommitSha.slice(0, 7)}` : ''}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
