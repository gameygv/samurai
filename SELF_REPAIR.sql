-- 1. Asegurar que la tabla LEADS tenga todas las columnas necesarias
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ai_paused') THEN
        ALTER TABLE public.leads ADD COLUMN ai_paused BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'confidence_score') THEN
        ALTER TABLE public.leads ADD COLUMN confidence_score INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_ai_analysis') THEN
        ALTER TABLE public.leads ADD COLUMN last_ai_analysis TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Asegurar que MEDIA_ASSETS tenga instrucciones IA
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_assets' AND column_name = 'ai_instructions') THEN
        ALTER TABLE public.media_assets ADD COLUMN ai_instructions TEXT;
    END IF;
END $$;

-- 3. Asegurar que CONVERSACIONES tenga metadata y platform
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'metadata') THEN
        ALTER TABLE public.conversaciones ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'platform') THEN
        ALTER TABLE public.conversaciones ADD COLUMN platform TEXT DEFAULT 'API';
    END IF;
END $$;

-- 4. Verificar o crear índices para velocidad (RAG)
CREATE INDEX IF NOT EXISTS idx_knowledge_content ON public.knowledge_documents USING gin(to_tsvector('spanish', content));
CREATE INDEX IF NOT EXISTS idx_leads_last_message ON public.leads(last_message_at DESC);

-- 5. Habilitar RLS en todas las tablas críticas si no lo están
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas permisivas (para evitar bloqueos en el Dashboard si RLS está activo pero sin policies)
-- NOTA: Esto es seguro porque la app usa Service Role en las Edge Functions, pero el cliente (Dashboard) necesita leer.
CREATE POLICY "Public Read Leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Public Read Chats" ON public.conversaciones FOR SELECT USING (true);
CREATE POLICY "Public Read Knowledge" ON public.knowledge_documents FOR SELECT USING (true);
CREATE POLICY "Public Read Media" ON public.media_assets FOR SELECT USING (true);

-- 7. Insertar configuración por defecto si no existe
INSERT INTO public.app_config (key, value, category, description)
VALUES 
    ('shop_base_url', 'https://theelephantbowl.com/finalizar-compra/', 'SYSTEM', 'URL Base del Checkout'),
    ('reservation_product_id', '4521', 'SYSTEM', 'ID del Producto de Apartado')
ON CONFLICT (key) DO NOTHING;