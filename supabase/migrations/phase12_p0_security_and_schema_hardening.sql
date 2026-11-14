-- ==============================================================================
-- DEVHOST CLOUD - PHASE 12: P0 SECURITY, MULTI-TENANT RLS & SCHEMA RECONCILIATION
-- Idempotent migration: safe to run repeatedly in Supabase SQL Editor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NON-RECURSIVE ADMIN HELPER (INCLUDE superadmin CONSISTENTLY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_admin_user();
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. PRIVATE SERVER-ONLY CREDENTIALS VAULT & cms_global_config RLS LOCKDOWN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.private_integration_credentials (
    config_key TEXT PRIMARY KEY,
    config_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.private_integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access private integrations" ON public.private_integration_credentials;
CREATE POLICY "Service role full access private integrations"
    ON public.private_integration_credentials
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage private integrations" ON public.private_integration_credentials;
CREATE POLICY "Admins manage private integrations"
    ON public.private_integration_credentials
    FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DO $do$
BEGIN
    IF to_regclass('public.cms_global_config') IS NOT NULL THEN
        -- Migrate any existing plaintext integration secrets out of public cms_global_config
        INSERT INTO public.private_integration_credentials (config_key, config_value, updated_at)
        SELECT config_key, config_value, COALESCE(updated_at, NOW())
        FROM public.cms_global_config
        WHERE config_key IN ('live_integrations', 'security_lockdown')
        ON CONFLICT (config_key) DO UPDATE
            SET config_value = EXCLUDED.config_value,
                updated_at = EXCLUDED.updated_at;

        DELETE FROM public.cms_global_config
        WHERE config_key = 'live_integrations';

        EXECUTE $sql$DROP POLICY IF EXISTS "Public read cms_global_config" ON public.cms_global_config$sql$;
        EXECUTE $sql$
            CREATE POLICY "Public read cms_global_config" ON public.cms_global_config
                FOR SELECT
                USING (
                    config_key IN (
                        'announcement_banner',
                        'hero_cms_content',
                        'public_branding',
                        'footer_links',
                        'pricing_badges'
                    )
                    OR public.is_admin_user()
                )
        $sql$;

        EXECUTE $sql$DROP POLICY IF EXISTS "Admins modify cms_global_config" ON public.cms_global_config$sql$;
        EXECUTE $sql$
            CREATE POLICY "Admins modify cms_global_config" ON public.cms_global_config
                FOR ALL
                TO authenticated
                USING (public.is_admin_user())
                WITH CHECK (public.is_admin_user())
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 3. LOCK DOWN PROMO CODES & AUDIT LOGS RLS
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.promo_codes') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Public can view active promo codes" ON public.promo_codes$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Service or admin view promo codes" ON public.promo_codes$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service or admin view promo codes"
                ON public.promo_codes FOR SELECT
                TO authenticated
                USING (public.is_admin_user())
        $sql$;
    END IF;

    IF to_regclass('public.security_audit_logs') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Allow system and users to insert audit logs" ON public.security_audit_logs$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users insert own audit logs or admin" ON public.security_audit_logs$sql$;
        EXECUTE $sql$
            CREATE POLICY "Users insert own audit logs or admin"
                ON public.security_audit_logs FOR INSERT
                TO authenticated
                WITH CHECK (auth.uid() = actor_id OR public.is_admin_user())
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 4. INVOICE ENTITLEMENT & HANDOVER CONSUMPTION TRACKING (PREVENT REPLAY)
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.invoices') IS NOT NULL THEN
        ALTER TABLE public.invoices
            ADD COLUMN IF NOT EXISTS domain_entitlement_consumed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS domain_entitlement_consumed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS domain_entitlement_consumed_for TEXT,
            ADD COLUMN IF NOT EXISTS handover_claimed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS handover_claimed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS handover_token_claimed TEXT;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 5. SCHEMA DRIFT RECONCILIATION (COMPUTE, DNS, WAF FRAUD, AFFILIATES, ENV)
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    -- 5A. domain_dns_records optional service/domain linkage for Log Doctor & Email
    IF to_regclass('public.domain_dns_records') IS NOT NULL THEN
        ALTER TABLE public.domain_dns_records
            ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.hosting_services(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS domain TEXT;
    END IF;

    -- 5B. compute_build_jobs additional git/completion columns
    IF to_regclass('public.compute_build_jobs') IS NOT NULL THEN
        ALTER TABLE public.compute_build_jobs
            ADD COLUMN IF NOT EXISTS git_repo_url TEXT,
            ADD COLUMN IF NOT EXISTS git_branch TEXT,
            ADD COLUMN IF NOT EXISTS commit_sha TEXT,
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    END IF;

    -- 5C. project_deployments & hosting_virtual_filesystem timestamp column alignment
    IF to_regclass('public.project_deployments') IS NOT NULL THEN
        ALTER TABLE public.project_deployments
            ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    END IF;

    IF to_regclass('public.hosting_virtual_filesystem') IS NOT NULL THEN
        ALTER TABLE public.hosting_virtual_filesystem
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    -- 5D. terminal_and_sql_logs column alignment
    IF to_regclass('public.terminal_and_sql_logs') IS NOT NULL THEN
        ALTER TABLE public.terminal_and_sql_logs
            ADD COLUMN IF NOT EXISTS command_or_query TEXT,
            ADD COLUMN IF NOT EXISTS execution_status TEXT,
            ADD COLUMN IF NOT EXISTS output_preview TEXT,
            ADD COLUMN IF NOT EXISTS execution_time_ms INT DEFAULT 0;

        ALTER TABLE public.terminal_and_sql_logs
            ALTER COLUMN input_command_or_query SET DEFAULT '',
            ALTER COLUMN output_result SET DEFAULT '';
    END IF;

    -- 5E. fraud_alerts alert_type + description/metadata alignment
    IF to_regclass('public.fraud_alerts') IS NOT NULL THEN
        ALTER TABLE public.fraud_alerts
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

        ALTER TABLE public.fraud_alerts
            DROP CONSTRAINT IF EXISTS fraud_alerts_alert_type_check;
        ALTER TABLE public.fraud_alerts
            ADD CONSTRAINT fraud_alerts_alert_type_check CHECK (
                alert_type IN (
                    'self_referral_attempt',
                    'duplicate_trxid',
                    'brute_force_ip',
                    'disposable_email',
                    'velocity_abuse',
                    'WAF_AUTO_BAN',
                    'FAILED_ADMIN_LOGIN'
                )
            );
    END IF;

    -- 5F. affiliate_marketer_profiles schedule modes & optional custom slug
    IF to_regclass('public.affiliate_marketer_profiles') IS NOT NULL THEN
        ALTER TABLE public.affiliate_marketer_profiles
            ALTER COLUMN custom_referral_slug DROP NOT NULL;

        ALTER TABLE public.affiliate_marketer_profiles
            DROP CONSTRAINT IF EXISTS affiliate_marketer_profiles_payout_schedule_mode_check;
        ALTER TABLE public.affiliate_marketer_profiles
            ADD CONSTRAINT affiliate_marketer_profiles_payout_schedule_mode_check CHECK (
                payout_schedule_mode IN (
                    'manual_request',
                    'auto_monthly_5th',
                    'manual',
                    'auto_monthly_1st',
                    'auto_threshold'
                )
            );
    END IF;

    -- 5G. project_env_variables target_environment CHECK includes 'preview'
    IF to_regclass('public.project_env_variables') IS NOT NULL THEN
        ALTER TABLE public.project_env_variables
            DROP CONSTRAINT IF EXISTS project_env_variables_target_environment_check;
        ALTER TABLE public.project_env_variables
            ADD CONSTRAINT project_env_variables_target_environment_check CHECK (
                target_environment IN ('production', 'preview', 'staging', 'all')
            );
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 6. ATOMIC WALLET ADJUSTMENT & AFFILIATE PAYOUT RPCS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_atomic(
    p_user_id UUID,
    p_delta_bdt NUMERIC,
    p_reason TEXT DEFAULT 'Administrative adjustment',
    p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
    ok BOOLEAN,
    new_balance_bdt NUMERIC,
    entry_code TEXT,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance NUMERIC;
    v_entry_code TEXT;
BEGIN
    UPDATE public.profiles
    SET wallet_balance_bdt = ROUND((COALESCE(wallet_balance_bdt, 0) + p_delta_bdt)::numeric, 2),
        updated_at = NOW()
    WHERE id = p_user_id
      AND COALESCE(wallet_balance_bdt, 0) + p_delta_bdt >= 0
    RETURNING wallet_balance_bdt INTO v_new_balance;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::NUMERIC, NULL::TEXT, 'User not found or wallet balance would drop below 0.'::TEXT;
        RETURN;
    END IF;

    v_entry_code := 'LDG-' || to_char(NOW(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    INSERT INTO public.financial_profit_ledger (
        entry_code,
        entry_type,
        user_id,
        gateway,
        gross_amount_bdt,
        base_cogs_cost_bdt,
        affiliate_commission_bdt,
        notes
    ) VALUES (
        v_entry_code,
        'wallet_topup',
        p_user_id,
        'system',
        p_delta_bdt,
        0,
        0,
        'Admin Wallet Balance Adjustment: ' || CASE WHEN p_delta_bdt >= 0 THEN '+' ELSE '' END || p_delta_bdt::text || ' BDT. Reason: ' || COALESCE(NULLIF(trim(p_reason), ''), 'Administrative adjustment')
    );

    RETURN QUERY SELECT true, v_new_balance, v_entry_code, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_wallet_atomic(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet_atomic(UUID, NUMERIC, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.request_affiliate_payout_atomic(
    p_user_id UUID,
    p_amount_bdt NUMERIC,
    p_payout_method TEXT,
    p_account_details TEXT
)
RETURNS TABLE (
    ok BOOLEAN,
    payout_id UUID,
    available_balance_bdt NUMERIC,
    error_code TEXT,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prof public.affiliate_profiles%ROWTYPE;
    v_new_balance NUMERIC;
    v_payout_id UUID;
BEGIN
    SELECT *
    INTO v_prof
    FROM public.affiliate_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, 'NOT_FOUND'::TEXT, 'Affiliate profile not found.'::TEXT;
        RETURN;
    END IF;

    IF COALESCE(v_prof.is_frozen_for_fraud, false) THEN
        RETURN QUERY SELECT false, NULL::UUID, COALESCE(v_prof.available_balance_bdt, 0), 'ACCOUNT_FROZEN'::TEXT, 'Affiliate account is frozen due to fraud investigation.'::TEXT;
        RETURN;
    END IF;

    IF COALESCE(v_prof.available_balance_bdt, 0) < p_amount_bdt THEN
        RETURN QUERY SELECT false, NULL::UUID, COALESCE(v_prof.available_balance_bdt, 0), 'INSUFFICIENT_BALANCE'::TEXT, 'Insufficient available balance for withdrawal.'::TEXT;
        RETURN;
    END IF;

    v_new_balance := ROUND((v_prof.available_balance_bdt - p_amount_bdt)::numeric, 2);

    UPDATE public.affiliate_profiles
    SET available_balance_bdt = v_new_balance,
        payout_method = p_payout_method,
        payout_account_number = p_account_details,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.affiliate_payouts (
        affiliate_user_id,
        amount_bdt,
        payout_method,
        account_details,
        status
    ) VALUES (
        p_user_id,
        p_amount_bdt,
        p_payout_method,
        p_account_details,
        'pending_review'
    )
    RETURNING id INTO v_payout_id;

    RETURN QUERY SELECT true, v_payout_id, v_new_balance, NULL::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.request_affiliate_payout_atomic(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_affiliate_payout_atomic(UUID, NUMERIC, TEXT, TEXT) TO service_role;
