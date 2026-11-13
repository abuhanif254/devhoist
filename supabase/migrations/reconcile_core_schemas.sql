-- ==============================================================================
-- DEVHOST CLOUD PLATFORM: PHASE 2 MASTER SCHEMA & RLS RECONCILIATION MIGRATION
-- Target: Supabase PostgreSQL 15+ (100% Idempotent & Table-Presence Guarded)
--
-- Fixes & Reconciles:
--   1. Unified admin RBAC helper functions (is_admin & is_admin_user) + role enum
--   2. Column/constraint parity for stackProvisioner, zeroTouchProvisioner,
--      hosting/previews, admin/ledger, admin/nodes-crm, and /api/catalog
--   3. Missing public.wallet_transactions table + indexes + RLS
--   4. Multi-record DNS unique constraint & flexible server_node/gateway checks
--   5. Safely closes overly permissive RLS policies across autonomous_cloud_suite,
--      workflow2_profiles_and_2fa, and security_and_affiliate_schema using
--      to_regclass guards so execution never fails if optional suites are not yet applied.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UNIFIED ADMIN RBAC HELPERS & PROFILES PARITY
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.profiles
                ADD COLUMN IF NOT EXISTS referral_code TEXT,
                ADD COLUMN IF NOT EXISTS company TEXT
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'profiles'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%role%'
        LOOP
            EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.profiles
                ADD CONSTRAINT profiles_role_check CHECK (role IN ('client', 'admin', 'superadmin'))
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
                ON public.profiles(referral_code)
                WHERE referral_code IS NOT NULL
        $sql$;
    END IF;
