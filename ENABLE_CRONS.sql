-- ========================================================
-- SCRIPT MAESTRO DE AUTOMATIZACIONES (CRON JOBS)
-- ========================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Limpieza de trabajos anteriores (evita errores y duplicados)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily_credit_collections';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'batch_analyze_leads';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process_retargeting';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'scrape_master_truth';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'analyze_pending_leads';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto_followup_routine';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync_knowledge_daily';
EXCEPTION WHEN OTHERS THEN
  -- Ignorar si las tablas aún no existen
END $$;

-- ========================================================
-- 3. CREACIÓN DE LOS 4 MOTORES CRÍTICOS
-- ========================================================

-- A. Motor de Análisis de Leads (Meta CAPI, Nombres, Routing) - CADA 5 MINUTOS
SELECT cron.schedule('batch_analyze_leads', '*/5 * * * *',
    $$ SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/analyze-leads',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{"force": false}'::jsonb
    ) $$
);

-- B. Motor de Retargeting y WooCommerce Watcher - CADA 15 MINUTOS
SELECT cron.schedule('process_retargeting', '*/15 * * * *',
    $$ SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-followups',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    ) $$
);

-- C. Motor de Verdad Maestra (Scraping Web) - 1 VEZ AL DÍA (03:00 AM UTC)
SELECT cron.schedule('scrape_master_truth', '0 3 * * *',
    $$ SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/scrape-main-website',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    ) $$
);

-- D. Motor de Sincronización de Conocimiento (Fuentes Web) - 1 VEZ AL DÍA (04:00 AM UTC)
SELECT cron.schedule('sync_knowledge_daily', '0 4 * * *',
    $$ SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/auto-sync-knowledge',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    ) $$
);

-- E. Motor de Cobranza (Recordatorios de Crédito A/B/C/D) - 1 VEZ AL DÍA (09:00 AM UTC)
SELECT cron.schedule('daily_credit_collections', '0 9 * * *',
    $$ SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-credit-reminders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    ) $$
);