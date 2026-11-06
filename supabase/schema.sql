-- ==============================================================================
-- DEVHOST CLOUD PLATFORM - PRODUCTION SUPABASE POSTGRESQL SCHEMA (PHASE 10)
-- Architecture: Row Level Security (RLS) + Automated Triggers + JSONB Storage
-- Run this in your Supabase Project: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE (Syncs with Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Cloud Developer',
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '+880 1712-345678',
    company_name TEXT DEFAULT 'DevHost Cloud',
    role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
    wallet_balance_bdt NUMERIC(12, 2) NOT NULL DEFAULT 2500.00 CHECK (wallet_balance_bdt >= 0),
    affiliate_code TEXT UNIQUE DEFAULT ('DEV-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))),
    referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. HOSTING SERVICES TABLE (Synced with real WHM / cPanel accounts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hosting_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    whm_package_name TEXT NOT NULL DEFAULT 'Developer_Cloud_Starter',
    cpanel_username TEXT NOT NULL,
    server_node TEXT NOT NULL DEFAULT 'sg1' CHECK (server_node IN ('sg1', 'us1')),
    ip_address TEXT NOT NULL DEFAULT '103.151.102.45',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'terminated')),
    disk_limit_gb NUMERIC(6, 2) NOT NULL DEFAULT 5.0,
    disk_used_gb NUMERIC(6, 2) NOT NULL DEFAULT 1.4,
    ram_limit_mb INTEGER NOT NULL DEFAULT 2048,
    ram_used_mb INTEGER NOT NULL DEFAULT 420,
    inode_limit INTEGER NOT NULL DEFAULT 250000,
    inode_used INTEGER NOT NULL DEFAULT 38400,
    bandwidth_limit_gb NUMERIC(8, 2) NOT NULL DEFAULT 1000.0,
    bandwidth_used_gb NUMERIC(8, 2) NOT NULL DEFAULT 45.2,
    git_repo_url TEXT DEFAULT 'github.com/developer/production-app',
    git_branch TEXT DEFAULT 'main',
    auto_deploy BOOLEAN DEFAULT TRUE,
    php_version TEXT DEFAULT '8.3',
    nodejs_version TEXT DEFAULT '20.x',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annually', 'triennially')),
    price_bdt NUMERIC(10, 2) NOT NULL DEFAULT 450.00,
    next_due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. DOMAINS TABLE (Registrar & DNS Management)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain_name TEXT NOT NULL UNIQUE,
    tld TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Transferring', 'Pending')),
    registrar_lock BOOLEAN NOT NULL DEFAULT TRUE,
    whois_privacy BOOLEAN NOT NULL DEFAULT TRUE,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    epp_code TEXT DEFAULT ('EPP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))),
    nameservers JSONB NOT NULL DEFAULT '["ns1.devhost.net", "ns2.devhost.net"]'::jsonb,
    child_nameservers JSONB NOT NULL DEFAULT '[]'::jsonb,
    dns_records JSONB NOT NULL DEFAULT '[
        {"id": "dns-1", "type": "A", "name": "@", "value": "103.151.102.45", "ttl": 3600, "proxied": true},
        {"id": "dns-2", "type": "CNAME", "name": "www", "value": "@", "ttl": 3600, "proxied": true},
        {"id": "dns-3", "type": "MX", "name": "@", "value": "mail.devhost.net", "priority": 10, "ttl": 14400}
    ]'::jsonb,
    redirects JSONB NOT NULL DEFAULT '[]'::jsonb,
    expiry_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. INVOICES TABLE (Automated Billing & WHMCS Sync)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'refunded', 'cancelled')),
    payment_method TEXT DEFAULT 'bKash Instant',
    trx_id TEXT,
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. TRANSACTIONS TABLE (Audit log for bKash, Nagad, Stripe, Wallet)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'stripe', 'wallet', 'uddoktapay', 'sslcommerz')),
    trx_id TEXT NOT NULL UNIQUE,
    amount_bdt NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Failed', 'Refunded')),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. SUPPORT TICKETS & MESSAGES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    department TEXT NOT NULL CHECK (department IN ('Technical Support', 'Billing & Accounts', 'Sales & Pre-Order', 'Migration')),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Answered', 'Customer-Reply', 'Closed')),
    service_id UUID REFERENCES public.hosting_services(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin', 'system')),
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. MIGRATION REQUESTS TABLE (Zero Downtime Website Migrations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.migration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    previous_provider TEXT NOT NULL,
    control_panel_type TEXT NOT NULL DEFAULT 'cpanel',
    cpanel_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'Queued' CHECK (
        status IN ('Queued', 'Analyzing Backup', 'Transferring Data', 'Restoring MySQL', 'DNS Verification', 'Completed', 'Failed')
    ),
    progress_percent INTEGER NOT NULL DEFAULT 10 CHECK (progress_percent BETWEEN 0 AND 100),
    target_service_id UUID REFERENCES public.hosting_services(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. PLATFORM SETTINGS TABLE (Global dynamic pricing, promo codes, broadcast banner)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEED INITIAL PLATFORM SETTINGS
-- ==============================================================================
INSERT INTO public.platform_settings (key, value, description)
VALUES 
(
    'hosting_plans',
    '{
        "developer_git": {"name": "Developer Git Hosting", "bdt_price": 450, "usd_price": 4.5, "disk_gb": 15, "whm_pkg": "Dev_Git_15G"},
        "wordpress_standard": {"name": "LiteSpeed NVMe Turbo", "bdt_price": 350, "usd_price": 3.5, "disk_gb": 10, "whm_pkg": "WP_Turbo_10G"},
        "cloud_vps_starter": {"name": "Managed Cloud VPS 2C/4G", "bdt_price": 1800, "usd_price": 18.0, "disk_gb": 60, "whm_pkg": "VPS_2C_4G"},
        "bare_metal": {"name": "Enterprise AMD EPYC", "bdt_price": 14500, "usd_price": 145.0, "disk_gb": 500, "whm_pkg": "EPYC_Dedicated"}
    }'::jsonb,
    'Dynamic live hosting plan definitions and pricing'
),
(
    'domain_tlds',
    '{
        ".com": {"register_bdt": 1350, "renew_bdt": 1550, "transfer_bdt": 1350, "popular": true},
        ".com.bd": {"register_bdt": 1750, "renew_bdt": 1750, "transfer_bdt": 0, "popular": true},
        ".org": {"register_bdt": 1650, "renew_bdt": 1850, "transfer_bdt": 1650},
        ".net": {"register_bdt": 1600, "renew_bdt": 1750, "transfer_bdt": 1600},
        ".xyz": {"register_bdt": 290, "renew_bdt": 1450, "transfer_bdt": 1450, "badge": "Special ৳290"},
        ".io": {"register_bdt": 4500, "renew_bdt": 4900, "transfer_bdt": 4500},
        ".ai": {"register_bdt": 9500, "renew_bdt": 9900, "transfer_bdt": 9500}
    }'::jsonb,
    'Live domain TLD pricing in BDT'
),
(
    'system_announcement',
    '{
        "enabled": true,
        "message": "⚡ 99.99% Global Uptime SLA — Instant bKash, Nagad & Stripe Gateway Online",
        "action_text": "Live Status",
        "action_url": "/server-status"
    }'::jsonb,
    'Global notification banner broadcast'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, wallet_balance_bdt)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        CASE 
            WHEN NEW.email = 'admin@devhost.net' OR NEW.email LIKE '%@devhost.net' THEN 'admin'
            ELSE 'client'
        END,
        2500.00 -- Complimentary prepaid balance on sandbox testing
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Helper check function for admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles RLS
CREATE POLICY "Users can view their own profile or Admin can view all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

