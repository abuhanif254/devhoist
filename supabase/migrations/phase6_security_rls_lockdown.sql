-- ==============================================================================
-- DEVHOST CLOUD — PHASE 6: ZERO-TRUST SECURITY & RLS LOCKDOWN MIGRATION
-- ==============================================================================
-- Run this idempotent migration in your Supabase SQL Editor.
--
-- Hardens every financial, registrar, credential, and compute table against:
--   1. Direct PostgREST client writes (FOR ALL policies replaced by SELECT-only
--      for owners, restricting all INSERT/UPDATE/DELETE mutations to server-side
--      service_role / verified admin helpers and SECURITY DEFINER RPCs).
--   2. Cross-migration drift between is_admin() and is_admin_user().
--   3. Exposure of user_security_credentials (TOTP secrets, recovery hashes,
--      PBKDF2 Sudo PIN hashes) and auth_login_attempts spam via PostgREST.
--   4. Unscoped transaction insertion by regular authenticated users.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UNIFY NON-RECURSIVE ADMIN HELPERS (admin + superadmin, fixed search_path)
-- ------------------------------------------------------------------------------
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. LOCK CREDENTIAL & AUTH LOG TABLES (ZERO DIRECT CLIENT ACCESS)
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    pol RECORD;
BEGIN
    -- A. user_security_credentials holds TOTP Base32 secrets, Sudo PIN hashes,
    --    and backup recovery hashes; all access must go through /api/auth/2fa
    --    over service_role so client PostgREST tokens cannot read or mutate secrets.
    IF to_regclass('public.user_security_credentials') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_security_credentials ENABLE ROW LEVEL SECURITY';
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'user_security_credentials'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_security_credentials', pol.policyname);
        END LOOP;

        EXECUTE $sql$
            CREATE POLICY "phase6_security_credentials_service_only"
                ON public.user_security_credentials
                FOR ALL TO service_role
                USING (true)
                WITH CHECK (true)
        $sql$;
    END IF;

    -- B. auth_login_attempts: lock anonymous inserts; backend records via service_role
    IF to_regclass('public.auth_login_attempts') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY';
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'auth_login_attempts'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.auth_login_attempts', pol.policyname);
        END LOOP;

        EXECUTE $sql$
            CREATE POLICY "phase6_login_attempts_admin_select"
                ON public.auth_login_attempts
                FOR SELECT TO authenticated
                USING (public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_login_attempts_service_all"
                ON public.auth_login_attempts
                FOR ALL TO service_role
                USING (true)
                WITH CHECK (true)
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 3. LOCK FINANCIAL, AFFILIATE PAYOUT & HANDOVER TABLES (OWNER SELECT ONLY)
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    pol RECORD;
BEGIN
    -- A. affiliate_payouts: users view own payouts; creation/approval only via /api/affiliate
    IF to_regclass('public.affiliate_payouts') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY';
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'affiliate_payouts'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.affiliate_payouts', pol.policyname);
        END LOOP;

        EXECUTE $sql$
            CREATE POLICY "phase6_affiliate_payouts_owner_select"
                ON public.affiliate_payouts
                FOR SELECT TO authenticated
                USING (auth.uid() = affiliate_user_id OR public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_affiliate_payouts_admin_all"
                ON public.affiliate_payouts
                FOR ALL TO authenticated
                USING (public.is_admin())
                WITH CHECK (public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_affiliate_payouts_service_all"
                ON public.affiliate_payouts
                FOR ALL TO service_role
                USING (true)
                WITH CHECK (true)
        $sql$;
    END IF;

    -- B. transactions: users view own payment records; NEVER client-insertable
    IF to_regclass('public.transactions') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY';
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'transactions'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', pol.policyname);
        END LOOP;

        EXECUTE $sql$
            CREATE POLICY "phase6_transactions_owner_select"
                ON public.transactions
                FOR SELECT TO authenticated
                USING (auth.uid() = user_id OR public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_transactions_admin_all"
                ON public.transactions
                FOR ALL TO authenticated
                USING (public.is_admin())
                WITH CHECK (public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_transactions_service_all"
                ON public.transactions
                FOR ALL TO service_role
                USING (true)
                WITH CHECK (true)
        $sql$;
    END IF;

    -- C. agency_handover_transfers: participants view only; claims/creation via API
    IF to_regclass('public.agency_handover_transfers') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.agency_handover_transfers ENABLE ROW LEVEL SECURITY';
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'agency_handover_transfers'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.agency_handover_transfers', pol.policyname);
        END LOOP;

        EXECUTE $sql$
            CREATE POLICY "phase6_handovers_participant_select"
                ON public.agency_handover_transfers
                FOR SELECT TO authenticated
                USING (
                    auth.uid() = developer_user_id
                    OR auth.uid() = claimed_by_user_id
                    OR public.is_admin()
                )
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_handovers_admin_all"
                ON public.agency_handover_transfers
                FOR ALL TO authenticated
                USING (public.is_admin())
                WITH CHECK (public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "phase6_handovers_service_all"
                ON public.agency_handover_transfers
                FOR ALL TO service_role
                USING (true)
                WITH CHECK (true)
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 4. LOCK BILLING, HOSTING, REGISTRAR & COMPUTE TABLES TO SERVER CONTROL PLANE
--    Owners retain SELECT-only RLS; all writes pass through Next.js API guards.
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    tbl TEXT;
    pol RECORD;
    owned_tables TEXT[] := ARRAY[
        'hosting_services',
        'domains',
        'invoices',
        'service_autoscaling_rules',
        'hosting_project_settings',
        'project_deployments',
        'project_env_variables',
        'hosting_databases',
        'hosting_backups',
        'hosting_cron_jobs',
        'hosting_virtual_filesystem',
        'hosting_preview_environments',
        'hosting_email_accounts',
        'terminal_and_sql_logs',
        'domain_transfers',
        'domain_dns_records',
        'domain_child_nameservers',
        'domain_url_forwards',
        'hosting_addon_domains'
    ];
BEGIN
    FOREACH tbl IN ARRAY owned_tables LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

            FOR pol IN
                SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
            END LOOP;

            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin())',
                'phase6_' || tbl || '_owner_select',
                tbl
            );

            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
                'phase6_' || tbl || '_admin_all',
                tbl
            );

            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
                'phase6_' || tbl || '_service_all',
                tbl
            );
        END IF;
    END LOOP;
END $do$;

-- Reload PostgREST schema & RLS cache immediately
NOTIFY pgrst, 'reload schema';
