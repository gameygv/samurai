-- Añadir columna JSONB para almacenar múltiples recordatorios con sus alertas
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]'::jsonb;