-- 2. Hosting Services RLS
CREATE POLICY "Users can view their own hosting services"
    ON public.hosting_services FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users or Admins can insert/update hosting services"
    ON public.hosting_services FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- 3. Domains RLS
CREATE POLICY "Users can view and manage their own domains"
    ON public.domains FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- 4. Invoices RLS
CREATE POLICY "Users can view their own invoices"
    ON public.invoices FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create invoices and Admin can manage"
    ON public.invoices FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- 5. Transactions RLS
CREATE POLICY "Users can view their own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Service role or Admin can insert transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id OR public.is_admin() OR auth.role() = 'service_role');

-- 6. Tickets & Messages RLS
CREATE POLICY "Users can view and create their own tickets"
    ON public.support_tickets FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can view and create messages in their tickets"
    ON public.ticket_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets 
            WHERE support_tickets.id = ticket_messages.ticket_id 
            AND (support_tickets.user_id = auth.uid() OR public.is_admin())
        )
    );

-- 7. Migration Requests RLS
CREATE POLICY "Users can view and manage their migrations"
    ON public.migration_requests FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- 8. Platform Settings RLS
CREATE POLICY "Public read for platform settings"
    ON public.platform_settings FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Admin only write for platform settings"
    ON public.platform_settings FOR ALL
    USING (public.is_admin());


-- ==============================================================================
-- PHASE 11: SECURITY, FRAUD RADAR & AUTOMATED AFFILIATE SYSTEM EXTENSION
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

-- 2.1 Affiliate Profiles
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

-- 2.2 Affiliate Clicks
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

-- 2.3 Affiliate Commissions
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

