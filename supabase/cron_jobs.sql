-- ==============================================================================
-- DEVHOST CLOUD - AUTONOMOUS LIFECYCLE & CRON SCHEDULES (pg_cron)
-- Run this in your Supabase SQL Editor if pg_cron is enabled
-- ==============================================================================

-- 1. Enable pg_cron and pg_net extensions (Supported on Supabase Pro / Self-hosted)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Daily Midnight Job: 35-Day Affiliate Commission Maturity
-- Runs at 00:00 every night (Bangladesh / UTC time)
SELECT cron.schedule(
    'process-mature-affiliate-commissions-midnight',
    '0 0 * * *',
    $$
        SELECT public.process_mature_affiliate_commissions();
    $$
);

-- 3. Daily Midnight Job: Invoke Cloudflare Edge Lifecycle Endpoint via pg_net
-- IMPORTANT: Replace <YOUR_PRODUCTION_DOMAIN> and <YOUR_STRONG_CRON_SECRET>
-- (must match the CRON_SECRET Cloudflare Worker secret — never commit live secrets!)
SELECT cron.schedule(
    'invoke-devhost-lifecycle-cron',
    '5 0 * * *',
    $$
        SELECT net.http_post(
            url := 'https://<YOUR_PRODUCTION_DOMAIN>/api/cron/lifecycle',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_STRONG_CRON_SECRET>"}'::jsonb,
            body := '{"source": "pg_cron_scheduler"}'::jsonb
        );
    $$
);

-- 4. Hourly Lockout Cleanup: Expire brute force attempts older than 24 hours
SELECT cron.schedule(
    'cleanup-stale-login-attempts',
    '0 * * * *',
    $$
        DELETE FROM public.auth_login_attempts
        WHERE created_at < (NOW() - INTERVAL '24 hours');
    $$
);
