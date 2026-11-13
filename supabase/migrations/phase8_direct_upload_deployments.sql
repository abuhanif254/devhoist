-- ============================================================================
-- Phase 8: Direct Project File, Folder & ZIP Upload Deployments Migration
-- Idempotent PostgreSQL / Supabase migration for project_upload_sessions and
-- project_deployments extensions (release_id, upload_session_id, detected_stack).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Signed upload session tracking table
CREATE TABLE IF NOT EXISTS public.project_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.hosting_services(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  upload_mode text NOT NULL DEFAULT 'zip_upload'
    CHECK (upload_mode IN ('zip_upload', 'folder_upload', 'file_upload')),
  deploy_target text NOT NULL DEFAULT 'auto'
    CHECK (deploy_target IN ('auto', 'static_edge', 'container')),
  r2_object_key text NOT NULL,
  declared_size_bytes bigint NOT NULL CHECK (declared_size_bytes >= 0),
  actual_size_bytes bigint,
  uncompressed_size_bytes bigint,
  entry_count integer,
  detected_stack text,
  status text NOT NULL DEFAULT 'presigned'
    CHECK (status IN ('presigned', 'uploaded', 'scanning', 'deployed', 'rejected', 'expired')),
  rejection_reason text,
  deployment_id uuid REFERENCES public.project_deployments(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_upload_sessions_service_created
  ON public.project_upload_sessions (service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_upload_sessions_status_expires
  ON public.project_upload_sessions (status, expires_at);

ALTER TABLE public.project_upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_upload_sessions_owner_select" ON public.project_upload_sessions;
CREATE POLICY "project_upload_sessions_owner_select"
  ON public.project_upload_sessions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.hosting_services hs
      WHERE hs.id = project_upload_sessions.service_id
        AND hs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "project_upload_sessions_service_role_all" ON public.project_upload_sessions;
CREATE POLICY "project_upload_sessions_service_role_all"
  ON public.project_upload_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Extend project_deployments with release metadata & upload trigger sources
ALTER TABLE IF EXISTS public.project_deployments
  ADD COLUMN IF NOT EXISTS release_id text,
  ADD COLUMN IF NOT EXISTS upload_session_id uuid REFERENCES public.project_upload_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS detected_stack text;

CREATE INDEX IF NOT EXISTS idx_project_deployments_service_release
  ON public.project_deployments (service_id, release_id)
  WHERE release_id IS NOT NULL;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_deployments'
      AND column_name = 'trigger_source'
  ) THEN
    FOR v_constraint_name IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'project_deployments'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%trigger_source%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.project_deployments DROP CONSTRAINT IF EXISTS %I',
        v_constraint_name
      );
    END LOOP;

    ALTER TABLE public.project_deployments
      ADD CONSTRAINT project_deployments_trigger_source_check
      CHECK (
        trigger_source IN (
          'manual',
          'manual_redeploy',
          'manual_dashboard',
          'manual_rebuild',
          'git_push',
          'github_push',
          'github_webhook',
          'webhook',
          'zip_upload',
          'folder_upload',
          'file_upload',
          'stack_blueprint',
          'preview_promotion',
          'rollback',
          'api',
          'api_deploy'
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
