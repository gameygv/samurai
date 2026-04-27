-- E15/S15.2: Cron para sync-group-members cada 30 min.
-- DESHABILITADO por defecto — activar manualmente después de validar S15.3.
-- Activar: SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'sync-group-members-30min'), active := true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-group-members-30min') THEN
    PERFORM cron.unschedule('sync-group-members-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-group-members-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/sync-group-members',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

-- DESACTIVAR inmediatamente
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-group-members-30min'),
  active := false
);
