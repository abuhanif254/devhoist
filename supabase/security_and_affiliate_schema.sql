-- ==============================================================================
-- DEVHOST CLOUD PLATFORM - SECURITY, FRAUD RADAR & AUTOMATED AFFILIATE SCHEMA
-- Architecture: Row Level Security (RLS) + Immutable Audit Logs + 35-Day Hold Engine
-- Run this in your Supabase SQL Editor to activate Phase 11 Security & Affiliate
-- ==============================================================================

-- ==============================================================================
-- 1. SECURITY & ANTI-FRAUD TABLES
-- ==============================================================================

-- 1.1 Brute-Force & Lockout Tracker
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    attempt_status TEXT NOT NULL CHECK (attempt_status IN ('success', 'failed_password', 'failed_2fa', 'blocked_lockout')),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip 
    ON public.auth_login_attempts(email, ip_address, created_at DESC);

-- 1.2 User Active Devices & Session Fingerprints
CREATE TABLE IF NOT EXISTS public.user_sessions_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    location TEXT DEFAULT 'Dhaka, Bangladesh',
    browser_os TEXT NOT NULL,
    is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Immutable Security Audit Trail
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL DEFAULT 'client' CHECK (actor_role IN ('client', 'admin', 'system')),
    action_type TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
    risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
    ON public.security_audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk 
    ON public.security_audit_logs(risk_level, created_at DESC);

-- 1.4 Automated Fraud & Threat Radar
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL CHECK (
        alert_type IN ('self_referral_attempt', 'duplicate_trxid', 'brute_force_ip', 'disposable_email', 'velocity_abuse')
    ),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'blocked', 'dismissed', 'whitelisted')),
    action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. AUTOMATED AFFILIATE MARKETING TABLES
-- ==============================================================================

-- 2.1 Affiliate Profiles (Auto-scaling Tiers: 20%, 25%, 30%)
CREATE TABLE IF NOT EXISTS public.affiliate_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    custom_slug TEXT UNIQUE,
    tier_level TEXT NOT NULL DEFAULT 'starter_20' CHECK (tier_level IN ('starter_20', 'pro_25', 'agency_30')),
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    total_clicks INTEGER NOT NULL DEFAULT 0,
    total_signups INTEGER NOT NULL DEFAULT 0,
    active_conversions INTEGER NOT NULL DEFAULT 0,
    pending_clearance_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (pending_clearance_bdt >= 0),
    available_balance_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance_bdt >= 0),
    total_withdrawn_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn_bdt >= 0),
    payout_method TEXT DEFAULT 'bkash' CHECK (payout_method IN ('bkash', 'nagad', 'bank')),
    payout_account_number TEXT,
    is_frozen_for_fraud BOOLEAN NOT NULL DEFAULT FALSE,
    fraud_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Affiliate Clicks (90-day tracking & Sub-ID campaign analytics)
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_user_id UUID NOT NULL REFERENCES public.affiliate_profiles(user_id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    visitor_ip_hash TEXT NOT NULL,
    user_agent TEXT,
    referrer_url TEXT,
    landing_page TEXT NOT NULL DEFAULT '/',
    sub_id TEXT DEFAULT 'organic',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_ref 
    ON public.affiliate_clicks(referral_code, created_at DESC);

-- 2.3 Affiliate Commissions (35-Day Anti-Refund Hold Lifecycle)
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_user_id UUID NOT NULL REFERENCES public.affiliate_profiles(user_id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    order_amount_bdt NUMERIC(10, 2) NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL,
    commission_amount_bdt NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_35d_hold' CHECK (
        status IN ('pending_35d_hold', 'cleared_available', 'clawed_back_refunded', 'flagged_self_referral')
    ),
    buyer_ip_hash TEXT,
    sub_id TEXT DEFAULT 'organic',
    matures_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '35 days'),
    cleared_at TIMESTAMPTZ,
    clawed_back_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aff_commissions_matures 
    ON public.affiliate_commissions(status, matures_at);

-- 2.4 Affiliate Payout Requests
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_user_id UUID NOT NULL REFERENCES public.affiliate_profiles(user_id) ON DELETE CASCADE,
    amount_bdt NUMERIC(10, 2) NOT NULL CHECK (amount_bdt >= 1000.00), -- Minimum ৳1,000 threshold
    payout_method TEXT NOT NULL CHECK (payout_method IN ('bkash', 'nagad', 'bank')),
    account_details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
        status IN ('pending_review', 'approved_paid', 'rejected_fraud')
    ),
    admin_trx_id TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. AUTOMATED POSTGRESQL FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 3.1 35-Day Maturity Cron Engine: Automatically matures commissions and credits available balance
