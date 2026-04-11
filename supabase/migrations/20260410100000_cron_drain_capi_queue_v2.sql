-- =================================================================
-- Reschedule drain-capi-queue: llamar sin Authorization header
-- =================================================================
-- process-capi-purchase se redeployó con --no-verify-jwt, por lo que el cron
-- puede llamarlo sin token (la función usa su propio service_role del env).

BEGIN;

DO $$
BEGIN
  PERFORM cron.unschedule('drain-capi-queue');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'drain-capi-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-capi-purchase',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

COMMIT;
