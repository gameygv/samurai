-- 1. Crear la tabla de eventos CAPI
CREATE TABLE IF NOT EXISTS public.meta_capi_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    whatsapp_id TEXT,
    event_name TEXT NOT NULL,
    value NUMERIC DEFAULT 0,
    status TEXT,
    payload_sent JSONB DEFAULT '{}'::jsonb,
    meta_response JSONB DEFAULT '{}'::jsonb,
    unhashed_data JSONB DEFAULT '{}'::jsonb,
    event_id TEXT
);

-- 2. Habilitar la seguridad a nivel de fila (RLS) - OBLIGATORIO
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para permitir acceso a usuarios autenticados
CREATE POLICY "Allow all access to meta_capi_events" 
ON public.meta_capi_events
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);