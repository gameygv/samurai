-- Habilitar la extensión pg_cron (Necesario para tareas programadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. CRON DE FOLLOW-UPS (Cada hora)
-- Revisa leads en 'ALTO' interés, verifica WooCommerce y envía recordatorios.
SELECT cron.schedule(
  'samurai-followups-hourly', -- Nombre único del cron
  '0 * * * *',                -- Se ejecuta en el minuto 0 de cada hora
  $$
  SELECT
    net.http_post(
        url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-followups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 2. CRON DE ACTUALIZACIÓN WEB (Diario a las 3:00 AM GMT)
-- Re-escanea theelephantbowl.com para mantener la Verdad Maestra al día.
SELECT cron.schedule(
  'samurai-web-scrape-daily',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/scrape-main-website',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 3. CRON DE ANÁLISIS DE LEADS (Cada 30 minutos)
-- Revisa chats recientes para extraer emails/nombres que se nos hayan pasado.
SELECT cron.schedule(
  'samurai-lead-analysis',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/analyze-leads',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);