-- ═══════════════════════════════════════════════════════════
-- PARTE 1: ESTADOS EMOCIONALES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.estados_emocionales (
  estado_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT,
  confidence_min FLOAT DEFAULT 80,
  palabras_clave TEXT[], -- Array de palabras
  accion_default VARCHAR(100),
  presion_level VARCHAR(20), -- SUAVE, MEDIA, FUERTE
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  activo BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.estados_emocionales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estados_read" ON public.estados_emocionales FOR SELECT TO authenticated USING (true);
CREATE POLICY "estados_write" ON public.estados_emocionales FOR ALL TO authenticated USING (true);

-- Datos iniciales v6.0
INSERT INTO public.estados_emocionales (nombre, descripcion, confidence_min, palabras_clave, accion_default, presion_level) VALUES
  ('CURIOSO', 'Cliente interesado en aprender más', 80, ARRAY['cuéntame', 'cómo', 'función'], 'AMPLIAR_INFO', 'SUAVE'),
  ('PRAGMÁTICO', 'Cliente enfocado en precio y datos', 85, ARRAY['cuánto', 'costo', 'precio', 'cuotas'], 'MOSTRAR_NÚMEROS', 'MEDIA'),
  ('EMOCIONAL', 'Cliente conecta con transformación', 85, ARRAY['cambiar', 'quiero', 'necesito', 'transformación'], 'TESTIMONIOS', 'MEDIA'),
  ('FRUSTRADO', 'Cliente con objeciones pero interesado', 85, ARRAY['caro', 'no puedo', 'muy', 'expensive'], 'OFRECER_CUOTAS', 'MEDIA'),
  ('ENOJADO', 'Cliente perdió confianza', 90, ARRAY['timo', 'engaño', 'no responden', 'fraude'], 'ESCALAR', 'FUERTE')
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- PARTE 2: LEADS & CONVERSACIONES (NUEVO)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leads (
  lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kommo_id VARCHAR(100) UNIQUE,
  nombre VARCHAR(100),
  telefono VARCHAR(20),
  email VARCHAR(100),
  ciudad VARCHAR(50),
  estado_emocional_actual VARCHAR(50),
  confidence_score FLOAT,
  dias_en_funnel INT DEFAULT 0,
  siesta_active BOOLEAN DEFAULT FALSE,
  siesta_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_read" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads_write" ON public.leads FOR ALL TO authenticated USING (true);

-- Tabla de Conversaciones (Log detallado)
CREATE TABLE IF NOT EXISTS public.conversaciones (
  conversacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(lead_id) ON DELETE CASCADE,
  mensaje_cliente TEXT,
  respuesta_ia TEXT,
  estado_detectado VARCHAR(50),
  confidence_score FLOAT,
  prompt_version VARCHAR(10),
  acciones_ejecutadas TEXT[], -- Array simple
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversaciones_read" ON public.conversaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversaciones_write" ON public.conversaciones FOR ALL TO authenticated USING (true);

-- Leads de ejemplo
INSERT INTO public.leads (kommo_id, nombre, telefono, email, ciudad, estado_emocional_actual, confidence_score, dias_en_funnel) VALUES
  ('lead_001', 'Juan García', '+52555551234', 'juan@example.com', 'CDMX', 'PRAGMÁTICO', 87.5, 3),
  ('lead_002', 'María López', '+52555555678', 'maria@example.com', 'Querétaro', 'EMOCIONAL', 85.2, 2),
  ('lead_003', 'Carlos Ruiz', '+52555559999', 'carlos@example.com', 'Monterrey', 'FRUSTRADO', 88.1, 5)
ON CONFLICT (kommo_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- PARTE 3: CONFIGURACIÓN ACTUALIZADA
-- ═══════════════════════════════════════════════════════════

-- Asegurar que app_config tenga las keys necesarias para v6.0
INSERT INTO public.app_config (key, value, category, description) VALUES
('api_key_gemini', '', 'SECRET', 'API Key de Google Gemini 1.5 Pro'),
('api_key_kommo', '', 'SECRET', 'API Key de Kommo CRM'),
('kommo_account_id', '', 'SECRET', 'ID de Cuenta Kommo'),
('webhook_kommo_incoming', '', 'WEBHOOK', 'Webhook generado en Make para recibir mensajes de Kommo'),
('webhook_make_outgoing', '', 'WEBHOOK', 'Webhook en Make para enviar mensajes'),
('panel_admin_email', 'gamey@dyad.local', 'SYSTEM', 'Email del administrador principal')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- VISTAS PARA DASHBOARD
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.resumen_leads_estado AS
SELECT 
  estado_emocional_actual,
  COUNT(*) as total,
  AVG(confidence_score)::NUMERIC(10,2) as confidence_promedio
FROM public.leads
WHERE estado_emocional_actual IS NOT NULL
GROUP BY estado_emocional_actual;