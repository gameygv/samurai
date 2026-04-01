-- Expand media_assets with academy/event fields for Media Manager v2
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS presale_price NUMERIC;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS presale_ends_at DATE;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS normal_price NUMERIC;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS nivel TEXT;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS profesor TEXT;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS sede TEXT;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS friday_concert BOOLEAN DEFAULT FALSE;

-- Expand category CHECK to new values (drop old index, recreate)
-- Old values: POSTER, PAYMENT
-- New values: POSTER_PROMO, CARTEL_GENERAL, PROMO_ESPECIAL, AVISO, PAYMENT
-- No constraint existed before (was just convention), so just update existing data
UPDATE public.media_assets SET category = 'POSTER_PROMO' WHERE category = 'POSTER';
