-- ============================================================
-- TABLA: receipt_audits (Ojo de Halcón — Auditoría de Comprobantes)
-- Registro centralizado de todos los comprobantes analizados
-- ============================================================

CREATE TABLE IF NOT EXISTS public.receipt_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,

  -- Análisis IA
  ai_analysis TEXT DEFAULT '',
  ai_verdict TEXT DEFAULT 'PENDING'
    CHECK (ai_verdict IN ('PROBABLE_VALID','PROBABLE_INVALID','INCONCLUSIVE','PENDING')),
  matched_account TEXT DEFAULT '',    -- "Principal" o nombre del agente
  bank_detected TEXT DEFAULT '',
  amount_detected NUMERIC DEFAULT 0,
  reference_detected TEXT DEFAULT '',
  date_detected TEXT DEFAULT '',
  ai_note TEXT DEFAULT '',            -- nota con disclaimer para el humano

  -- Verificación humana
  human_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_note TEXT DEFAULT '',

  -- Trazabilidad
  conversation_id UUID,              -- link al mensaje original en conversaciones
  channel_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_receipt_audits_lead ON public.receipt_audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_receipt_audits_pending ON public.receipt_audits(human_verified) WHERE human_verified = false;
CREATE INDEX IF NOT EXISTS idx_receipt_audits_created ON public.receipt_audits(created_at DESC);

-- RLS
ALTER TABLE public.receipt_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_audits_read_all" ON public.receipt_audits FOR SELECT USING (true);
CREATE POLICY "receipt_audits_insert_auth" ON public.receipt_audits FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "receipt_audits_update_auth" ON public.receipt_audits FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "receipt_audits_service_insert" ON public.receipt_audits FOR INSERT WITH CHECK (auth.role() = 'service_role');
