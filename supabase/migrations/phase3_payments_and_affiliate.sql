-- ==============================================================================
-- DEVHOST CLOUD PLATFORM: PHASE 3 AUTOMATIC PAYMENTS & ZERO-LOSS AFFILIATE SQL
-- Target: Supabase PostgreSQL 15+ (100% Idempotent & Table-Presence Guarded)
--
-- Features:
--   1. Reconciles invoices (attribution + verifying_trxid) & transactions schema
--   2. Enhances affiliate_commissions (4-signal fraud hashes + unique invoice lock)
--   3. ACID process_atomic_wallet_payment(p_user_id, p_invoice_number, p_trx_id) RPC
--   4. Idempotent credit_user_wallet_atomic(p_user_id, p_amount_bdt, p_gateway, p_trx_id, p_description) RPC
--   5. Idempotent commission maturity & 30-day refund clawback trigger parity
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INVOICES ATTRIBUTION & STATUS RECONCILIATION
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.invoices') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.invoices
                ADD COLUMN IF NOT EXISTS referral_code TEXT,
                ADD COLUMN IF NOT EXISTS referral_sub_id TEXT DEFAULT 'organic',
                ADD COLUMN IF NOT EXISTS plan_id TEXT,
                ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'hosting_order',
                ADD COLUMN IF NOT EXISTS promo_code TEXT,
                ADD COLUMN IF NOT EXISTS promo_discount_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'invoices'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%status%'
        LOOP
            EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.invoices
                ADD CONSTRAINT invoices_status_check
                CHECK (status IN ('unpaid', 'verifying_trxid', 'paid', 'refunded', 'cancelled'))
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 2. TRANSACTIONS TABLE RECONCILIATION (MULTI-GATEWAY + MANUAL MFS + IDEMPOTENCY)
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.transactions') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.transactions
                ADD COLUMN IF NOT EXISTS invoice_number TEXT,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        $sql$;

        -- Allow nullable user_id if external gateway webhooks reference an orphaned order
        EXECUTE $sql$
            ALTER TABLE public.transactions
                ALTER COLUMN user_id DROP NOT NULL
        $sql$;

        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'transactions'
              AND con.contype = 'c'
              AND (
                  pg_get_constraintdef(con.oid) ILIKE '%status%'
                  OR pg_get_constraintdef(con.oid) ILIKE '%gateway%'
              )
        LOOP
            EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.transactions
                ADD CONSTRAINT transactions_status_check
                CHECK (status IN ('Completed', 'Pending', 'Failed', 'Refunded', 'pending_verification', 'Rejected'))
        $sql$;

        EXECUTE $sql$
            ALTER TABLE public.transactions
                ADD CONSTRAINT transactions_gateway_check
                CHECK (gateway IN ('bkash', 'nagad', 'stripe', 'wallet', 'uddoktapay', 'sslcommerz', 'system', 'manual_admin'))
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_trx_id_unique
                ON public.transactions(trx_id)
        $sql$;
    END IF;
END $do$;

