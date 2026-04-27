DROP TRIGGER IF EXISTS segments_set_updated_at ON public.segments;
DROP TABLE IF EXISTS public.segments CASCADE;
DROP INDEX IF EXISTS idx_leads_buying_intent;
DROP INDEX IF EXISTS idx_leads_ciudad;
DROP INDEX IF EXISTS idx_leads_origen;
DROP INDEX IF EXISTS idx_contacts_academic_record_gin;
DROP INDEX IF EXISTS idx_cwg_group_jid;
