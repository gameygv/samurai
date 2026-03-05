-- Ejecuta esto en el SQL Editor para poder guardar los datos originales sin encriptar y auditarlos
ALTER TABLE public.meta_capi_events 
ADD COLUMN IF NOT EXISTS unhashed_data JSONB DEFAULT '{}'::jsonb;