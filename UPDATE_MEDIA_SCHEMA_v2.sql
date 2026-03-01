-- 1. Añadir columna de categoría
ALTER TABLE public.media_assets 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'POSTER';

-- 2. Actualizar registros existentes basados en lógica previa
UPDATE public.media_assets 
SET category = 'PAYMENT' 
WHERE ai_instructions ILIKE '%OCR DATA%' OR ai_instructions ILIKE '%PAGO%';

-- 3. Índice para búsquedas rápidas en el Ojo de Halcón
CREATE INDEX IF NOT EXISTS idx_media_category ON public.media_assets(category);