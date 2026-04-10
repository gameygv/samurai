-- Allow agents to upsert ONLY their own agent_ai_status key in app_config
-- Required for #ON/#OFF command and AI toggle from Inbox/ChatViewer panels
-- Security: restrictive — agent can only write their own row in AI_CONTROL category

CREATE POLICY "config_agent_insert_own_ai_status" ON public.app_config
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND key = 'agent_ai_status_' || auth.uid()::text
  AND category = 'AI_CONTROL'
);

CREATE POLICY "config_agent_update_own_ai_status" ON public.app_config
FOR UPDATE TO authenticated
USING (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND key = 'agent_ai_status_' || auth.uid()::text
)
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND key = 'agent_ai_status_' || auth.uid()::text
  AND category = 'AI_CONTROL'
);

-- Allow agents to report AI errors to Bitácora #CIA
-- The "Corregir IA" button in MemoryPanel is visible to all users
CREATE POLICY "errores_agent_insert" ON public.errores_ia
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND usuario_id = auth.uid()
);
