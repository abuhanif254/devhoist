-- ==============================================================================
-- DEVHOST CLOUD - AUTH MASTER SECURITY HARDENING & FAIL-SAFE DB TRIGGERS
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Automatic Profile Provisioning, Zero Admin Overwrite, Brute-Force Rate Limiting
-- ==============================================================================

-- 1. AUTH LOGIN ATTEMPTS (Brute-Force & Rate Limiting Audit Table)
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time 
    ON public.auth_login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
    ON public.auth_login_attempts(ip_address, attempted_at DESC);

-- Enable RLS on auth_login_attempts
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role / admin can view login attempts
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.auth_login_attempts;
CREATE POLICY "Admins can view login attempts"
    ON public.auth_login_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 2. MASTER SIGNUP TRIGGER FUNCTION (SECURITY DEFINER)
-- Idempotent, role-preserving signup trigger for Email, Google, and GitHub
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_name TEXT;
    v_company TEXT;
    v_clean_email TEXT;
    v_referral_slug TEXT;
BEGIN
    -- Extract clean email
    v_clean_email := lower(trim(NEW.email));

    -- Extract full name from raw_user_meta_data (Google, GitHub, or Email Signup)
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'user_name',
        split_part(v_clean_email, '@', 1)
    );

    v_company := COALESCE(NEW.raw_user_meta_data->>'company', '');

    -- Generate a clean referral slug (alphanumeric + random suffix if collision)
    v_referral_slug := regexp_replace(split_part(v_clean_email, '@', 1), '[^a-zA-Z0-9]', '', 'g');
    IF length(v_referral_slug) < 3 THEN
        v_referral_slug := 'dev' || substr(replace(NEW.id::text, '-', ''), 1, 6);
    ELSE
        v_referral_slug := lower(v_referral_slug) || substr(replace(NEW.id::text, '-', ''), 1, 4);
    END IF;

    -- 1. Insert into public.profiles
    -- CRITICAL: ON CONFLICT DO NOT OVERWRITE role OR wallet_balance_bdt!
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        company_name,
        role,
        wallet_balance_bdt,
        affiliate_code,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_clean_email,
        v_full_name,
        v_company,
        'client', -- Default to client! Never admin on automated signup
        0,        -- Strictly 0 starting balance!
        v_referral_slug,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
        company_name = COALESCE(NULLIF(profiles.company_name, ''), EXCLUDED.company_name),
        updated_at = now();
        -- Notice: profiles.role and profiles.wallet_balance_bdt are NEVER touched on conflict!

    -- 2. Insert into public.customer_developer_profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_developer_profiles') THEN
        INSERT INTO public.customer_developer_profiles (
            user_id,
            account_type,
            company_legal_name,
            default_datacenter_region,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            'individual',
            v_company,
            'sg1',
            now(),
            now()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- 3. Insert into public.user_security_credentials (Default TOTP disabled, email 2FA enabled)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_security_credentials') THEN
        INSERT INTO public.user_security_credentials (
            user_id,
            totp_enabled,
            email_2fa_enabled,
            backup_recovery_hashes,
            last_password_change,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            false,
            true,
            '{}'::TEXT[],
            now(),
            now(),
            now()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- 4. Insert into public.affiliate_profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_profiles') THEN
        INSERT INTO public.affiliate_profiles (
            user_id,
            referral_code,
            custom_slug,
            tier_level,
            commission_rate
        ) VALUES (
            NEW.id,
            v_referral_slug,
            v_referral_slug,
            'starter_20',
            20.00
        )
        ON CONFLICT (user_id) DO NOTHING
        ON CONFLICT (referral_code) DO NOTHING;
    END IF;

    -- 5. Insert into public.affiliate_marketer_profiles (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_marketer_profiles') THEN
        INSERT INTO public.affiliate_marketer_profiles (
            user_id,
            partner_display_name,
            custom_referral_slug,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            v_full_name,
            v_referral_slug,
            now(),
            now()
        )
        ON CONFLICT (user_id) DO NOTHING
        ON CONFLICT (custom_referral_slug) DO NOTHING;
    END IF;

    -- 6. Record Initial Registration Event in Security Audit Logs (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_audit_logs') THEN
        INSERT INTO public.security_audit_logs (
            actor_id,
            actor_role,
            action_type,
            target_resource,
            ip_address,
            risk_level,
            metadata
        ) VALUES (
            NEW.id,
            'client',
            'user_signup_completed',
            v_clean_email,
            '127.0.0.1',
            'low',
            jsonb_build_object(
                'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
                'registered_at', now()
            )
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Defensive fallback: Log error so signup never fails due to side-effects
        RAISE WARNING 'handle_new_user_signup trigger notice: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Drop and recreate the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- 3. HELPER FUNCTION: CHECK LOGIN ATTEMPTS (BRUTE-FORCE LOCKOUT CHECK)
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_email TEXT, p_ip TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_failures INT;
    v_clean_email TEXT := lower(trim(p_email));
    v_lockout_duration INT := 15; -- 15 minutes
BEGIN
    SELECT COUNT(*)
    INTO v_recent_failures
    FROM public.auth_login_attempts
    WHERE (email = v_clean_email OR ip_address = p_ip)
      AND success = false
      AND attempted_at > (now() - (v_lockout_duration || ' minutes')::INTERVAL);

    IF v_recent_failures >= 5 THEN
        RETURN jsonb_build_object(
            'locked', true,
            'failed_attempts', v_recent_failures,
            'lockout_minutes', v_lockout_duration,
            'message', 'Too many failed login attempts. Workstation temporarily rate-limited.'
        );
    END IF;

    RETURN jsonb_build_object(
        'locked', false,
        'failed_attempts', v_recent_failures
    );
END;
$$;
