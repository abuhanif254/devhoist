'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (!agreeTerms) {
      setErrorMsg('You must agree to the Terms of Service & Privacy Policy.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Register user via dedicated Edge API route
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          company: company.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      // 2. Sign in with the registered credentials to establish Supabase session
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        // Redirect to login if confirmation email is required
        router.push('/login?registered=1');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthSignUp = async (provider: 'github' | 'google') => {
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to sign up with ${provider}`);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Left Column: Register Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 border-r border-slate-200 dark:border-white/[0.08]">
        {/* Top Header */}
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

        {/* Center Content */}
        <div className="max-w-md w-full mx-auto my-10 space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Cloud Account</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Create Your Cloud Account
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Start building with 99.99% NVMe infrastructure, zero-bloat GitHub Actions, and instant bKash/Nagad checkout.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick OAuth */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOAuthSignUp('github')}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub Sign Up</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignUp('google')}
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
              <span>Google Sign Up</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-white/10 w-full" />
            <span className="bg-white dark:bg-zinc-950 px-3 text-[11px] font-mono uppercase text-slate-400 dark:text-zinc-500">
              Or register with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Tanvir Ahmed"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Email Address
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Company / Organization <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Acme Tech Ltd"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min. 6 characters"
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

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="terms" className="text-xs text-slate-600 dark:text-zinc-400 leading-snug cursor-pointer">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Login link */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
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

      {/* Right Column: Architectural Highlights */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 dark:bg-black p-12 lg:p-16 flex-col justify-between relative overflow-hidden text-white">
        <div className="absolute inset-0 architectural-grid opacity-20 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs font-mono tracking-widest text-blue-400 uppercase font-semibold">
            Enterprise Cloud Infrastructure
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-mono text-blue-300">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>Singapore SG1 &amp; US-East</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
            Developer Experience of Vercel. Accessibility of cPanel.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Automate Git deployments with sub-second commit hooks, LiteSpeed enterprise caching, and zero node_modules bloat.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-white">Strict Row Level Security (RLS)</div>
                <div className="text-slate-400">Every project and database is isolated at the PostgreSQL kernel level.</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Lock className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-white">RFC 6238 TOTP 2-Step Verification</div>
                <div className="text-slate-400">Hardware-grade Authenticator app login with Sudo elevation gates.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-slate-400 pt-6 border-t border-white/10">
          <span>SLA: 99.99% Global Uptime</span>
          <span>BDIX: Sub-5ms Latency</span>
        </div>
      </div>
    </div>
  );
}