-- 2.4 Affiliate Payout Requests
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_user_id UUID NOT NULL REFERENCES public.affiliate_profiles(user_id) ON DELETE CASCADE,
    amount_bdt NUMERIC(10, 2) NOT NULL CHECK (amount_bdt >= 1000.00),
    payout_method TEXT NOT NULL CHECK (payout_method IN ('bkash', 'nagad', 'bank')),
    account_details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
        status IN ('pending_review', 'approved_paid', 'rejected_fraud')
    ),
    admin_trx_id TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for Phase 11 tables
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs insert" ON public.security_audit_logs;
CREATE POLICY "Audit logs insert" ON public.security_audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Audit logs admin select" ON public.security_audit_logs;
CREATE POLICY "Audit logs admin select" ON public.security_audit_logs FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Fraud alerts admin all" ON public.fraud_alerts;
CREATE POLICY "Fraud alerts admin all" ON public.fraud_alerts FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Affiliate profiles owner/admin" ON public.affiliate_profiles;
CREATE POLICY "Affiliate profiles owner/admin" ON public.affiliate_profiles FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Affiliate clicks insert" ON public.affiliate_clicks;
CREATE POLICY "Affiliate clicks insert" ON public.affiliate_clicks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Affiliate clicks select owner" ON public.affiliate_clicks;
CREATE POLICY "Affiliate clicks select owner" ON public.affiliate_clicks FOR SELECT USING (auth.uid() = affiliate_user_id OR public.is_admin());

DROP POLICY IF EXISTS "Affiliate commissions owner" ON public.affiliate_commissions;
CREATE POLICY "Affiliate commissions owner" ON public.affiliate_commissions FOR SELECT USING (auth.uid() = affiliate_user_id OR public.is_admin());

DROP POLICY IF EXISTS "Affiliate payouts owner/admin" ON public.affiliate_payouts;
CREATE POLICY "Affiliate payouts owner/admin" ON public.affiliate_payouts FOR ALL USING (auth.uid() = affiliate_user_id OR public.is_admin());


-- ==============================================================================
-- WORKFLOW 1: DYNAMIC CATALOG & PROFIT-PROTECTED UNIT ECONOMICS
-- ==============================================================================

-- ==============================================================================
-- DEVHOST CLOUD PLATFORM - WORKFLOW 1: DYNAMIC CATALOG & PROFIT-PROTECTED ENGINE
-- Architecture: Dynamic Supabase PostgreSQL Tables + Generated Columns + Zero-Loss Check Constraints
-- ==============================================================================

-- 1. DYNAMIC CATALOG HOSTING & VPS PLANS
CREATE TABLE IF NOT EXISTS public.catalog_hosting_plans (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('shared', 'developer', 'vps', 'enterprise')),
    
    -- Financial & Profit-Protection Columns (BDT)
    selling_price_monthly_bdt NUMERIC(10, 2) NOT NULL,
    unit_server_cost_bdt NUMERIC(10, 2) NOT NULL,
    min_owner_profit_bdt NUMERIC(10, 2) NOT NULL,
    max_affiliate_pool_bdt NUMERIC(10, 2) GENERATED ALWAYS AS (
        selling_price_monthly_bdt - unit_server_cost_bdt - min_owner_profit_bdt
    ) STORED,
    annual_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    
    -- Technical Specifications
    storage_gb INT NOT NULL,
    ram_mb INT NOT NULL,
    cpu_cores INT NOT NULL,
    io_speed_mbps INT NOT NULL,
    entry_processes INT NOT NULL,
    inode_limit INT NOT NULL,
    max_addon_domains INT NOT NULL,
    ssh_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    git_auto_deploy BOOLEAN NOT NULL DEFAULT FALSE,
    backup_frequency TEXT NOT NULL DEFAULT 'Weekly Backup',
    whm_package_name TEXT NOT NULL,
    is_popular BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 1,
    features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Mathematical Zero-Loss Protection Constraint
    CONSTRAINT chk_positive_owner_profit CHECK (
        selling_price_monthly_bdt >= (unit_server_cost_bdt + min_owner_profit_bdt)
    )
);

