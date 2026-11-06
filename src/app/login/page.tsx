'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Server,
  Activity,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldAlert,
  Zap,
  Globe,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { usePortal } from '@/context/PortalContext';

export default function LoginPage() {
  const router = useRouter();
  const { switchRole } = usePortal();

  const [email, setEmail] = useState('hanif@devhost.cloud');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [require2FA, setRequire2FA] = useState(false);
  const [show2FAScreen, setShow2FAScreen] = useState(false);
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (require2FA && !show2FAScreen) {
      setShow2FAScreen(true);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      switchRole('client');
      router.push('/dashboard');
    }, 600);
  };

  const handleDemoClientLogin = () => {
    switchRole('client');
    router.push('/dashboard');
  };

  const handleDemoAdminLogin = () => {
    switchRole('admin');
    router.push('/admin');
  };

  const handleTotpChange = (index: number, val: string) => {
    if (val.length > 1) {
      val = val[val.length - 1];
    }
    const newCode = [...totpCode];
    newCode[index] = val;
    setTotpCode(newCode);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`totp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleTotpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
      const prevInput = document.getElementById(`totp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTotpError(null);
    setIsVerifyingTotp(true);

    const enteredCode = useBackupCode ? backupCodeInput.trim() : totpCode.join('').trim();
    if (useBackupCode && enteredCode.length < 8) {
      setTotpError('Please enter a valid 12-character backup recovery code.');
      setIsVerifyingTotp(false);
      return;
    }
    if (!useBackupCode && enteredCode.length !== 6) {
      setTotpError('Please enter all 6 digits from your authenticator app.');
      setIsVerifyingTotp(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: email.trim(),
          code: enteredCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        switchRole('client');
        router.push('/dashboard');
      } else {
        // If no 2FA secret is saved in db for demo email, allow smooth demo pass-through
        if (data.error && data.error.includes('No TOTP secret configured')) {
          switchRole('client');
          router.push('/dashboard');
        } else {
          setTotpError(data.error || 'Invalid 2FA verification code. Please check your clock.');
        }
      }
    } catch {
      // Offline fallback
      switchRole('client');
      router.push('/dashboard');
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* =========================================================================
          LEFT COLUMN: AUTHENTICATION FORM & DEVELOPER OAUTH
         ========================================================================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 border-r border-slate-200 dark:border-white/[0.08]">
        {/* Brand Top Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                DevHost
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-white/10 uppercase">
                Portal
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="text-xs font-mono text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white transition-colors"
          >
            ← Return to Website
          </Link>
        </div>

        {/* Main Form Center Box */}
        <div className="max-w-md w-full mx-auto my-10">
          {!show2FAScreen ? (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Secure 256-Bit SSO Gateway</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Sign In to Cloud Console
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 font-normal">
                  Access your NVMe hosting, Git deployment pipelines, DNS zones, and automated billing.
                </p>
              </div>

              {/* 1-Click Developer OAuth */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDemoClientLogin}
                  className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>GitHub OAuth</span>
                </button>

                <button
                  type="button"
                  onClick={handleDemoClientLogin}
                  className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google Account</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 dark:border-white/10 w-full" />
                <span className="bg-white dark:bg-zinc-950 px-3 text-[11px] font-mono uppercase text-slate-400 dark:text-zinc-500">
                  Or continue with email
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Account Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 h-10 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 text-xs font-sans text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 text-xs font-sans text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember & 2FA Toggles */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Remember 30 days</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={require2FA}
                      onChange={(e) => setRequire2FA(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>Require 2FA Step</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin mr-2">⏳</span>
                  ) : (
                    <>
                      <span>Sign In to Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Instant Sandbox Demo Access Bar */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-blue-900 dark:text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Instant Sandbox Demo Access:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleDemoClientLogin}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold text-center shadow-xs transition-colors cursor-pointer"
                  >
                    Customer Portal (Demo)
                  </button>
                  <button
                    type="button"
                    onClick={handleDemoAdminLogin}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold text-center shadow-xs transition-colors cursor-pointer"
                  >
                    Founder Admin Center
                  </button>
                </div>
              </div>

              <div className="text-center text-xs text-slate-500 dark:text-zinc-400">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Create new account
                </Link>
              </div>
            </div>
          ) : (
            /* 2FA TOTP STEP */
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  Two-Factor Authentication
                </h2>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                  {useBackupCode
                    ? 'Enter one of your 10-set emergency backup recovery codes (format: XXXX-XXXX-XXXX).'
                    : 'Enter the 6-digit TOTP security code generated by your Authenticator app (Google Authenticator, Authy, 1Password).'}
                </p>
              </div>

              {totpError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{totpError}</span>
                </div>
              )}

              {!useBackupCode ? (
                /* 6 Digit Inputs */
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {totpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`totp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleTotpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleTotpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-mono font-bold rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                  ))}
                </div>
              ) : (
                /* 12-char Backup code input */
                <div>
                  <input
                    type="text"
                    value={backupCodeInput}
                    onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2-C3D4-E5F6"
                    className="w-full text-center tracking-widest text-base font-mono font-bold px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isVerifyingTotp}
                  onClick={() => handleVerify2FA()}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isVerifyingTotp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Cryptographic Hash...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Code &amp; Launch Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setTotpError(null);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                  >
                    {useBackupCode ? 'Use 6-digit Authenticator app' : 'Lost phone? Use Emergency Backup Code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShow2FAScreen(false)}
                    className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    ← Password sign-in
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-600 dark:text-zinc-400 text-center">
                RFC 6238 Web Crypto HMAC-SHA1 Protected • 30-sec Time Drift Tolerance
              </div>
            </div>
          )}
        </div>

        {/* Footer Legal Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 gap-2 pt-6 border-t border-slate-100 dark:border-white/5">
          <span>&copy; {new Date().getFullYear()} DevHost Cloud Inc. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <span>•</span>
            <Link href="/security" className="hover:underline">Security</Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: ENTERPRISE TELEMETRY & TRUST SHOWCASE
         ========================================================================= */}
      <div className="hidden lg:flex w-1/2 bg-slate-50/70 dark:bg-zinc-900/30 p-12 lg:p-16 flex-col justify-between relative overflow-hidden">
        {/* Architectural Grid pattern */}
        <div className="absolute inset-0 architectural-grid opacity-50 pointer-events-none" />

        {/* Top Badges */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Equinix SG1 Tier-IV Datacenter Active</span>
          </div>

          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            99.99% Live SLA
          </span>
        </div>

        {/* Middle: Rich Glass Telemetry Blade */}
        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    CloudLinux LVE Isolated Shell
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                    Host Container: SG1-NVMe-Node-01
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold">
                CageFS Active
              </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5">
                <span className="text-slate-400 dark:text-zinc-500 text-[10px]">Pure PCIe NVMe:</span>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">7,400 MB/s</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5">
                <span className="text-slate-400 dark:text-zinc-500 text-[10px]">Passenger Reload:</span>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">2.8 Seconds</div>
              </div>
            </div>

            {/* Quote */}
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed italic">
              &ldquo;Deploying Next.js standalone on cPanel with GitHub Actions cut our local latency to 38ms and saved our team 80% on cloud bills.&rdquo;
            </p>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
              — Tanvir Hossain, Lead Full-Stack Architect
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-10 flex items-center gap-6 text-xs text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>256-Bit Hardware Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-blue-500" />
            <span>Sub-40ms BDIX Peering</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-purple-500" />
            <span>Cloudflare Edge DNS</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotSuccess(false);
              }}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>

            {!forgotSuccess ? (
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Account Password</h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                    Enter your registered email address to receive an instant password recovery link.
                  </p>
                </div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 h-10 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setForgotSuccess(true)}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
                >
                  Send Recovery Link
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center py-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Check Your Inbox</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  We have dispatched a secure password reset link to your email address.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSuccess(false);
                  }}
                  className="w-full h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-semibold text-xs"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
