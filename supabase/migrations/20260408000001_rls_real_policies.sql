-- =================================================================
-- Migration: Real Role-Based RLS Policies
-- Story: S9.2 — RLS Policies Reales por Rol
-- =================================================================
-- Replaces all permissive USING(true) policies with role-based access.
-- Requires auth.get_user_role() from 20260408000000.
-- Wrapped in a single transaction for atomic apply.

BEGIN;

-- =================================================================
-- PHASE 1: Drop ALL existing permissive policies
-- =================================================================

-- leads
DROP POLICY IF EXISTS "Enable read access for all users" ON public.leads;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Allow all access to leads" ON public.leads;
DROP POLICY IF EXISTS "Allow all leads access" ON public.leads;
DROP POLICY IF EXISTS "leads_read" ON public.leads;
DROP POLICY IF EXISTS "leads_write" ON public.leads;

-- conversaciones
DROP POLICY IF EXISTS "Enable all for conversaciones" ON public.conversaciones;
DROP POLICY IF EXISTS "Allow all access to conversaciones" ON public.conversaciones;
DROP POLICY IF EXISTS "Allow all conversations access" ON public.conversaciones;
DROP POLICY IF EXISTS "conversaciones_read" ON public.conversaciones;
DROP POLICY IF EXISTS "conversaciones_write" ON public.conversaciones;

-- contacts (may not have existing policies)
DROP POLICY IF EXISTS "Allow all access to contacts" ON public.contacts;

-- media_assets
DROP POLICY IF EXISTS "Enable all for media_assets" ON public.media_assets;
DROP POLICY IF EXISTS "Media Assets All Access" ON public.media_assets;

-- frases_geoffrey
DROP POLICY IF EXISTS "Enable all for frases_geoffrey" ON public.frases_geoffrey;

-- profiles
DROP POLICY IF EXISTS "Allow all access to profiles" ON public.profiles;

-- activity_logs
DROP POLICY IF EXISTS "Allow all access to logs" ON public.activity_logs;

-- errores_ia
DROP POLICY IF EXISTS "Allow all access to errors" ON public.errores_ia;

-- versiones_prompts_aprendidas
DROP POLICY IF EXISTS "Allow all access to versions" ON public.versiones_prompts_aprendidas;

-- historial_corregiria
DROP POLICY IF EXISTS "Allow all access to history" ON public.historial_corregiria;

-- app_config
DROP POLICY IF EXISTS "config_read_policy" ON public.app_config;
DROP POLICY IF EXISTS "config_update_policy" ON public.app_config;
DROP POLICY IF EXISTS "config_insert_policy" ON public.app_config;

-- credit_sales
DROP POLICY IF EXISTS "credit_sales_all_access" ON public.credit_sales;

-- credit_installments
DROP POLICY IF EXISTS "credit_installments_all_access" ON public.credit_installments;

-- prompt_versions
DROP POLICY IF EXISTS "Permitir a usuarios autenticados leer versiones" ON public.prompt_versions;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados insertar versiones" ON public.prompt_versions;

-- knowledge_documents
DROP POLICY IF EXISTS "knowledge_select_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_insert_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_update_policy" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_delete_policy" ON public.knowledge_documents;

-- main_website_content
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.main_website_content;
DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados" ON public.main_website_content;
DROP POLICY IF EXISTS "Permitir actualización a usuarios autenticados" ON public.main_website_content;
DROP POLICY IF EXISTS "Permitir eliminación a usuarios autenticados" ON public.main_website_content;
DROP POLICY IF EXISTS "main_website_read_policy" ON public.main_website_content;
DROP POLICY IF EXISTS "main_website_write_policy" ON public.main_website_content;

-- followup_config
DROP POLICY IF EXISTS "followup_config_select_policy" ON public.followup_config;
DROP POLICY IF EXISTS "followup_config_update_policy" ON public.followup_config;
DROP POLICY IF EXISTS "followup_config_insert_policy" ON public.followup_config;
DROP POLICY IF EXISTS "followup_config_read" ON public.followup_config;
DROP POLICY IF EXISTS "followup_config_update" ON public.followup_config;

-- followup_history
DROP POLICY IF EXISTS "Allow all access to followup_history" ON public.followup_history;
DROP POLICY IF EXISTS "followup_history_all" ON public.followup_history;

-- meta_capi_events
DROP POLICY IF EXISTS "Allow all access to meta_capi_events" ON public.meta_capi_events;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.meta_capi_events;

-- agent_evaluations
DROP POLICY IF EXISTS "Admins can read all evaluations" ON public.agent_evaluations;
DROP POLICY IF EXISTS "Users can insert their own evaluations" ON public.agent_evaluations;

-- whatsapp_channels (may not have existing policies)
DROP POLICY IF EXISTS "Allow all access to whatsapp_channels" ON public.whatsapp_channels;

