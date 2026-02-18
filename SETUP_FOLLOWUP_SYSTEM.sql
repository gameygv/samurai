-- =====================================================
-- SISTEMA DE FOLLOW-UP AUTOMÁTICO INTELIGENTE
-- =====================================================

-- 1. Añadir columnas necesarias a la tabla leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS last_bot_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS followup_stage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stop_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_restart_scheduled_at TIMESTAMP WITH TIME ZONE;

-- 2. Crear tabla de configuración de follow-ups
CREATE TABLE IF NOT EXISTS public.followup_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Tiempos de reintento (en minutos)
  stage_1_delay INTEGER DEFAULT 10,
  stage_2_delay INTEGER DEFAULT 60,
  stage_3_delay INTEGER DEFAULT 360,
  
  -- Auto-restart después de #STOP (en minutos)
  auto_restart_delay INTEGER DEFAULT 30,
  
  -- Horarios permitidos
  allowed_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
  start_hour INTEGER DEFAULT 9,
  end_hour INTEGER DEFAULT 21,
  timezone TEXT DEFAULT 'America/Mexico_City',
  
  -- Mensajes de follow-up
  stage_1_message TEXT DEFAULT 'Hola {nombre}, ¿sigues interesado? Estoy aquí para ayudarte.',
  stage_2_message TEXT DEFAULT 'Hey {nombre}, no quiero ser insistente, pero tengo info que te puede interesar.',
  stage_3_message TEXT DEFAULT '{nombre}, última oportunidad de aprovechar esta oferta especial.',
  
  -- Control
  enabled BOOLEAN DEFAULT true,
  max_followup_stage INTEGER DEFAULT 3,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insertar configuración por defecto
INSERT INTO public.followup_config (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar RLS
ALTER TABLE public.followup_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "followup_config_read" ON public.followup_config FOR SELECT USING (true);
CREATE POLICY "followup_config_update" ON public.followup_config FOR UPDATE USING (true);

-- 4. Crear tabla de historial de follow-ups
CREATE TABLE IF NOT EXISTS public.followup_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  message_sent TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_received BOOLEAN DEFAULT false,
  response_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.followup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_history_all" ON public.followup_history FOR ALL USING (true);

-- 5. Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON public.leads(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_auto_restart ON public.leads(auto_restart_scheduled_at) WHERE auto_restart_scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_followup_history_lead ON public.followup_history(lead_id, sent_at DESC);

-- 6. Función para calcular próximo follow-up
CREATE OR REPLACE FUNCTION calculate_next_followup(
  p_lead_id UUID,
  p_current_stage INTEGER
) RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
DECLARE
  v_config RECORD;
  v_delay_minutes INTEGER;
  v_next_time TIMESTAMP WITH TIME ZONE;
  v_current_hour INTEGER;
  v_current_day TEXT;
BEGIN
  -- Obtener configuración
  SELECT * INTO v_config FROM followup_config LIMIT 1;
  
  -- Determinar delay según stage
  IF p_current_stage = 1 THEN
    v_delay_minutes := v_config.stage_1_delay;
  ELSIF p_current_stage = 2 THEN
    v_delay_minutes := v_config.stage_2_delay;
  ELSIF p_current_stage = 3 THEN
    v_delay_minutes := v_config.stage_3_delay;
  ELSE
    RETURN NULL; -- No más follow-ups
  END IF;
  
  -- Calcular tiempo base
  v_next_time := NOW() + (v_delay_minutes || ' minutes')::INTERVAL;
  
  -- Ajustar a horario permitido
  v_current_hour := EXTRACT(HOUR FROM v_next_time AT TIME ZONE v_config.timezone);
  v_current_day := LOWER(TO_CHAR(v_next_time AT TIME ZONE v_config.timezone, 'Day'));
  
  -- Si está fuera de horario, mover al siguiente día hábil a la hora de inicio
  IF v_current_hour < v_config.start_hour OR v_current_hour >= v_config.end_hour THEN
    v_next_time := DATE_TRUNC('day', v_next_time) + ((v_config.start_hour || ' hours')::INTERVAL);
    IF v_current_hour >= v_config.end_hour THEN
      v_next_time := v_next_time + '1 day'::INTERVAL;
    END IF;
  END IF;
  
  RETURN v_next_time;
END;
$$;

COMMENT ON TABLE public.followup_config IS 'Configuración del sistema de follow-up automático inteligente';
COMMENT ON TABLE public.followup_history IS 'Historial de mensajes de follow-up enviados';