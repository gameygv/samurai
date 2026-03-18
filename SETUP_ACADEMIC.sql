-- 1. Añadir columna para la Ficha Curricular
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS academic_record JSONB DEFAULT '[]'::jsonb;

-- 2. Añadir columna para las Notas del Perfil
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS internal_notes JSONB DEFAULT '[]'::jsonb;