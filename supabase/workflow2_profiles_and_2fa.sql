-- ==============================================================================
-- DEVHOST CLOUD - WORKFLOW 2: HACKER-PROOF 2FA, SUDO STEP-UP & MULTI-ROLE PROFILES
-- Idempotent Migration: Safe on fresh databases and pre-existing profile tables
-- ==============================================================================

-- 0. Ensure prerequisite columns exist on public.profiles
DO $do$
BEGIN
    IF to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.profiles
                ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'Cloud Developer',
                ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'DevHost Cloud'
        $sql$;
    END IF;
END $do$;

-- 1. USER SECURITY CREDENTIALS (RFC 6238 TOTP, Backup Codes & Sudo Vault)
CREATE TABLE IF NOT EXISTS public.user_security_credentials (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    totp_enabled BOOLEAN NOT NULL DEFAULT false,
    totp_secret_base32 TEXT,
    email_2fa_enabled BOOLEAN NOT NULL DEFAULT true,
    backup_recovery_hashes TEXT[] DEFAULT '{}'::TEXT[],
    sudo_security_pin_hash TEXT,
    trusted_device_fingerprints JSONB NOT NULL DEFAULT '[]'::JSONB,
    admin_allowed_ips TEXT[] DEFAULT '{}'::TEXT[],
    last_password_change TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sudo_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reconcile columns if public.user_security_credentials pre-existed from an earlier schema
ALTER TABLE public.user_security_credentials
    ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS totp_secret_base32 TEXT,
    ADD COLUMN IF NOT EXISTS email_2fa_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS backup_recovery_hashes TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS sudo_security_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS trusted_device_fingerprints JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS admin_allowed_ips TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_sudo_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. CUSTOMER & DEVELOPER PROFILES (Corporate BIN, Global SSH, Scoped API Tokens)
CREATE TABLE IF NOT EXISTS public.customer_developer_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual', 'business_corporate', 'software_agency')),
    company_legal_name TEXT,
    tax_vat_bin_number TEXT,
    billing_street_address TEXT,
    billing_city TEXT,
    billing_country TEXT NOT NULL DEFAULT 'Bangladesh',
    emergency_billing_email TEXT,
    whatsapp_alert_number TEXT,
    default_datacenter_region TEXT NOT NULL DEFAULT 'sg1' CHECK (default_datacenter_region IN ('sg1', 'us1')),
    default_node_version TEXT NOT NULL DEFAULT '22',
    default_php_version TEXT NOT NULL DEFAULT '8.3',
    ssh_public_keys JSONB NOT NULL DEFAULT '[]'::JSONB,
    personal_api_tokens JSONB NOT NULL DEFAULT '[]'::JSONB,
    auto_pay_from_wallet BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reconcile columns if public.customer_developer_profiles pre-existed without tax_vat_bin_number or newer columns
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
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. AFFILIATE MARKETER PROFILES (Dedicated Partner Profile, Anti-Hijack Lock & Webhooks)
CREATE TABLE IF NOT EXISTS public.affiliate_marketer_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    partner_display_name TEXT,
    custom_referral_slug TEXT UNIQUE NOT NULL,
    promotional_channels TEXT[] DEFAULT '{}'::TEXT[],
    website_or_page_url TEXT,
    primary_payout_method TEXT NOT NULL DEFAULT 'bkash_personal' CHECK (primary_payout_method IN ('bkash_personal', 'nagad_personal', 'bank_eft')),
    payout_wallet_number TEXT,
    bank_account_details JSONB DEFAULT '{}'::JSONB,
    payout_schedule_mode TEXT NOT NULL DEFAULT 'auto_monthly_5th' CHECK (payout_schedule_mode IN ('manual_request', 'auto_monthly_5th')),
    min_payout_threshold_bdt NUMERIC(10, 2) NOT NULL DEFAULT 1000.00 CHECK (min_payout_threshold_bdt >= 1000.00),
    conversion_postback_webhook_url TEXT,
    default_utm_campaign TEXT,
    kyc_verified BOOLEAN NOT NULL DEFAULT false,
    payout_lock_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reconcile columns if public.affiliate_marketer_profiles pre-existed from an earlier schema
ALTER TABLE public.affiliate_marketer_profiles
    ADD COLUMN IF NOT EXISTS partner_display_name TEXT,
    ADD COLUMN IF NOT EXISTS custom_referral_slug TEXT,
    ADD COLUMN IF NOT EXISTS promotional_channels TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS website_or_page_url TEXT,
    ADD COLUMN IF NOT EXISTS primary_payout_method TEXT NOT NULL DEFAULT 'bkash_personal',
    ADD COLUMN IF NOT EXISTS payout_wallet_number TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_details JSONB DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS payout_schedule_mode TEXT NOT NULL DEFAULT 'auto_monthly_5th',
    ADD COLUMN IF NOT EXISTS min_payout_threshold_bdt NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    ADD COLUMN IF NOT EXISTS conversion_postback_webhook_url TEXT,
    ADD COLUMN IF NOT EXISTS default_utm_campaign TEXT,
    ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS payout_lock_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure unique indexes exist on user_id in case pre-existing tables lacked PK/unique on user_id
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'user_security_credentials'
          AND con.contype IN ('p', 'u')
          AND pg_get_constraintdef(con.oid) ILIKE '%(user_id)%'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_user_security_credentials_user_id
            ON public.user_security_credentials(user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'customer_developer_profiles'
          AND con.contype IN ('p', 'u')
          AND pg_get_constraintdef(con.oid) ILIKE '%(user_id)%'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_developer_profiles_user_id
            ON public.customer_developer_profiles(user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'affiliate_marketer_profiles'
          AND con.contype IN ('p', 'u')
          AND pg_get_constraintdef(con.oid) ILIKE '%(user_id)%'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_marketer_profiles_user_id
            ON public.affiliate_marketer_profiles(user_id);
    END IF;
END $do$;

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_security_totp ON public.user_security_credentials(user_id, totp_enabled);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_vat ON public.customer_developer_profiles(tax_vat_bin_number);
CREATE INDEX IF NOT EXISTS idx_affiliate_slug ON public.affiliate_marketer_profiles(custom_referral_slug);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_security_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_developer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_marketer_profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR user_security_credentials
DROP POLICY IF EXISTS "Users can view own security credentials" ON public.user_security_credentials;
CREATE POLICY "Users can view own security credentials"
    ON public.user_security_credentials FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own security credentials" ON public.user_security_credentials;
CREATE POLICY "Users can update own security credentials"
    ON public.user_security_credentials FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own security credentials" ON public.user_security_credentials;
CREATE POLICY "Users can insert own security credentials"
    ON public.user_security_credentials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 5. RLS POLICIES FOR customer_developer_profiles
DROP POLICY IF EXISTS "Users can view own customer profile" ON public.customer_developer_profiles;
CREATE POLICY "Users can view own customer profile"
    ON public.customer_developer_profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own customer profile" ON public.customer_developer_profiles;
CREATE POLICY "Users can update own customer profile"
    ON public.customer_developer_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own customer profile" ON public.customer_developer_profiles;
CREATE POLICY "Users can insert own customer profile"
    ON public.customer_developer_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 6. RLS POLICIES FOR affiliate_marketer_profiles
DROP POLICY IF EXISTS "Users can view own affiliate marketer profile" ON public.affiliate_marketer_profiles;
CREATE POLICY "Users can view own affiliate marketer profile"
    ON public.affiliate_marketer_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Remove public table-wide SELECT policy to protect payout wallets & webhooks; use RPC below instead
DROP POLICY IF EXISTS "Public can check referral slug existence" ON public.affiliate_marketer_profiles;

DROP POLICY IF EXISTS "Users can update own affiliate marketer profile" ON public.affiliate_marketer_profiles;
CREATE POLICY "Users can update own affiliate marketer profile"
    ON public.affiliate_marketer_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own affiliate marketer profile" ON public.affiliate_marketer_profiles;
CREATE POLICY "Users can insert own affiliate marketer profile"
    ON public.affiliate_marketer_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service Role Bypass Policies (explicitly scoped TO service_role)
DROP POLICY IF EXISTS "Service role full access security" ON public.user_security_credentials;
CREATE POLICY "Service role full access security"
    ON public.user_security_credentials FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access customer" ON public.customer_developer_profiles;
CREATE POLICY "Service role full access customer"
    ON public.customer_developer_profiles FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access affiliate" ON public.affiliate_marketer_profiles;
CREATE POLICY "Service role full access affiliate"
    ON public.affiliate_marketer_profiles FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Boolean-only slug check RPC (prevents exposing full affiliate rows publicly)
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

-- 7. AUTO INITIAL SEED TRIGGER FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user_security_and_profiles()
RETURNS TRIGGER AS $$
DECLARE
    new_json JSONB := to_jsonb(NEW);
    v_company TEXT := COALESCE(NULLIF(new_json->>'company_name', ''), NULLIF(new_json->>'company', ''), 'DevHost Cloud');
    v_full_name TEXT := COALESCE(NULLIF(new_json->>'full_name', ''), SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1));
    v_slug_prefix TEXT := COALESCE(NULLIF(LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), '[^a-zA-Z0-9]', '', 'g')), ''), 'dev');
