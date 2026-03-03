-- Asegurar que las extensiones están activas
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar ejecución todos los días a las 3:00 AM
SELECT cron.schedule(
  'samurai-daily-sync',
  '0 3 * * *', 
  $$
  SELECT net.http_post(
      url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/scrape-main-website',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb
  );
  $$
);