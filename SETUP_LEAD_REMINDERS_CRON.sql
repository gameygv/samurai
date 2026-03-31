-- ========================================================
-- AUTOMATIZACIÓN DE RECORDATORIOS POR LEAD (S5.1)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Eliminar job anterior si existe
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hourly_lead_reminders';

-- 2. Programar ejecución cada hora (minuto 30)
-- Los recordatorios se verifican cada hora. Delay maximo: ~59 minutos.
SELECT cron.schedule(
    'hourly_lead_reminders',
    '30 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-lead-reminders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
