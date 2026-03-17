-- ========================================================
-- AUTOMATIZACIÓN DE COBRANZA Y RECORDATORIOS
-- ========================================================

-- Este script programa la ejecución diaria de la Edge Function
-- 'process-credit-reminders', la cual se encarga de revisar
-- los vencimientos y enviar los mensajes de WhatsApp A/B/C/D.

-- Habilitar extensión si no existe
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Eliminar el job si ya existía para evitar duplicados
SELECT cron.unschedule('daily_credit_collections');

-- Programar ejecución a las 09:00 AM (hora UTC) todos los días
-- Esto suele corresponder a las 3:00 AM o 4:00 AM hora México/Centro
SELECT cron.schedule(
    'daily_credit_collections',
    '0 9 * * *',
    $$
    SELECT net.http_post(
        url := (
            SELECT current_setting('custom.my_project_url') || '/functions/v1/process-credit-reminders'
        ),
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT current_setting('custom.my_anon_key')) || '"}'::jsonb,
        body := '{}'::jsonb
    )
    $$
);

-- ========================================================
-- NOTA IMPORTANTE PARA EL ADMINISTRADOR DE SUPABASE
-- ========================================================
-- Asegúrate de que las variables 'custom.my_project_url' y 
-- 'custom.my_anon_key' estén configuradas en los ajustes
-- de tu base de datos Supabase:
-- 
-- ALTER DATABASE postgres SET custom.my_project_url TO 'https://tu-id.supabase.co';
-- ALTER DATABASE postgres SET custom.my_anon_key TO 'tu-anon-key';
-- ========================================================