-- ==============================================================================
-- DEVHOST CLOUD PLATFORM - PHASE 11 MIGRATION
-- Affiliate Lifecycle Automation, Profile Vault Security & Autonomous Cron Plane
-- Target: Supabase PostgreSQL 15+ (100% Idempotent & Table-Presence Guarded)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN public.affiliate_marketer_profiles SCHEMA & LOCK DOWN CLIENT WRITES
--    Prevents authenticated users from bypassing the 24h anti-hijack
--    payout_lock_until or SSRF postback URL checks directly via PostgREST.
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.affiliate_marketer_profiles') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.affiliate_marketer_profiles
                ADD COLUMN IF NOT EXISTS partner_display_name TEXT,
                ADD COLUMN IF NOT EXISTS custom_referral_slug TEXT,
                ADD COLUMN IF NOT EXISTS primary_payout_method TEXT DEFAULT 'bkash_personal',
                ADD COLUMN IF NOT EXISTS payout_wallet_number TEXT,
                ADD COLUMN IF NOT EXISTS bank_account_details JSONB DEFAULT '{}'::JSONB,
                ADD COLUMN IF NOT EXISTS payout_schedule_mode TEXT DEFAULT 'manual',
                ADD COLUMN IF NOT EXISTS min_payout_threshold_bdt NUMERIC(10, 2) DEFAULT 1000.00,
                ADD COLUMN IF NOT EXISTS conversion_postback_webhook_url TEXT,
                ADD COLUMN IF NOT EXISTS payout_lock_until TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_marketer_profiles_user_id
                ON public.affiliate_marketer_profiles(user_id)
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_marketer_profiles_slug_lower
                ON public.affiliate_marketer_profiles(lower(custom_referral_slug))
                WHERE custom_referral_slug IS NOT NULL AND length(trim(custom_referral_slug)) > 0
        $sql$;

        EXECUTE $sql$ALTER TABLE public.affiliate_marketer_profiles ENABLE ROW LEVEL SECURITY$sql$;

        -- Revoke dangerous direct client INSERT/UPDATE policies (must go through Sudo-gated /api/affiliate)
        EXECUTE $sql$DROP POLICY IF EXISTS "Users can update own affiliate marketer profile" ON public.affiliate_marketer_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users can insert own affiliate marketer profile" ON public.affiliate_marketer_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Public can check referral slug existence" ON public.affiliate_marketer_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users can view own affiliate marketer profile" ON public.affiliate_marketer_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users view own affiliate marketer profile" ON public.affiliate_marketer_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Admins manage affiliate marketer profiles" ON public.affiliate_marketer_profiles$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role full access affiliate" ON public.affiliate_marketer_profiles$sql$;

        EXECUTE $sql$
            CREATE POLICY "Users view own affiliate marketer profile"
                ON public.affiliate_marketer_profiles FOR SELECT
                USING (auth.uid() = user_id OR public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "Admins manage affiliate marketer profiles"
                ON public.affiliate_marketer_profiles FOR ALL
                USING (public.is_admin())
                WITH CHECK (public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "Service role full access affiliate"
                ON public.affiliate_marketer_profiles FOR ALL TO service_role
                USING (true) WITH CHECK (true)
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 2. RECONCILE public.affiliate_payouts AUDIT COLUMNS & INDEXES
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.affiliate_payouts') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.affiliate_payouts
                ADD COLUMN IF NOT EXISTS payout_gateway_ref TEXT,
                ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
                ADD COLUMN IF NOT EXISTS processed_by UUID
        $sql$;

        EXECUTE $sql$
            CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_user_status_created
                ON public.affiliate_payouts(affiliate_user_id, status, created_at DESC)
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 3. ATOMIC SQL CAS RPC FOR AFFILIATE PAYOUT REVIEW (APPROVE / REJECT / FORFEIT)
--    Locks payout + profile rows FOR UPDATE to eliminate concurrent double-approve
--    or approve+reject race conditions.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_affiliate_payout_review(
    p_payout_id UUID,
    p_decision TEXT,
    p_admin_user_id UUID,
    p_admin_trx_id TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_forfeit_fraud BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_payout RECORD;
    v_amount NUMERIC(10, 2);
BEGIN
    IF p_payout_id IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'error', 'Invalid payout review input.');
    END IF;

    SELECT * INTO v_payout
    FROM public.affiliate_payouts
    WHERE id = p_payout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Payout request not found.');
    END IF;

    IF v_payout.status <> 'pending_review' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'ALREADY_PROCESSED',
            'error', format('Payout request was already processed as ''%s''.', v_payout.status),
            'current_status', v_payout.status
        );
    END IF;

    v_amount := COALESCE(v_payout.amount_bdt, 0);

    IF p_decision = 'approve' THEN
        IF p_admin_trx_id IS NULL OR length(trim(p_admin_trx_id)) < 3 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'error', 'Admin settlement TrxID is required.');
        END IF;

        UPDATE public.affiliate_payouts
        SET status = 'approved_paid',
            admin_trx_id = trim(p_admin_trx_id),
            payout_gateway_ref = trim(p_admin_trx_id),
            processed_by = p_admin_user_id,
            processed_at = NOW()
        WHERE id = v_payout.id
          AND status = 'pending_review';

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PROCESSED', 'error', 'Concurrent payout state transition.');
        END IF;

        UPDATE public.affiliate_profiles
        SET total_withdrawn_bdt = ROUND((COALESCE(total_withdrawn_bdt, 0) + v_amount)::numeric, 2),
            updated_at = NOW()
        WHERE user_id = v_payout.affiliate_user_id;

        RETURN jsonb_build_object(
            'ok', true,
            'decision', 'approve',
            'payout_id', v_payout.id,
            'affiliate_user_id', v_payout.affiliate_user_id,
            'amount_bdt', v_amount
        );
    ELSE
        UPDATE public.affiliate_payouts
        SET status = 'rejected_fraud',
            rejected_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Rejected by Finance Review'),
            processed_by = p_admin_user_id,
            processed_at = NOW()
        WHERE id = v_payout.id
          AND status = 'pending_review';

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_PROCESSED', 'error', 'Concurrent payout state transition.');
        END IF;

        IF p_forfeit_fraud THEN
            UPDATE public.affiliate_profiles
            SET is_frozen_for_fraud = TRUE,
                fraud_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Forfeited due to fraud review'),
                updated_at = NOW()
            WHERE user_id = v_payout.affiliate_user_id;
        ELSE
            UPDATE public.affiliate_profiles
            SET available_balance_bdt = ROUND((COALESCE(available_balance_bdt, 0) + v_amount)::numeric, 2),
                updated_at = NOW()
            WHERE user_id = v_payout.affiliate_user_id;
        END IF;

        RETURN jsonb_build_object(
            'ok', true,
            'decision', 'reject',
            'forfeited', p_forfeit_fraud,
            'payout_id', v_payout.id,
            'affiliate_user_id', v_payout.affiliate_user_id,
            'amount_bdt', v_amount
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.process_affiliate_payout_review(UUID, TEXT, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_affiliate_payout_review(UUID, TEXT, UUID, TEXT, TEXT, BOOLEAN) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. ENSURE 35-DAY AFFILIATE COMMISSION MATURITY RPC IS HARDENED & IDEMPOTENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_mature_affiliate_commissions()
RETURNS INTEGER AS $$
DECLARE
    r RECORD;
    matured_count INTEGER := 0;
BEGIN
    IF to_regclass('public.affiliate_commissions') IS NULL OR to_regclass('public.affiliate_profiles') IS NULL THEN
        RETURN 0;
    END IF;

    FOR r IN
        SELECT id, affiliate_user_id, commission_amount_bdt
        FROM public.affiliate_commissions
        WHERE status = 'pending_35d_hold'
          AND matures_at <= NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.affiliate_commissions
        SET status = 'cleared_available',
            cleared_at = NOW()
        WHERE id = r.id
          AND status = 'pending_35d_hold';

        IF FOUND THEN
            UPDATE public.affiliate_profiles
            SET pending_clearance_bdt = GREATEST(0, COALESCE(pending_clearance_bdt, 0) - COALESCE(r.commission_amount_bdt, 0)),
                available_balance_bdt = COALESCE(available_balance_bdt, 0) + COALESCE(r.commission_amount_bdt, 0),
                updated_at = NOW()
            WHERE user_id = r.affiliate_user_id;

            matured_count := matured_count + 1;
        END IF;
    END LOOP;

    RETURN matured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.process_mature_affiliate_commissions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_mature_affiliate_commissions() TO service_role;

-- ------------------------------------------------------------------------------
-- 5. LIFECYCLE AUTOMATION COLUMNS FOR hosting_services, invoices & PR previews
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.hosting_services') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS last_renewal_invoice_id UUID,
                ADD COLUMN IF NOT EXISTS last_renewal_billed_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
                ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ
        $sql$;

        -- Reconcile status check constraint so active/suspended/pending/terminated/provisioning_failed work
        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_services'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%status%'
        LOOP
            EXECUTE format('ALTER TABLE public.hosting_services DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD CONSTRAINT hosting_services_status_check
                CHECK (status IN ('active', 'suspended', 'pending', 'terminated', 'provisioning_failed'))
        $sql$;

        EXECUTE $sql$
            CREATE INDEX IF NOT EXISTS idx_hosting_services_lifecycle_due
                ON public.hosting_services(status, next_due_date)
                WHERE status IN ('active', 'suspended')
        $sql$;
    END IF;

    IF to_regclass('public.invoices') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.invoices
                ADD COLUMN IF NOT EXISTS service_id UUID,
                ADD COLUMN IF NOT EXISTS domain_id UUID,
                ADD COLUMN IF NOT EXISTS reminder_t3_sent_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS reminder_t1_sent_at TIMESTAMPTZ
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'invoices'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%order_type%'
        LOOP
            EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.invoices
                ADD CONSTRAINT invoices_order_type_check CHECK (
                    order_type IN (
                        'hosting_order',
                        'service_renewal',
                        'renewal',
                        'wallet_topup',
                        'domain_registration',
                        'domain_register',
                        'domain_renewal',
                        'domain_renew',
                        'domain_transfer',
                        'agency_handover'
                    )
                )
        $sql$;

        EXECUTE $sql$
            CREATE INDEX IF NOT EXISTS idx_invoices_service_status_due
                ON public.invoices(service_id, status, due_date)
                WHERE service_id IS NOT NULL
        $sql$;
    END IF;

    IF to_regclass('public.hosting_preview_environments') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_preview_environments
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
        $sql$;

        EXECUTE $sql$
            CREATE INDEX IF NOT EXISTS idx_hosting_previews_expired_cleanup
                ON public.hosting_preview_environments(status, expires_at)
                WHERE status IN ('ready_live', 'building')
        $sql$;
    END IF;
END $do$;

NOTIFY pgrst, 'reload schema';
