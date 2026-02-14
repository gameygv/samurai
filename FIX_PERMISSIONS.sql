-- =================================================================
-- REPARACIÓN MAESTRA DE PERMISOS Y RUTAS (Auth + Public)
-- =================================================================

BEGIN;

-- 1. Asegurar acceso de USO a los esquemas críticos
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 2. CONFIGURACIÓN CRÍTICA: search_path
-- Esto asegura que cuando Auth ejecuta triggers o consultas, sepa dónde buscar.
ALTER ROLE authenticator SET search_path = public, auth, extensions;
ALTER ROLE service_role SET search_path = public, auth, extensions;
ALTER ROLE supabase_auth_admin SET search_path = public, auth, extensions;
ALTER ROLE postgres SET search_path = public, auth, extensions;

-- También configuramos la base de datos por defecto
ALTER DATABASE postgres SET search_path = public, auth, extensions;

-- 3. Permisos explícitos en esquema PUBLIC (para triggers de perfiles)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Permisos explícitos en esquema AUTH (para login)
GRANT SELECT ON TABLE auth.users TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;

COMMIT;

-- 5. Forzar recarga de configuración en PostgREST
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';