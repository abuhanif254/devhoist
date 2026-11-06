-- ==============================================================================
-- DEVHOST CLOUD - 1ST-YEAR FREE DOMAIN BUNDLE & ZERO-TOUCH PROVISIONING SCHEMA
-- Execute this migration in your Supabase SQL Editor
-- Enhances catalog_hosting_plans with free annual domain bundle rules and AutoSSL
-- ==============================================================================

-- 1. ADD FREE DOMAIN BUNDLE COLUMNS TO CATALOG HOSTING PLANS
ALTER TABLE public.catalog_hosting_plans 
ADD COLUMN IF NOT EXISTS free_domain_tlds_annual TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE public.catalog_hosting_plans 
ADD COLUMN IF NOT EXISTS free_domain_max_cost_bdt NUMERIC(10, 2) DEFAULT 0.00;

-- 2. POPULATE INITIAL BUNDLE ELIGIBILITY RULES
-- Starter Pack (Annual): Free .xyz or .shop (Registrar wholesale buy cost ~180 BDT)
UPDATE public.catalog_hosting_plans
SET 
    free_domain_tlds_annual = ARRAY['.xyz', '.shop'],
    free_domain_max_cost_bdt = 180.00,
    updated_at = NOW()
WHERE slug IN ('starter', 'whm_starter_2gb', 'devhost_starter_2g') 
   OR (category = 'shared' AND selling_price_monthly_bdt <= 300);

-- Developer Pro & Business Max (Annual): Free .com, .net, .org, .xyz, or .shop (Wholesale .com buy cost ~1,150 BDT)
UPDATE public.catalog_hosting_plans
SET 
    free_domain_tlds_annual = ARRAY['.com', '.net', '.org', '.xyz', '.shop'],
    free_domain_max_cost_bdt = 1150.00,
    updated_at = NOW()
WHERE slug IN ('developer-pro', 'whm_devpro_5gb', 'devhost_devpro_5g', 'business-max', 'whm_bizmax_10gb', 'devhost_bizmax_15g')
   OR (category IN ('developer', 'shared', 'enterprise') AND selling_price_monthly_bdt > 300);

-- 3. ENSURE HOSTING SERVICES HAS SSL AND AUTO-FORCE HTTPS FIELDS
ALTER TABLE public.hosting_services 
ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'active_tls13';

ALTER TABLE public.hosting_services 
ADD COLUMN IF NOT EXISTS force_https BOOLEAN DEFAULT TRUE;

ALTER TABLE public.hosting_services 
ADD COLUMN IF NOT EXISTS auto_ssl_issued_at TIMESTAMPTZ DEFAULT NOW();

-- 4. ENSURE INVOICES TRACKS BILLING CYCLE & BUNDLED FREE DOMAINS
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS free_domain_bundle_applied BOOLEAN DEFAULT FALSE;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS bundled_domain_name TEXT;

-- 5. VERIFICATION QUERY
SELECT 
    id, 
    slug, 
    name_en, 
    selling_price_monthly_bdt, 
    annual_discount_percent, 
    free_domain_tlds_annual, 
    free_domain_max_cost_bdt 
FROM public.catalog_hosting_plans 
ORDER BY sort_order ASC;
