-- Crear la tabla para el contenido del sitio principal
CREATE TABLE IF NOT EXISTS public.main_website_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  content_length INTEGER,
  scrape_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'error'
  error_message TEXT,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Seguridad de Fila)
ALTER TABLE public.main_website_content ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.main_website_content FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserción a usuarios autenticados" 
ON public.main_website_content FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir actualización a usuarios autenticados" 
ON public.main_website_content FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Permitir eliminación a usuarios autenticados" 
ON public.main_website_content FOR DELETE 
TO authenticated 
USING (true);

-- Comentario descriptivo de la tabla
COMMENT ON TABLE public.main_website_content IS 'Almacena el contenido indexado del sitio web oficial para el entrenamiento del Samurai.';