CREATE INDEX IF NOT EXISTS idx_catalog_plans_category ON public.catalog_hosting_plans(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_plans_slug ON public.catalog_hosting_plans(slug);

-- 2. DYNAMIC DOMAIN REGISTRAR PRICING & MARGIN TABLE
CREATE TABLE IF NOT EXISTS public.catalog_domain_tlds (
    tld TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    registrar_cost_bdt NUMERIC(10, 2) NOT NULL,
    reg_price_bdt NUMERIC(10, 2) NOT NULL,
    renew_price_bdt NUMERIC(10, 2) NOT NULL,
    transfer_price_bdt NUMERIC(10, 2) NOT NULL,
    owner_net_profit_reg_bdt NUMERIC(10, 2) GENERATED ALWAYS AS (
        reg_price_bdt - registrar_cost_bdt
    ) STORED,
    affiliate_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    featured_badge TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Domain Pricing Zero-Loss Check Constraint
    CONSTRAINT chk_positive_domain_profit CHECK (reg_price_bdt >= registrar_cost_bdt)
);

-- 3. PROFIT-AWARE PROMO CODES ENGINE
CREATE TABLE IF NOT EXISTS public.promo_codes (
    code TEXT PRIMARY KEY,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_bdt')),
    discount_value NUMERIC(10, 2) NOT NULL,
    applies_to TEXT NOT NULL CHECK (applies_to IN ('hosting', 'vps', 'all')),
    max_uses INT,
    current_uses INT NOT NULL DEFAULT 0,
    reduce_affiliate_commission_proportionally BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. GLOBAL PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.catalog_hosting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_domain_tlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public can read all active catalog data
DROP POLICY IF EXISTS "Public can view active hosting plans" ON public.catalog_hosting_plans;
CREATE POLICY "Public can view active hosting plans"
    ON public.catalog_hosting_plans FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Public can view active domain tlds" ON public.catalog_domain_tlds;
CREATE POLICY "Public can view active domain tlds"
    ON public.catalog_domain_tlds FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Public can view active promo codes" ON public.promo_codes;
CREATE POLICY "Public can view active promo codes"
    ON public.promo_codes FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Public can view platform settings" ON public.platform_settings;
CREATE POLICY "Public can view platform settings"
    ON public.platform_settings FOR SELECT
    USING (true);

-- Admins can manage everything
DROP POLICY IF EXISTS "Admins can manage hosting plans" ON public.catalog_hosting_plans;
CREATE POLICY "Admins can manage hosting plans"
    ON public.catalog_hosting_plans FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage domain tlds" ON public.catalog_domain_tlds;
CREATE POLICY "Admins can manage domain tlds"
    ON public.catalog_domain_tlds FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins can manage promo codes"
    ON public.promo_codes FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins can manage platform settings"
    ON public.platform_settings FOR ALL
    USING (public.is_admin());

-- ==============================================================================
-- INITIAL PRODUCTION SEED DATA (SAFE UPSERTS)
-- ==============================================================================

-- 1. Shared & Developer Hosting Plans
INSERT INTO public.catalog_hosting_plans (
    slug, name_en, name_bn, category,
    selling_price_monthly_bdt, unit_server_cost_bdt, min_owner_profit_bdt, annual_discount_percent,
    storage_gb, ram_mb, cpu_cores, io_speed_mbps, entry_processes, inode_limit, max_addon_domains,
    ssh_enabled, git_auto_deploy, backup_frequency, whm_package_name, is_popular, sort_order, features_json
) VALUES
(
    'starter', 'Starter Pack', 'স্টার্টার প্যাক', 'shared',
    200.00, 45.00, 95.00, 20.00,
    2, 1024, 1, 25, 20, 150000, 1,
    FALSE, FALSE, 'Weekly Backup', 'devhost_starter_2g', FALSE, 1,
    '["2 GB Pure NVMe SSD", "1 GB Dedicated CloudLinux RAM", "1 Core CPU | 25 MB/s Disk I/O", "1-Click WordPress (Softaculous)", "Free Automated Wildcard SSL", "Sitejet AI Website Builder Included", "cPanel File Manager & PHP Selector", "Weekly Automated Backups"]'::jsonb
),
(
    'developer-pro', 'Developer Pro', 'ডেভেলপার প্রো', 'developer',
    450.00, 90.00, 225.00, 20.00,
    5, 2048, 2, 50, 40, 300000, 5,
    TRUE, TRUE, 'Every 3 Days', 'devhost_devpro_5g', TRUE, 2,
    '["5 GB Pure NVMe SSD", "2 GB Dedicated CloudLinux RAM", "2 Cores CPU | 50 MB/s Disk I/O", "Node.js (v18-v22), Next.js & Python", "1-Click GitHub Webhook Auto-Deploy", "Jailed SSH & WP-CLI Access", "Smart In-Place Overwrite Pipeline", "Backups Shipped Every 3 Days"]'::jsonb
),
(
    'business-max', 'Business Max', 'বিজনেস ম্যাক্স', 'shared',
    900.00, 180.00, 450.00, 20.00,
    15, 4096, 4, 100, 80, 600000, 15,
    TRUE, TRUE, 'Daily Automated', 'devhost_bizmax_15g', FALSE, 3,
    '["15 GB Pure NVMe SSD", "4 GB Dedicated CloudLinux RAM", "4 Cores CPU | 100 MB/s Disk I/O", "Enterprise Redis & Object Cache 100/100", "WooCommerce High-Concurrency Engine", "Priority Tier-1 VIP NOC Routing", "White-Label Staging & Cloning Tools", "Daily Automated Offsite Snapshots"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    selling_price_monthly_bdt = EXCLUDED.selling_price_monthly_bdt,
    unit_server_cost_bdt = EXCLUDED.unit_server_cost_bdt,
    min_owner_profit_bdt = EXCLUDED.min_owner_profit_bdt,
    storage_gb = EXCLUDED.storage_gb,
    ram_mb = EXCLUDED.ram_mb,
    cpu_cores = EXCLUDED.cpu_cores,
    features_json = EXCLUDED.features_json;

-- 2. Cloud KVM VPS Plans
INSERT INTO public.catalog_hosting_plans (
    slug, name_en, name_bn, category,
    selling_price_monthly_bdt, unit_server_cost_bdt, min_owner_profit_bdt, annual_discount_percent,
    storage_gb, ram_mb, cpu_cores, io_speed_mbps, entry_processes, inode_limit, max_addon_domains,
    ssh_enabled, git_auto_deploy, backup_frequency, whm_package_name, is_popular, sort_order, features_json
) VALUES
(
    'cloud-kvm-1', 'Cloud KVM-1', 'ক্লাউড কেভিএম-১', 'vps',
    1450.00, 500.00, 650.00, 15.00,
    60, 4096, 2, 350, 100, 1000000, 999,
    TRUE, TRUE, 'Weekly Automated', 'devhost_vps_kvm1', FALSE, 10,
    '["2 vCPU Cores AMD EPYC", "4 GB DDR5 ECC RAM", "60 GB Pure NVMe Gen4", "2 TB High-Speed Bandwidth", "1 Dedicated IPv4", "Full Root SSH & Custom ISO", "Singapore SG1 & USA East"]'::jsonb
),
(
    'cloud-kvm-2', 'Cloud KVM-2', 'ক্লাউড কেভিএম-২', 'vps',
    2750.00, 950.00, 1250.00, 15.00,
    120, 8192, 4, 350, 200, 2000000, 999,
    TRUE, TRUE, 'Weekly Automated', 'devhost_vps_kvm2', TRUE, 11,
    '["4 vCPU Cores AMD EPYC", "8 GB DDR5 ECC RAM", "120 GB Pure NVMe Gen4", "4 TB High-Speed Bandwidth", "1 Dedicated IPv4", "Docker & Kubernetes MicroK8s Ready", "10 Gbps Redundant Uplink"]'::jsonb
),
(
    'cloud-kvm-4', 'Cloud KVM-4', 'ক্লাউড কেভিএম-৪', 'vps',
    5200.00, 1800.00, 2400.00, 15.00,
    240, 16384, 6, 500, 400, 5000000, 999,
    TRUE, TRUE, 'Daily Automated', 'devhost_vps_kvm4', FALSE, 12,
    '["6 vCPU Cores AMD EPYC", "16 GB DDR5 ECC RAM", "240 GB Pure NVMe Gen4", "8 TB High-Speed Bandwidth", "1 Dedicated IPv4", "Multi-Tenant E-Commerce Scale", "Enterprise Redis Tuning"]'::jsonb
),
(
    'cloud-kvm-8', 'Cloud KVM-8', 'ক্লাউড কেভিএম-৮', 'vps',
    9800.00, 3400.00, 4600.00, 15.00,
    480, 32768, 8, 500, 800, 10000000, 999,
    TRUE, TRUE, 'Daily Automated', 'devhost_vps_kvm8', FALSE, 13,
    '["8 vCPU Cores AMD EPYC", "32 GB DDR5 ECC RAM", "480 GB Pure NVMe Gen4", "12 TB High-Speed Bandwidth", "2 Dedicated IPv4", "Bare-Metal Virtual Isolation", "24/7 Dedicated NOC Support"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    selling_price_monthly_bdt = EXCLUDED.selling_price_monthly_bdt,
    unit_server_cost_bdt = EXCLUDED.unit_server_cost_bdt,
    min_owner_profit_bdt = EXCLUDED.min_owner_profit_bdt,
    storage_gb = EXCLUDED.storage_gb,
    ram_mb = EXCLUDED.ram_mb,
    cpu_cores = EXCLUDED.cpu_cores,
    features_json = EXCLUDED.features_json;

-- 3. Dynamic Domain TLD Registrar Pricing
INSERT INTO public.catalog_domain_tlds (
    tld, category, registrar_cost_bdt, reg_price_bdt, renew_price_bdt, transfer_price_bdt,
    affiliate_eligible, featured_badge, is_active
) VALUES
('.com', 'Popular', 1150.00, 1350.00, 1450.00, 1350.00, FALSE, 'Most Popular', TRUE),
('.net', 'Popular', 1450.00, 1650.00, 1750.00, 1650.00, FALSE, 'Network Standard', TRUE),
('.org', 'Organization', 1300.00, 1500.00, 1600.00, 1500.00, FALSE, 'Trusted Non-Profit', TRUE),
('.xyz', 'Budget', 190.00, 290.00, 1400.00, 1300.00, FALSE, 'Best Starter', TRUE),
('.io', 'Developer', 4200.00, 4800.00, 5200.00, 4800.00, TRUE, 'Startup Favorite', TRUE),
('.ai', 'Developer', 8700.00, 9500.00, 9800.00, 9500.00, TRUE, 'AI & SaaS Standard', TRUE),
('.co', 'Business', 2700.00, 3100.00, 3400.00, 3100.00, FALSE, 'Global Corp', TRUE),
('.me', 'Personal', 1650.00, 1900.00, 2200.00, 1900.00, FALSE, 'Personal Portfolio', TRUE),
('.tech', 'Developer', 480.00, 650.00, 4200.00, 3900.00, FALSE, 'Tech Brand', TRUE),
('.shop', 'Business', 350.00, 450.00, 3200.00, 3000.00, FALSE, 'E-Commerce Store', TRUE)
ON CONFLICT (tld) DO UPDATE SET
    registrar_cost_bdt = EXCLUDED.registrar_cost_bdt,
    reg_price_bdt = EXCLUDED.reg_price_bdt,
    renew_price_bdt = EXCLUDED.renew_price_bdt,
    transfer_price_bdt = EXCLUDED.transfer_price_bdt;

-- 4. Initial Promo Codes
INSERT INTO public.promo_codes (
    code, discount_type, discount_value, applies_to, max_uses, current_uses,
    reduce_affiliate_commission_proportionally, expires_at, is_active
) VALUES
('BDIX50', 'percentage', 50.00, 'hosting', 100, 12, TRUE, NOW() + INTERVAL '90 days', TRUE),
('DEVHOST20', 'percentage', 20.00, 'all', 500, 45, TRUE, NOW() + INTERVAL '180 days', TRUE),
('WELCOME10', 'percentage', 10.00, 'all', 1000, 89, FALSE, NOW() + INTERVAL '365 days', TRUE)
ON CONFLICT (code) DO UPDATE SET
    discount_value = EXCLUDED.discount_value,
    is_active = EXCLUDED.is_active;

-- 5. Global Platform Settings
INSERT INTO public.platform_settings (key, value, description) VALUES
('bdix_status', '{"status": "online", "peering_mbps": 10000, "node": "Equinix SG1 + Dhaka IX"}'::jsonb, 'BDIX Connectivity Status'),
('vat_percent', '{"rate": 0, "enabled": false}'::jsonb, 'Value Added Tax Rate'),
('usd_bdt_rate', '{"rate": 120.00}'::jsonb, 'Live USD to BDT Exchange Rate'),
('affiliate_global_enabled', '{"enabled": true, "min_payout_bdt": 1000, "hold_days": 35}'::jsonb, 'Affiliate System Global Configuration')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value;


-- ==============================================================================
-- WORKFLOW 2: HACKER-PROOF 2FA, SUDO STEP-UP & MULTI-ROLE PROFILES
-- ==============================================================================
-- ==============================================================================
-- DEVHOST CLOUD - WORKFLOW 2: HACKER-PROOF 2FA, SUDO STEP-UP & MULTI-ROLE PROFILES
-- ==============================================================================

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

DROP POLICY IF EXISTS "Public can check referral slug existence" ON public.affiliate_marketer_profiles;
CREATE POLICY "Public can check referral slug existence"
    ON public.affiliate_marketer_profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update own affiliate marketer profile" ON public.affiliate_marketer_profiles;
CREATE POLICY "Users can update own affiliate marketer profile"
    ON public.affiliate_marketer_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own affiliate marketer profile" ON public.affiliate_marketer_profiles;
CREATE POLICY "Users can insert own affiliate marketer profile"
    ON public.affiliate_marketer_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service Role Bypass Policies (Admin / Edge Functions full access)
DROP POLICY IF EXISTS "Service role full access security" ON public.user_security_credentials;
CREATE POLICY "Service role full access security"
    ON public.user_security_credentials FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access customer" ON public.customer_developer_profiles;
CREATE POLICY "Service role full access customer"
    ON public.customer_developer_profiles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access affiliate" ON public.affiliate_marketer_profiles;
CREATE POLICY "Service role full access affiliate"
    ON public.affiliate_marketer_profiles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 7. AUTO INITIAL SEED TRIGGER FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user_security_and_profiles()
RETURNS TRIGGER AS $$
BEGIN
    -- Initialize user security record
    INSERT INTO public.user_security_credentials (user_id, totp_enabled, email_2fa_enabled)
    VALUES (NEW.id, false, true)
    ON CONFLICT (user_id) DO NOTHING;

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
        NEW.company_name,
        'Bangladesh',
        'sg1',
        '22',
        '8.3'
    )
    ON CONFLICT (user_id) DO NOTHING;

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
        NEW.full_name,
        LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9]', '', 'g')) || '-' || SUBSTRING(NEW.id::text, 1, 4),
        'bkash_personal',
        1000.00
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
BEGIN
    FOR r IN SELECT * FROM public.profiles LOOP
        INSERT INTO public.user_security_credentials (user_id, totp_enabled, email_2fa_enabled)
        VALUES (r.id, false, true)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.customer_developer_profiles (user_id, account_type, company_legal_name, billing_country)
        VALUES (r.id, 'individual', r.company_name, 'Bangladesh')
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.affiliate_marketer_profiles (
            user_id,
            partner_display_name,
            custom_referral_slug,
            primary_payout_method,
            min_payout_threshold_bdt
        )
        VALUES (
            r.id,
            r.full_name,
            LOWER(REGEXP_REPLACE(SPLIT_PART(r.email, '@', 1), '[^a-zA-Z0-9]', '', 'g')) || '-' || SUBSTRING(r.id::text, 1, 4),
            'bkash_personal',
            1000.00
        )
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END;
$$;


-- ==============================================================================
-- WORKFLOW 3 OF 6: CLOUDFLARE & NAMECHEAP-GRADE DYNAMIC DOMAIN PORTFOLIO,
-- RFC-VALIDATED DNS ZONE ENGINE, EPP TRANSFER STATE MACHINE & ADDON DOMAIN ROUTER
-- ==============================================================================

-- 1. CLOUDFLARE-GRADE INDIVIDUAL DNS RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA')),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INT DEFAULT NULL,
    ttl INT NOT NULL DEFAULT 3600,
    proxied BOOLEAN DEFAULT FALSE,
    comment TEXT,
    is_system_managed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dns_domain_id ON public.domain_dns_records(domain_id);
CREATE INDEX IF NOT EXISTS idx_dns_lookup ON public.domain_dns_records(domain_id, name, record_type);
CREATE INDEX IF NOT EXISTS idx_dns_user_id ON public.domain_dns_records(user_id);

-- 2. PRIVATE BRANDED GLUE RECORDS (CHILD NAMESERVERS)
CREATE TABLE IF NOT EXISTS public.domain_child_nameservers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL,
    ipv4_address TEXT NOT NULL,
    ipv6_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_child_ns_domain ON public.domain_child_nameservers(domain_id);

-- 3. DOMAIN 301/302 HTTP URL REDIRECTION ENGINE
CREATE TABLE IF NOT EXISTS public.domain_url_forwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_prefix TEXT NOT NULL DEFAULT '@',
    destination_url TEXT NOT NULL,
    redirect_type INT NOT NULL DEFAULT 301 CHECK (redirect_type IN (301, 302)),
    preserve_path_query BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_forward_domain ON public.domain_url_forwards(domain_id);

-- 4. INBOUND EPP DOMAIN TRANSFER STATE MACHINE (5-STEP NAMECHEAP FLOW)
CREATE TABLE IF NOT EXISTS public.domain_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain_name TEXT NOT NULL,
    tld TEXT NOT NULL,
    epp_code_encrypted TEXT NOT NULL,
    transfer_price_bdt NUMERIC(10, 2) NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id),
    current_step INT DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
        'pending_payment',
        'verifying_epp',
        'awaiting_losing_registrar',
        'completed',
        'rejected_invalid_epp',
        'locked_at_source'
    )),
    status_message TEXT,
    auto_import_dns BOOLEAN DEFAULT TRUE,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transfers_user ON public.domain_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_domain ON public.domain_transfers(domain_name);

