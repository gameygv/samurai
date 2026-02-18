-- Añadir columna para el ID de Kommo si no existe
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS kommo_id TEXT UNIQUE;

-- Crear un índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_leads_kommo_id ON public.leads(kommo_id);