BEGIN
    -- Initialize user security record
    INSERT INTO public.user_security_credentials (user_id, totp_enabled, email_2fa_enabled)
    VALUES (NEW.id, false, true)
    ON CONFLICT DO NOTHING;

    -- Initialize customer profile record
    INSERT INTO public.customer_developer_profiles (
        user_id,
        account_type,
        company_legal_name,
        billing_country,
        default_datacenter_region,
        default_node_version,
        default_php_version
    )
    VALUES (
        NEW.id,
        'individual',
        v_company,
        'Bangladesh',
        'sg1',
        '22',
        '8.3'
    )
    ON CONFLICT DO NOTHING;

    -- Initialize affiliate marketer profile record
    INSERT INTO public.affiliate_marketer_profiles (
        user_id,
        partner_display_name,
        custom_referral_slug,
        primary_payout_method,
        min_payout_threshold_bdt
    )
    VALUES (
        NEW.id,
        v_full_name,
        v_slug_prefix || '-' || SUBSTRING(NEW.id::text, 1, 4),
        'bkash_personal',
        1000.00
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to public.profiles
DROP TRIGGER IF EXISTS trg_new_user_security_and_profiles ON public.profiles;
CREATE TRIGGER trg_new_user_security_and_profiles
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_security_and_profiles();

-- Initialize profiles for existing users if any exist
DO $$
DECLARE
    r RECORD;
    r_json JSONB;
    v_company TEXT;
    v_full_name TEXT;
    v_slug_prefix TEXT;
BEGIN
    FOR r IN SELECT * FROM public.profiles LOOP
        r_json := to_jsonb(r);
        v_company := COALESCE(NULLIF(r_json->>'company_name', ''), NULLIF(r_json->>'company', ''), 'DevHost Cloud');
        v_full_name := COALESCE(NULLIF(r_json->>'full_name', ''), SPLIT_PART(COALESCE(r.email, 'user'), '@', 1));
        v_slug_prefix := COALESCE(NULLIF(LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(r.email, ''), '@', 1), '[^a-zA-Z0-9]', '', 'g')), ''), 'dev');

        INSERT INTO public.user_security_credentials (user_id, totp_enabled, email_2fa_enabled)
        VALUES (r.id, false, true)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.customer_developer_profiles (user_id, account_type, company_legal_name, billing_country)
        VALUES (r.id, 'individual', v_company, 'Bangladesh')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.affiliate_marketer_profiles (
            user_id,
            partner_display_name,
            custom_referral_slug,
            primary_payout_method,
            min_payout_threshold_bdt
        )
        VALUES (
            r.id,
            v_full_name,
            v_slug_prefix || '-' || SUBSTRING(r.id::text, 1, 4),
            'bkash_personal',
            1000.00
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
