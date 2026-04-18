-- Allow agents to manage their own self AI status and schedule
-- Keys: agent_self_ai_status_<uid>, agent_self_schedule_<uid>
-- Priority: admin config (agent_ai_status/agent_ai_schedule) > self config

CREATE POLICY "config_agent_insert_self_ai" ON public.app_config
FOR INSERT TO authenticated
WITH CHECK (
  key IN (
    'agent_self_ai_status_' || auth.uid()::text,
    'agent_self_schedule_' || auth.uid()::text
  )
  AND category = 'AI_CONTROL'
);

CREATE POLICY "config_agent_update_self_ai" ON public.app_config
FOR UPDATE TO authenticated
USING (
  key IN (
    'agent_self_ai_status_' || auth.uid()::text,
    'agent_self_schedule_' || auth.uid()::text
  )
)
WITH CHECK (
  key IN (
    'agent_self_ai_status_' || auth.uid()::text,
    'agent_self_schedule_' || auth.uid()::text
  )
  AND category = 'AI_CONTROL'
);
