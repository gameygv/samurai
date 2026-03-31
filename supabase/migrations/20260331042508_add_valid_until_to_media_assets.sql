-- S4.2: Add valid_until to media_assets to filter expired posters
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Set valid_until for existing posters based on their event dates
UPDATE public.media_assets SET valid_until = '2026-03-08' WHERE title ILIKE '%Hermosillo 7 y 8 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-03-08' WHERE title ILIKE '%Monterrey 7 y 8 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-03-15' WHERE title ILIKE '%Torreón 14 y 15 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-03-16' WHERE title ILIKE '%Toluca 15 y 16 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-03-22' WHERE title ILIKE '%Querétaro 21 y 22 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-03-22' WHERE title ILIKE '%CDMX Coyoacán 21 y 22 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-03-29' WHERE title ILIKE '%Guadalajara 28 y 29 de marzo%';
UPDATE public.media_assets SET valid_until = '2026-04-12' WHERE title ILIKE '%Zacatecas 11 y 12 de abril%';
UPDATE public.media_assets SET valid_until = '2026-04-19' WHERE title ILIKE '%San Luís Potosí 18 y 19 de abril%';
UPDATE public.media_assets SET valid_until = '2026-04-19' WHERE title ILIKE '%Baja California Sur 18 y 19 de abril%';
UPDATE public.media_assets SET valid_until = '2026-04-26' WHERE title ILIKE '%Oaxaca 25 y 26 de abril%';
UPDATE public.media_assets SET valid_until = '2026-05-17' WHERE title ILIKE '%Monterrey 16 y 17 de mayo%';
UPDATE public.media_assets SET valid_until = '2026-04-30' WHERE title ILIKE '%general talleres marzo y abril%';
