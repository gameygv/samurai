-- =================================================================
-- Migration: Create auth.get_user_role() helper function
-- Story: S9.2 — RLS Policies Reales por Rol
-- =================================================================
-- This function returns the current user's role from profiles.
-- SECURITY DEFINER bypasses profiles RLS (avoids circular dependency).
-- STABLE allows PostgreSQL to cache the result per-statement.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'unknown'
  )
$$;

-- Grant execute to authenticated and anon (anon gets 'unknown', denied by policies)
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon;

COMMIT;
