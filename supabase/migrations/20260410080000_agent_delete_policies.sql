-- =================================================================
-- Agent DELETE policies — agentes pueden borrar sus leads, conversaciones
-- y contactos asignados.
-- =================================================================
-- Bug reportado 2026-04-10: los agentes no podían borrar "contactos" (en
-- realidad borra lead + contact + conversaciones). Las políticas existentes
-- solo cubrían SELECT/INSERT/UPDATE — DELETE quedaba bloqueado por RLS.
--
-- Alcance: solo pueden borrar registros ligados a leads asignados a sí mismos.

BEGIN;

-- Usar las mismas variantes de rol que el fix anterior (20260410060000)
-- para consistencia defensiva.

-- LEADS DELETE
DROP POLICY IF EXISTS "leads_agent_delete" ON public.leads;
CREATE POLICY "leads_agent_delete" ON public.leads
FOR DELETE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND assigned_to = auth.uid()
);

-- CONVERSACIONES DELETE
DROP POLICY IF EXISTS "conv_agent_delete" ON public.conversaciones;
CREATE POLICY "conv_agent_delete" ON public.conversaciones
FOR DELETE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- CONTACTS DELETE
DROP POLICY IF EXISTS "contacts_agent_delete" ON public.contacts;
CREATE POLICY "contacts_agent_delete" ON public.contacts
FOR DELETE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- También ampliamos SELECT/INSERT/UPDATE de conversaciones y contacts con las
-- variantes de rol extendidas, por consistencia con leads_agent_*.
DROP POLICY IF EXISTS "conv_agent_select" ON public.conversaciones;
CREATE POLICY "conv_agent_select" ON public.conversaciones
FOR SELECT TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "conv_agent_insert" ON public.conversaciones;
CREATE POLICY "conv_agent_insert" ON public.conversaciones
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- Agregar UPDATE de conversaciones para agentes (p.ej. marcar como leído,
-- actualizar delivery_status localmente, etc.)
DROP POLICY IF EXISTS "conv_agent_update" ON public.conversaciones;
CREATE POLICY "conv_agent_update" ON public.conversaciones
FOR UPDATE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
)
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "contacts_agent_select" ON public.contacts;
CREATE POLICY "contacts_agent_select" ON public.contacts
FOR SELECT TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "contacts_agent_update" ON public.contacts;
CREATE POLICY "contacts_agent_update" ON public.contacts
FOR UPDATE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
)
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales', 'agente', 'vendedor', 'asesor')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

COMMIT;
