'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, syncAuthCookie } from '@/lib/supabase';
import { sanitizeRedirect } from '@/lib/authSecurity';

/**
 * Module-level cache so the PKCE code / OTP is exchanged EXACTLY ONCE per page load,
 * even when React Strict Mode runs the effect twice. A second exchange would fail because the
 * PKCE verifier is single-use.
 */
const inFlight = new Map<string, Promise<Session | null>>();

function runOnce(key: string, task: () => Promise<Session | null>): Promise<Session | null> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = task();
  inFlight.set(key, p);
  return p;
}

async function resolveSession(params: URLSearchParams, hash: string): Promise<{ session: Session | null; recovery: boolean }> {
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  // 1. PKCE code (Google / GitHub / email-link PKCE) - runs in the browser where the verifier lives
  if (code) {
    const session = await runOnce(`code:${code}`, async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data.session;
    });
    return { session, recovery: false };
  }

  // 2. Email OTP (signup confirmation / password recovery / magic link)
  if (tokenHash && type) {
    const session = await runOnce(`otp:${tokenHash}`, async () => {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
      if (error) throw error;
      return data.session;
    });
    return { session, recovery: type === 'recovery' };
  }

  // 3. Implicit-flow hash fragment (#access_token=...&refresh_token=...)
  if (hash) {
    const h = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const hashError = h.get('error_description') || h.get('error');
    if (hashError) throw new Error(hashError);
    const access_token = h.get('access_token');
    const refresh_token = h.get('refresh_token');
    if (access_token && refresh_token) {
      const session = await runOnce(`hash:${access_token.slice(-16)}`, async () => {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        return data.session;
      });
      return { session, recovery: h.get('type') === 'recovery' };
    }
  }

  // 4. Nothing in the URL - maybe the session already exists
  const { data } = await supabase.auth.getSession();
  return { session: data.session, recovery: false };
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [statusMessage, setStatusMessage] = useState('Verifying cloud credentials...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const providerError = searchParams.get('error_description') || searchParams.get('error');
        if (providerError) throw new Error(providerError);

        const next = sanitizeRedirect(searchParams.get('next') || searchParams.get('redirect') || '/dashboard');
        const hash = typeof window !== 'undefined' ? window.location.hash : '';

        setStatusMessage('Exchanging secure authorization token...');
        const { session, recovery } = await resolveSession(new URLSearchParams(searchParams.toString()), hash);

        if (!session) {
          if (!cancelled) router.replace('/login');
          return;
        }

        if (recovery) {
          if (!cancelled) router.replace('/reset-password');
          return;
        }

        setStatusMessage('Synchronizing your profile...');
        let role = 'client';
        try {
          const res = await fetch('/api/auth/sync-session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const body = await res.json().catch(() => null);
            if (body?.user?.role) role = body.user.role;
          }
        } catch {
          // Profile sync is best-effort; PortalContext self-heals the profile too.
        }

        syncAuthCookie(session, role);

        if (cancelled) return;
        setStatus('success');
        setStatusMessage('Redirecting to Cloud Console...');
        // Hard navigation guarantees PortalContext re-hydrates from the freshly persisted session
        // (no client-side race between SIGNED_IN and the dashboard auth guard).
        window.location.replace(next);
      } catch (err: any) {
        console.error('[Auth Callback Error]:', err);
        if (cancelled) return;
        const message = err?.message || 'Authentication failed. Please try again.';
        setStatus('error');
        setErrorMessage(message);
        setTimeout(() => router.replace(`/login?error=${encodeURIComponent(message)}`), 2500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-xl text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-5">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Securing Cloud Session</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 font-mono">{statusMessage}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Authenticated Successfully</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 font-mono">{statusMessage}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-5">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Authentication Failed</h2>
            <p className="text-sm text-rose-600 dark:text-rose-400 mt-2">{errorMessage}</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4">Redirecting to login page...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
