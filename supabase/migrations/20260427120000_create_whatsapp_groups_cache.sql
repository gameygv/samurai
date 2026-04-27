-- E13/S13.1: Tabla maestra de grupos de WhatsApp por canal.
-- Separa metadata del grupo (esta tabla) de membresía (contact_whatsapp_groups).

-- Helper function reutilizable para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Extensión para búsqueda fuzzy por nombre
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.whatsapp_groups_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
  jid TEXT NOT NULL,
  name TEXT NOT NULL,
  member_count INT NOT NULL DEFAULT 0,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_wgc_channel ON public.whatsapp_groups_cache(channel_id);
CREATE INDEX IF NOT EXISTS idx_wgc_course ON public.whatsapp_groups_cache(course_id);
CREATE INDEX IF NOT EXISTS idx_wgc_name_trgm ON public.whatsapp_groups_cache USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wgc_active_synced ON public.whatsapp_groups_cache(is_active, last_synced_at);

-- RLS
ALTER TABLE public.whatsapp_groups_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wgc_authenticated_read"
  ON public.whatsapp_groups_cache FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "wgc_service_role_all"
  ON public.whatsapp_groups_cache FOR ALL
  TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.whatsapp_groups_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups_cache TO service_role;

-- Trigger updated_at
CREATE TRIGGER wgc_set_updated_at
  BEFORE UPDATE ON public.whatsapp_groups_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: cuando se cambia courses.whatsapp_group_jid o whatsapp_channel_id,
-- propagar el course_id al cache.
CREATE OR REPLACE FUNCTION public.sync_course_to_wgc()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (
     OLD.whatsapp_group_jid IS DISTINCT FROM NEW.whatsapp_group_jid OR
     OLD.whatsapp_channel_id IS DISTINCT FROM NEW.whatsapp_channel_id
  ) THEN
    UPDATE public.whatsapp_groups_cache
      SET course_id = NULL, updated_at = now()
      WHERE course_id = OLD.id;
  END IF;

  IF NEW.whatsapp_group_jid IS NOT NULL AND NEW.whatsapp_channel_id IS NOT NULL THEN
    UPDATE public.whatsapp_groups_cache
      SET course_id = NEW.id, updated_at = now()
      WHERE channel_id = NEW.whatsapp_channel_id
        AND jid = NEW.whatsapp_group_jid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS courses_sync_to_wgc ON public.courses;
CREATE TRIGGER courses_sync_to_wgc
  AFTER INSERT OR UPDATE OF whatsapp_group_jid, whatsapp_channel_id ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_to_wgc();
