'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Terminal, Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import Auth3DScene from '@/components/visuals/Auth3DScene';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);


  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your account email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured()) {
        const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl,
        });

        if (error) {
          console.warn('[ForgotPassword Supabase Notice]:', error.message);
          // For security (preventing account harvesting), only display generic success or sanitized error
        }
      }

      // Display secure confirmation (prevents email enumeration attacks)
      setIsSent(true);
      setCooldown(60);
    } catch (err: unknown) {
      console.error('[ForgotPassword Exception]:', err);
      setIsSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Left Column: Password Recovery Form */}
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
                AUTH
              </span>
            </div>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>

        {/* Central Form Container */}
        <div className="max-w-md w-full mx-auto my-12 space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 text-xs font-mono text-blue-700 dark:text-zinc-300 font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Cryptographic Account Recovery</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Reset Your Password
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 font-normal leading-relaxed">
              Enter your registered DevHost account email address. We will dispatch a secure, single-use cryptographic recovery link.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSent ? (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    Recovery Link Dispatched
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                    If an account is associated with <span className="font-mono font-semibold">{email}</span>, a secure password reset link has been dispatched.
                  </p>
                </div>
              </div>

              <div className="text-xs text-emerald-800 dark:text-emerald-400/90 space-y-1.5 pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                <p>• The reset link remains valid for 60 minutes.</p>
                <p>• Check your inbox and spam folder.</p>
                <p>• For your security, this link can only be used once.</p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={() => setIsSent(false)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Link'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Password Recovery Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-4 text-center">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Remembered your credentials?{' '}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
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
