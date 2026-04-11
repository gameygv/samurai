-- =================================================================
-- Atribución de anuncios Click-to-WhatsApp (CTWA) en leads
-- =================================================================
-- Contexto: Meta Cloud API envía un objeto `referral` en el webhook
-- cuando el usuario llega desde un anuncio FB/IG con botón "Enviar mensaje".
-- Sin capturar estos campos, Meta CAPI no puede atribuir el Purchase/Lead
-- al anuncio correcto → la campaña no optimiza.
--
-- Campos que Meta envía:
--   { source_url, source_id, source_type, headline, body, thumbnail_url, ctwa_clid }
--
-- De estos, `ctwa_clid` es el más crítico: permite construir `fbc` y
-- se usa como click_id en el evento CAPI para matching preciso.

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ctwa_clid TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_url TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_type TEXT,
  ADD COLUMN IF NOT EXISTS ad_headline TEXT,
  ADD COLUMN IF NOT EXISTS ad_body TEXT,
  ADD COLUMN IF NOT EXISTS ad_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS referral_captured_at TIMESTAMPTZ;

-- Índice para debugging/dedup por click id
CREATE INDEX IF NOT EXISTS idx_leads_ctwa_clid ON public.leads(ctwa_clid) WHERE ctwa_clid IS NOT NULL;

COMMENT ON COLUMN public.leads.ctwa_clid IS 'Click-to-WhatsApp click ID enviado por Meta Cloud API en el objeto referral. Crítico para matching en CAPI.';
COMMENT ON COLUMN public.leads.fbc IS 'Facebook click cookie reconstruida como fb.1.<timestamp>.<ctwa_clid>';
COMMENT ON COLUMN public.leads.fbp IS 'Facebook pixel cookie (suele ser NULL para leads CTWA — solo existe en web)';

COMMIT;
