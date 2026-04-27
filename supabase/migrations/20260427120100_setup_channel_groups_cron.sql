-- E13/S13.3: Cron que dispara sync-channel-groups cada 30 min.
-- pg_cron y pg_net ya están habilitados (ver ENABLE_CRONS.sql).
-- Patrón: mismo que SETUP_DAILY_SYNC.sql (ANON key en headers).

-- Idempotente: eliminar el job si ya existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-channel-groups-30min') THEN
    PERFORM cron.unschedule('sync-channel-groups-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-channel-groups-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/sync-channel-groups',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);
