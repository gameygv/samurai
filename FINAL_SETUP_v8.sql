-- 🏯 SAMURAI v8.0 FINAL DATABASE SETUP
-- Execute this in Supabase SQL Editor

-- 1. LEADS TABLE (CRM Mirror)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kommo_id TEXT UNIQUE,
  nombre TEXT,
  telefono TEXT,
  email TEXT,
  ciudad TEXT,
  estado_emocional_actual TEXT DEFAULT 'NEUTRO',
  confidence_score NUMERIC DEFAULT 0,
  funnel_stage TEXT DEFAULT 'INITIAL',
  dias_en_funnel INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CONVERSACIONES (Chat History)
CREATE TABLE IF NOT EXISTS public.conversaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  mensaje TEXT,
  emisor TEXT, -- 'CLIENTE', 'SAMURAI', 'HUMANO'
  platform TEXT DEFAULT 'WHATSAPP',
  intent_detected TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MEDIA ASSETS (Media Manager)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  url TEXT NOT NULL,
  type TEXT, -- 'IMAGE', 'VIDEO', 'PDF'
  tags TEXT[],
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. FRASES GEOFFREY (Personality Injection)
CREATE TABLE IF NOT EXISTS public.frases_geoffrey (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  frase TEXT NOT NULL,
  categoria TEXT, -- 'SALUDO', 'DESPEDIDA', 'ESPERA', 'ERROR'
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ENABLE RLS (Security)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frases_geoffrey ENABLE ROW LEVEL SECURITY;

-- 6. CREATE POLICIES (Permissive for Dashboard/Make access)
CREATE POLICY "Enable read access for all users" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.leads FOR UPDATE USING (true);

CREATE POLICY "Enable all for conversaciones" ON public.conversaciones FOR ALL USING (true);
CREATE POLICY "Enable all for media_assets" ON public.media_assets FOR ALL USING (true);
CREATE POLICY "Enable all for frases_geoffrey" ON public.frases_geoffrey FOR ALL USING (true);

-- 7. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access Media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Auth Upload Media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Auth Delete Media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');

-- 8. SEED DATA (Frases Geoffrey)
INSERT INTO public.frases_geoffrey (frase, categoria) VALUES 
('Permítame consultar con el maestro de llaves...', 'ESPERA'),
('Excelente elección, denota un gusto refinado.', 'SALUDO'),
('Mis disculpas, parece que hubo un cruce en los cables del telégrafo.', 'ERROR'),
('Quedo a su entera disposición para cualquier otra consulta.', 'DESPEDIDA');

-- 9. SEED CONFIG (API Keys Placeholders)
INSERT INTO public.app_config (key, value, category, description) VALUES
('gemini_api_key', '', 'SECRET', 'API Key de Google Gemini AI'),
('kommo_api_key', '', 'SECRET', 'API Key de Kommo CRM'),
('kommo_subdomain', '', 'SYSTEM', 'Subdominio de Kommo (ej: empresa.kommo.com)'),
('make_webhook_incoming', '', 'WEBHOOK', 'Webhook Make: Incoming Messages')
ON CONFLICT (key) DO NOTHING;