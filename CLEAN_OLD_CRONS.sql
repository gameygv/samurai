-- ========================================================
-- LIMPIEZA DE CRON JOBS DUPLICADOS/ANTIGUOS
-- ========================================================

DO $$
BEGIN
  -- Eliminamos todas las tareas viejas por su nombre exacto
  PERFORM cron.unschedule('sync-websites-daily');
  PERFORM cron.unschedule('process-followups-every-5min');
  PERFORM cron.unschedule('samurai-followups-hourly');
  PERFORM cron.unschedule('samurai-web-scrape-daily');
  PERFORM cron.unschedule('samurai-lead-analysis');
  PERFORM cron.unschedule('samurai-auto-followups');
  PERFORM cron.unschedule('samurai-followups-job');
  PERFORM cron.unschedule('cobranza_diaria');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar errores si alguna ya no existe
END $$;

-- Verificamos el resultado final (Deberían quedar solo 4 filas)
SELECT jobid, jobname, schedule, active FROM cron.job;