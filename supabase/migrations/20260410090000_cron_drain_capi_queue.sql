-- =================================================================
-- Cron job: drenar cola CAPI pendiente cada 2 minutos
-- =================================================================
-- Producción requiere que los eventos PENDING en activity_logs se envíen
-- a Meta con confiabilidad, sin depender de que un usuario haga click.
--
-- El cron llama process-capi-purchase via pg_net → la función consume
-- eventos PENDING y los marca como OK o ERROR.

BEGIN;

-- Habilitar extensiones (Supabase los tiene disponibles)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Borrar job previo si existe (para que esta migración sea idempotente)
-- pg_cron.unschedule falla si el job no existe, pero retorna null dentro de un bloque
DO $$
BEGIN
  PERFORM cron.unschedule('drain-capi-queue');
EXCEPTION WHEN OTHERS THEN
  -- Job no existía, ignorar
  NULL;
END $$;

-- Schedule: cada 2 minutos drenar la cola PENDING
-- Usa pg_net para llamar al edge function con service role key
SELECT cron.schedule(
  'drain-capi-queue',
  '*/2 * * * *',  -- cada 2 minutos
  $$
  SELECT net.http_post(
    url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-capi-purchase',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

COMMIT;
