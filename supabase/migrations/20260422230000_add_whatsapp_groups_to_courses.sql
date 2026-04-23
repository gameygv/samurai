-- E12/S12.1: Vincular grupos de WhatsApp a cursos + tabla junction contacto↔grupo
-- Aplicar con: cat supabase/migrations/20260422230000_add_whatsapp_groups_to_courses.sql | ssh easypanel-vps "docker exec -i samurai-db-1 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1"

-- 1. Agregar columnas de grupo WA a courses (relación 1:1)
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS whatsapp_group_jid TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_channel_id UUID REFERENCES whatsapp_channels(id);

-- 2. Tabla junction: contacto ↔ grupo de WhatsApp
CREATE TABLE IF NOT EXISTS contact_whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  channel_id UUID NOT NULL REFERENCES whatsapp_channels(id),
  phone_number TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, group_jid)
);

CREATE INDEX IF NOT EXISTS idx_cwg_contact ON contact_whatsapp_groups(contact_id);
CREATE INDEX IF NOT EXISTS idx_cwg_group ON contact_whatsapp_groups(group_jid);
CREATE INDEX IF NOT EXISTS idx_cwg_course ON contact_whatsapp_groups(course_id);

-- 3. RLS
ALTER TABLE contact_whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contact_whatsapp_groups"
  ON contact_whatsapp_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contact_whatsapp_groups"
  ON contact_whatsapp_groups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact_whatsapp_groups"
  ON contact_whatsapp_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contact_whatsapp_groups"
  ON contact_whatsapp_groups FOR DELETE TO authenticated USING (true);

-- 4. Grants para que el frontend (authenticated) pueda operar
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_whatsapp_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_whatsapp_groups TO service_role;
