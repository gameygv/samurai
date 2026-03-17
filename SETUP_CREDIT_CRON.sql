-- Habilitar extensiones necesarias (por si no lo están)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eliminar la tarea si ya existía previamente para evitar duplicados
SELECT cron.unschedule('cobranza_diaria');

-- Programar la tarea para todos los días a las 9:00 AM (UTC)
SELECT cron.schedule('cobranza_diaria', '0 9 * * *', $$
  SELECT net.http_post(
      url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-credit-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb
  ) AS request_id;
$$);