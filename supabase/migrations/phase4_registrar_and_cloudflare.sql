-- ==============================================================================
-- PHASE 4: REAL DOMAIN REGISTRAR & CLOUDFLARE ANYCAST EDGE PLANE MIGRATION
-- Safe idempotent migration for PostgreSQL 15+ (Supabase SQL Editor)
-- ==============================================================================

-- 1. Domains Table: Registrar Order IDs, Provider & Cloudflare Zone Metadata
ALTER TABLE IF EXISTS public.domains
    ADD COLUMN IF NOT EXISTS registrar_provider TEXT NOT NULL DEFAULT 'unassigned',
    ADD COLUMN IF NOT EXISTS registrar_order_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_zone_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS cloudflare_nameservers JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_domains_cloudflare_zone_id
    ON public.domains(cloudflare_zone_id);

CREATE INDEX IF NOT EXISTS idx_domains_registrar_order_id
    ON public.domains(registrar_order_id);

-- 2. Individual DNS Records Table: Track Live Cloudflare Record IDs & Sync State
ALTER TABLE IF EXISTS public.domain_dns_records
    ADD COLUMN IF NOT EXISTS cloudflare_record_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT,
    ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'pending_sync';

CREATE INDEX IF NOT EXISTS idx_dns_cloudflare_record_id
    ON public.domain_dns_records(cloudflare_record_id);

-- 3. Hosting Addon Domains / Custom Hostnames: Cloudflare for SaaS SSL & DCV Tracking
ALTER TABLE IF EXISTS public.hosting_addon_domains
    ADD COLUMN IF NOT EXISTS cloudflare_hostname_id TEXT,
    ADD COLUMN IF NOT EXISTS ssl_dcv_method TEXT NOT NULL DEFAULT 'txt',
    ADD COLUMN IF NOT EXISTS dcv_record_name TEXT,
    ADD COLUMN IF NOT EXISTS dcv_record_value TEXT,
    ADD COLUMN IF NOT EXISTS custom_origin_server TEXT;

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    SELECT con.conname INTO constraint_name_var
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'hosting_addon_domains'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%ssl_status%';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.hosting_addon_domains DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
    END IF;

    ALTER TABLE public.hosting_addon_domains
        ADD CONSTRAINT hosting_addon_domains_ssl_status_check
        CHECK (ssl_status IN ('active_tls13', 'provisioning', 'pending_validation', 'expired'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped ssl_status constraint update: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_addon_cloudflare_hostname_id
    ON public.hosting_addon_domains(cloudflare_hostname_id);

-- 4. Domain URL Forwards: Track Live Cloudflare Dynamic Redirect Rule IDs
ALTER TABLE IF EXISTS public.domain_url_forwards
    ADD COLUMN IF NOT EXISTS cloudflare_rule_id TEXT;

-- 5. Domain Transfers: Upstream Registrar Transfer Order Tracking
ALTER TABLE IF EXISTS public.domain_transfers
    ADD COLUMN IF NOT EXISTS registrar_transfer_id TEXT,
    ADD COLUMN IF NOT EXISTS registrar_provider TEXT;

-- 6. Edge WAF Rules: Track Live Cloudflare IP Access Rule / Ruleset Synchronization
ALTER TABLE IF EXISTS public.edge_waf_rules
    ADD COLUMN IF NOT EXISTS cloudflare_rule_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_ruleset_id TEXT,
    ADD COLUMN IF NOT EXISTS cloudflare_sync_status TEXT NOT NULL DEFAULT 'local_only';

CREATE INDEX IF NOT EXISTS idx_waf_cloudflare_rule_id
    ON public.edge_waf_rules(cloudflare_rule_id);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