END $do$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    matched BOOLEAN := false;
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN false;
    END IF;
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'superadmin')
    ) INTO matched;
    RETURN COALESCE(matched, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    matched BOOLEAN := false;
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN false;
    END IF;
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'superadmin')
    ) INTO matched;
    RETURN COALESCE(matched, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. HOSTING SERVICES & DOMAIN DNS RECORDS RECONCILIATION
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.hosting_services') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD COLUMN IF NOT EXISTS package_name TEXT,
                ADD COLUMN IF NOT EXISTS server_location TEXT DEFAULT 'Singapore NVMe Cluster',
                ADD COLUMN IF NOT EXISTS disk_usage_gb NUMERIC(10, 2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'pending',
                ADD COLUMN IF NOT EXISTS force_https BOOLEAN DEFAULT true,
                ADD COLUMN IF NOT EXISTS auto_ssl_issued_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS stack_slug TEXT
        $sql$;

        -- Relax server_node CHECK so dynamic whm_server_nodes.node_code values work
        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_services'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%server_node%'
        LOOP
            EXECUTE format('ALTER TABLE public.hosting_services DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        -- Ensure unique(domain) exists for zeroTouchProvisioner ON CONFLICT (domain)
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_services'
              AND con.contype IN ('u', 'p')
              AND pg_get_constraintdef(con.oid) ILIKE '%(domain)%'
        ) THEN
            EXECUTE $sql$
                ALTER TABLE public.hosting_services
                    ADD CONSTRAINT uq_hosting_services_domain UNIQUE (domain)
            $sql$;
        END IF;
    END IF;
END $do$;

-- Support multi-record DNS zones (e.g. multiple TXT/MX/A) and atomic upserts
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.domain_dns_records') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.domain_dns_records
                ADD COLUMN IF NOT EXISTS proxied BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS is_system_managed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS comment TEXT,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'domain_dns_records'
              AND con.contype = 'u'
              AND pg_get_constraintdef(con.oid) ILIKE '%(domain_id, name, record_type)%'
        LOOP
            EXECUTE format('ALTER TABLE public.domain_dns_records DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'domain_dns_records'
              AND (
                  con.conname = 'uq_domain_dns_record_tuple'
                  OR (con.contype = 'u' AND pg_get_constraintdef(con.oid) ILIKE '%(domain_id, name, record_type, content)%')
              )
        ) THEN
            EXECUTE $sql$
                ALTER TABLE public.domain_dns_records
                    ADD CONSTRAINT uq_domain_dns_record_tuple UNIQUE (domain_id, name, record_type, content)
            $sql$;
        END IF;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 3. HOSTING PROJECT SETTINGS, DATABASES, ENV VARS, CRON JOBS & DEPLOYMENTS
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.hosting_project_settings') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_project_settings
                ADD COLUMN IF NOT EXISTS stack_slug TEXT,
                ADD COLUMN IF NOT EXISTS production_branch TEXT NOT NULL DEFAULT 'main',
                ADD COLUMN IF NOT EXISTS output_directory TEXT,
                ADD COLUMN IF NOT EXISTS startup_file TEXT,
                ADD COLUMN IF NOT EXISTS auto_deploy_on_push BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS zero_downtime_symlink BOOLEAN NOT NULL DEFAULT true
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_project_settings'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%framework_preset%'
        LOOP
            EXECUTE format('ALTER TABLE public.hosting_project_settings DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.hosting_project_settings
                ADD CONSTRAINT hosting_project_settings_framework_preset_check CHECK (
                    framework_preset IN (
                        'nextjs_standalone',
                        'nextjs_ssr',
                        'nodejs_express',
                        'laravel_php',
                        'laravel_artisan',
                        'wordpress_lscache',
                        'wordpress_turbo',
                        'python_wsgi',
                        'static_site',
                        'static_html',
                        'custom_docker'
                    )
                )
        $sql$;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_project_settings'
              AND con.contype IN ('u', 'p')
              AND pg_get_constraintdef(con.oid) ILIKE '%(service_id)%'
        ) THEN
            EXECUTE $sql$
                ALTER TABLE public.hosting_project_settings
                    ADD CONSTRAINT uq_hosting_project_settings_service_id UNIQUE (service_id)
            $sql$;
        END IF;
    END IF;
END $do$;

-- hosting_databases: canonical columns db_engine, db_username, db_password_hash + (service_id, db_name) unique
DO $do$
BEGIN
    IF to_regclass('public.hosting_databases') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_databases
                ADD COLUMN IF NOT EXISTS db_engine TEXT NOT NULL DEFAULT 'MySQL 8.0',
                ADD COLUMN IF NOT EXISTS db_username TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS db_password_hash TEXT NOT NULL DEFAULT 'managed_vault_ref',
                ADD COLUMN IF NOT EXISTS charset TEXT DEFAULT 'utf8mb4',
                ADD COLUMN IF NOT EXISTS size_mb NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS remote_access_ips TEXT[] DEFAULT ARRAY['127.0.0.1']
        $sql$;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_databases'
              AND (
                  con.conname = 'uq_hosting_databases_service_dbname'
                  OR (con.contype = 'u' AND pg_get_constraintdef(con.oid) ILIKE '%(service_id, db_name)%')
              )
        ) THEN
            EXECUTE $sql$
                ALTER TABLE public.hosting_databases
                    ADD CONSTRAINT uq_hosting_databases_service_dbname UNIQUE (service_id, db_name)
            $sql$;
        END IF;
    END IF;
END $do$;

-- project_env_variables: canonical env_key, target_environment + uq_service_env_target
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.project_env_variables') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.project_env_variables
                ADD COLUMN IF NOT EXISTS target_environment TEXT NOT NULL DEFAULT 'production'
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'project_env_variables'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%target_environment%'
        LOOP
            EXECUTE format('ALTER TABLE public.project_env_variables DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.project_env_variables
                ADD CONSTRAINT project_env_variables_target_environment_check
                CHECK (target_environment IN ('production', 'preview', 'staging', 'all'))
        $sql$;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'project_env_variables'
              AND (
                  con.conname = 'uq_service_env_target'
                  OR (con.contype = 'u' AND pg_get_constraintdef(con.oid) ILIKE '%(service_id, env_key, target_environment)%')
              )
        ) THEN
            EXECUTE $sql$
                ALTER TABLE public.project_env_variables
                    ADD CONSTRAINT uq_service_env_target UNIQUE (service_id, env_key, target_environment)
            $sql$;
        END IF;
    END IF;
END $do$;

-- hosting_cron_jobs: ensure job_label column
DO $do$
BEGIN
    IF to_regclass('public.hosting_cron_jobs') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_cron_jobs
                ADD COLUMN IF NOT EXISTS job_label TEXT NOT NULL DEFAULT 'Scheduled Task'
        $sql$;
    END IF;
END $do$;

-- project_deployments: reconcile status, trigger_source, and timing columns
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.project_deployments') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.project_deployments
                ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production',
                ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'manual_redeploy',
                ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
                ADD COLUMN IF NOT EXISTS is_current_production BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS build_logs TEXT,
                ADD COLUMN IF NOT EXISTS preview_url TEXT,
                ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'project_deployments'
              AND con.contype = 'c'
              AND (
                  pg_get_constraintdef(con.oid) ILIKE '%status%'
                  OR pg_get_constraintdef(con.oid) ILIKE '%trigger_source%'
              )
        LOOP
            EXECUTE format('ALTER TABLE public.project_deployments DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.project_deployments
                ADD CONSTRAINT project_deployments_status_check CHECK (
                    status IN ('queued', 'building', 'deploying', 'live_production', 'superseded', 'failed', 'rolled_back')
                )
        $sql$;

        EXECUTE $sql$
            ALTER TABLE public.project_deployments
                ADD CONSTRAINT project_deployments_trigger_source_check CHECK (
                    trigger_source IN (
                        'github_push',
                        'github_webhook',
                        'manual_redeploy',
                        'manual_dashboard',
                        'rollback',
                        'zip_upload',
                        'stack_blueprint',
                        'preview_promotion'
                    )
                )
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 4. BILLING, CATALOG, PROFIT LEDGER & WALLET TRANSACTIONS
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.invoices') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.invoices
                ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
                ADD COLUMN IF NOT EXISTS free_domain_bundle_applied BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS bundled_domain_name TEXT,
                ADD COLUMN IF NOT EXISTS payment_gateway TEXT,
                ADD COLUMN IF NOT EXISTS plan_name TEXT,
                ADD COLUMN IF NOT EXISTS description TEXT
        $sql$;
    END IF;

    IF to_regclass('public.catalog_hosting_plans') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.catalog_hosting_plans
                ADD COLUMN IF NOT EXISTS free_domain_tlds_annual TEXT[] DEFAULT ARRAY['.com', '.net', '.org', '.xyz'],
                ADD COLUMN IF NOT EXISTS free_domain_max_cost_bdt NUMERIC(10, 2) DEFAULT 1500.00
        $sql$;
    END IF;

    IF to_regclass('public.financial_profit_ledger') IS NOT NULL THEN
        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'financial_profit_ledger'
              AND con.contype = 'c'
              AND (
                  pg_get_constraintdef(con.oid) ILIKE '%gateway%'
                  OR pg_get_constraintdef(con.oid) ILIKE '%entry_type%'
              )
        LOOP
            EXECUTE format('ALTER TABLE public.financial_profit_ledger DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.financial_profit_ledger
                ADD CONSTRAINT financial_profit_ledger_gateway_check CHECK (
                    gateway IN ('bkash', 'nagad', 'uddoktapay', 'sslcommerz', 'stripe', 'wallet', 'system', 'manual_admin')
                )
        $sql$;

        EXECUTE $sql$
            ALTER TABLE public.financial_profit_ledger
                ADD CONSTRAINT financial_profit_ledger_entry_type_check CHECK (
                    entry_type IN (
                        'hosting_sale',
                        'hosting_renewal',
                        'vps_sale',
                        'domain_registration',
                        'domain_renewal',
                        'addon_purchase',
                        'wallet_topup',
                        'affiliate_commission',
                        'affiliate_payout',
                        'customer_refund',
                        'refund_loss',
                        'server_infrastructure_expense',
                        'manual_adjustment'
                    )
                )
        $sql$;
    END IF;
END $do$;

-- Missing Wallet Transactions Ledger (queried by client portal & billing webhooks)
DO $do$
BEGIN
    IF to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS public.wallet_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'affiliate_payout', 'commission_clawback')),
                amount_bdt NUMERIC(12, 2) NOT NULL,
                balance_after_bdt NUMERIC(12, 2),
                description TEXT NOT NULL,
                reference_id TEXT,
                gateway TEXT DEFAULT 'wallet',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        $sql$;

        EXECUTE $sql$
            CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
                ON public.wallet_transactions(user_id, created_at DESC)
        $sql$;

        EXECUTE $sql$
            ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY
        $sql$;

        EXECUTE $sql$
            DROP POLICY IF EXISTS "Users view own wallet transactions" ON public.wallet_transactions
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "Users view own wallet transactions"
                ON public.wallet_transactions FOR SELECT
                USING (auth.uid() = user_id OR public.is_admin())
        $sql$;

        EXECUTE $sql$
            DROP POLICY IF EXISTS "Admins manage wallet transactions" ON public.wallet_transactions
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "Admins manage wallet transactions"
                ON public.wallet_transactions FOR ALL
                USING (public.is_admin())
                WITH CHECK (public.is_admin())
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 5. RLS HARDENING: CLOSE OVER-PERMISSIVE PUBLIC / UN-SCOPED POLICIES
-- ------------------------------------------------------------------------------

-- 5A. autonomous_cloud_suite: Scope service-role policies explicitly to TO service_role
--     and remove broad public read on agency_handover_transfers
DO $do$
BEGIN
    IF to_regclass('public.service_uptime_telemetry') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can manage telemetry" ON public.service_uptime_telemetry$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service role can manage telemetry"
                ON public.service_uptime_telemetry FOR ALL TO service_role
                USING (true) WITH CHECK (true)
        $sql$;
    END IF;

    IF to_regclass('public.diagnostic_scans') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can manage diagnostic scans" ON public.diagnostic_scans$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service role can manage diagnostic scans"
                ON public.diagnostic_scans FOR ALL TO service_role
                USING (true) WITH CHECK (true)
        $sql$;
    END IF;

    IF to_regclass('public.abuse_quarantine_events') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can insert abuse events" ON public.abuse_quarantine_events$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can manage abuse events" ON public.abuse_quarantine_events$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service role can manage abuse events"
                ON public.abuse_quarantine_events FOR ALL TO service_role
                USING (true) WITH CHECK (true)
        $sql$;
    END IF;

    IF to_regclass('public.agency_handover_transfers') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Public can view pending handover by token" ON public.agency_handover_transfers$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can manage handovers" ON public.agency_handover_transfers$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service role can manage handovers"
                ON public.agency_handover_transfers FOR ALL TO service_role
                USING (true) WITH CHECK (true)
        $sql$;
    END IF;

    IF to_regclass('public.developer_api_logs') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can insert API logs" ON public.developer_api_logs$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service role can insert API logs"
                ON public.developer_api_logs FOR INSERT TO service_role
                WITH CHECK (true)
        $sql$;
    END IF;
END $do$;

-- 5B. workflow2_profiles_and_2fa: Reconcile columns & prevent anonymous enumeration of full marketer rows
DO $do$
BEGIN
    IF to_regclass('public.customer_developer_profiles') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.customer_developer_profiles
                ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual',
                ADD COLUMN IF NOT EXISTS company_legal_name TEXT,
                ADD COLUMN IF NOT EXISTS tax_vat_bin_number TEXT,
                ADD COLUMN IF NOT EXISTS billing_street_address TEXT,
                ADD COLUMN IF NOT EXISTS billing_city TEXT,
                ADD COLUMN IF NOT EXISTS billing_country TEXT NOT NULL DEFAULT 'Bangladesh',
                ADD COLUMN IF NOT EXISTS emergency_billing_email TEXT,
                ADD COLUMN IF NOT EXISTS whatsapp_alert_number TEXT,
                ADD COLUMN IF NOT EXISTS default_datacenter_region TEXT NOT NULL DEFAULT 'sg1',
                ADD COLUMN IF NOT EXISTS default_node_version TEXT NOT NULL DEFAULT '22',
                ADD COLUMN IF NOT EXISTS default_php_version TEXT NOT NULL DEFAULT '8.3',
                ADD COLUMN IF NOT EXISTS ssh_public_keys JSONB NOT NULL DEFAULT '[]'::JSONB,
                ADD COLUMN IF NOT EXISTS personal_api_tokens JSONB NOT NULL DEFAULT '[]'::JSONB,
                ADD COLUMN IF NOT EXISTS auto_pay_from_wallet BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        $sql$;
        EXECUTE $sql$CREATE INDEX IF NOT EXISTS idx_customer_profiles_vat ON public.customer_developer_profiles(tax_vat_bin_number)$sql$;
    END IF;

    IF to_regclass('public.affiliate_marketer_profiles') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.affiliate_marketer_profiles
                ADD COLUMN IF NOT EXISTS partner_display_name TEXT,
                ADD COLUMN IF NOT EXISTS custom_referral_slug TEXT
        $sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Public can check referral slug existence" ON public.affiliate_marketer_profiles$sql$;
    END IF;
END $do$;

CREATE OR REPLACE FUNCTION public.check_referral_slug_exists(slug_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    cleaned TEXT := lower(trim(COALESCE(slug_input, '')));
    found_in_marketer BOOLEAN := false;
    found_in_affiliate BOOLEAN := false;
BEGIN
    IF length(cleaned) = 0 THEN
        RETURN false;
    END IF;

    IF to_regclass('public.affiliate_marketer_profiles') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.affiliate_marketer_profiles WHERE lower(custom_referral_slug) = $1)'
            INTO found_in_marketer
            USING cleaned;
        IF found_in_marketer THEN
            RETURN true;
        END IF;
    END IF;

    IF to_regclass('public.affiliate_profiles') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.affiliate_profiles WHERE lower(referral_code) = $1 OR lower(COALESCE(custom_slug, '''')) = $1)'
            INTO found_in_affiliate
            USING cleaned;
        IF found_in_affiliate THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.check_referral_slug_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_referral_slug_exists(TEXT) TO anon, authenticated, service_role;

-- 5C. security_and_affiliate_schema: Lock down forged logs, fraud alerts, clicks & balance tampering
DO $do$
BEGIN
    IF to_regclass('public.security_audit_logs') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Allow system and users to insert audit logs" ON public.security_audit_logs$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users insert own audit logs or admin" ON public.security_audit_logs$sql$;
        EXECUTE $sql$
            CREATE POLICY "Users insert own audit logs or admin"
                ON public.security_audit_logs FOR INSERT
                WITH CHECK (auth.uid() = actor_id OR public.is_admin())
        $sql$;
    END IF;

    IF to_regclass('public.fraud_alerts') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "System can insert fraud alerts" ON public.fraud_alerts$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Admins or service insert fraud alerts" ON public.fraud_alerts$sql$;
        EXECUTE $sql$
            CREATE POLICY "Admins or service insert fraud alerts"
                ON public.fraud_alerts FOR INSERT
                WITH CHECK (public.is_admin())
        $sql$;
    END IF;

    IF to_regclass('public.affiliate_clicks') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Anyone can register clicks" ON public.affiliate_clicks$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Service or admin insert affiliate clicks" ON public.affiliate_clicks$sql$;
        EXECUTE $sql$
            CREATE POLICY "Service or admin insert affiliate clicks"
                ON public.affiliate_clicks FOR INSERT
                WITH CHECK (public.is_admin())
        $sql$;
    END IF;

    IF to_regclass('public.affiliate_profiles') IS NOT NULL THEN
        EXECUTE $sql$DROP POLICY IF EXISTS "Users can view and edit their own affiliate profile or Admin manage" ON public.affiliate_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users view own affiliate profile" ON public.affiliate_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Admins manage affiliate profiles" ON public.affiliate_profiles$sql$;
        EXECUTE $sql$
            CREATE POLICY "Users view own affiliate profile"
                ON public.affiliate_profiles FOR SELECT
                USING (auth.uid() = user_id OR public.is_admin())
        $sql$;
        EXECUTE $sql$
            CREATE POLICY "Admins manage affiliate profiles"
                ON public.affiliate_profiles FOR ALL
                USING (public.is_admin())
                WITH CHECK (public.is_admin())
        $sql$;
    END IF;
END $do$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
