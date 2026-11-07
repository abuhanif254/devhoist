'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Terminal,
  ShieldCheck,
  Lock,
  Mail,
  Key,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getClientLockoutState, recordClientFailedAttempt, resetClientFailedAttempts, sanitizeRedirect } from '@/lib/authSecurity';
import Auth3DScene from '@/components/visuals/Auth3DScene';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || searchParams.get('from') || searchParams.get('next');
  const redirectParam = sanitizeRedirect(rawRedirect);

  // Lockout & Brute-force state
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [authUserId, setAuthUserId] = useState<string | null>(searchParams.get('userId'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [require2FA, setRequire2FA] = useState(false);
  const [show2FAScreen, setShow2FAScreen] = useState(false);
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // If redirected with registered flag
  // 1. Live Lockout & Brute Force Timer
  useEffect(() => {
    const checkLock = () => {
      const state = getClientLockoutState();
      setIsLocked(state.isLocked);
      setLockoutSeconds(state.remainingSeconds);
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Detect 2FA Challenge from OAuth Callback or direct redirect
  useEffect(() => {
    if (searchParams.get('challenge_2fa') === '1') {
      const uId = searchParams.get('userId');
      const uEmail = searchParams.get('email');
      if (uId) setAuthUserId(uId);
      if (uEmail) setEmail(uEmail);
      setRequire2FA(true);
      setShow2FAScreen(true);
      setLoginError(null);
    } else if (searchParams.get('registered') === '1') {
      setLoginError(null);
    } else if (searchParams.get('logged_out') === 'true') {
      setLoginError(null);
    } else if (searchParams.get('error')) {
      const err = searchParams.get('error');
      if (err) setLoginError(decodeURIComponent(err));
    }
  }, [searchParams]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!email.trim() || !password) {
      setLoginError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authErr) {
        throw new Error(authErr.message || 'Invalid email or password.');
      }

      if (!authData?.user) {
        throw new Error('Authentication failed. No user session returned.');
      }

      const userId = authData.user.id;
      setAuthUserId(userId);
      resetClientFailedAttempts();

      // 2. Check if 2FA TOTP is required for this user
      try {
        const check2faRes = await fetch(`/api/auth/2fa?userId=${userId}&email=${encodeURIComponent(email.trim().toLowerCase())}`);
        if (check2faRes.ok) {
          const check2faData = await check2faRes.json();
          if (check2faData.enabled) {
            setRequire2FA(true);
            setShow2FAScreen(true);
            setIsSubmitting(false);
            return;
          }
        }
      } catch (twoFaErr) {
        console.warn('2FA verification check warning:', twoFaErr);
      }

      // 3. Query User Role from public.profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      const userRole = profile?.role || 'client';

      // 4. Strict Role-Based Routing
      if (redirectParam && redirectParam.startsWith('/')) {
        // If regular client tries to redirect to /admin, force /dashboard
        if (redirectParam.startsWith('/admin') && userRole !== 'admin') {
          router.push('/dashboard');
        } else {
          router.push(redirectParam);
        }
      } else if (userRole === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const lockout = recordClientFailedAttempt();
      if (lockout.isLocked) {
        setIsLocked(true);
        setLockoutSeconds(lockout.remainingSeconds);
        setLoginError('Security Alert: Too many failed login attempts. Workstation temporarily locked for 15 minutes to prevent brute-force attacks.');
      } else {
        setLoginError(err.message || 'Failed to sign in. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectParam || '/dashboard')}`,
        },
      });
      if (error) {
        setLoginError(
          `${provider === 'google' ? 'Google' : 'GitHub'} OAuth is not enabled in Supabase yet. Please sign in below with your Email & Password.`
        );
      }
    } catch (err: any) {
      setLoginError(
        `${provider === 'google' ? 'Google' : 'GitHub'} OAuth is not enabled in Supabase yet. Please sign in below with your Email & Password.`
      );
    }
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
          email: email.trim().toLowerCase(),
          code: enteredCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Query user role to route properly
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        let userRole = 'client';
        if (userId) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
          if (profile?.role) userRole = profile.role;
        }

        if (redirectParam && redirectParam.startsWith('/')) {
          if (redirectParam.startsWith('/admin') && userRole !== 'admin') {
            router.push('/dashboard');
          } else {
            router.push(redirectParam);
          }
        } else if (userRole === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        setTotpError(data.error || 'Invalid 2FA verification code. Please check your clock.');
      }
    } catch {
      setTotpError('Network error during 2FA verification. Please try again.');
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setForgotSuccess(true);
    } catch {
      setForgotSuccess(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* LEFT COLUMN: AUTHENTICATION FORM */}
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
                Cloud
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

              {loginError && (
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {searchParams.get('registered') === '1' && (
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Registration successful! Please sign in with your email and password.</span>
                </div>
              )}

              {/* Developer OAuth */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('github')}
                  className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>GitHub Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
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
                  <span>Google Sign In</span>
                </button>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 dark:border-white/10 w-full" />
                <span className="bg-white dark:bg-zinc-950 px-3 text-[11px] font-mono uppercase text-slate-400 dark:text-zinc-500">
                  Or continue with email
                </span>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Remember this workstation</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLocked}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Locked ({Math.floor(lockoutSeconds / 60)}:{String(lockoutSeconds % 60).padStart(2, '0')})</span>
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center text-xs text-slate-500 dark:text-zinc-400 pt-2">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Create new account
                </Link>
              </div>
            </div>
          ) : (
            /* 2FA TOTP VERIFICATION STEP */
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs font-mono text-purple-700 dark:text-purple-400 font-semibold mb-3">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>RFC 6238 TOTP Two-Factor Authentication</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Enter 2-Step Code
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 font-normal">
                  Open Google Authenticator or your 2FA security key app on your phone and enter the code.
                </p>
              </div>

              {totpError && (
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{totpError}</span>
                </div>
              )}

              <form onSubmit={handleVerify2FA} className="space-y-6">
                {!useBackupCode ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                      6-Digit Security Code
                    </label>
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {totpCode.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`totp-${idx}`}
                          type="text"
                          maxLength={1}
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) => handleTotpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleTotpKeyDown(idx, e)}
                          className="w-12 h-14 text-center font-mono text-xl font-extrabold rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      12-Character Backup Recovery Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. A9B2-C8D4-E7F1"
                      value={backupCodeInput}
                      onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm font-mono text-slate-900 dark:text-white uppercase focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setTotpError(null);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {useBackupCode ? 'Use Authenticator Code instead' : 'Lost your phone? Use Backup Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShow2FAScreen(false);
                      setTotpCode(['', '', '', '', '', '']);
                    }}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingTotp}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isVerifyingTotp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Security Token...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify &amp; Enter Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Brand Bottom Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-600 pt-6 border-t border-slate-100 dark:border-white/5">
          <span>© {new Date().getFullYear()} DevHost Cloud</span>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-zinc-400">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-600 dark:hover:text-zinc-400">
              Terms
            </Link>
            <Link href="/security" className="hover:text-slate-600 dark:hover:text-zinc-400">
              Security
            </Link>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: REAL 3D MOVING OBJECT */}
      <div className="hidden lg:block w-1/2 min-h-screen">
        <Auth3DScene />
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Reset Account Password
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>If an account exists for {forgotEmail}, a password recovery link has been dispatched.</span>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Enter your registered account email to receive a password reset link.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
