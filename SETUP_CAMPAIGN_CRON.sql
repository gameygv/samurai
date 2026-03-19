-- ==============================================================================
-- 🚀 ACTIVAR CRON JOB: PROCESADOR DE CAMPAÑAS PROGRAMADAS
-- ==============================================================================
-- IMPORTANTE: Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- Requiere tener habilitada la extensión pg_net y pg_cron (ya deben estarlo).

SELECT cron.schedule(
  'process-campaigns-every-minute', -- Nombre del Cron Job
  '* * * * *',                      -- Frecuencia: Cada 1 minuto
  $$
    SELECT net.http_post(
      url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-campaign-queue',
      headers:=jsonb_build_object('Content-Type', 'application/json')
    )
  $$
);