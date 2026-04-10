-- ============================================================
-- TABLA: courses (Cursos y Talleres — módulo Academia)
-- Reemplaza la categoría POSTER_PROMO de media_assets
-- ============================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  poster_url TEXT NOT NULL,
  ocr_content TEXT DEFAULT '',

  -- Precios y fechas comerciales
  presale_price NUMERIC DEFAULT 0,
  presale_ends_at DATE,
  normal_price NUMERIC DEFAULT 0,
  sale_closes_at DATE,           -- después de esta fecha la IA ya no ofrece el curso

  -- Clasificación
  nivel TEXT DEFAULT '',
  sede TEXT DEFAULT '',
  profesor TEXT DEFAULT '',

  -- IA
  ai_instructions TEXT DEFAULT '',
  ai_enabled BOOLEAN DEFAULT true,

  -- Extras (conciertos, eventos adicionales, etc.)
  extras TEXT DEFAULT '',

  -- Fechas de impartición: [{date, start_time, end_time}, ...]
  session_dates JSONB DEFAULT '[]'::jsonb,

  -- Metadatos
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until DATE               -- fecha límite global de visibilidad
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_courses_ai_enabled ON public.courses(ai_enabled) WHERE ai_enabled = true;
CREATE INDEX IF NOT EXISTS idx_courses_valid_until ON public.courses(valid_until);
CREATE INDEX IF NOT EXISTS idx_courses_sale_closes ON public.courses(sale_closes_at);

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_read_all" ON public.courses FOR SELECT USING (true);
CREATE POLICY "courses_insert_auth" ON public.courses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "courses_update_auth" ON public.courses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "courses_delete_auth" ON public.courses FOR DELETE USING (auth.role() = 'authenticated');
