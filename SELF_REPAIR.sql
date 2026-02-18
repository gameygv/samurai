-- 1. Asegurar que la tabla de Leads existe con todos los campos de perfilado
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT,
    telefono TEXT UNIQUE,
    ciudad TEXT,
    preferencias TEXT,
    perfil_psicologico TEXT,
    summary TEXT,
    estado_emocional_actual TEXT DEFAULT 'NEUTRO',
    buying_intent TEXT DEFAULT 'BAJO',
    confidence_score INTEGER DEFAULT 10,
    ai_paused BOOLEAN DEFAULT FALSE,
    last_ai_analysis TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Asegurar que la tabla de Conversaciones existe (para el historial)
CREATE TABLE IF NOT EXISTS public.conversaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    emisor TEXT CHECK (emisor IN ('CLIENTE', 'SAMURAI', 'HUMANO')),
    platform TEXT DEFAULT 'WHATSAPP',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS (Seguridad)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Acceso (Permitir todo a usuarios autenticados para el panel)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all leads access') THEN
        CREATE POLICY "Allow all leads access" ON public.leads FOR ALL TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all conversations access') THEN
        CREATE POLICY "Allow all conversations access" ON public.conversaciones FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- 5. Añadir columnas si la tabla ya existía pero le faltaban estos campos específicos
DO $$ 
BEGIN
    -- Añadir ciudad
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='ciudad') THEN
        ALTER TABLE public.leads ADD COLUMN ciudad TEXT;
    END IF;

    -- Añadir preferencias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='preferencias') THEN
        ALTER TABLE public.leads ADD COLUMN preferencias TEXT;
    END IF;

    -- Añadir perfil_psicologico
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='perfil_psicologico') THEN
        ALTER TABLE public.leads ADD COLUMN perfil_psicologico TEXT;
    END IF;

    -- Asegurar columna de pausa de IA (Handoff)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='ai_paused') THEN
        ALTER TABLE public.leads ADD COLUMN ai_paused BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 6. Índices para velocidad de búsqueda
CREATE INDEX IF NOT EXISTS idx_leads_telefono ON public.leads(telefono);
CREATE INDEX IF NOT EXISTS idx_conversaciones_lead_id ON public.conversaciones(lead_id);