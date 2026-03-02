-- Añadir columna de email para captura de datos CAPI
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Comentario
COMMENT ON COLUMN public.leads.email IS 'Correo electrónico extraído automáticamente por la IA para Meta CAPI.';