-- =================================================================
-- ROLLBACK: Restore original permissive RLS policies
-- Story: S9.2 — RLS Policies Reales por Rol
-- =================================================================
-- WARNING: This file is NOT meant to be run automatically.
-- It is an emergency manual rollback to restore the previous state.
-- Run this only if the forward migration causes access issues.
-- =================================================================

BEGIN;

-- =================================================================
-- PHASE 1: Drop all new role-based policies
-- =================================================================

-- leads
DROP POLICY IF EXISTS "leads_admin_all" ON public.leads;
DROP POLICY IF EXISTS "leads_gerente_all" ON public.leads;
DROP POLICY IF EXISTS "leads_agent_select" ON public.leads;
DROP POLICY IF EXISTS "leads_agent_update" ON public.leads;
DROP POLICY IF EXISTS "leads_agent_insert" ON public.leads;

-- conversaciones
DROP POLICY IF EXISTS "conv_admin_gerente_all" ON public.conversaciones;
DROP POLICY IF EXISTS "conv_agent_select" ON public.conversaciones;
DROP POLICY IF EXISTS "conv_agent_insert" ON public.conversaciones;

-- contacts
DROP POLICY IF EXISTS "contacts_admin_gerente_all" ON public.contacts;
DROP POLICY IF EXISTS "contacts_agent_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_agent_update" ON public.contacts;

-- profiles
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_gerente_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_agent_select" ON public.profiles;

-- media_assets
DROP POLICY IF EXISTS "media_admin_gerente_all" ON public.media_assets;
DROP POLICY IF EXISTS "media_agent_select" ON public.media_assets;
DROP POLICY IF EXISTS "media_agent_insert" ON public.media_assets;

-- whatsapp_channels
DROP POLICY IF EXISTS "channels_admin_all" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "channels_gerente_select" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "channels_agent_select" ON public.whatsapp_channels;

-- app_config
DROP POLICY IF EXISTS "config_admin_all" ON public.app_config;
DROP POLICY IF EXISTS "config_gerente_read" ON public.app_config;
DROP POLICY IF EXISTS "config_gerente_update" ON public.app_config;
DROP POLICY IF EXISTS "config_agent_read" ON public.app_config;

-- credit_sales
DROP POLICY IF EXISTS "credit_sales_admin_gerente_all" ON public.credit_sales;
DROP POLICY IF EXISTS "credit_sales_agent_select" ON public.credit_sales;
DROP POLICY IF EXISTS "credit_sales_agent_update" ON public.credit_sales;

-- credit_installments
DROP POLICY IF EXISTS "installments_admin_gerente_all" ON public.credit_installments;
DROP POLICY IF EXISTS "installments_agent_select" ON public.credit_installments;
DROP POLICY IF EXISTS "installments_agent_update" ON public.credit_installments;

-- activity_logs
DROP POLICY IF EXISTS "logs_admin_gerente_all" ON public.activity_logs;
DROP POLICY IF EXISTS "logs_agent_insert" ON public.activity_logs;

-- errores_ia
DROP POLICY IF EXISTS "errores_admin_gerente_all" ON public.errores_ia;
DROP POLICY IF EXISTS "errores_agent_select" ON public.errores_ia;

-- frases_geoffrey
DROP POLICY IF EXISTS "frases_admin_gerente_all" ON public.frases_geoffrey;
DROP POLICY IF EXISTS "frases_agent_select" ON public.frases_geoffrey;

-- versiones_prompts_aprendidas
DROP POLICY IF EXISTS "versiones_admin_gerente_all" ON public.versiones_prompts_aprendidas;
DROP POLICY IF EXISTS "versiones_agent_select" ON public.versiones_prompts_aprendidas;

-- historial_corregiria
DROP POLICY IF EXISTS "historial_admin_gerente_all" ON public.historial_corregiria;
DROP POLICY IF EXISTS "historial_agent_select" ON public.historial_corregiria;

-- prompt_versions
DROP POLICY IF EXISTS "prompt_versions_admin_gerente_all" ON public.prompt_versions;
DROP POLICY IF EXISTS "prompt_versions_agent_select" ON public.prompt_versions;

-- followup_config
DROP POLICY IF EXISTS "followup_config_admin_gerente_all" ON public.followup_config;
DROP POLICY IF EXISTS "followup_config_agent_select" ON public.followup_config;

-- followup_history
DROP POLICY IF EXISTS "followup_history_admin_gerente_all" ON public.followup_history;
DROP POLICY IF EXISTS "followup_history_agent_select" ON public.followup_history;

-- knowledge_documents
DROP POLICY IF EXISTS "knowledge_admin_gerente_all" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_agent_select" ON public.knowledge_documents;

-- main_website_content
DROP POLICY IF EXISTS "website_admin_gerente_all" ON public.main_website_content;
DROP POLICY IF EXISTS "website_agent_select" ON public.main_website_content;

-- meta_capi_events
DROP POLICY IF EXISTS "capi_admin_gerente_all" ON public.meta_capi_events;
DROP POLICY IF EXISTS "capi_agent_select" ON public.meta_capi_events;

