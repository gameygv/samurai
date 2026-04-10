-- ============================================================
-- 1. Campo género en contacts
-- ============================================================
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS genero TEXT;

-- ============================================================
-- 2. Campos nuevos en media_assets para el rediseño
-- ============================================================
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS start_date DATE;

-- ============================================================
-- 3. Limpiar registros PAYMENT de media_assets
--    (los comprobantes ahora van en receipt_audits)
-- ============================================================
-- Solo eliminar si existen registros con esa categoría
DELETE FROM public.media_assets WHERE category = 'PAYMENT';

-- ============================================================
-- 4. Migrar datos POSTER_PROMO a tabla courses
--    (copiar los que existan, luego eliminar de media_assets)
-- ============================================================
INSERT INTO public.courses (
  title, description, poster_url, ocr_content,
  presale_price, presale_ends_at, normal_price,
  nivel, sede, profesor, ai_instructions,
  ai_enabled, valid_until, created_at
)
SELECT
  title, COALESCE(description, ''), url, COALESCE(ocr_content, ''),
  COALESCE(presale_price, 0), presale_ends_at, COALESCE(normal_price, 0),
  COALESCE(nivel, ''), COALESCE(sede, ''), COALESCE(profesor, ''), COALESCE(ai_instructions, ''),
  true, valid_until, created_at
FROM public.media_assets
WHERE category = 'POSTER_PROMO';

DELETE FROM public.media_assets WHERE category = 'POSTER_PROMO';
