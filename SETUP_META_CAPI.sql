-- Crear la tabla para registrar los eventos enviados a Meta CAPI
CREATE TABLE public.meta_capi_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    whatsapp_id TEXT,
    event_name TEXT NOT NULL,
    value NUMERIC,
    currency TEXT,
    status TEXT, -- e.g., 'OK', 'ERROR', 'PENDING'
    emq_score NUMERIC,
    payload_sent JSONB,
    meta_response JSONB,
    event_id TEXT -- Para deduplicación
);

-- Habilitar Row Level Security
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso: Permitir a los usuarios autenticados leer y escribir.
CREATE POLICY "Allow all access to authenticated users"
ON public.meta_capi_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);