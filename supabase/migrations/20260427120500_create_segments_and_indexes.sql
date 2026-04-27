-- E16/S16.2: Tabla segments + índices para filtros segmentados.

-- Índices para performance de filtros
CREATE INDEX IF NOT EXISTS idx_leads_buying_intent ON leads(buying_intent);
CREATE INDEX IF NOT EXISTS idx_leads_ciudad ON leads(ciudad);
CREATE INDEX IF NOT EXISTS idx_contacts_academic_record_gin ON contacts USING gin (academic_record jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_cwg_group_jid ON contact_whatsapp_groups(group_jid);

-- Tabla segments
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  definition_json JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments_authenticated_all"
  ON public.segments FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO authenticated;

CREATE TRIGGER segments_set_updated_at
  BEFORE UPDATE ON public.segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
