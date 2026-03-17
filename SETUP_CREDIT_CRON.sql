-- ========================================================
-- AUTOMATIZACIÓN DE COBRANZA Y RECORDATORIOS
-- ========================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Eliminar el job de forma segura (solo si existe, para evitar el error XX000)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily_credit_collections';

-- 2. Programar ejecución a las 09:00 AM (hora UTC) todos los días
-- Esto suele corresponder a las 3:00 AM o 4:00 AM hora México/Centro
SELECT cron.schedule(
    'daily_credit_collections',
    '0 9 * * *',
    $$
    SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-credit-reminders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);