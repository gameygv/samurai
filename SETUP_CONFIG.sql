-- Tabla única para toda la configuración del sistema
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY, -- Ej: 'prompt_core', 'webhook_make_errors', 'openai_api_key'
    value TEXT, -- El contenido del prompt o la URL
    category TEXT NOT NULL, -- 'PROMPT', 'WEBHOOK', 'SECRET', 'SYSTEM'
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer prompts y webhooks (el backend los necesita)
CREATE POLICY "config_read_policy" ON public.app_config
FOR SELECT TO authenticated USING (true);

-- Solo usuarios autenticados pueden actualizar
CREATE POLICY "config_update_policy" ON public.app_config
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "config_insert_policy" ON public.app_config
FOR INSERT TO authenticated WITH CHECK (true);

-- Insertar valores por defecto para Webhooks
INSERT INTO public.app_config (key, value, category, description) VALUES
('webhook_make_corregiria', '', 'WEBHOOK', 'URL del Webhook de Make para recibir reportes #CORREGIRIA'),
('webhook_make_validation', '', 'WEBHOOK', 'URL del Webhook de Make para validar comprobantes'),
('webhook_make_test', '', 'WEBHOOK', 'URL del Webhook para correr tests de prompts'),
('api_key_openai', '', 'SECRET', 'API Key de OpenAI (si aplica)'),
('api_key_gemini', '', 'SECRET', 'API Key de Google Gemini')
ON CONFLICT (key) DO NOTHING;

-- Insertar Prompts por defecto (Para que AgentBrain no empiece vacío si se conecta a DB)
-- Nota: AgentBrain usará sus defaults si esto está vacío, pero es bueno tener registro.