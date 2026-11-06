'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Key,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import Auth3DScene from '@/components/visuals/Auth3DScene';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMatch = password.length > 0 && password === confirmPassword;

  const strengthScore = [
    hasMinLength,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  useEffect(() => {
    // Check if recovery session or token is active in URL
    const checkSession = async () => {
      try {
        if (!isSupabaseConfigured()) {
          setIsReady(true);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setHasValidSession(true);
        } else {
          // Listen for PASSWORD_RECOVERY event from Supabase PKCE/hash parser
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              if (event === 'PASSWORD_RECOVERY' || session) {
                setHasValidSession(true);
              }
            }
          );
          return () => {
            authListener?.subscription?.unsubscribe();
          };
        }
      } catch (err) {
        console.warn('[ResetPassword Check Notice]:', err);
      } finally {
        setIsReady(true);
      }
    };

    checkSession();
  }, []);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify both fields.');
      return;
    }

    if (strengthScore < 3) {
      setErrorMsg('Please choose a stronger password with a mix of letters, numbers, and symbols.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) {
          throw new Error(error.message || 'Failed to update password.');
        }

        // Global Session Revocation on Password Change (Critical Security Rule)
        try {
          const { data: userRes } = await supabase.auth.getUser();
          if (userRes?.user?.id) {
            await supabase
              .from('user_security_credentials')
              .update({
                last_password_change: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userRes.user.id);

            await supabase
              .from('security_audit_logs')
              .insert({
                event_type: 'password_reset_completed',
                actor_user_id: userRes.user.id,
                severity: 'HIGH',
                details: {
                  timestamp: new Date().toISOString(),
                  revoked_other_sessions: true,
                },
              });
          }

          // Revoke other active sessions on other devices
          await supabase.auth.signOut({ scope: 'others' });
        } catch (revokeErr) {
          console.warn('[Global Session Revocation Notice]:', revokeErr);
        }
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Left Column: Password Update Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 border-r border-slate-200 dark:border-white/[0.08]">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                DevHost
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-semibold">
                SECURITY
              </span>
            </div>
          </Link>

          <Link
            href="/login"
            className="text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Sign In Instead
          </Link>
        </div>

        {/* Central Form */}
        <div className="max-w-md w-full mx-auto my-12 space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cryptographic Credential Update</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Set New Password
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 font-normal leading-relaxed">
              Create a strong new password for your DevHost Cloud console. All active sessions will be re-authenticated.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    Password Successfully Updated!
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                    Your account has been secured with your new password. Redirecting to your Cloud Console...
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : !hasValidSession && isReady ? (
            <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">Recovery Link Expired or Invalid</h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    For your security, password recovery tokens expire after 60 minutes or upon single usage.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Request New Reset Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500 dark:text-zinc-400">Security Strength:</span>
                    <span
                      className={`font-bold ${
                        strengthScore <= 2
                          ? 'text-rose-500'
                          : strengthScore <= 4
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}
                    >
                      {strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Moderate' : 'Enterprise Strong'}
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="grid grid-cols-5 gap-1.5 h-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`rounded-full transition-colors ${
                          level <= strengthScore
                            ? strengthScore <= 2
                              ? 'bg-rose-500'
                              : strengthScore <= 4
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-200 dark:bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Checklist */}
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 dark:text-zinc-400 pt-1">
                    <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                      {hasMinLength ? '✓' : '•'} 8+ Characters
                    </span>
                    <span className={hasUpperCase ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                      {hasUpperCase ? '✓' : '•'} Uppercase Letter
                    </span>
                    <span className={hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                      {hasNumber ? '✓' : '•'} Number
                    </span>
                    <span className={isMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                      {isMatch ? '✓' : '•'} Passwords Match
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || strengthScore < 3 || !isMatch}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Cryptographic Key...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Update Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
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

      {/* Right Column: Real 3D Moving Object */}
      <div className="hidden lg:block w-1/2 min-h-screen">
        <Auth3DScene />
      </div>
    </div>
  );
}
