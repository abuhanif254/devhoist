'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Shield,
  Sparkles,
  Server,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Cpu,
  FileCode,
} from 'lucide-react';

export interface AddonDomainItem {
  id: string;
  service_id: string;
  domain_type: 'addon_domain' | 'subdomain' | 'parked_alias' | 'staging_clone';
  hostname: string;
  document_root: string;
  runtime_engine: string;
  ssl_status: 'active_tls13' | 'provisioning' | 'expired';
  force_https: boolean;
  created_at?: string;
}

interface HostingAddonManagerProps {
  serviceId: string;
  serviceDomain: string;
  cpanelUsername: string;
}

export default function HostingAddonManager({
  serviceId,
  serviceDomain,
  cpanelUsername,
}: HostingAddonManagerProps) {
  const [domains, setDomains] = useState<AddonDomainItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState({
    addonCount: 1,
    maxAddons: 4,
    planName: 'Developer Cloud Pro',
    isQuotaExceeded: false,
  });

  // Form State
  const [domainType, setDomainType] = useState<AddonDomainItem['domain_type']>('addon_domain');
  const [subPrefix, setSubPrefix] = useState('');
  const [addonHostname, setAddonHostname] = useState('');
  const [documentRoot, setDocumentRoot] = useState('');
  const [runtimeEngine, setRuntimeEngine] = useState('Node.js 22 LTS');
  const [forceHttps, setForceHttps] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch live domains and quota
  const fetchDomains = async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hosting/domains?serviceId=${encodeURIComponent(serviceId)}`);
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.domains)) setDomains(data.domains);
        if (data.quota) setQuota(data.quota);
      }
    } catch (err) {
      console.warn('Failed to fetch hosting domains, using local state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [serviceId]);

  // Update default document root on hostname change
  useEffect(() => {
    const host = domainType === 'subdomain' ? `${subPrefix}.${serviceDomain}` : addonHostname;
    if (host && !host.includes('..')) {
      setDocumentRoot(`/home/${cpanelUsername || 'user'}/public_html/${host.trim()}`);
    }
  }, [domainType, subPrefix, addonHostname, serviceDomain, cpanelUsername]);

  // Add Domain Handler
  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const targetHost =
      domainType === 'subdomain'
        ? `${subPrefix.trim().toLowerCase()}.${serviceDomain}`
        : addonHostname.trim().toLowerCase();

    if (!targetHost || targetHost.length < 3) {
      setFormError('Please specify a valid hostname or subdomain prefix.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/hosting/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          domainType,
          hostname: targetHost,
          documentRoot: documentRoot.trim(),
          runtimeEngine,
          forceHttps,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to map domain to container.');
      }

      setToast(data.message || `Domain ${targetHost} provisioned!`);
      setTimeout(() => setToast(null), 3500);

      // Refresh list
      setSubPrefix('');
      setAddonHostname('');
      await fetchDomains();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Domain Handler
  const handleDelete = async (id: string, host: string) => {
    if (!confirm(`Are you sure you want to remove ${host} from this container? Virtual host routes will be deleted.`)) return;

    try {
      await fetch(`/api/hosting/domains?id=${encodeURIComponent(id)}&serviceId=${encodeURIComponent(serviceId)}`, {
        method: 'DELETE',
      });
      setDomains((prev) => prev.filter((d) => d.id !== id));
      setToast(`Domain ${host} removed.`);
      setTimeout(() => setToast(null), 3000);
      fetchDomains();
    } catch {
      setDomains((prev) => prev.filter((d) => d.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 shadow-lg animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Quota Progress Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <strong className="text-slate-900 dark:text-white text-sm">
                Addon Domain Quota &amp; Multi-Tenant Routing
              </strong>
            </div>
            <p className="text-slate-500 mt-0.5">
              Current Plan: <span className="font-bold text-blue-600">{quota.planName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              Used: <strong>{quota.addonCount}</strong> / {quota.maxAddons} Addon Domains
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                quota.addonCount >= quota.maxAddons
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {quota.addonCount >= quota.maxAddons ? 'Quota Limit Reached' : 'Slots Available'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              quota.addonCount >= quota.maxAddons ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(100, (quota.addonCount / (quota.maxAddons || 1)) * 100)}%` }}
          />
        </div>

        {quota.addonCount >= quota.maxAddons && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs">
            <span>You have reached the maximum addon domains for your plan. Need to host more websites?</span>
            <button
              type="button"
              onClick={() => alert('Redirecting to upgrade checkout...')}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
            >
              Upgrade Plan
            </button>
          </div>
        )}
      </div>

      {/* Create Addon Domain / Subdomain Form */}
      <form
        onSubmit={handleCreateDomain}
        className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 font-mono text-xs"
      >
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" />
          <span>Provision New Addon Domain, Subdomain or Staging Sandbox</span>
        </h4>

        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-500">Domain Mapping Type:</label>
            <select
              value={domainType}
              onChange={(e) => setDomainType(e.target.value as any)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value="addon_domain">Addon Domain (Separate Website)</option>
              <option value="subdomain">Subdomain (*.{serviceDomain})</option>
              <option value="parked_alias">Parked Alias (Mirrors Primary Site)</option>
              <option value="staging_clone">Staging Sandbox Clone</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-500">
              {domainType === 'subdomain'
                ? `Subdomain Prefix (e.g. "api"):`
                : 'Fully Qualified Domain Name (FQDN):'}
            </label>
            {domainType === 'subdomain' ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={subPrefix}
                  onChange={(e) => setSubPrefix(e.target.value)}
                  placeholder="api"
                  required
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
                <span className="text-slate-500">.{serviceDomain}</span>
              </div>
            ) : (
              <input
                type="text"
                value={addonHostname}
                onChange={(e) => setAddonHostname(e.target.value)}
                placeholder="e.g. mysecondstore.com"
                required
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-500">Virtual Host Document Root:</label>
            <input
              type="text"
              value={documentRoot}
              onChange={(e) => setDocumentRoot(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500">Runtime Engine &amp; Container Handler:</label>
            <select
              value={runtimeEngine}
              onChange={(e) => setRuntimeEngine(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value="Node.js 22 LTS">Node.js 22 LTS (Phusion Passenger)</option>
              <option value="PHP 8.3 (LiteSpeed)">PHP 8.3 (LiteSpeed LSAPI + OPcache)</option>
              <option value="Python 3.12">Python 3.12 (WSGI / FastAPI)</option>
              <option value="Static HTML">Static HTML / React SSG</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={forceHttps}
              onChange={(e) => setForceHttps(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Force HTTPS (301 Auto-Redirect to SSL)</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-md shadow-blue-600/20"
          >
            {isSubmitting ? 'Provisioning...' : 'Provision Domain & Issue AutoSSL'}
          </button>
        </div>
      </form>

      {/* Mapped Domains Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden font-mono text-xs">
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 dark:text-white">
            Active Domains &amp; Virtual Hosts on this Container
          </h4>
          <span className="text-[11px] text-slate-400">Total: {domains.length} mapped</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {domains.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No addon domains or subdomains configured yet.
            </div>
          ) : (
            domains.map((dom) => (
              <div
                key={dom.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <strong className="text-slate-900 dark:text-white text-sm">
                      {dom.hostname}
                    </strong>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dom.domain_type === 'addon_domain'
                          ? 'bg-blue-50 text-blue-700'
                          : dom.domain_type === 'staging_clone'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {dom.domain_type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    DocRoot: {dom.document_root} • Runtime: {dom.runtime_engine}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-500/20">
                    <Shield className="w-3 h-3" />
                    <span>AutoSSL TLS 1.3 Active</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDelete(dom.id, dom.hostname)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
