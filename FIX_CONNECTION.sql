-- =================================================================
-- REPARACIÓN DE RUTA DE BÚSQUEDA Y CACHÉ (SOLUCIÓN DEFINITIVA)
-- =================================================================

BEGIN;

-- 1. Forzar al rol 'authenticator' a usar siempre los esquemas correctos
-- Esto es crucial en instalaciones self-hosted donde a veces se pierde.
ALTER ROLE authenticator SET search_path = public, auth, extensions;

-- 2. Asegurarse de que el rol 'anon' (usado antes del login) pueda leer la configuración
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA extensions TO anon;

-- 3. REPARAR PERMISOS DEL SISTEMA DE AUTH (Por si el fallo viene de ahí)
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON TABLE auth.users TO service_role;

-- 4. Confirmar que la extensión pgcrypto está disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

COMMIT;

-- 5. NOTIFICACIÓN AGRESIVA DE RECARGA
-- Enviamos la señal varias veces para asegurar que PostgREST despierte
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';