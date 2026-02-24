-- Añadir una columna para rastrear si el evento 'Lead' de CAPI ya fue enviado
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS capi_lead_event_sent_at TIMESTAMP WITH TIME ZONE;