-- Asegurar que la tabla leads tenga los campos de inteligencia
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nombre TEXT,
    telefono TEXT,
    email TEXT,
    ciudad TEXT,
    origen TEXT,
    -- Campos de Inteligencia Samurai
    estado_emocional_actual TEXT DEFAULT 'NEUTRO', -- ENOJADO, FELIZ, PRAGMATICO, INDECISO
    confidence_score INTEGER DEFAULT 0, -- 0 a 100 probabilidad de venta
    funnel_stage TEXT DEFAULT 'INICIAL', -- INICIAL, INTERES, COTIZACION, CIERRE, GANADO, PERDIDO
    summary TEXT, -- Resumen narrativo de la situación
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    buying_intent TEXT DEFAULT 'BAJO', -- BAJO, MEDIO, ALTO
    ai_paused BOOLEAN DEFAULT FALSE -- Para intervención humana
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- Tabla de conversaciones para el historial
CREATE TABLE IF NOT EXISTS public.conversaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    emisor TEXT, -- 'CLIENTE', 'SAMURAI', 'HUMANO'
    mensaje TEXT,
    platform TEXT, -- 'WHATSAPP', 'WEB', 'INSTAGRAM'
    metadata JSONB -- Para guardar tokens, modelo usado, etc
);

ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to conversaciones" ON public.conversaciones FOR ALL USING (true) WITH CHECK (true);