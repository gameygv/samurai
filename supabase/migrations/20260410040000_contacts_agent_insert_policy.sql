-- Allow agents to INSERT contacts for leads assigned to them
-- Fixes: "new row violates row-level security policy for table contacts"
-- when an agent creates a new lead (trigger auto-creates contact)

CREATE POLICY "contacts_agent_insert" ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);
