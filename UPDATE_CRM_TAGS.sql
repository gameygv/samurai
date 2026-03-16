-- Agregar la columna para las etiquetas personalizadas de los leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];