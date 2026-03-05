-- Ejecuta este código en el SQL Editor de tu Supabase
-- para habilitar las banderas de los pagos en la tabla de leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'NONE';