-- 5. HOSTING ADDON DOMAINS, SUBDOMAINS, PARKED ALIASES & STAGING CLONES
CREATE TABLE IF NOT EXISTS public.hosting_addon_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain_type TEXT NOT NULL DEFAULT 'addon_domain' CHECK (domain_type IN (
        'addon_domain',
        'subdomain',
        'parked_alias',
        'staging_clone'
    )),
    hostname TEXT UNIQUE NOT NULL,
    document_root TEXT NOT NULL,
    runtime_engine TEXT DEFAULT 'Node.js 22 LTS',
    ssl_status TEXT DEFAULT 'active_tls13' CHECK (ssl_status IN ('active_tls13', 'provisioning', 'expired')),
    force_https BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_service ON public.hosting_addon_domains(service_id);
CREATE INDEX IF NOT EXISTS idx_addon_user ON public.hosting_addon_domains(user_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.domain_dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_child_nameservers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_url_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_addon_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own domain dns records" ON public.domain_dns_records
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users insert own domain dns records" ON public.domain_dns_records
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users update own domain dns records" ON public.domain_dns_records
    FOR UPDATE USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users delete own domain dns records" ON public.domain_dns_records
    FOR DELETE USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own child nameservers" ON public.domain_child_nameservers
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own url forwards" ON public.domain_url_forwards
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users view own domain transfers" ON public.domain_transfers
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users insert domain transfers" ON public.domain_transfers
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Admins manage all domain transfers" ON public.domain_transfers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own addon domains" ON public.hosting_addon_domains
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );


