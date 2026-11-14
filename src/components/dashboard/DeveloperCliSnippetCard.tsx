'use client';

import React, { useState } from 'react';
import { Terminal, Copy, Check, Sparkles, Code2, Globe, Zap, ArrowRight } from 'lucide-react';
import { buildPortalUrl } from '@/lib/siteUrl';

interface DeveloperCliSnippetCardProps {
  apiToken?: string;
  domain?: string;
  serviceId?: string;
}

export default function DeveloperCliSnippetCard({
  apiToken = 'dh_live_948a2bc7190e21a',
  domain = 'ecommerce-live.com',
  serviceId = 'srv_production_sg1',
}: DeveloperCliSnippetCardProps) {
  const [selectedAction, setSelectedAction] = useState<'deploy' | 'cache_purge' | 'dns'>('deploy');
  const [shellType, setShellType] = useState<'bash' | 'powershell'>('bash');
  const [copied, setCopied] = useState(false);

  const deployEndpoint = buildPortalUrl('/api/v1/deploy');
  let snippet = '';

  if (shellType === 'bash') {
    if (selectedAction === 'deploy') {
      snippet = `curl -X POST ${deployEndpoint} \\
  -H "Authorization: Bearer ${apiToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "deploy", "domain": "${domain}", "branch": "main"}'`;
    } else if (selectedAction === 'cache_purge') {
      snippet = `curl -X POST ${deployEndpoint} \\
  -H "Authorization: Bearer ${apiToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "cache_purge", "domain": "${domain}"}'`;
    } else {
      snippet = `curl -X POST ${deployEndpoint} \\
  -H "Authorization: Bearer ${apiToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "dns_record", "domain": "${domain}", "recordType": "A", "recordName": "api", "recordContent": "103.151.102.45"}'`;
    }
  } else {
    // PowerShell
    if (selectedAction === 'deploy') {
      snippet = `Invoke-RestMethod -Uri "${deployEndpoint}" -Method Post -Headers @{ Authorization = "Bearer ${apiToken}"; "Content-Type" = "application/json" } -Body '{"action":"deploy","domain":"${domain}","branch":"main"}'`;
    } else if (selectedAction === 'cache_purge') {
      snippet = `Invoke-RestMethod -Uri "${deployEndpoint}" -Method Post -Headers @{ Authorization = "Bearer ${apiToken}"; "Content-Type" = "application/json" } -Body '{"action":"cache_purge","domain":"${domain}"}'`;
    } else {
      snippet = `Invoke-RestMethod -Uri "${deployEndpoint}" -Method Post -Headers @{ Authorization = "Bearer ${apiToken}"; "Content-Type" = "application/json" } -Body '{"action":"dns_record","domain":"${domain}","recordType":"A","recordName":"api","recordContent":"103.151.102.45"}'`;
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>Public REST API v1 &amp; Terminal CLI Studio</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                30 req/min
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Trigger instant production deployments or cache flushes directly from VS Code terminal
            </p>
          </div>
        </div>

        {/* Shell Type Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setShellType('bash')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              shellType === 'bash'
                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            cURL / Bash
          </button>
          <button
            type="button"
            onClick={() => setShellType('powershell')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              shellType === 'powershell'
                ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            PowerShell
          </button>
        </div>
      </div>

      {/* Action Selector Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedAction('deploy')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            selectedAction === 'deploy'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>1. Trigger Git Deployment</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedAction('cache_purge')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            selectedAction === 'cache_purge'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>2. Flush LiteSpeed Cache</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedAction('dns')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            selectedAction === 'dns'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>3. Upsert DNS Record</span>
        </button>
      </div>

      {/* Terminal Code Snippet Box */}
      <div className="relative rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800 shadow-inner group">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-700"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
        <pre className="pr-16 leading-relaxed whitespace-pre-wrap">{snippet}</pre>
      </div>
    </div>
  );
}
