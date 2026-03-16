-- Agregar la columna para la asignación de leads a usuarios
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;