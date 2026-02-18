-- Crear extensión pg_cron si no existe (solo si tienes permisos)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar scraping del sitio principal todos los días a las 3:00 AM
SELECT cron.schedule(
  'scrape-main-website-daily',
  '0 3 * * *', -- Todos los días a las 3:00 AM
  $$
  SELECT
    net.http_post(
      url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/scrape-main-website',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);

-- Verificar que el CRON job fue creado
SELECT * FROM cron.job WHERE jobname = 'scrape-main-website-daily';