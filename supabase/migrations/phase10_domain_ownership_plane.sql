-- ==============================================================================
-- PHASE 10: UNIFIED DOMAIN PURCHASE, TRANSFER-IN & CUSTOM DOMAIN OWNERSHIP PLANE
-- Target: Supabase PostgreSQL 15+ (100% Idempotent & Safe to Re-Run)
-- ==============================================================================

-- 1. Domains Table: Ensure registrar metadata & Cloudflare sync columns exist
ALTER TABLE IF EXISTS public.domains
    ADD COLUMN IF NOT EXISTS registrar_provider TEXT NOT NULL DEFAULT 'unassigned',
    ADD COLUMN IF NOT EXISTS registrar_order_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_zone_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS cloudflare_nameservers JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_domains_user_status
    ON public.domains(user_id, status);

-- 2. Domain Transfers Table: Authentic Registrar Transfer Polling & EPP Metadata
ALTER TABLE IF EXISTS public.domain_transfers
    ADD COLUMN IF NOT EXISTS registrar_transfer_id TEXT,
    ADD COLUMN IF NOT EXISTS registrar_provider TEXT,
    ADD COLUMN IF NOT EXISTS epp_status TEXT,
    ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transfers_status_polled
    ON public.domain_transfers(status, last_polled_at);

CREATE INDEX IF NOT EXISTS idx_transfers_registrar_id
    ON public.domain_transfers(registrar_transfer_id);

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    IF to_regclass('public.domain_transfers') IS NOT NULL THEN
        FOR constraint_name_var IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'domain_transfers'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%status%'
        LOOP
            EXECUTE format('ALTER TABLE public.domain_transfers DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END LOOP;

        ALTER TABLE public.domain_transfers
            ADD CONSTRAINT domain_transfers_status_check CHECK (
                status IN (
                    'pending_payment',
                    'verifying_epp',
                    'awaiting_losing_registrar',
                    'completed',
                    'rejected_invalid_epp',
                    'locked_at_source',
                    'cancelled'
                )
            );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped domain_transfers status constraint update: %', SQLERRM;
END $$;

-- 3. Hosting Addon / Custom Domains: DNS TXT Ownership Verification Plane
ALTER TABLE IF EXISTS public.hosting_addon_domains
    ADD COLUMN IF NOT EXISTS verification_token TEXT,
    ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending_txt',
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cloudflare_hostname_id TEXT,
    ADD COLUMN IF NOT EXISTS ssl_dcv_method TEXT NOT NULL DEFAULT 'txt',
    ADD COLUMN IF NOT EXISTS dcv_record_name TEXT,
    ADD COLUMN IF NOT EXISTS dcv_record_value TEXT,
    ADD COLUMN IF NOT EXISTS custom_origin_server TEXT;

CREATE INDEX IF NOT EXISTS idx_addon_verification_status
    ON public.hosting_addon_domains(verification_status);

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    IF to_regclass('public.hosting_addon_domains') IS NOT NULL THEN
        FOR constraint_name_var IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_addon_domains'
              AND con.contype = 'c'
              AND (
                  pg_get_constraintdef(con.oid) ILIKE '%ssl_status%'
                  OR pg_get_constraintdef(con.oid) ILIKE '%verification_status%'
              )
        LOOP
            EXECUTE format('ALTER TABLE public.hosting_addon_domains DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END LOOP;

        ALTER TABLE public.hosting_addon_domains
            ADD CONSTRAINT hosting_addon_domains_ssl_status_check CHECK (
                ssl_status IN ('active_tls13', 'provisioning', 'pending_validation', 'expired', 'failed')
            );

        ALTER TABLE public.hosting_addon_domains
            ADD CONSTRAINT hosting_addon_domains_verification_status_check CHECK (
                verification_status IN ('pending_txt', 'verified', 'failed', 'internal_owned')
            );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped hosting_addon_domains constraint update: %', SQLERRM;
END $$;

-- 4. Financial Profit Ledger: Allow domain_transfer entry_type
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    IF to_regclass('public.financial_profit_ledger') IS NOT NULL THEN
        FOR constraint_name_var IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'financial_profit_ledger'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%entry_type%'
        LOOP
            EXECUTE format('ALTER TABLE public.financial_profit_ledger DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END LOOP;

        ALTER TABLE public.financial_profit_ledger
            ADD CONSTRAINT financial_profit_ledger_entry_type_check CHECK (
                entry_type IN (
                    'hosting_sale',
                    'hosting_renewal',
                    'vps_sale',
                    'domain_registration',
                    'domain_renewal',
                    'domain_transfer',
                    'addon_purchase',
                    'wallet_topup',
                    'affiliate_commission',
                    'affiliate_payout',
                    'customer_refund',
                    'refund_loss',
                    'server_infrastructure_expense',
                    'manual_adjustment'
                )
            );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped financial_profit_ledger constraint update: %', SQLERRM;
END $$;

-- 5. Invoices: Index order_type & ensure standalone domain order_types pass cleanly
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    IF to_regclass('public.invoices') IS NOT NULL THEN
        FOR constraint_name_var IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'invoices'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%order_type%'
        LOOP
            EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END LOOP;

        ALTER TABLE public.invoices
            ADD CONSTRAINT invoices_order_type_check CHECK (
                order_type IN (
                    'hosting_order',
                    'wallet_topup',
                    'domain_registration',
                    'domain_register',
                    'domain_renewal',
                    'domain_renew',
                    'domain_transfer',
                    'agency_handover'
                )
            );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped invoices order_type constraint update: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_order_type
    ON public.invoices(order_type, status);