-- =================================================================
-- PHASE 2: Ensure RLS is ENABLED on all tables
-- =================================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.errores_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frases_geoffrey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versiones_prompts_aprendidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_corregiria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.main_website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_evaluations ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- PHASE 3: Create new role-based policies
-- =================================================================

-- -----------------------------------------------------------------
-- LEADS
-- -----------------------------------------------------------------

-- Admin/dev: full access
CREATE POLICY "leads_admin_all" ON public.leads
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev'));

-- Gerente: full access
CREATE POLICY "leads_gerente_all" ON public.leads
FOR ALL TO authenticated
USING (auth.get_user_role() = 'gerente')
WITH CHECK (auth.get_user_role() = 'gerente');

-- Agent: only assigned leads (SELECT)
CREATE POLICY "leads_agent_select" ON public.leads
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND assigned_to = auth.uid()
);

-- Agent: only assigned leads (UPDATE)
CREATE POLICY "leads_agent_update" ON public.leads
FOR UPDATE TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND assigned_to = auth.uid()
)
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND assigned_to = auth.uid()
);

-- Agent: insert own leads
CREATE POLICY "leads_agent_insert" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND assigned_to = auth.uid()
);

-- -----------------------------------------------------------------
-- CONVERSACIONES
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "conv_admin_gerente_all" ON public.conversaciones
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: only conversations for their leads (SELECT)
CREATE POLICY "conv_agent_select" ON public.conversaciones
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- Agent: insert conversations for their leads
CREATE POLICY "conv_agent_insert" ON public.conversaciones
FOR INSERT TO authenticated
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- -----------------------------------------------------------------
-- CONTACTS
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "contacts_admin_gerente_all" ON public.contacts
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: only contacts for their leads (SELECT)
CREATE POLICY "contacts_agent_select" ON public.contacts
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- Agent: update contacts for their leads
CREATE POLICY "contacts_agent_update" ON public.contacts
FOR UPDATE TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
)
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
);

-- -----------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------

-- Admin/dev: full access
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev'));

-- Gerente: read all profiles
CREATE POLICY "profiles_gerente_select" ON public.profiles
FOR SELECT TO authenticated
USING (auth.get_user_role() = 'gerente');

-- Agent: read own profile only
CREATE POLICY "profiles_agent_select" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND id = auth.uid()
);

-- -----------------------------------------------------------------
-- MEDIA_ASSETS (reference data: all authenticated read, admin/gerente write)
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "media_admin_gerente_all" ON public.media_assets
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: SELECT all + INSERT
CREATE POLICY "media_agent_select" ON public.media_assets
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

CREATE POLICY "media_agent_insert" ON public.media_assets
FOR INSERT TO authenticated
WITH CHECK (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- WHATSAPP_CHANNELS
-- -----------------------------------------------------------------

-- Admin/dev: full access
CREATE POLICY "channels_admin_all" ON public.whatsapp_channels
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev'));

-- Gerente: read all
CREATE POLICY "channels_gerente_select" ON public.whatsapp_channels
FOR SELECT TO authenticated
USING (auth.get_user_role() = 'gerente');

-- Agent: read all (secret columns deferred to S9.3)
CREATE POLICY "channels_agent_select" ON public.whatsapp_channels
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- APP_CONFIG
-- -----------------------------------------------------------------

-- Admin/dev: full access (including secrets)
CREATE POLICY "config_admin_all" ON public.app_config
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev'));

-- Gerente: read non-secret config
CREATE POLICY "config_gerente_read" ON public.app_config
FOR SELECT TO authenticated
USING (
  auth.get_user_role() = 'gerente'
  AND category IS DISTINCT FROM 'SECRET'
);

-- Gerente: update non-secret config
CREATE POLICY "config_gerente_update" ON public.app_config
FOR UPDATE TO authenticated
USING (
  auth.get_user_role() = 'gerente'
  AND category IS DISTINCT FROM 'SECRET'
)
WITH CHECK (
  auth.get_user_role() = 'gerente'
  AND category IS DISTINCT FROM 'SECRET'
);

-- Agent: read-only non-secret config
CREATE POLICY "config_agent_read" ON public.app_config
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND category IS DISTINCT FROM 'SECRET'
);

-- -----------------------------------------------------------------
-- CREDIT_SALES
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "credit_sales_admin_gerente_all" ON public.credit_sales
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: select/update via contact ownership chain
CREATE POLICY "credit_sales_agent_select" ON public.credit_sales
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND contact_id IN (
    SELECT c.id FROM public.contacts c
    JOIN public.leads l ON c.lead_id = l.id
    WHERE l.assigned_to = auth.uid()
  )
);

CREATE POLICY "credit_sales_agent_update" ON public.credit_sales
FOR UPDATE TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND contact_id IN (
    SELECT c.id FROM public.contacts c
    JOIN public.leads l ON c.lead_id = l.id
    WHERE l.assigned_to = auth.uid()
  )
)
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND contact_id IN (
    SELECT c.id FROM public.contacts c
    JOIN public.leads l ON c.lead_id = l.id
    WHERE l.assigned_to = auth.uid()
  )
);

