-- ==============================================================================
-- DEVHOST CLOUD PLATFORM: PHASE 5 COMPUTE, BUILD BROKER & R2 STORAGE MIGRATION
-- Target: Supabase PostgreSQL 15+ (100% Idempotent & Table-Presence Guarded)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND WHM / PAAS COMPUTE SERVER NODES
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.whm_server_nodes') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.whm_server_nodes
                ADD COLUMN IF NOT EXISTS node_driver TEXT NOT NULL DEFAULT 'hybrid',
                ADD COLUMN IF NOT EXISTS agent_endpoint TEXT,
                ADD COLUMN IF NOT EXISTS agent_region TEXT DEFAULT 'sg1',
                ADD COLUMN IF NOT EXISTS max_ram_mb INTEGER NOT NULL DEFAULT 65536,
                ADD COLUMN IF NOT EXISTS allocated_ram_mb INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS cpu_cores INTEGER NOT NULL DEFAULT 16,
                ADD COLUMN IF NOT EXISTS agent_version TEXT,
                ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 2. EXTEND HOSTING_SERVICES & PROJECT_DEPLOYMENTS WITH LIVE RUNTIME METADATA
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.hosting_services') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_services
                ADD COLUMN IF NOT EXISTS runtime_family TEXT,
                ADD COLUMN IF NOT EXISTS stack_slug TEXT,
                ADD COLUMN IF NOT EXISTS container_id TEXT,
                ADD COLUMN IF NOT EXISTS upstream_url TEXT,
                ADD COLUMN IF NOT EXISTS upstream_port INTEGER,
                ADD COLUMN IF NOT EXISTS deployment_mode TEXT NOT NULL DEFAULT 'hybrid',
                ADD COLUMN IF NOT EXISTS health_check_status TEXT NOT NULL DEFAULT 'unknown',
                ADD COLUMN IF NOT EXISTS live_preview_url TEXT,
                ADD COLUMN IF NOT EXISTS r2_bucket_prefix TEXT,
                ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ
        $sql$;
    END IF;

    IF to_regclass('public.project_deployments') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.project_deployments
                ADD COLUMN IF NOT EXISTS r2_artifact_key TEXT,
                ADD COLUMN IF NOT EXISTS container_id TEXT,
                ADD COLUMN IF NOT EXISTS build_job_id TEXT,
                ADD COLUMN IF NOT EXISTS live_url TEXT,
                ADD COLUMN IF NOT EXISTS runtime_family TEXT,
                ADD COLUMN IF NOT EXISTS health_check_status TEXT
        $sql$;

        -- Ensure trigger_source accepts api_deploy alongside existing sources
        IF EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'project_deployments'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%trigger_source%'
        ) THEN
            EXECUTE $sql$
                ALTER TABLE public.project_deployments
                    DROP CONSTRAINT IF EXISTS project_deployments_trigger_source_check
            $sql$;
            EXECUTE $sql$
                ALTER TABLE public.project_deployments
                    ADD CONSTRAINT project_deployments_trigger_source_check CHECK (
                        trigger_source IN (
                            'github_push',
                            'github_webhook',
                            'manual_redeploy',
                            'manual_dashboard',
                            'rollback',
                            'instant_rollback',
                            'zip_upload',
                            'stack_blueprint',
                            'preview_promotion',
                            'api_deploy'
                        )
                    )
            $sql$;
        END IF;
    END IF;

    IF to_regclass('public.hosting_backups') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_backups
                ADD COLUMN IF NOT EXISTS r2_object_key TEXT,
                ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 3. RECONCILE EMAIL & TERMINAL TABLES USED BY CLOUD WORKSPACE APIS
-- ------------------------------------------------------------------------------
DO $do$
BEGIN
    IF to_regclass('public.hosting_email_accounts') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.hosting_email_accounts
                ADD COLUMN IF NOT EXISTS quota_mb INTEGER DEFAULT 1024,
                ADD COLUMN IF NOT EXISTS used_mb NUMERIC(10, 2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS forward_to_email TEXT,
                ADD COLUMN IF NOT EXISTS mailbox_id_external TEXT
        $sql$;
    END IF;

    IF to_regclass('public.terminal_and_sql_logs') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.terminal_and_sql_logs
                ADD COLUMN IF NOT EXISTS command_or_query TEXT,
                ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'executed',
                ADD COLUMN IF NOT EXISTS output_preview TEXT,
                ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        $sql$;
    END IF;
END $do$;

-- ------------------------------------------------------------------------------
-- 4. COMPUTE_BUILD_JOBS TABLE (Cloudflare Queue + Agent Job Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compute_build_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    deployment_id UUID,
    node_code TEXT,
    stack_slug TEXT,
    runtime_family TEXT,
    trigger_source TEXT NOT NULL DEFAULT 'manual_dashboard',
    status TEXT NOT NULL DEFAULT 'queued' CHECK (
        status IN ('queued', 'cloning', 'building', 'deploying', 'live', 'failed', 'cancelled')
    ),
    queue_message_id TEXT,
    r2_artifact_key TEXT,
    container_id TEXT,
    upstream_port INTEGER,
    live_url TEXT,
    build_logs TEXT NOT NULL DEFAULT '',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compute_build_jobs_service
    ON public.compute_build_jobs(service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compute_build_jobs_status
    ON public.compute_build_jobs(status, created_at DESC);

ALTER TABLE public.compute_build_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own build jobs or admin" ON public.compute_build_jobs;
CREATE POLICY "Users view own build jobs or admin"
    ON public.compute_build_jobs
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage all build jobs" ON public.compute_build_jobs;
CREATE POLICY "Admins manage all build jobs"
    ON public.compute_build_jobs
    FOR ALL
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
