-- ==============================================================================
-- WORKFLOW 5 OF 6: ADMIN GOD-MODE CONTROL ROOM, REAL-TIME EDGE WAF & IP FIREWALL,
-- DOUBLE-ENTRY FINANCIAL PROFIT LEDGER, MULTI-NODE WHM CLUSTER MANAGER & DYNAMIC HEADLESS CMS
-- ==============================================================================

-- 1. REAL-TIME EDGE WAF & ENTITY BLACKLIST TABLE
CREATE TABLE IF NOT EXISTS public.edge_waf_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'ip_address',
        'email_domain',
        'payment_wallet_number',
        'user_account',
        'country_code'
    )),
    target_value TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'block_403' CHECK (action IN (
        'block_403',
        'challenge_2fa',
        'freeze_withdrawals',
        'whitelist_bypass'
    )),
    reason TEXT NOT NULL,
    triggered_count INT DEFAULT 1,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_waf_type_target UNIQUE (rule_type, target_value)
);

CREATE INDEX IF NOT EXISTS idx_waf_target_value ON public.edge_waf_rules(target_value);
CREATE INDEX IF NOT EXISTS idx_waf_active ON public.edge_waf_rules(rule_type, is_active);

-- 2. IMMUTABLE DOUBLE-ENTRY FINANCIAL PROFIT LEDGER
CREATE TABLE IF NOT EXISTS public.financial_profit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_code TEXT UNIQUE NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'hosting_sale',
        'hosting_renewal',
        'vps_sale',
        'domain_registration',
        'wallet_topup',
        'affiliate_payout',
        'customer_refund',
        'server_infrastructure_expense'
    )),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'stripe', 'wallet', 'system')),
    trx_id TEXT,
    gross_amount_bdt NUMERIC(12, 2) NOT NULL,
    base_cogs_cost_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0,
    affiliate_commission_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0,
    promo_discount_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0,
    owner_net_profit_bdt NUMERIC(12, 2) GENERATED ALWAYS AS (
        gross_amount_bdt - base_cogs_cost_bdt - affiliate_commission_bdt
    ) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entry_code ON public.financial_profit_ledger(entry_code);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON public.financial_profit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON public.financial_profit_ledger(user_id);

-- 3. WHM RESELLER & CLOUD SERVER CLUSTER REGISTRY
CREATE TABLE IF NOT EXISTS public.whm_server_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_code TEXT UNIQUE NOT NULL,
    node_name TEXT NOT NULL,
    datacenter_location TEXT NOT NULL,
    ipv4_address TEXT NOT NULL,
    whm_hostname TEXT NOT NULL,
    whm_username TEXT NOT NULL,
    whm_api_token_encrypted TEXT,
    primary_nameserver TEXT DEFAULT 'ns1.devhost.cloud',
    secondary_nameserver TEXT DEFAULT 'ns2.devhost.cloud',
    monthly_node_cost_bdt NUMERIC(10, 2) NOT NULL DEFAULT 3500.00,
    max_cpanel_slots INT NOT NULL DEFAULT 50,
    used_cpanel_slots INT DEFAULT 0,
    max_disk_gb NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    allocated_disk_gb NUMERIC(10, 2) DEFAULT 0.00,
    actual_physical_disk_gb NUMERIC(10, 2) DEFAULT 0.00,
    auto_provision_enabled BOOLEAN DEFAULT TRUE,
    is_healthy BOOLEAN DEFAULT TRUE,
    status_message TEXT DEFAULT '100% Operational - LiteSpeed + CloudLinux Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whm_nodes_code ON public.whm_server_nodes(node_code);

