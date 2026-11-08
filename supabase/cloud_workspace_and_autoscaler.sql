-- =============================================================================
-- DEVHOST CLOUD - TIER-1 CLOUD WORKSPACE EXPANSION SCHEMA
-- 1. hosting_virtual_filesystem (In-Portal File Manager & Code Editor)
-- 2. hosting_preview_environments (Vercel-Style Git Branch/PR Previews)
-- 3. hosting_email_accounts (Business Email Suite, Forwarders & Auto-Responders)
-- 4. service_autoscaling_rules (Profit-Protected Resource Auto-Scaler & Edge WAF)
-- 5. terminal_and_sql_logs (Audit Ledger for Web SSH Terminal & SQL Query Lab)
-- =============================================================================

-- 0. ENSURE SECURITY-DEFINER ADMIN HELPER FUNCTION EXISTS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

-- =============================================================================
-- A. hosting_virtual_filesystem (In-Portal Cloud File Manager & Code Editor)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hosting_virtual_filesystem (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    file_name text NOT NULL,
    is_directory boolean NOT NULL DEFAULT false,
    size_bytes int NOT NULL DEFAULT 1024,
    permissions_octal text NOT NULL DEFAULT '0644',
    mime_type text NOT NULL DEFAULT 'text/plain',
    content_text text,
    last_modified_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(service_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_hosting_vfs_service
    ON public.hosting_virtual_filesystem(service_id, file_path);

ALTER TABLE public.hosting_virtual_filesystem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins can manage virtual filesystem" ON public.hosting_virtual_filesystem;
CREATE POLICY "Users and admins can manage virtual filesystem"
    ON public.hosting_virtual_filesystem
    FOR ALL
    USING (auth.uid() = user_id OR public.is_admin_user())
    WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- =============================================================================
-- B. hosting_preview_environments (Vercel-Style Git PR Preview Deployments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hosting_preview_environments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_name text NOT NULL,
    pr_number int,
    commit_sha text NOT NULL,
    preview_url text UNIQUE NOT NULL,
    status text NOT NULL DEFAULT 'ready_live' CHECK (status IN (
        'building',
        'ready_live',
        'promoted_to_prod',
        'expired'
    )),
    isolated_db_clone boolean NOT NULL DEFAULT true,
    response_time_ms int NOT NULL DEFAULT 42,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_hosting_previews_service
    ON public.hosting_preview_environments(service_id, created_at DESC);

ALTER TABLE public.hosting_preview_environments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins can manage preview environments" ON public.hosting_preview_environments;
CREATE POLICY "Users and admins can manage preview environments"
    ON public.hosting_preview_environments
    FOR ALL
    USING (auth.uid() = user_id OR public.is_admin_user())
    WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- =============================================================================
-- C. hosting_email_accounts (Business Email Mailboxes, Forwarders & Auto-Responder)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hosting_email_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_address text UNIQUE NOT NULL,
    mailbox_quota_mb int NOT NULL DEFAULT 1024,
    used_quota_mb numeric NOT NULL DEFAULT 18.5,
    forward_to_addresses text[] NOT NULL DEFAULT '{}'::text[],
    keep_copy_in_inbox boolean NOT NULL DEFAULT true,
    autoresponder_enabled boolean NOT NULL DEFAULT false,
    autoresponder_subject text,
    autoresponder_body text,
    spam_assassin_level text NOT NULL DEFAULT 'standard' CHECK (spam_assassin_level IN (
        'standard',
        'aggressive',
        'permissive'
    )),
    status text NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'suspended_quota'
    )),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hosting_emails_service
    ON public.hosting_email_accounts(service_id, created_at DESC);

ALTER TABLE public.hosting_email_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins can manage email accounts" ON public.hosting_email_accounts;
CREATE POLICY "Users and admins can manage email accounts"
    ON public.hosting_email_accounts
    FOR ALL
    USING (auth.uid() = user_id OR public.is_admin_user())
    WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- =============================================================================
-- D. service_autoscaling_rules (Autonomous Resource Auto-Scaler & Edge WAF Shield)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.service_autoscaling_rules (
    service_id uuid PRIMARY KEY REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    autoscale_enabled boolean NOT NULL DEFAULT false,
    ram_threshold_percent int NOT NULL DEFAULT 85 CHECK (ram_threshold_percent BETWEEN 70 AND 95),
    cpu_threshold_percent int NOT NULL DEFAULT 85,
    target_upgrade_plan_slug text NOT NULL DEFAULT 'business-max',
    max_monthly_budget_cap_bdt numeric NOT NULL DEFAULT 1500,
    edge_waf_mode text NOT NULL DEFAULT 'standard' CHECK (edge_waf_mode IN (
        'standard',
        'under_attack_js_challenge',
        'bot_fight_strict'
    )),
    blocked_countries text[] NOT NULL DEFAULT '{}'::text[],
    rate_limit_req_per_min int NOT NULL DEFAULT 600,
    last_scaled_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_autoscaling_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins can manage autoscaling rules" ON public.service_autoscaling_rules;
CREATE POLICY "Users and admins can manage autoscaling rules"
    ON public.service_autoscaling_rules
    FOR ALL
    USING (auth.uid() = user_id OR public.is_admin_user())
    WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- =============================================================================
-- E. terminal_and_sql_logs (Audit Ledger for Browser SSH & SQL Query Lab)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.terminal_and_sql_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    console_type text NOT NULL CHECK (console_type IN (
        'jailed_ssh',
        'sql_runner'
    )),
    input_command_or_query text NOT NULL,
    output_result text NOT NULL,
    execution_ms int NOT NULL DEFAULT 18,
    status text NOT NULL DEFAULT 'success' CHECK (status IN (
        'success',
        'blocked_firewall',
        'syntax_error'
    )),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terminal_sql_logs_service
    ON public.terminal_and_sql_logs(service_id, created_at DESC);

ALTER TABLE public.terminal_and_sql_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins can view and insert terminal logs" ON public.terminal_and_sql_logs;
CREATE POLICY "Users and admins can view and insert terminal logs"
    ON public.terminal_and_sql_logs
    FOR ALL
    USING (auth.uid() = user_id OR public.is_admin_user())
    WITH CHECK (auth.uid() = user_id OR public.is_admin_user());
