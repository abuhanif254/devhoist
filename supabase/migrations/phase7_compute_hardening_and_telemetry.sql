-- ==============================================================================
-- DEVHOST CLOUD PLATFORM: PHASE 7 COMPUTE HARDENING & REAL TELEMETRY MIGRATION
-- Target: Supabase PostgreSQL 15+ (100% Idempotent & Table-Presence Guarded)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND HOSTING_SERVICES WITH QUOTA PARITY, ZEROED USAGE DEFAULTS & FAILURE STATUS
-- ------------------------------------------------------------------------------
DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.hosting_services') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD COLUMN IF NOT EXISTS cpu_cores NUMERIC(4, 2) NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS bandwidth_used_gb NUMERIC(8, 2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS bandwidth_limit_gb NUMERIC(8, 2) NOT NULL DEFAULT 1000.0,
                ADD COLUMN IF NOT EXISTS provisioning_error TEXT,
                ADD COLUMN IF NOT EXISTS health_check_status TEXT NOT NULL DEFAULT 'unknown',
                ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ
        $sql$;

        -- Remove misleading sample defaults from freshly provisioned accounts
        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ALTER COLUMN disk_used_gb SET DEFAULT 0,
                ALTER COLUMN ram_used_mb SET DEFAULT 0,
                ALTER COLUMN inode_used SET DEFAULT 0,
                ALTER COLUMN bandwidth_used_gb SET DEFAULT 0
        $sql$;

        -- Replace status CHECK constraint to support fail-closed provisioning_failed state
        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_services'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ~* '\mstatus\M'
              AND pg_get_constraintdef(con.oid) NOT ILIKE '%health_check_status%'
        LOOP
            EXECUTE format('ALTER TABLE public.hosting_services DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD CONSTRAINT hosting_services_status_check CHECK (
                    status IN ('active', 'suspended', 'pending', 'terminated', 'provisioning_failed')
                )
        $sql$;

        -- Allow any validated lowercase server node code (sg1, us1, bd1, eu1, etc.)
        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'hosting_services'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%server_node%'
        LOOP
            EXECUTE format('ALTER TABLE public.hosting_services DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            UPDATE public.hosting_services
            SET server_node = LOWER(TRIM(server_node))
            WHERE server_node IS NOT NULL
              AND server_node <> LOWER(TRIM(server_node))
        $sql$;

        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD CONSTRAINT hosting_services_server_node_check CHECK (
                    server_node ~ '^[a-z0-9_-]{2,32}$'
                )
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 2. SERVICE UPTIME TELEMETRY HARDENING & STRICT RLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_uptime_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    http_status INT NOT NULL DEFAULT 200,
    response_time_ms INT NOT NULL DEFAULT 0,
    ssl_days_remaining INT DEFAULT NULL,
    incident_type TEXT NOT NULL DEFAULT 'healthy',
    auto_healed BOOLEAN DEFAULT FALSE,
    healing_action_taken TEXT,
    uptime_30d_percent NUMERIC(5, 2) DEFAULT 100.00,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $do$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.service_uptime_telemetry') IS NOT NULL THEN
        FOR r IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'service_uptime_telemetry'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%incident_type%'
        LOOP
            EXECUTE format('ALTER TABLE public.service_uptime_telemetry DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;

        EXECUTE $sql$
            ALTER TABLE public.service_uptime_telemetry
                ALTER COLUMN ssl_days_remaining SET DEFAULT NULL,
                ALTER COLUMN response_time_ms SET DEFAULT 0,
                ALTER COLUMN uptime_30d_percent SET DEFAULT 100.00
        $sql$;

        EXECUTE $sql$
            ALTER TABLE public.service_uptime_telemetry
                ADD CONSTRAINT service_uptime_telemetry_incident_type_check CHECK (
                    incident_type IN (
                        'healthy',
                        'http_503_passenger_hang',
                        'http_502_bad_gateway',
                        'high_memory_spike',
                        'ssl_expiring',
                        'dns_unrouted',
                        'probe_timeout'
                    )
                )
        $sql$;

        EXECUTE $sql$ALTER TABLE public.service_uptime_telemetry ENABLE ROW LEVEL SECURITY$sql$;

        EXECUTE $sql$DROP POLICY IF EXISTS "Users read own uptime telemetry" ON public.service_uptime_telemetry$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Users can view own uptime telemetry" ON public.service_uptime_telemetry$sql$;
        EXECUTE $sql$DROP POLICY IF EXISTS "Service role can manage telemetry" ON public.service_uptime_telemetry$sql$;

        EXECUTE $sql$
            CREATE POLICY "Users read own uptime telemetry"
                ON public.service_uptime_telemetry
                FOR SELECT
                USING (user_id = auth.uid() OR public.is_admin())
        $sql$;

        EXECUTE $sql$
            CREATE POLICY "Service role can manage telemetry"
                ON public.service_uptime_telemetry
                FOR ALL
                TO service_role
                USING (true)
                WITH CHECK (true)
        $sql$;
    END IF;
END $do$;

CREATE INDEX IF NOT EXISTS idx_uptime_service_checked_at
    ON public.service_uptime_telemetry(service_id, checked_at DESC);

-- ------------------------------------------------------------------------------
-- 3. PLATFORM 5-CORE SERVICE PROBE TELEMETRY TABLE (/api/uptime REAL BACKING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_service_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_key TEXT NOT NULL,
    service_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Core',
    status TEXT NOT NULL DEFAULT 'operational'
        CHECK (status IN ('operational', 'degraded', 'outage')),
    latency_ms INTEGER NOT NULL DEFAULT 0,
    uptime_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    details TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_service_telemetry
    ALTER COLUMN service_name SET DEFAULT '',
    ALTER COLUMN category SET DEFAULT 'Core';

CREATE INDEX IF NOT EXISTS idx_platform_telemetry_key_checked
    ON public.platform_service_telemetry(service_key, checked_at DESC);

ALTER TABLE public.platform_service_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read platform telemetry" ON public.platform_service_telemetry;
CREATE POLICY "Public read platform telemetry"
    ON public.platform_service_telemetry
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role manage platform telemetry" ON public.platform_service_telemetry;
CREATE POLICY "Service role manage platform telemetry"
    ON public.platform_service_telemetry
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