-- 4. DYNAMIC HEADLESS CMS, EXCHANGE RATE & GLOBAL CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.cms_global_config (
    config_key TEXT PRIMARY KEY,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.edge_waf_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_profit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whm_server_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_global_config ENABLE ROW LEVEL SECURITY;

-- 1. edge_waf_rules: Only admins can manage, system edge service key can read
CREATE POLICY "Admins full access on edge_waf_rules" ON public.edge_waf_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 2. financial_profit_ledger: Strictly private to admin
CREATE POLICY "Admins view and insert financial_profit_ledger" ON public.financial_profit_ledger
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 3. whm_server_nodes: Strictly private to admin
CREATE POLICY "Admins full access on whm_server_nodes" ON public.whm_server_nodes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 4. cms_global_config: Public can read sitewide settings, only admins can modify
CREATE POLICY "Public read cms_global_config" ON public.cms_global_config
    FOR SELECT USING (true);

CREATE POLICY "Admins modify cms_global_config" ON public.cms_global_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- ==============================================================================
-- PRODUCTION SEED DATA & INITIAL CONFIGURATION
-- ==============================================================================

-- 1. Seed Initial Server Cluster Nodes
INSERT INTO public.whm_server_nodes (
    node_code,
    node_name,
    datacenter_location,
    ipv4_address,
    whm_hostname,
    whm_username,
    primary_nameserver,
    secondary_nameserver,
    monthly_node_cost_bdt,
    max_cpanel_slots,
    used_cpanel_slots,
    max_disk_gb,
    allocated_disk_gb,
    actual_physical_disk_gb,
    auto_provision_enabled,
    is_healthy,
    status_message
) VALUES 
(
    'sg1-nvme-01',
    'Singapore SG1 Enterprise NVMe (Equinix)',
    'Singapore (Equinix SG1)',
    '103.151.102.45',
    'sg1.devhost.cloud',
    'root_sg1',
    'ns1.devhost.cloud',
    'ns2.devhost.cloud',
    3500.00,
    50,
    14,
    100.00,
    28.50,
    8.40,
    TRUE,
    TRUE,
    '100% Operational - LiteSpeed Enterprise 8-Worker Active'
),
(
    'us1-nvme-02',
    'US East NY4 Dev Cluster (Equinix)',
    'New York, USA (Equinix NY4)',
    '198.51.100.22',
    'us1.devhost.cloud',
    'root_us1',
    'ns1.devhost.cloud',
    'ns2.devhost.cloud',
    3500.00,
    50,
    6,
    100.00,
    12.00,
    4.10,
    TRUE,
    TRUE,
    '100% Operational - CloudLinux 9 OS + CageFS Active'
)
ON CONFLICT (node_code) DO NOTHING;

-- 2. Seed Headless CMS Global Configurations
INSERT INTO public.cms_global_config (config_key, config_value, description)
VALUES 
(
    'currency_settings',
    '{
        "usd_exchange_rate_bdt": 120,
        "default_currency": "BDT",
        "vat_percent": 0,
        "supported_currencies": ["BDT", "USD"]
    }'::jsonb,
    'Live currency conversion and VAT calculation settings'
),
(
    'announcement_banner',
    '{
        "enabled": true,
        "badge_en": "99.99% Global Uptime SLA",
        "badge_bn": "৯৯.৯৯% গ্লোবাল আপটাইম গ্যারান্টি",
        "text_en": "Instant bKash & Nagad Account Activation — Save 20% on Annual Plans with code LAUNCH20",
        "text_bn": "বিকাশ ও নগদে তাৎক্ষণিক অটোমেটিক হোস্টিং চালু — বার্ষিক প্ল্যানে ২০% ছাড় কোড LAUNCH20",
        "promo_code": "LAUNCH20",
        "link_url": "/#pricing"
    }'::jsonb,
    'Top header notification banner across the website'
),
(
    'security_lockdown',
    '{
        "under_attack_mode": false,
        "freeze_all_withdrawals": false,
        "block_new_signups": false,
        "require_2fa_for_all": false,
        "maintenance_mode": false,
        "strict_ip_country_whitelist": false
    }'::jsonb,
    'Global emergency security switches and threat lockdown controls'
),
(
    'payment_gateways_config',
    '{
        "bkash_active": true,
        "bkash_merchant_label": "01789-234567 (Automated Merchant)",
        "nagad_active": true,
        "nagad_merchant_label": "01889-234567 (Automated Merchant)",
        "stripe_active": true,
        "manual_trxid_fallback": true,
        "auto_approval_threshold_bdt": 5000
    }'::jsonb,
    'Payment gateway routing, wallet numbers and instant approval rules'
),
(
    'hero_cms_content',
    '{
        "headline_line1": "Developer Experience of Vercel.",
        "headline_line2": "Accessibility of cPanel.",
        "subheadline_en": "Deploy Git repos with LiteSpeed NVMe speed, instant automated bKash/Nagad checkout, and 1-click staging containers in Singapore & USA.",
        "subheadline_bn": "গিট রিপোজিটরি ডিপ্লয় করুন লাইটস্পিড NVMe স্পিডে, বিকাশ ও নগদে অটো অ্যাক্টিভেশন এবং সিঙ্গাপুর ও ইউএসএ ডাটা সেন্টারে ১-ক্লিকে হোস্টিং।",
        "starting_price_badge": "৳200/mo",
        "cta_button_en": "Get Started — 30-Day Money Back",
        "cta_button_bn": "শুরু করুন — ৩০ দিনের মানিব্যাক"
    }'::jsonb,
    'Hero section headlines and conversion copy'
)
ON CONFLICT (config_key) DO UPDATE 
SET config_value = EXCLUDED.config_value, updated_at = NOW();

-- 3. Seed Baseline Known Edge WAF Rules (Simulated Bad Actors)
INSERT INTO public.edge_waf_rules (
    rule_type,
    target_value,
    action,
    reason,
    triggered_count
) VALUES 
(
    'ip_address',
    '185.220.101.45',
    'block_403',
    'Repeated fake bKash trxID brute-force submission',
    14
),
(
    'payment_wallet_number',
    '01999999999',
    'freeze_withdrawals',
    'Known fraudulent wallet reported across multiple chargeback alerts',
    3
),
(
    'email_domain',
    'tempmail.org',
    'block_403',
    'Disposable fake email domain used for trial abuse',
    42
)
ON CONFLICT (rule_type, target_value) DO NOTHING;

-- 4. Seed Baseline Financial Profit Ledger Entries
INSERT INTO public.financial_profit_ledger (
    entry_code,
    entry_type,
    gateway,
    trx_id,
    gross_amount_bdt,
    base_cogs_cost_bdt,
    affiliate_commission_bdt,
    promo_discount_bdt,
    notes
) VALUES 
(
    'LDG-2026-9001',
    'hosting_sale',
    'bkash',
    '9K72LM89QP',
    450.00,
    70.00,
    90.00,
    0.00,
    'Developer Pro NVMe (1 Month) - Sale via Affiliate ref_devhanif'
),
(
    'LDG-2026-9002',
    'domain_registration',
    'nagad',
    '8H34NK12XZ',
    1250.00,
    1150.00,
    0.00,
    0.00,
    '.com 1-Year Registration (CIRA Buy Cost $9.50 = ৳1,150)'
),
(
    'LDG-2026-9003',
    'hosting_sale',
    'bkash',
    '7J45PL90OP',
    350.00,
    40.00,
    70.00,
    50.00,
    'Standard Shared Hosting (1 Month) - Promo code LAUNCH20 applied'
),
(
    'LDG-2026-9004',
    'server_infrastructure_expense',
    'system',
    'EXP-SG1-MARCH',
    -3500.00,
    3500.00,
    0.00,
    0.00,
    'Monthly Reseller Server Lease: Singapore SG1 Equinix 100GB NVMe Node'
)
ON CONFLICT (entry_code) DO NOTHING;
