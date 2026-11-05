'use client';

import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal } from 'lucide-react';

export default function ConfigCopyHub() {
  const [activeSnippet, setActiveSnippet] = useState<'workflow' | 'cpanel'>('workflow');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const workflowCode = `name: Build & Deploy to Global cPanel NVMe Cloud

on:
  push:
    branches: [ "main" ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 1. Checkout Repository
        uses: actions/checkout@v4

      - name: 2. Setup Node.js 20 Runtime on GitHub Runner (Zero Server RAM Used)
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: 3. Install Dependencies & Build Production Bundle
        run: |
          npm ci
          npm run build

      - name: 4. Sync Production Artifacts via SSH Overwrite (3-Release Retention)
        uses: appleboy/scp-action@v0.1.7
        with:
          host: \${{ secrets.CPANEL_HOST }}
          username: \${{ secrets.CPANEL_USER }}
          key: \${{ secrets.CPANEL_SSH_KEY }}
          port: \${{ secrets.CPANEL_SSH_PORT }}
          source: ".next/,public/,package.json,package-lock.json"
          target: "~/apps/my-app-current"
          overwrite: true

      - name: 5. Install Production-Only Deps & Restart CloudLinux Passenger
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.CPANEL_HOST }}
          username: \${{ secrets.CPANEL_USER }}
          key: \${{ secrets.CPANEL_SSH_KEY }}
          port: \${{ secrets.CPANEL_SSH_PORT }}
          script: |
            cd ~/apps/my-app-current
            npm install --omit=dev --ignore-scripts
            mkdir -p tmp
            touch tmp/restart.txt
`;

  const cpanelYamlCode = `---
# CloudLinux cPanel Git Deployment Manifest
# Place in root as .cpanel.yml
deployment:
  tasks:
    - export DEPLOYPATH=/home/username/public_html/api
    - /bin/cp -R app.js package.json \${DEPLOYPATH}
    - cd \${DEPLOYPATH}
    - /bin/npm install --production --ignore-scripts
    - /bin/touch \${DEPLOYPATH}/tmp/restart.txt
`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToastMessage(`Copied ${label} to clipboard!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full relative transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-zinc-900 border border-slate-700 dark:border-white/20 text-white text-xs font-mono shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {/* Hub Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-white/[0.08] gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSnippet('workflow')}
              className={`flex items-center gap-2 h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
                activeSnippet === 'workflow'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>.github/workflows/deploy.yml</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSnippet('cpanel')}
              className={`flex items-center gap-2 h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
                activeSnippet === 'cpanel'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>.cpanel.yml</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                activeSnippet === 'workflow' ? workflowCode : cpanelYamlCode,
                activeSnippet === 'workflow' ? 'deploy.yml' : '.cpanel.yml'
              )
            }
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-md bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-semibold text-xs shadow-xs transition-all whitespace-nowrap cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Snippet</span>
          </button>
        </div>

        {/* Code Content Box */}
        <div className="p-4 sm:p-6 font-mono text-xs text-slate-800 dark:text-zinc-300 bg-slate-900 dark:bg-zinc-950 overflow-x-auto leading-relaxed">
          <pre className="text-slate-200">
            {activeSnippet === 'workflow' ? workflowCode : cpanelYamlCode}
          </pre>
        </div>

        {/* Helper Note */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-900/40 border-t border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-zinc-400 flex items-center justify-between font-mono">
          <span>
            {activeSnippet === 'workflow'
              ? 'GitHub Actions auto-triggers on git push origin main and updates cPanel in ~2.8s.'
              : 'Direct cPanel Version Control YAML for webhooks without external GitHub Actions.'}
          </span>
          <span className="text-slate-400 dark:text-zinc-500 hidden md:inline">UTF-8 • UNIX line endings</span>
        </div>
      </div>
    </div>
  );
}