-- Ensure wallet_transactions exists
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
            CREATE INDEX IF NOT EXISTS idx_wallet_transactions_ref
                ON public.wallet_transactions(reference_id)
                WHERE reference_id IS NOT NULL
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 3. AFFILIATE COMMISSIONS (4-SIGNAL FRAUD SHARDS & IDEMPOTENCY LOCK)
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.affiliate_commissions') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.affiliate_commissions
                ADD COLUMN IF NOT EXISTS invoice_number TEXT,
                ADD COLUMN IF NOT EXISTS buyer_email_hash TEXT,
                ADD COLUMN IF NOT EXISTS buyer_phone_hash TEXT,
                ADD COLUMN IF NOT EXISTS payment_sender_fingerprint TEXT,
                ADD COLUMN IF NOT EXISTS loss_capped_from_bdt NUMERIC(10, 2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS commission_pool_max_bdt NUMERIC(10, 2)
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_commissions_invoice_id
                ON public.affiliate_commissions(invoice_id)
                WHERE invoice_id IS NOT NULL
        $sql$;

        EXECUTE $sql$
            CREATE INDEX IF NOT EXISTS idx_aff_commissions_fraud_hashes
                ON public.affiliate_commissions(affiliate_user_id, buyer_ip_hash, created_at DESC)
        $sql$;
    END IF;

    IF to_regclass('public.affiliate_payouts') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.affiliate_payouts
                ADD COLUMN IF NOT EXISTS payout_gateway_ref TEXT,
                ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
                ADD COLUMN IF NOT EXISTS processed_by UUID
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 4. ACID WALLET CHECKOUT RPC (ELIMINATES RACE CONDITIONS & AMOUNT TAMPERING)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_atomic_wallet_payment(
    p_user_id UUID,
    p_invoice_number TEXT,
    p_trx_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_balance NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_total NUMERIC(12, 2);
    v_trx_id TEXT;
BEGIN
    IF p_invoice_number IS NULL OR length(trim(p_invoice_number)) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'error', 'Invoice number is required.');
    END IF;

    -- Lock invoice row exclusively inside transaction
    SELECT * INTO v_inv
    FROM public.invoices
    WHERE invoice_number = trim(p_invoice_number)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Invoice not found.');
    END IF;

    IF p_user_id IS NOT NULL AND v_inv.user_id IS NOT NULL AND v_inv.user_id <> p_user_id THEN
        RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'You do not have permission to pay this invoice.');
    END IF;

    IF v_inv.status <> 'unpaid' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'ALREADY_PROCESSED',
            'error', format('Invoice is already marked as ''%s''.', v_inv.status),
            'invoice_status', v_inv.status
        );
    END IF;

    v_total := COALESCE(v_inv.total_bdt, 0);
    IF v_total <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'error', 'Invalid invoice total on server.');
    END IF;

    -- Lock buyer wallet profile row exclusively
    SELECT wallet_balance_bdt INTO v_balance
    FROM public.profiles
    WHERE id = v_inv.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND', 'error', 'User profile not found.');
    END IF;

    v_balance := COALESCE(v_balance, 0);
    IF v_balance < v_total THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'INSUFFICIENT_BALANCE',
            'error', format('Insufficient Wallet Balance. Current balance: %s BDT, required: %s BDT.', v_balance, v_total),
            'current_balance', v_balance,
            'required_amount', v_total
        );
    END IF;

    v_trx_id := COALESCE(NULLIF(trim(p_trx_id), ''), 'WLT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

    -- Single atomic subtraction inside the locked transaction
    UPDATE public.profiles
    SET wallet_balance_bdt = ROUND((wallet_balance_bdt - v_total)::numeric, 2),
        updated_at = NOW()
    WHERE id = v_inv.user_id
      AND wallet_balance_bdt >= v_total
    RETURNING wallet_balance_bdt INTO v_new_balance;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'CONFLICT', 'error', 'Concurrent balance conflict during debit.');
    END IF;

    -- Mark invoice paid atomically
    UPDATE public.invoices
    SET status = 'paid',
        payment_method = 'wallet',
        payment_gateway = 'wallet',
        trx_id = v_trx_id,
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = v_inv.id;

    -- Record payment transaction
    IF to_regclass('public.transactions') IS NOT NULL THEN
        INSERT INTO public.transactions (
            invoice_id,
            invoice_number,
            user_id,
            gateway,
            trx_id,
            amount_bdt,
            status,
            raw_payload
        ) VALUES (
            v_inv.id,
            v_inv.invoice_number,
            v_inv.user_id,
            'wallet',
            v_trx_id,
            v_total,
            'Completed',
            jsonb_build_object(
                'paymentType', 'wallet_debit',
                'previousBalance', v_balance,
                'newBalance', v_new_balance,
                'paidAt', NOW()
            )
        )
        ON CONFLICT (trx_id) DO NOTHING;
    END IF;

    -- Record wallet ledger entry
    IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
        INSERT INTO public.wallet_transactions (
            user_id,
            type,
            amount_bdt,
            balance_after_bdt,
            description,
            reference_id,
            gateway
        ) VALUES (
            v_inv.user_id,
            'debit',
            v_total,
            v_new_balance,
            format('Invoice %s Paid via Prepaid Cloud Wallet', v_inv.invoice_number),
            v_trx_id,
            'wallet'
        );
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'invoice_id', v_inv.id,
        'invoice_number', v_inv.invoice_number,
        'user_id', v_inv.user_id,
        'total_bdt', v_total,
        'previous_balance', v_balance,
        'new_balance', v_new_balance,
        'trx_id', v_trx_id,
        'billing_cycle', COALESCE(v_inv.billing_cycle, 'monthly'),
        'free_domain_bundle_applied', COALESCE(v_inv.free_domain_bundle_applied, false),
        'bundled_domain_name', v_inv.bundled_domain_name,
        'referral_code', v_inv.referral_code,
        'referral_sub_id', COALESCE(v_inv.referral_sub_id, 'organic'),
        'order_type', COALESCE(v_inv.order_type, 'hosting_order'),
        'promo_discount_bdt', COALESCE(v_inv.promo_discount_bdt, 0),
        'plan_id', v_inv.plan_id,
        'items', v_inv.items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.process_atomic_wallet_payment(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_atomic_wallet_payment(UUID, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. IDEMPOTENT ATOMIC WALLET TOP-UP RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_user_wallet_atomic(
    p_user_id UUID,
    p_amount_bdt NUMERIC,
    p_gateway TEXT,
    p_trx_id TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_new_balance NUMERIC(12, 2);
BEGIN
    IF p_user_id IS NULL OR p_amount_bdt IS NULL OR p_amount_bdt <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'error', 'Valid user_id and positive amount required.');
    END IF;

    -- Lock user profile row
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND', 'error', 'User profile not found.');
    END IF;

    -- Idempotency check against reference_id
    IF p_trx_id IS NOT NULL AND to_regclass('public.wallet_transactions') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.wallet_transactions
            WHERE reference_id = p_trx_id AND type = 'credit'
        ) THEN
            SELECT wallet_balance_bdt INTO v_new_balance FROM public.profiles WHERE id = p_user_id;
            RETURN jsonb_build_object('ok', true, 'already_credited', true, 'new_balance', v_new_balance);
        END IF;
    END IF;

    UPDATE public.profiles
    SET wallet_balance_bdt = ROUND((COALESCE(wallet_balance_bdt, 0) + p_amount_bdt)::numeric, 2),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING wallet_balance_bdt INTO v_new_balance;

    IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
        INSERT INTO public.wallet_transactions (
            user_id,
            type,
            amount_bdt,
            balance_after_bdt,
            description,
            reference_id,
            gateway
        ) VALUES (
            p_user_id,
            'credit',
            p_amount_bdt,
            v_new_balance,
            COALESCE(p_description, format('Prepaid Wallet Top-Up via %s (%s)', COALESCE(p_gateway, 'gateway'), COALESCE(p_trx_id, 'instant'))),
            p_trx_id,
            COALESCE(p_gateway, 'wallet')
        );
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'already_credited', false,
        'credited_amount', p_amount_bdt,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.credit_user_wallet_atomic(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_user_wallet_atomic(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. ENSURE AFFILIATE MATURITY & CLAWBACK FUNCTIONS / TRIGGERS ARE INSTALLED
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
        WHERE status = 'pending_35d_hold' AND matures_at <= NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.affiliate_commissions
        SET status = 'cleared_available',
            cleared_at = NOW()
        WHERE id = r.id;

        UPDATE public.affiliate_profiles
        SET pending_clearance_bdt = GREATEST(0, pending_clearance_bdt - r.commission_amount_bdt),
            available_balance_bdt = available_balance_bdt + r.commission_amount_bdt,
            updated_at = NOW()
        WHERE user_id = r.affiliate_user_id;

        matured_count := matured_count + 1;
    END LOOP;

    RETURN matured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.process_mature_affiliate_commissions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_mature_affiliate_commissions() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_invoice_refund_clawback()
RETURNS TRIGGER AS $$
DECLARE
    comm RECORD;
BEGIN
    IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
        IF to_regclass('public.affiliate_commissions') IS NULL OR to_regclass('public.affiliate_profiles') IS NULL THEN
            RETURN NEW;
        END IF;

        FOR comm IN
            SELECT id, affiliate_user_id, commission_amount_bdt, status
            FROM public.affiliate_commissions
            WHERE invoice_id = NEW.id
            FOR UPDATE
        LOOP
            IF comm.status = 'pending_35d_hold' THEN
                UPDATE public.affiliate_profiles
                SET pending_clearance_bdt = GREATEST(0, pending_clearance_bdt - comm.commission_amount_bdt),
                    updated_at = NOW()
                WHERE user_id = comm.affiliate_user_id;
            ELSIF comm.status = 'cleared_available' THEN
                UPDATE public.affiliate_profiles
                SET available_balance_bdt = GREATEST(0, available_balance_bdt - comm.commission_amount_bdt),
                    updated_at = NOW()
                WHERE user_id = comm.affiliate_user_id;
            END IF;

            IF comm.status <> 'clawed_back_refunded' THEN
                UPDATE public.affiliate_commissions
                SET status = 'clawed_back_refunded',
                    clawed_back_at = NOW(),
                    notes = 'Auto-clawed back due to invoice refund guarantee'
                WHERE id = comm.id;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $do$
BEGIN
    IF to_regclass('public.invoices') IS NOT NULL THEN
        EXECUTE $sql$DROP TRIGGER IF EXISTS trigger_invoice_refund_clawback ON public.invoices$sql$;
        EXECUTE $sql$
            CREATE TRIGGER trigger_invoice_refund_clawback
                AFTER UPDATE OF status ON public.invoices
                FOR EACH ROW EXECUTE FUNCTION public.handle_invoice_refund_clawback()
        $sql$;
    END IF;
END $do$;

NOTIFY pgrst, 'reload schema';
