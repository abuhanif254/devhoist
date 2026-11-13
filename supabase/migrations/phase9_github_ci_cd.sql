-- ============================================================================
-- Phase 9: GitHub OAuth CI/CD, Push Auto-Deploys & Ephemeral PR Previews
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User-level GitHub OAuth account credentials (strictly service_role readable)
CREATE TABLE IF NOT EXISTS public.github_oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  github_user_id bigint NOT NULL,
  github_login text NOT NULL,
  avatar_url text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_oauth_accounts_github_user
  ON public.github_oauth_accounts (github_user_id);

ALTER TABLE public.github_oauth_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "github_oauth_accounts_service_role_all" ON public.github_oauth_accounts;
CREATE POLICY "github_oauth_accounts_service_role_all"
  ON public.github_oauth_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicitly revoke direct PostgREST access so ciphertexts never leave server routes
DO $$
BEGIN
  REVOKE ALL ON TABLE public.github_oauth_accounts FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- 2. Per-service Git repository binding & encrypted webhook credentials
CREATE TABLE IF NOT EXISTS public.project_git_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.hosting_services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  github_account_id uuid REFERENCES public.github_oauth_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github' CHECK (provider IN ('github')),
  repo_id bigint,
  repo_full_name text NOT NULL,
  repo_html_url text NOT NULL,
  clone_url text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  selected_branch text NOT NULL DEFAULT 'main',
  is_private boolean NOT NULL DEFAULT false,
  auto_deploy_on_push boolean NOT NULL DEFAULT true,
  pr_previews_enabled boolean NOT NULL DEFAULT true,
  webhook_id bigint,
  webhook_url text,
  webhook_secret_encrypted text,
  last_commit_sha text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_git_connections_service
  ON public.project_git_connections (service_id);

CREATE INDEX IF NOT EXISTS idx_project_git_connections_repo
  ON public.project_git_connections (repo_full_name);

ALTER TABLE public.project_git_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_git_connections_owner_select" ON public.project_git_connections;
CREATE POLICY "project_git_connections_owner_select"
  ON public.project_git_connections
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.hosting_services hs
      WHERE hs.id = project_git_connections.service_id
        AND hs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "project_git_connections_service_role_all" ON public.project_git_connections;
CREATE POLICY "project_git_connections_service_role_all"
  ON public.project_git_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Extend hosting_preview_environments for real isolated PR builds & teardowns
ALTER TABLE IF EXISTS public.hosting_preview_environments
  ADD COLUMN IF NOT EXISTS commit_message text,
  ADD COLUMN IF NOT EXISTS release_id text,
  ADD COLUMN IF NOT EXISTS build_job_id text,
  ADD COLUMN IF NOT EXISTS deployment_id uuid REFERENCES public.project_deployments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_id text,
  ADD COLUMN IF NOT EXISTS r2_prefix text,
  ADD COLUMN IF NOT EXISTS pr_comment_id bigint,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_hosting_previews_service_pr
  ON public.hosting_preview_environments (service_id, pr_number)
  WHERE pr_number IS NOT NULL;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  IF to_regclass('public.hosting_preview_environments') IS NOT NULL THEN
    FOR v_constraint_name IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'hosting_preview_environments'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.hosting_preview_environments DROP CONSTRAINT IF EXISTS %I',
        v_constraint_name
      );
    END LOOP;

    ALTER TABLE public.hosting_preview_environments
      ADD CONSTRAINT hosting_preview_environments_status_check
      CHECK (
        status IN (
          'building',
          'ready_live',
          'promoted_to_prod',
          'destroyed',
          'expired',
          'failed'
        )
      );
  END IF;
END $$;

-- 4. Extend project_deployments metadata for GitHub commits & PR previews
ALTER TABLE IF EXISTS public.project_deployments
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS build_job_id text,
  ADD COLUMN IF NOT EXISTS live_url text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS pr_number int;

NOTIFY pgrst, 'reload schema';
