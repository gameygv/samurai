-- Crear tabla de configuración de follow-ups
CREATE TABLE IF NOT EXISTS public.followup_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  stage_1_delay INTEGER DEFAULT 15,
  stage_2_delay INTEGER DEFAULT 60,
  stage_3_delay INTEGER DEFAULT 1440,
  auto_restart_delay INTEGER DEFAULT 30,
  start_hour INTEGER DEFAULT 9,
  end_hour INTEGER DEFAULT 20,
  allowed_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  stage_1_message TEXT DEFAULT 'Hola {nombre}, ¿pudiste ver la información?',
  stage_2_message TEXT DEFAULT 'Hola {nombre}, sigo aquí por si tienes dudas.',
  stage_3_message TEXT DEFAULT 'Hola {nombre}, te escribo por última vez para saber si quieres avanzar.',
  max_followup_stage INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.followup_config ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
CREATE POLICY "followup_config_select_policy" ON public.followup_config
FOR SELECT USING (true);

-- Política de actualización para usuarios autenticados
CREATE POLICY "followup_config_update_policy" ON public.followup_config
FOR UPDATE TO authenticated USING (true);

-- Política de inserción para usuarios autenticados
CREATE POLICY "followup_config_insert_policy" ON public.followup_config
FOR INSERT TO authenticated WITH CHECK (true);

-- Insertar configuración por defecto si no existe
INSERT INTO public.followup_config (enabled, stage_1_delay, stage_2_delay, stage_3_delay, auto_restart_delay)
VALUES (false, 15, 60, 1440, 30)
ON CONFLICT DO NOTHING;

-- Comentario de la tabla
COMMENT ON TABLE public.followup_config IS 'Configuración global del sistema de follow-ups automáticos y auto-restart post #STOP';