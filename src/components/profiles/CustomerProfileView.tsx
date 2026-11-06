'use client';

import React, { useState } from 'react';
import {
  User,
  Building,
  Key,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Laptop,
  Globe,
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  Lock,
  ExternalLink,
  X,
} from 'lucide-react';
import { usePortal } from '@/context/PortalContext';
import { useSudoGate } from '@/components/security/SudoGateModal';
import { sha256Hex } from '@/lib/totpEngine';

export default function CustomerProfileView() {
  const {
    currentUser,
    teamMembers,
    apiTokens,
    generateApiToken,
    revokeApiToken,
    loginSessions,
    revokeSession,
    revokeAllOtherSessions,
  } = usePortal();

  const { requireSudo } = useSudoGate();

  const [activeTab, setActiveTab] = useState<'identity' | 'ssh' | 'api' | 'security'>('identity');
  const [saveToast, setSaveToast] = useState(false);

  // Tab A: Identity & Corporate VAT State
  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [accountType, setAccountType] = useState<'individual' | 'business_corporate' | 'software_agency'>('business_corporate');
  const [companyLegalName, setCompanyLegalName] = useState(currentUser?.company || '');
  const [taxBinNumber, setTaxBinNumber] = useState('002941849-0101');
  const [billingAddress, setBillingAddress] = useState('Level 7, Software Technology Park, Kawran Bazar');
  const [billingCity, setBillingCity] = useState('Dhaka');
  const [billingCountry, setBillingCountry] = useState('Bangladesh');
  const [emergencyBillingEmail, setEmergencyBillingEmail] = useState('finance@devhostcloud.com');
  const [whatsappAlertNumber, setWhatsappAlertNumber] = useState('+880 1712-345678');

  // Tab B: Global SSH & Defaults State
  const [defaultRegion, setDefaultRegion] = useState<'sg1' | 'us1'>('sg1');
  const [defaultNodeVersion, setDefaultNodeVersion] = useState('22');
  const [defaultPhpVersion, setDefaultPhpVersion] = useState('8.3');
  const [sshKeys, setSshKeys] = useState([
    {
      id: 'ssh_1',
      label: 'MacBook Pro M3 Max (Primary Dev)',
      type: 'ED25519',
      fingerprint: 'SHA256:4x8k19ZbQ0vLmP82K94fJ8aLmPq19',
      created: '2026-10-14',
    },
    {
      id: 'ssh_2',
      label: 'Ubuntu Office Workstation',
      type: 'RSA 4096',
      fingerprint: 'SHA256:9q2mP41xLk89ZaBc772Lmq001Za',
      created: '2026-09-02',
    },
  ]);
  const [newSshLabel, setNewSshLabel] = useState('');
  const [newSshKeyText, setNewSshKeyText] = useState('');
  const [isAddSshModalOpen, setIsAddSshModalOpen] = useState(false);

  // Tab C: Scoped API Tokens State
  const [isCreateTokenModalOpen, setIsCreateTokenModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [tokenScopes, setTokenScopes] = useState<string[]>(['services:read', 'git:deploy']);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Tab D: 2FA & Sudo State
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [is2FaWizardOpen, setIs2FaWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardSecret, setWizardSecret] = useState('');
  const [wizardQrSvg, setWizardQrSvg] = useState('');
  const [wizardVerifyCode, setWizardVerifyCode] = useState('');
  const [wizardBackupCodes, setWizardBackupCodes] = useState<string[]>([]);
  const [wizardBackupHashes, setWizardBackupHashes] = useState<string[]>([]);
  const [wizardError, setWizardError] = useState('');
  const [sudoPinInput, setSudoPinInput] = useState('');
  const [sudoPinSuccess, setSudoPinSuccess] = useState(false);

  // Handle Profile Save
  const handleSaveProfile = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  // Add SSH Key
  const handleAddSshKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSshKeyText.trim()) return;

    const trimmed = newSshKeyText.trim();
    let keyType = 'SSH Key';
    if (trimmed.startsWith('ssh-ed25519')) keyType = 'ED25519';
    else if (trimmed.startsWith('ssh-rsa')) keyType = 'RSA 4096';

    const hash = await sha256Hex(trimmed);
    const fingerprint = `SHA256:${hash.slice(0, 24)}`;

    const newKey = {
      id: `ssh_${Date.now()}`,
      label: newSshLabel || 'Personal Deployment Key',
      type: keyType,
      fingerprint,
      created: new Date().toISOString().split('T')[0],
    };

    setSshKeys((prev) => [newKey, ...prev]);
    setNewSshLabel('');
    setNewSshKeyText('');
    setIsAddSshModalOpen(false);
  };

  // Handle Token Generation
  const handleGenerateToken = () => {
    if (!newTokenName.trim()) return;
    const scopesStr = tokenScopes.join(', ');
    const fullToken = generateApiToken(newTokenName, scopesStr);
    setRevealedToken(fullToken);
  };

  // Start 2FA Setup
  const handleStart2FaSetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', email: currentUser?.email || '' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWizardSecret(data.secretBase32);
        setWizardQrSvg(data.qrCodeSvg);
        setWizardBackupCodes(data.backupCodes);
        setWizardBackupHashes(data.backupHashes);
        setWizardStep(1);
        setWizardError('');
        setIs2FaWizardOpen(true);
      }
    } catch (err: any) {
      alert('Failed to initialize 2FA setup: ' + err.message);
    }
  };

  // Confirm 2FA Activation
  const handleConfirm2FaCode = async () => {
    setWizardError('');
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          secretBase32: wizardSecret,
          token: wizardVerifyCode,
          backupHashes: wizardBackupHashes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTotpEnabled(true);
        setWizardStep(3); // Show backup codes download
      } else {
        setWizardError(data.error || 'Invalid 6-digit code. Please verify your authenticator app.');
      }
    } catch (err: any) {
      setWizardError(err.message || 'Error communicating with 2FA server.');
    }
  };

  // Download Backup Codes Text File
  const handleDownloadBackupCodes = () => {
    const fileContent = `DEVHOST CLOUD - 2-STEP VERIFICATION RECOVERY CODES
Account: ${currentUser?.email || 'user'}
Generated: ${new Date().toUTCString()}

IMPORTANT: Each code can only be used once. Keep these codes safe and offline.
--------------------------------------------------------------------------------
${wizardBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}
--------------------------------------------------------------------------------`;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'devhost-2fa-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-600/10 border border-blue-500/20">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[11px] font-mono font-semibold mb-1 border border-blue-200 dark:border-blue-800">
            <User className="w-3 h-3 text-blue-600" />
            <span>Customer &amp; Developer Hub</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Developer Account, Corporate BIN &amp; Security Profile
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
            Manage your legal tax/VAT BIN details, SSH deploy keys, scoped API tokens, and RFC 6238 2-step verification.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer whitespace-nowrap flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {saveToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500 text-white font-mono text-xs flex items-center gap-2 animate-in fade-in shadow-md shadow-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span>Profile &amp; security preferences saved successfully!</span>
        </div>
      )}

      {/* Profile Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Corporate &amp; Billing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ssh')}
          className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ssh'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>SSH Keys &amp; Runtimes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api')}
          className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'api'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>Scoped API Tokens</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>2FA &amp; Sudo PIN</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB A: IDENTITY, CORPORATE VAT & BILLING                              */}
      {/* ===================================================================== */}
      {activeTab === 'identity' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Identity, Tax &amp; Printable Invoice Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              These details are automatically printed on official PDF tax invoices and receipts for corporate accounting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Account Representative Name:</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-sans text-sm font-semibold"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Account Type / Entity Classification:</label>
              <select
                value={accountType}
                onChange={(e: any) => setAccountType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-sans text-xs font-semibold cursor-pointer"
              >
                <option value="individual">Individual Developer / Freelancer</option>
                <option value="business_corporate">Registered Corporate Enterprise (Pvt Ltd / Inc)</option>
                <option value="software_agency">Digital Agency / Software Development House</option>
              </select>
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Legal Company / Organization Name:</label>
              <input
                type="text"
                value={companyLegalName}
                onChange={(e) => setCompanyLegalName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">
                <span>Bangladesh 13/14-Digit VAT / BIN / TIN:</span>
                <span className="text-[10px] text-blue-500 ml-1">(NBR Compliant)</span>
              </label>
              <input
                type="text"
                value={taxBinNumber}
                onChange={(e) => setTaxBinNumber(e.target.value)}
                placeholder="e.g. 001294819-0101"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Registered Billing Street Address:</label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">City / Division:</label>
              <input
                type="text"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Country:</label>
              <input
                type="text"
                value={billingCountry}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">Emergency Finance Email (Secondary):</label>
              <input
                type="email"
                value={emergencyBillingEmail}
                onChange={(e) => setEmergencyBillingEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-zinc-400 block mb-1">WhatsApp Alert Mobile Number:</label>
              <input
                type="text"
                value={whatsappAlertNumber}
                onChange={(e) => setWhatsappAlertNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB B: GLOBAL SSH KEYS & DEVELOPER DEFAULTS                           */}
      {/* ===================================================================== */}
      {activeTab === 'ssh' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Global SSH Public Key Vault
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Keys registered here are automatically synchronized into your cPanel authorized_keys and Cloud VPS nodes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddSshModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add SSH Public Key</span>
            </button>
          </div>

          {/* Keys List */}
          <div className="space-y-3">
            {sshKeys.map((key) => (
              <div
                key={key.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <strong className="text-slate-900 dark:text-white font-sans text-sm">{key.label}</strong>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold">
                      {key.type}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block truncate max-w-lg">
                    {key.fingerprint}
                  </span>
                  <span className="text-[10px] text-slate-400">Added on {key.created}</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    requireSudo(() => {
                      setSshKeys((prev) => prev.filter((k) => k.id !== key.id));
                    }, `Revoke SSH Key: ${key.label}`)
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke</span>
                </button>
              </div>
            ))}
          </div>

          {/* Developer Environment Defaults */}
          <div className="pt-4 border-t border-slate-200/60 dark:border-white/5 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
              Default Runtime &amp; Region Preferences
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-1.5">
                <label className="text-slate-500 block text-[11px]">Primary Datacenter:</label>
                <select
                  value={defaultRegion}
                  onChange={(e: any) => setDefaultRegion(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  <option value="sg1">Singapore SG1 (Equinix - Sub 35ms BD)</option>
                  <option value="us1">USA East US1 (Ashburn)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-1.5">
                <label className="text-slate-500 block text-[11px]">Default Node.js Engine:</label>
                <select
                  value={defaultNodeVersion}
                  onChange={(e) => setDefaultNodeVersion(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  <option value="22">Node.js 22 LTS (Active)</option>
                  <option value="20">Node.js 20 LTS</option>
                  <option value="18">Node.js 18 LTS</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-1.5">
                <label className="text-slate-500 block text-[11px]">Default PHP Runtime:</label>
                <select
                  value={defaultPhpVersion}
                  onChange={(e) => setDefaultPhpVersion(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  <option value="8.3">PHP 8.3 (JIT Enabled)</option>
                  <option value="8.2">PHP 8.2</option>
                  <option value="8.1">PHP 8.1</option>
                </select>
              </div>
            </div>
          </div>

          {/* Add SSH Key Modal */}
          {isAddSshModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Add New OpenSSH Public Key</h4>
                <form onSubmit={handleAddSshKey} className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="text-slate-500 block mb-1">Key Label:</label>
                    <input
                      type="text"
                      placeholder="e.g. Work M3 Laptop"
                      value={newSshLabel}
                      onChange={(e) => setNewSshLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Public Key Content (ssh-ed25519 or ssh-rsa):</label>
                    <textarea
                      rows={4}
                      placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@hostname"
                      value={newSshKeyText}
                      onChange={(e) => setNewSshKeyText(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddSshModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                    >
                      Save Key
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB C: SCOPED API TOKENS (Cloudflare-Style Token Generator)            */}
      {/* ===================================================================== */}
      {activeTab === 'api' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Personal API Access Tokens
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Generate scoped bearer tokens for GitHub Actions, custom webhook pipelines, and Terraform automation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRevealedToken(null);
                setNewTokenName('');
                setIsCreateTokenModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Access Token</span>
            </button>
          </div>

          {/* Tokens List */}
          <div className="space-y-3">
            {apiTokens.map((token) => (
              <div
                key={token.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <strong className="text-slate-900 dark:text-white font-sans text-sm">{token.name}</strong>
                    <code className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {token.prefix}••••••••
                    </code>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                    Scopes: <span className="text-blue-600 dark:text-blue-400">{token.permissions}</span>
                  </span>
                  <div className="text-[10px] text-slate-400 flex items-center gap-3">
                    <span>Created: {token.created}</span>
                    <span>Last Used: {token.lastUsed}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    requireSudo(() => {
                      revokeApiToken(token.id);
                    }, `Revoke Personal API Token: ${token.name}`)
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke</span>
                </button>
              </div>
            ))}
          </div>

          {/* Create Token Modal */}
          {isCreateTokenModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Generate Scoped API Token</h4>

                {!revealedToken ? (
                  <div className="space-y-4 text-xs font-mono">
                    <div>
                      <label className="text-slate-500 block mb-1">Token Description / Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. GitHub Actions CI/CD Production"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-sans"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-slate-500 block">Granular Permissions &amp; Scopes:</label>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {[
                          { id: 'services:read', label: 'View Cloud Services' },
                          { id: 'git:deploy', label: 'Trigger GitHub Auto-Deploy' },
                          { id: 'dns:edit', label: 'Manage Cloudflare DNS' },
                          { id: 'backups:create', label: 'Create JetBackup Snapshots' },
                        ].map((sc) => (
                          <label
                            key={sc.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={tokenScopes.includes(sc.id)}
                              onChange={(e) => {
                                if (e.target.checked) setTokenScopes([...tokenScopes, sc.id]);
                                else setTokenScopes(tokenScopes.filter((s) => s !== sc.id));
                              }}
                              className="accent-blue-600"
                            />
                            <span className="text-slate-700 dark:text-zinc-300 font-sans">{sc.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateTokenModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          requireSudo(() => {
                            handleGenerateToken();
                          }, 'Generate Scoped API Token')
                        }
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                      >
                        Generate Token
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Make sure to copy your API token now. For security purposes, you will not be able to view it again!
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs break-all flex items-center justify-between gap-2 border border-slate-800">
                      <span>{revealedToken}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(revealedToken);
                          setCopiedToken(true);
                          setTimeout(() => setCopiedToken(false), 2000);
                        }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white shrink-0 cursor-pointer"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateTokenModalOpen(false)}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                      >
                        Done &amp; Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB D: 2-STEP VERIFICATION, SUDO PIN & DEVICE SESSIONS                */}
      {/* ===================================================================== */}
      {activeTab === 'security' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6 animate-in fade-in">
          {/* 2FA Status Card */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  totpEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Authenticator App (TOTP RFC 6238)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                      totpEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {totpEnabled ? 'Active & Protected' : 'Not Configured'}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Protects your account with Google Authenticator, Authy, or 1Password.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (totpEnabled) {
                  requireSudo(() => {
                    setTotpEnabled(false);
                  }, 'Disable 2-Step Verification');
                } else {
                  handleStart2FaSetup();
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap shadow-xs ${
                totpEnabled
                  ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
              }`}
            >
              {totpEnabled ? 'Disable 2FA' : 'Enable Authenticator 2FA'}
            </button>
          </div>

          {/* Master Sudo PIN Setter */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-slate-900 dark:text-white text-sm font-sans flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>Master 6-Digit Sudo Security PIN</span>
                </strong>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Used as instant step-up authorization for fast sensitive operations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="password"
                maxLength={6}
                placeholder="Enter 6-Digit PIN (e.g. 123456)"
                value={sudoPinInput}
                onChange={(e) => setSudoPinInput(e.target.value)}
                className="w-64 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold tracking-widest text-center"
              />
              <button
                type="button"
                onClick={() => {
                  if (/^\d{6}$/.test(sudoPinInput)) {
                    setSudoPinSuccess(true);
                    setTimeout(() => setSudoPinSuccess(false), 3000);
                  } else {
                    alert('Sudo PIN must be exactly 6 digits.');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold cursor-pointer"
              >
                Update PIN
              </button>
            </div>

            {sudoPinSuccess && (
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Master Sudo PIN updated successfully!</span>
              </span>
            )}
          </div>

          {/* Active Device Sessions */}
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white font-sans text-sm">
                Active Browser &amp; Device Sessions
              </h4>
              <button
                type="button"
                onClick={() =>
                  requireSudo(() => {
                    revokeAllOtherSessions();
                  }, 'Terminate All Other Browser Sessions')
                }
                className="text-[11px] text-rose-600 hover:underline cursor-pointer font-semibold"
              >
                Terminate All Other Sessions
              </button>
            </div>

            <div className="space-y-2">
              {loginSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Laptop className="w-4 h-4 text-slate-500" />
                    <div>
                      <strong className="text-slate-900 dark:text-white font-sans text-xs">
                        {session.device}
                      </strong>
                      <span className="text-[10px] text-slate-400 block">
                        IP: {session.ip} • {session.location} • {session.time}
                      </span>
                    </div>
                  </div>

                  {session.current ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-200 dark:border-emerald-800 font-bold">
                      Current Device
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => revokeSession(session.id)}
                      className="px-2.5 py-1 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-rose-50 hover:text-rose-600 cursor-pointer text-[10px]"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3-Step 2FA Setup Wizard Modal */}
          {is2FaWizardOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl">
                {/* Wizard Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>Setup 2-Step Verification (Step {wizardStep} of 3)</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">RFC 6238 Standard TOTP</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIs2FaWizardOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Step 1: Scan SVG QR Code */}
                {wizardStep === 1 && (
                  <div className="space-y-4 text-center font-mono text-xs">
                    <p className="text-slate-600 dark:text-zinc-400 text-xs font-sans">
                      Open Google Authenticator, Authy, or 1Password and scan this QR code:
                    </p>

                    {/* SVG QR Code Display */}
                    <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-200 shadow-inner">
                      <div
                        className="w-48 h-48 flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: wizardQrSvg }}
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">Can&apos;t scan? Copy key manually:</span>
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 font-bold select-all text-xs tracking-wider border border-slate-200 dark:border-white/5">
                        {wizardSecret}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      Next: Verify 6-Digit Code
                    </button>
                  </div>
                )}

                {/* Step 2: Verify Initial 6-Digit Code */}
                {wizardStep === 2 && (
                  <div className="space-y-4 text-center font-mono text-xs">
                    <p className="text-slate-600 dark:text-zinc-400 text-xs font-sans">
                      Enter the 6-digit code currently generated by your authenticator app:
                    </p>

                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="e.g. 918240"
                      value={wizardVerifyCode}
                      onChange={(e) => setWizardVerifyCode(e.target.value)}
                      className="w-full h-12 text-center text-2xl font-bold tracking-widest rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white"
                    />

                    {wizardError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{wizardError}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setWizardStep(1)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={wizardVerifyCode.trim().length !== 6}
                        onClick={handleConfirm2FaCode}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                      >
                        Verify &amp; Activate
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Backup Recovery Codes Download */}
                {wizardStep === 3 && (
                  <div className="space-y-4 text-center font-mono text-xs">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>

                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm font-sans">
                        Two-Step Verification Active!
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                        Save your 10 one-time recovery codes. If you ever lose your phone, these are the only way to recover your account.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 text-[11px] text-slate-700 dark:text-zinc-300 text-left font-bold">
                      {wizardBackupCodes.map((code, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[9px] w-4">{idx + 1}.</span>
                          <span>{code}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadBackupCodes}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download devhost-2fa-recovery-codes.txt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIs2FaWizardOpen(false)}
                      className="w-full py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer text-xs"
                    >
                      Done &amp; Close Wizard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
