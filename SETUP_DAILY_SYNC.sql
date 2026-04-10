-- 1. Habilitar extensiones requeridas
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Definir la URL de tu proyecto (Reemplaza PROJECT_REF con tu ID si es necesario)
-- IMPORTANTE: Usa tu URL real de Edge Functions
-- Formato: https://<PROJECT_REF>.supabase.co/functions/v1/auto-sync-knowledge

-- 3. Crear el Job de Cron
-- Se ejecuta todos los días a las 03:00 AM (UTC)
select
  cron.schedule(
    'sync-websites-daily', -- Nombre del trabajo
    '0 3 * * *',           -- Cron expression (3:00 AM diario)
    $$
    select
      net.http_post(
          url:='https://giwoovmvwlddaizorizk.supabase.co/functions/v1/auto-sync-knowledge',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- NOTA: Debes reemplazar TU_SERVICE_ROLE_KEY_AQUI con tu clave real (Service Role Key)
-- Puedes encontrarla en Project Settings > API > service_role (secret)
-- Esto es necesario porque pg_cron necesita permisos de administrador para invocar la función.