CREATE OR REPLACE FUNCTION public.process_mature_affiliate_commissions()
RETURNS INTEGER AS $$
DECLARE
    r RECORD;
    matured_count INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT id, affiliate_user_id, commission_amount_bdt
        FROM public.affiliate_commissions
        WHERE status = 'pending_35d_hold' AND matures_at <= NOW()
    LOOP
        -- 1. Mark commission as cleared
        UPDATE public.affiliate_commissions
        SET status = 'cleared_available', cleared_at = NOW()
        WHERE id = r.id;

        -- 2. Move funds from pending to available in affiliate profile
        UPDATE public.affiliate_profiles
        SET 
            pending_clearance_bdt = GREATEST(0, pending_clearance_bdt - r.commission_amount_bdt),
            available_balance_bdt = available_balance_bdt + r.commission_amount_bdt,
            updated_at = NOW()
        WHERE user_id = r.affiliate_user_id;

        matured_count := matured_count + 1;
    END LOOP;

    RETURN matured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 Auto-Scaling Tier Trigger: Upgrade commission rate based on active conversions
CREATE OR REPLACE FUNCTION public.check_affiliate_tier_upgrade()
RETURNS TRIGGER AS $$
DECLARE
    signup_count INTEGER;
    new_tier TEXT;
    new_rate NUMERIC(5, 2);
BEGIN
    signup_count := NEW.total_signups;

    IF signup_count >= 31 THEN
        new_tier := 'agency_30';
        new_rate := 30.00;
    ELSIF signup_count >= 11 THEN
        new_tier := 'pro_25';
        new_rate := 25.00;
    ELSE
        new_tier := 'starter_20';
        new_rate := 20.00;
    END IF;

    IF NEW.tier_level <> new_tier THEN
        NEW.tier_level := new_tier;
        NEW.commission_rate := new_rate;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_affiliate_tier_upgrade ON public.affiliate_profiles;
CREATE TRIGGER trigger_affiliate_tier_upgrade
    BEFORE UPDATE OF total_signups ON public.affiliate_profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_affiliate_tier_upgrade();

-- 3.3 Auto Clawback Trigger on Invoice Refund:
CREATE OR REPLACE FUNCTION public.handle_invoice_refund_clawback()
RETURNS TRIGGER AS $$
DECLARE
    comm RECORD;
BEGIN
    IF NEW.status = 'refunded' AND OLD.status <> 'refunded' THEN
        FOR comm IN 
            SELECT id, affiliate_user_id, commission_amount_bdt, status
            FROM public.affiliate_commissions
            WHERE invoice_id = NEW.id
        LOOP
            IF comm.status = 'pending_35d_hold' THEN
                -- Deduct from pending clearance
                UPDATE public.affiliate_profiles
                SET pending_clearance_bdt = GREATEST(0, pending_clearance_bdt - comm.commission_amount_bdt),
                    updated_at = NOW()
                WHERE user_id = comm.affiliate_user_id;
            ELSIF comm.status = 'cleared_available' THEN
                -- Deduct from available balance (clawback)
                UPDATE public.affiliate_profiles
                SET available_balance_bdt = GREATEST(0, available_balance_bdt - comm.commission_amount_bdt),
                    updated_at = NOW()
                WHERE user_id = comm.affiliate_user_id;
            END IF;

            -- Mark commission status as clawed back
            UPDATE public.affiliate_commissions
            SET status = 'clawed_back_refunded',
                clawed_back_at = NOW(),
                notes = 'Auto-clawed back due to invoice refund guarantee'
            WHERE id = comm.id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invoice_refund_clawback ON public.invoices;
CREATE TRIGGER trigger_invoice_refund_clawback
    AFTER UPDATE OF status ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_invoice_refund_clawback();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- 4.1 Immutable Security Audit Logs (INSERT + Admin SELECT only, NEVER UPDATE OR DELETE)
CREATE POLICY "Allow system and users to insert audit logs"
    ON public.security_audit_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Only admins can select audit logs"
    ON public.security_audit_logs FOR SELECT
    USING (public.is_admin());

-- Notice: NO UPDATE OR DELETE POLICY CREATED FOR security_audit_logs -> 100% IMMUTABLE

-- 4.2 Fraud Alerts (Admin only select and update)
CREATE POLICY "Admins can view and manage fraud alerts"
    ON public.fraud_alerts FOR ALL
    USING (public.is_admin());

CREATE POLICY "System can insert fraud alerts"
    ON public.fraud_alerts FOR INSERT
    WITH CHECK (true);

-- 4.3 Affiliate Profiles RLS
CREATE POLICY "Users can view and edit their own affiliate profile or Admin manage"
    ON public.affiliate_profiles FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- 4.4 Affiliate Clicks RLS (Public insert via tracking redirect, affiliate read)
CREATE POLICY "Anyone can register clicks"
    ON public.affiliate_clicks FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Affiliates can view their own click stats"
    ON public.affiliate_clicks FOR SELECT
    USING (auth.uid() = affiliate_user_id OR public.is_admin());

-- 4.5 Affiliate Commissions RLS
CREATE POLICY "Affiliates can view their own commissions"
    ON public.affiliate_commissions FOR SELECT
    USING (auth.uid() = affiliate_user_id OR public.is_admin());

CREATE POLICY "Admin or service role can insert/update commissions"
    ON public.affiliate_commissions FOR ALL
    USING (public.is_admin());

-- 4.6 Affiliate Payouts RLS
CREATE POLICY "Affiliates can view and request their own payouts"
    ON public.affiliate_payouts FOR ALL
    USING (auth.uid() = affiliate_user_id OR public.is_admin());
