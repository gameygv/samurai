-- Crear la tabla para almacenar las versiones de los prompts
CREATE TABLE public.prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version_name TEXT NOT NULL,
  prompts_snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT, -- Denormalizado para fácil visualización
  notes TEXT
);

-- Habilitar Row Level Security
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Permitir a usuarios autenticados leer versiones"
  ON public.prompt_versions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Permitir a usuarios autenticados insertar versiones"
  ON public.prompt_versions FOR INSERT
  TO authenticated WITH CHECK (true);