-- agent_evaluations
DROP POLICY IF EXISTS "evaluations_admin_gerente_all" ON public.agent_evaluations;
DROP POLICY IF EXISTS "evaluations_agent_select" ON public.agent_evaluations;
DROP POLICY IF EXISTS "evaluations_agent_insert" ON public.agent_evaluations;

-- =================================================================
-- PHASE 2: Drop helper function
-- =================================================================

DROP FUNCTION IF EXISTS auth.get_user_role();

-- =================================================================
-- PHASE 3: Recreate original permissive USING(true) policies
-- =================================================================

-- leads (from FINAL_SETUP_v8.sql)
CREATE POLICY "Enable read access for all users" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.leads FOR UPDATE USING (true);

-- conversaciones (from FINAL_SETUP_v8.sql)
CREATE POLICY "Enable all for conversaciones" ON public.conversaciones FOR ALL USING (true);

-- media_assets (from FINAL_SETUP_v8.sql)
CREATE POLICY "Enable all for media_assets" ON public.media_assets FOR ALL USING (true);

-- frases_geoffrey (from FINAL_SETUP_v8.sql)
CREATE POLICY "Enable all for frases_geoffrey" ON public.frases_geoffrey FOR ALL USING (true);

-- profiles (from SUPABASE_SETUP.sql)
CREATE POLICY "Allow all access to profiles" ON public.profiles FOR ALL USING (true);

-- activity_logs (from SUPABASE_SETUP.sql)
CREATE POLICY "Allow all access to logs" ON public.activity_logs FOR ALL USING (true);

-- errores_ia (from SUPABASE_SETUP.sql)
CREATE POLICY "Allow all access to errors" ON public.errores_ia FOR ALL USING (true);

-- versiones_prompts_aprendidas (from SUPABASE_SETUP.sql)
CREATE POLICY "Allow all access to versions" ON public.versiones_prompts_aprendidas FOR ALL USING (true);

-- historial_corregiria (from SUPABASE_SETUP.sql)
CREATE POLICY "Allow all access to history" ON public.historial_corregiria FOR ALL USING (true);

-- app_config (from SETUP_CONFIG.sql)
CREATE POLICY "config_read_policy" ON public.app_config
FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_update_policy" ON public.app_config
FOR UPDATE TO authenticated USING (true);
CREATE POLICY "config_insert_policy" ON public.app_config
FOR INSERT TO authenticated WITH CHECK (true);

-- credit_sales (from SETUP_CREDIT_SALES.sql)
CREATE POLICY "credit_sales_all_access" ON public.credit_sales
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dev', 'gerente'))
);

-- credit_installments (from SETUP_CREDIT_SALES.sql)
CREATE POLICY "credit_installments_all_access" ON public.credit_installments
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dev', 'gerente'))
);

-- prompt_versions (from CREATE_PROMPT_VERSIONS_TABLE.sql)
CREATE POLICY "Permitir a usuarios autenticados leer versiones"
ON public.prompt_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir a usuarios autenticados insertar versiones"
ON public.prompt_versions FOR INSERT TO authenticated WITH CHECK (true);

-- knowledge_documents (from CREATE_KNOWLEDGE_TABLE.sql)
CREATE POLICY "knowledge_select_policy" ON public.knowledge_documents
FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_insert_policy" ON public.knowledge_documents
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "knowledge_update_policy" ON public.knowledge_documents
FOR UPDATE TO authenticated USING (true);
CREATE POLICY "knowledge_delete_policy" ON public.knowledge_documents
FOR DELETE TO authenticated USING (true);

-- main_website_content (from SETUP_MAIN_WEBSITE.sql)
CREATE POLICY "main_website_read_policy" ON public.main_website_content
FOR SELECT TO authenticated USING (true);
CREATE POLICY "main_website_write_policy" ON public.main_website_content
FOR ALL TO authenticated USING (true);

-- followup_config (from CREATE_FOLLOWUP_CONFIG_TABLE.sql)
CREATE POLICY "followup_config_select_policy" ON public.followup_config
FOR SELECT TO authenticated USING (true);
CREATE POLICY "followup_config_update_policy" ON public.followup_config
FOR UPDATE TO authenticated USING (true);
CREATE POLICY "followup_config_insert_policy" ON public.followup_config
FOR INSERT TO authenticated WITH CHECK (true);

-- followup_history (from FIX_MISSING_COLUMNS.sql)
CREATE POLICY "Allow all access to followup_history" ON public.followup_history
FOR ALL USING (true);

-- meta_capi_events (from CREATE_CAPI_TABLE.sql)
CREATE POLICY "Allow all access to meta_capi_events"
ON public.meta_capi_events FOR ALL USING (true);

-- agent_evaluations (from SETUP_TEAM_ANALYTICS.sql)
CREATE POLICY "Admins can read all evaluations" ON public.agent_evaluations
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'dev')
  )
);
CREATE POLICY "Users can insert their own evaluations" ON public.agent_evaluations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id);

-- =================================================================
-- PHASE 4: Re-grant anon access (restores FIX_PERMISSIONS.sql)
-- =================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- =================================================================
-- PHASE 5: Drop performance index (optional, harmless to keep)
-- =================================================================

DROP INDEX IF EXISTS idx_leads_assigned_to;

-- =================================================================
-- PHASE 6: Notify PostgREST to reload
-- =================================================================

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

COMMIT;