-- -----------------------------------------------------------------
-- CREDIT_INSTALLMENTS
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "installments_admin_gerente_all" ON public.credit_installments
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: select/update via 4-hop chain
CREATE POLICY "installments_agent_select" ON public.credit_installments
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND sale_id IN (
    SELECT cs.id FROM public.credit_sales cs
    JOIN public.contacts c ON cs.contact_id = c.id
    JOIN public.leads l ON c.lead_id = l.id
    WHERE l.assigned_to = auth.uid()
  )
);

CREATE POLICY "installments_agent_update" ON public.credit_installments
FOR UPDATE TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND sale_id IN (
    SELECT cs.id FROM public.credit_sales cs
    JOIN public.contacts c ON cs.contact_id = c.id
    JOIN public.leads l ON c.lead_id = l.id
    WHERE l.assigned_to = auth.uid()
  )
)
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND sale_id IN (
    SELECT cs.id FROM public.credit_sales cs
    JOIN public.contacts c ON cs.contact_id = c.id
    JOIN public.leads l ON c.lead_id = l.id
    WHERE l.assigned_to = auth.uid()
  )
);

-- -----------------------------------------------------------------
-- ACTIVITY_LOGS
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "logs_admin_gerente_all" ON public.activity_logs
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: insert only (for logging actions)
CREATE POLICY "logs_agent_insert" ON public.activity_logs
FOR INSERT TO authenticated
WITH CHECK (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- ERRORES_IA (reference data: all authenticated read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "errores_admin_gerente_all" ON public.errores_ia
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "errores_agent_select" ON public.errores_ia
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- FRASES_GEOFFREY (reference data: all authenticated read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "frases_admin_gerente_all" ON public.frases_geoffrey
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "frases_agent_select" ON public.frases_geoffrey
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- VERSIONES_PROMPTS_APRENDIDAS (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "versiones_admin_gerente_all" ON public.versiones_prompts_aprendidas
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "versiones_agent_select" ON public.versiones_prompts_aprendidas
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- HISTORIAL_CORREGIRIA (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "historial_admin_gerente_all" ON public.historial_corregiria
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "historial_agent_select" ON public.historial_corregiria
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- PROMPT_VERSIONS (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "prompt_versions_admin_gerente_all" ON public.prompt_versions
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "prompt_versions_agent_select" ON public.prompt_versions
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- FOLLOWUP_CONFIG
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "followup_config_admin_gerente_all" ON public.followup_config
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: read only
CREATE POLICY "followup_config_agent_select" ON public.followup_config
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- FOLLOWUP_HISTORY (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "followup_history_admin_gerente_all" ON public.followup_history
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "followup_history_agent_select" ON public.followup_history
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- KNOWLEDGE_DOCUMENTS (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "knowledge_admin_gerente_all" ON public.knowledge_documents
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "knowledge_agent_select" ON public.knowledge_documents
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- MAIN_WEBSITE_CONTENT (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "website_admin_gerente_all" ON public.main_website_content
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "website_agent_select" ON public.main_website_content
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- META_CAPI_EVENTS (reference: all read, admin/gerente write)
-- -----------------------------------------------------------------

CREATE POLICY "capi_admin_gerente_all" ON public.meta_capi_events
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

CREATE POLICY "capi_agent_select" ON public.meta_capi_events
FOR SELECT TO authenticated
USING (auth.get_user_role() IN ('agent', 'sales_agent', 'sales'));

-- -----------------------------------------------------------------
-- AGENT_EVALUATIONS
-- -----------------------------------------------------------------

-- Admin/dev + gerente: full access
CREATE POLICY "evaluations_admin_gerente_all" ON public.agent_evaluations
FOR ALL TO authenticated
USING (auth.get_user_role() IN ('admin', 'dev', 'gerente'))
WITH CHECK (auth.get_user_role() IN ('admin', 'dev', 'gerente'));

-- Agent: read own evaluations only
CREATE POLICY "evaluations_agent_select" ON public.agent_evaluations
FOR SELECT TO authenticated
USING (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND agent_id = auth.uid()
);

-- Agent: insert own evaluations
CREATE POLICY "evaluations_agent_insert" ON public.agent_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  auth.get_user_role() IN ('agent', 'sales_agent', 'sales')
  AND agent_id = auth.uid()
);

-- =================================================================
-- PHASE 4: Revoke anon access, grant authenticated base access
-- =================================================================

-- Remove all anon access to public tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Grant base DML to authenticated (RLS policies control actual access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- =================================================================
-- PHASE 5: Performance index
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

-- =================================================================
-- PHASE 6: Notify PostgREST to reload
-- =================================================================

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

COMMIT;
