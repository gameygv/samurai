-- Añadir columnas de soporte para el sistema de Follow-ups y Meta CAPI
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS followup_stage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS capi_lead_event_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Crear tabla de historial de follow-ups si no existe (usada por la Edge Function)
CREATE TABLE IF NOT EXISTS public.followup_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    stage INTEGER,
    message_sent TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para la nueva tabla
ALTER TABLE public.followup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to followup_history" ON public.followup_history
FOR ALL USING (true) WITH CHECK (true);

-- Asegurar que la tabla de configuración tenga los keys necesarios para Ojo de Halcón
INSERT INTO public.app_config (key, value, category, description)
VALUES 
('prompt_vision_instrucciones', '', 'PROMPT', 'Instrucciones para el módulo de visión financiera (Ojo de Halcón)'),
('meta_pixel_id', '', 'META_CAPI', 'ID del Pixel de Meta'),
('meta_access_token', '', 'META_CAPI', 'Token de acceso API Graph'),
('meta_test_mode', 'false', 'META_CAPI', 'Habilitar modo pruebas'),
('meta_test_event_code', '', 'META_CAPI', 'Código de evento de prueba')
ON CONFLICT (key) DO NOTHING;