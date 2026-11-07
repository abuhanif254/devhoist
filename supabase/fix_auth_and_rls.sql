-- ==============================================================================
-- DEVHOST CLOUD - FIX AUTH RLS (INFINITE RECURSION 42P17) ON public.profiles
-- Safe to run multiple times (idempotent). Run in the Supabase SQL Editor.
-- ==============================================================================

-- 1. SECURITY DEFINER admin check. Runs as the function owner so it BYPASSES RLS on
--    public.profiles, which is what prevents "infinite recursion detected in policy".
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;

-- 2. Drop EVERY existing policy on public.profiles (any of them may be the recursive one)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Users manage their OWN row
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id AND role = 'client');

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Admins get full access via the non-recursive helper
CREATE POLICY "profiles_admin_all"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- 5. Privilege-escalation guard: a normal user must never be able to promote themselves
--    to admin or edit their own wallet balance through the public API.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- service_role / SQL editor (no JWT subject) and real admins may change anything
    IF auth.uid() IS NULL OR public.is_admin_user() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        NEW.role := OLD.role;
    END IF;
    IF NEW.wallet_balance_bdt IS DISTINCT FROM OLD.wallet_balance_bdt THEN
        NEW.wallet_balance_bdt := OLD.wallet_balance_bdt;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Verification: this must return rows (or zero rows) WITHOUT error 42P17
-- SELECT id, email, role FROM public.profiles LIMIT 5;
