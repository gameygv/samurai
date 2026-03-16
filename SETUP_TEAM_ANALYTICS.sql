-- Crear tabla de evaluaciones de agentes
CREATE TABLE public.agent_evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    tone_analysis TEXT,
    anomaly_detected BOOLEAN DEFAULT false,
    anomaly_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.agent_evaluations ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad (Solo lectura para admin, inserción para autenticados)
CREATE POLICY "Admins can read all evaluations" ON public.agent_evaluations
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'dev')
  )
);

CREATE POLICY "Users can insert their own evaluations" ON public.agent_evaluations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id);