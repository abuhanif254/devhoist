'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  ShieldAlert,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  X,
  Smartphone,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { usePortal } from '@/context/PortalContext';

// Sudo session duration: 15 minutes in milliseconds
const SUDO_SESSION_TTL_MS = 15 * 60 * 1000;

interface SudoGateContextType {
  isSudoActive: boolean;
  sudoExpiresAt: number | null;
  requireSudo: (actionCallback: () => void | Promise<void>, actionDescription?: string) => void;
  elevateSudoManually: () => void;
  revokeSudo: () => void;
}

const SudoGateContext = createContext<SudoGateContextType | undefined>(undefined);

export function SudoGateProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = usePortal();
  const [sudoExpiresAt, setSudoExpiresAt] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void | Promise<void>) | null>(null);
  const [actionDescription, setActionDescription] = useState('High-Security Operation');

  // Active Verification Form State
  const [activeTab, setActiveTab] = useState<'totp' | 'pin' | 'backup'>('totp');
  const [codeValue, setCodeValue] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Check if sudo is currently active
  const isSudoActive = sudoExpiresAt !== null && Date.now() < sudoExpiresAt;

  // Cleanup expired sudo sessions
  useEffect(() => {
    if (!sudoExpiresAt) return;
    const remainingMs = sudoExpiresAt - Date.now();
    if (remainingMs <= 0) {
      setSudoExpiresAt(null);
      return;
    }
    const timer = setTimeout(() => {
      setSudoExpiresAt(null);
    }, remainingMs);
    return () => clearTimeout(timer);
  }, [sudoExpiresAt]);

  const requireSudo = (callback: () => void | Promise<void>, description?: string) => {
    if (isSudoActive) {
      callback();
      return;
    }

    setPendingCallback(() => callback);
    if (description) setActionDescription(description);
    setCodeValue('');
    setErrorMessage('');
    setSuccessAnimation(false);
    setIsModalOpen(true);
  };

  const elevateSudoManually = () => {
    setSudoExpiresAt(Date.now() + SUDO_SESSION_TTL_MS);
  };

  const revokeSudo = () => {
    setSudoExpiresAt(null);
    fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_sudo' }),
    }).catch(() => {});
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsVerifying(true);

    try {
      const cleanInput = codeValue.trim();

      if (cleanInput.length < 6) {
        setErrorMessage('Please enter a valid 6-digit code, PIN, or recovery code.');
        return;
      }

      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_sudo',
          token: activeTab === 'totp' ? cleanInput : undefined,
          sudoPin: activeTab === 'pin' ? cleanInput : undefined,
          backupCode: activeTab === 'backup' ? cleanInput : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setSuccessAnimation(true);
        const expiresAtMs = data.sudoExpiresAt
          ? new Date(data.sudoExpiresAt).getTime()
          : Date.now() + SUDO_SESSION_TTL_MS;
        setSudoExpiresAt(expiresAtMs);

        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessAnimation(false);
          if (pendingCallback) {
            pendingCallback();
            setPendingCallback(null);
          }
        }, 600);
      } else {
        setErrorMessage(data.error || data.message || 'Verification failed. Incorrect code or PIN.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to reach authentication server.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SudoGateContext.Provider
      value={{
        isSudoActive,
        sudoExpiresAt,
        requireSudo,
        elevateSudoManually,
        revokeSudo,
      }}
    >
      {children}

      {/* Sudo Gate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Sudo Security Step-Up</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800">
                        Protected
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Action: <strong className="text-slate-800 dark:text-zinc-200">{actionDescription}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notice */}
              <div className="mt-3.5 p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 text-[11px] font-mono text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Verification grants an elevated 15-minute sudo session.</span>
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleVerify} className="p-6 space-y-4">
              {/* Method Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-white/5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('totp');
                    setCodeValue('');
                    setErrorMessage('');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'totp'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>2FA App</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pin');
                    setCodeValue('');
                    setErrorMessage('');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'pin'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Key className="w-3 h-3" />
                  <span>Sudo PIN</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('backup');
                    setCodeValue('');
                    setErrorMessage('');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'backup'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Backup</span>
                </button>
              </div>

              {/* Input Area */}
              <div className="space-y-1.5 font-mono">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  {activeTab === 'totp' && 'Enter 6-Digit Authenticator Code:'}
                  {activeTab === 'pin' && 'Enter 6-Digit Master Sudo PIN:'}
                  {activeTab === 'backup' && 'Enter 12-Character Recovery Code (XXXX-XXXX-XXXX):'}
                </label>

                <input
                  type={activeTab === 'pin' ? 'password' : 'text'}
                  autoFocus
                  maxLength={activeTab === 'backup' ? 14 : 6}
                  placeholder={
                    activeTab === 'totp'
                      ? 'e.g. 849201'
                      : activeTab === 'pin'
                      ? '•••••• (Default: 123456)'
                      : 'e.g. 7A9B-4X2K-981M'
                  }
                  value={codeValue}
                  onChange={(e) => setCodeValue(e.target.value)}
                  className="w-full h-12 text-center text-xl font-bold tracking-widest rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                />

                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block text-center">
                  {activeTab === 'totp' && 'From Google Authenticator, Authy, or 1Password'}
                  {activeTab === 'pin' && 'Your personal 6-digit Master Security PIN (Demo default: 123456)'}
                  {activeTab === 'backup' && 'One-time recovery code generated during 2FA setup'}
                </span>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Feedback */}
              {successAnimation && (
                <div className="p-3 rounded-xl bg-emerald-500 text-white font-mono text-xs flex items-center justify-center gap-2 animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sudo identity verified! Executing action...</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isVerifying || !codeValue.trim()}
                  className="flex-1 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-rose-600/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isVerifying ? 'Verifying...' : 'Authenticate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SudoGateContext.Provider>
  );
}

export function useSudoGate() {
  const context = useContext(SudoGateContext);
  if (!context) {
    throw new Error('useSudoGate must be used within a SudoGateProvider');
  }
  return context;
}
