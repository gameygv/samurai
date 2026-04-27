-- Rollback E13/S13.1: eliminar whatsapp_groups_cache y triggers asociados
DROP TRIGGER IF EXISTS courses_sync_to_wgc ON public.courses;
DROP FUNCTION IF EXISTS public.sync_course_to_wgc();
DROP TRIGGER IF EXISTS wgc_set_updated_at ON public.whatsapp_groups_cache;
DROP TABLE IF EXISTS public.whatsapp_groups_cache CASCADE;
-- NO eliminamos set_updated_at() porque podría ser usada por otras tablas