-- ==============================================================================
-- WORKFLOW 4 OF 6: VERCEL & CPANEL-GRADE DYNAMIC PROJECT SETTINGS,
-- HMAC-VERIFIED GIT WEBHOOK ENGINE, AES-GCM ENCRYPTED .ENV VAULT,
-- IN-PORTAL DATABASE MANAGER & JETBACKUP/CRON CONTROLLER
-- ==============================================================================

-- 1. HOSTING PROJECT RUNTIME, FRAMEWORK & BUILD SETTINGS
CREATE TABLE IF NOT EXISTS public.hosting_project_settings (
    service_id UUID PRIMARY KEY REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    framework_preset TEXT NOT NULL DEFAULT 'nextjs_standalone' CHECK (framework_preset IN (
        'nextjs_standalone',
        'nodejs_express',
        'laravel_php',
        'wordpress_lscache',
        'python_wsgi',
        'static_site'
    )),
    runtime_version TEXT NOT NULL DEFAULT 'Node.js 22 LTS',
    root_directory TEXT NOT NULL DEFAULT './',
    install_command TEXT DEFAULT 'npm ci',
    build_command TEXT DEFAULT 'npm run build',
    output_directory TEXT DEFAULT '.next/standalone',
    startup_file TEXT DEFAULT 'server.js',
    git_repo_url TEXT,
    production_branch TEXT DEFAULT 'main',
    auto_deploy_on_push BOOLEAN DEFAULT TRUE,
    webhook_secret_token TEXT NOT NULL DEFAULT ('whsec_' || encode(gen_random_bytes(24), 'hex')),
    retained_rollback_releases INT DEFAULT 3 CHECK (retained_rollback_releases BETWEEN 1 AND 5),
    litespeed_cache_enabled BOOLEAN DEFAULT TRUE,
    redis_object_cache_enabled BOOLEAN DEFAULT TRUE,
    passenger_min_instances INT DEFAULT 1,
    directory_browsing_disabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_settings_user ON public.hosting_project_settings(user_id);

-- 2. GIT CI/CD DEPLOYMENT RELEASES & 1-CLICK ROLLBACK HISTORY
CREATE TABLE IF NOT EXISTS public.project_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    commit_sha TEXT NOT NULL,
    commit_message TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    author_name TEXT,
    trigger_source TEXT NOT NULL CHECK (trigger_source IN (
        'github_webhook',
        'manual_dashboard',
        'instant_rollback'
    )),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued',
        'building',
        'syncing_nvme',
        'live_production',
        'superseded',
        'failed'
    )),
    is_current_production BOOLEAN DEFAULT FALSE,
    artifact_size_mb NUMERIC(8, 2) NOT NULL DEFAULT 14.2,
    inodes_count INT NOT NULL DEFAULT 1850,
    duration_seconds NUMERIC(6, 2) DEFAULT 2.8,
    build_logs TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_service ON public.project_deployments(service_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON public.project_deployments(service_id, is_current_production);

-- 3. AES-256-GCM ENCRYPTED .ENV VAULT
CREATE TABLE IF NOT EXISTS public.project_env_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    env_key TEXT NOT NULL CHECK (env_key ~ '^[A-Z_][A-Z0-9_]*$'),
    encrypted_value TEXT NOT NULL,
    masked_preview TEXT NOT NULL,
    target_environment TEXT NOT NULL DEFAULT 'all' CHECK (target_environment IN ('production', 'staging', 'all')),
    is_secret BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_service_env_target UNIQUE (service_id, env_key, target_environment)
);

