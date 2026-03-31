-- ========================================================
-- ACTUALIZAR CRON DE RECORDATORIOS: de cada hora a cada 15 min (S7.3)
-- ========================================================

-- 1. Eliminar cron anterior
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hourly_lead_reminders';

-- 2. Nuevo cron cada 15 minutos
SELECT cron.schedule(
    'lead_reminders_15min',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-lead-reminders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
