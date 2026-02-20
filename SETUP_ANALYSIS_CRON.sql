-- Habilitar extensión pg_cron si es necesario (generalmente ya está en Supabase Pro o local, si falla se ignora)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar análisis cada 10 minutos
SELECT cron.schedule(
  'analyze-active-leads', -- nombre del job
  '*/10 * * * *',         -- cada 10 mins
  $$
  select
    net.http_post(
        url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/analyze-leads',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);