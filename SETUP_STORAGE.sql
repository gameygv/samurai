-- 1. Crear Bucket 'media' para el Media Manager
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de seguridad para 'media' (Borramos previas para evitar conflictos)
DROP POLICY IF EXISTS "Media Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Media Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Media Auth Delete" ON storage.objects;

CREATE POLICY "Media Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Media Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Media Auth Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');

-- 2. Crear Bucket 'knowledge-files' para la Base de Conocimiento
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-files', 'knowledge-files', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de seguridad para 'knowledge-files'
DROP POLICY IF EXISTS "Knowledge Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Knowledge Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Knowledge Auth Delete" ON storage.objects;

CREATE POLICY "Knowledge Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'knowledge-files');
CREATE POLICY "Knowledge Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge-files');
CREATE POLICY "Knowledge Auth Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'knowledge-files');

-- 3. Asegurar tabla media_assets
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title TEXT,
    url TEXT,
    type TEXT,
    tags TEXT[]
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media Assets All Access" ON public.media_assets;
CREATE POLICY "Media Assets All Access" ON public.media_assets FOR ALL USING (true) WITH CHECK (true);