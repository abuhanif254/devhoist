'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Terminal, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRedirect } from '@/lib/authSecurity';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [statusMessage, setStatusMessage] = useState('Verifying cloud credentials...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuth() {
      try {
        const rawNext = searchParams.get('next') || searchParams.get('redirect') || '/dashboard';
        const targetNext = sanitizeRedirect(rawNext);

        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        const errorDesc = searchParams.get('error_description');

        if (error || errorDesc) {
          throw new Error(errorDesc || error || 'Authentication provider error.');
        }

        // 1. Check for URL Hash Fragment (Implicit OAuth flow or recovery)
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (hash) {
          const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
          const hashError = hashParams.get('error_description') || hashParams.get('error');
          if (hashError) {
            throw new Error(hashError);
          }
          const accessToken = hashParams.get('access_token');
          if (accessToken) {
            setStatusMessage('Establishing encrypted session...');
            // Let supabase client parse and detect session
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session) {
              await syncUserProfile(sessionData.session.access_token);
              if (isMounted) {
                setStatus('success');
                setStatusMessage('Redirecting to Cloud Console...');
                router.replace(targetNext);
              }
              return;
            }
          }
        }

        // 2. PKCE Code Exchange (Executed in browser where code_verifier is stored in localStorage)
        if (code) {
          setStatusMessage('Exchanging PKCE authorization token...');
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.error('[PKCE Client Exchange Error]:', exchangeErr);
            throw exchangeErr;
          }

          if (data?.session) {
            setStatusMessage('Synchronizing user profile...');
            await syncUserProfile(data.session.access_token);
            if (isMounted) {
              setStatus('success');
              setStatusMessage('Redirecting to Cloud Console...');
              router.replace(targetNext);
            }
            return;
          }
        }

        // 3. Email OTP or Password Recovery Verification
        if (tokenHash && type) {
          setStatusMessage('Verifying single-use authentication token...');
          const { data, error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (otpErr) throw otpErr;

          if (type === 'recovery') {
            if (isMounted) router.replace('/reset-password');
            return;
          }

          if (data?.session) {
            await syncUserProfile(data.session.access_token);
            if (isMounted) {
              setStatus('success');
              setStatusMessage('Redirecting to Cloud Console...');
              router.replace(targetNext);
            }
            return;
          }
        }

        // 4. Fallback: check if session is already active
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          await syncUserProfile(existingSession.session.access_token);
          if (isMounted) {
            setStatus('success');
            setStatusMessage('Redirecting to Cloud Console...');
            router.replace(targetNext);
          }
          return;
        }

        // If no credentials found at all, navigate back to login
        router.replace('/login');
      } catch (err: any) {
        console.error('[Auth Callback Fatal]:', err);
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Authentication failed. Please try again.');
          setTimeout(() => {
            router.replace(`/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
          }, 2000);
        }
      }
    }

    async function syncUserProfile(accessToken: string) {
      try {
        await fetch('/api/auth/sync-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (e) {
        console.warn('[Sync profile notice]:', e);
      }
    }

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-xl text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-5 shadow-sm">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Securing Cloud Session
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 font-mono">
              {statusMessage}
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Hardware-Grade 256-Bit SSL Gateway</span>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5 shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Authenticated Successfully
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 font-mono">
              {statusMessage}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-5 shadow-sm">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Authentication Failed
            </h2>
            <p className="text-sm text-rose-600 dark:text-rose-400 mt-2 font-mono">
              {errorMessage}
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4">
              Redirecting to login page...
            </p>
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
