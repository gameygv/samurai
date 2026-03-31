-- ========================================================
-- AUTOMATIZACIÓN VERDAD MAESTRA — Scrape diario 3am UTC (S6.2)
-- 3am UTC = ~9pm Mexico City (CST) o ~10pm (CDT)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Eliminar job anterior si existe
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily_website_scrape';

-- 2. Programar ejecución diaria a las 3:00 AM UTC
SELECT cron.schedule(
    'daily_website_scrape',
    '0 3 * * *',
    $$
    SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/scrape-main-website',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
