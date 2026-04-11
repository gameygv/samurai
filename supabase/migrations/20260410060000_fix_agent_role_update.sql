-- =================================================================
-- Fix: Bug 3 — Funnel stage change doesn't persist for sales agents
-- =================================================================
-- Causas defensivas cubiertas:
--   1. profiles.role con mayúsculas o variantes ('Agent', 'AGENTE', 'Vendedor')
--      → get_user_role() no matcheaba los literales del policy
--   2. policy literal solo aceptaba 'agent','sales_agent','sales'
--   3. Normalización one-shot de valores existentes a 'agent'

BEGIN;

-- 1. get_user_role() ahora devuelve SIEMPRE en minúsculas y trim
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT LOWER(TRIM(role)) FROM public.profiles WHERE id = auth.uid()),
    'unknown'
  )
$$;

-- 2. Normalizar valores existentes: cualquier variante de agente → 'agent'
UPDATE public.profiles
SET role = 'agent'
WHERE LOWER(TRIM(role)) IN (
  'sales_agent', 'sales', 'agente', 'agente_ventas', 'agente de ventas',
  'vendedor', 'asesor', 'asesor_ventas', 'sales agent'
);

-- 3. Recrear policies de leads con set expandido de roles equivalentes a 'agent'
DROP POLICY IF EXISTS "leads_agent_select" ON public.leads;
DROP POLICY IF EXISTS "leads_agent_update" ON public.leads;
DROP POLICY IF EXISTS "leads_agent_insert" ON public.leads;

CREATE POLICY "leads_agent_select" ON public.leads
FOR SELECT TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND assigned_to = auth.uid()
);

CREATE POLICY "leads_agent_update" ON public.leads
FOR UPDATE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND assigned_to = auth.uid()
)
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND assigned_to = auth.uid()
);

CREATE POLICY "leads_agent_insert" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND assigned_to = auth.uid()
);

COMMIT;