CREATE INDEX IF NOT EXISTS idx_env_service ON public.project_env_variables(service_id);

-- 4. IN-PORTAL DATABASES & REMOTE IP ACCESS
CREATE TABLE IF NOT EXISTS public.hosting_databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    db_engine TEXT NOT NULL DEFAULT 'MySQL 8.0' CHECK (db_engine IN ('MySQL 8.0', 'MariaDB 10.11', 'PostgreSQL 16')),
    db_name TEXT UNIQUE NOT NULL,
    db_username TEXT NOT NULL,
    db_password_hash TEXT NOT NULL,
    privileges TEXT DEFAULT 'ALL PRIVILEGES',
    size_mb NUMERIC(8, 2) DEFAULT 12.4,
    tables_count INT DEFAULT 8,
    remote_access_ips TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_databases_service ON public.hosting_databases(service_id);

-- 5. JETBACKUP OFFSITE SNAPSHOTS & RESTORE LEDGER
CREATE TABLE IF NOT EXISTS public.hosting_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    snapshot_label TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'automated_daily' CHECK (backup_type IN (
        'automated_daily',
        'pre_deploy_auto',
        'manual_snapshot'
    )),
    scope TEXT NOT NULL DEFAULT 'full_account' CHECK (scope IN (
        'full_account',
        'files_only',
        'database_only'
    )),
    storage_location TEXT DEFAULT 'Offsite Encrypted S3 Vault (SG1)',
    size_mb NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'restoring', 'creating')),
    last_restored_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_service ON public.hosting_backups(service_id);

-- 6. SANITIZED CRON JOB SCHEDULER
CREATE TABLE IF NOT EXISTS public.hosting_cron_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_label TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    command TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    email_output_on_error BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    last_exit_code INT DEFAULT 0,
    last_output_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_service ON public.hosting_cron_jobs(service_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.hosting_project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_env_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_cron_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project settings" ON public.hosting_project_settings
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users view own deployments" ON public.project_deployments
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users insert/manage own deployments" ON public.project_deployments
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own env variables" ON public.project_env_variables
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own databases" ON public.hosting_databases
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own backups" ON public.hosting_backups
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

CREATE POLICY "Users manage own cron jobs" ON public.hosting_cron_jobs
    FOR ALL USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );
