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
