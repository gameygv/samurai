-- =====================================================
-- CRON JOB PARA FOLLOW-UPS AUTOMÁTICOS
-- =====================================================

-- Nota: Este SQL es para referencia. El cron se configura en Supabase Dashboard.
-- Ruta: Database > Extensions > pg_cron

-- Habilitar extensión pg_cron (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar ejecución cada 5 minutos
SELECT cron.schedule(
  'process-followups-every-5min',
  '*/5 * * * *', -- Cada 5 minutos
  $$
  SELECT
    net.http_post(
      url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-followups',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Ver cron jobs activos
-- SELECT * FROM cron.job;

-- Desactivar cron (si es necesario)
-- SELECT cron.unschedule('process-followups-every-5min');

COMMENT ON EXTENSION pg_cron IS 'Programador de tareas para follow-ups automáticos';