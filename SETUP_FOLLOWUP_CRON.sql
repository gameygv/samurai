-- 1. Activar extensiones necesarias en Supabase
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Eliminar trabajo previo si existe para evitar duplicados
SELECT cron.unschedule('samurai-auto-followups');

-- 3. Programar ejecución cada hora (En el minuto 0 de cada hora)
SELECT cron.schedule(
  'samurai-auto-followups',
  '0 * * * *', 
  $$
  SELECT net.http_post(
      url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-followups',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb
  );
  $$
);