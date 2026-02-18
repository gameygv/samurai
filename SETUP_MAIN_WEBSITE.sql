-- Tabla para almacenar el contenido del sitio principal
CREATE TABLE IF NOT EXISTS public.main_website_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT,
  last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scrape_status TEXT DEFAULT 'pending', -- pending, success, error
  error_message TEXT,
  content_length INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.main_website_content ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read
CREATE POLICY "main_website_read_policy" ON public.main_website_content
FOR SELECT TO authenticated USING (true);

-- Policy: Only system can write (service role)
CREATE POLICY "main_website_write_policy" ON public.main_website_content
FOR ALL USING (true);

-- Insertar las URLs principales que deben ser scrapeadas
INSERT INTO public.main_website_content (url, scrape_status) VALUES
('https://theelephantbowl.com/', 'pending'),
('https://theelephantbowl.com/cursos/', 'pending'),
('https://theelephantbowl.com/curso-nivel-1/', 'pending'),
('https://theelephantbowl.com/curso-nivel-2/', 'pending'),
('https://theelephantbowl.com/curso-nivel-3/', 'pending'),
('https://theelephantbowl.com/curso-online-conviertete-en-cuencoterapeuta/', 'pending'),
('https://theelephantbowl.com/curso-online-la-psicoacustica/', 'pending'),
('https://theelephantbowl.com/curso-online-facilitadores-de-cuencos/', 'pending'),
('https://theelephantbowl.com/comunidad/', 'pending'),
('https://theelephantbowl.com/historia/', 'pending'),
('https://theelephantbowl.com/expertos/', 'pending'),
('https://theelephantbowl.com/biblioteca/', 'pending'),
('https://theelephantbowl.com/ubicaciones/', 'pending'),
('https://theelephantbowl.com/contacto/', 'pending')
ON CONFLICT (url) DO NOTHING;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_main_website_url ON public.main_website_content(url);
CREATE INDEX IF NOT EXISTS idx_main_website_status ON public.main_website_content(scrape_status);