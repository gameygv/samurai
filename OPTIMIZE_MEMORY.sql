-- Asegurar índices para búsqueda rápida de historial
CREATE INDEX IF NOT EXISTS idx_conversaciones_lead_id ON public.conversaciones(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_created_at ON public.conversaciones(created_at DESC);

-- Asegurar que la tabla leads tenga campos de inteligencia
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS buying_intent TEXT DEFAULT 'MEDIO';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS summary TEXT;

-- Comentario: Índices creados para optimizar get-samurai-context con limit 30.