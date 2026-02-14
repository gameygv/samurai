-- =================================================================
-- REPARACIÓN CRÍTICA DEL ROL AUTH ADMIN (Error 500 Login)
-- =================================================================

BEGIN;

-- 1. Asegurar que el rol de administración tiene acceso TOTAL al esquema auth
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- 2. CORRECCIÓN DE PRIORIDAD DE SEARCH_PATH
-- Para este rol, 'auth' DEBE ir primero. Si estaba en 'public, auth', falla.
ALTER ROLE supabase_auth_admin SET search_path = auth, public, extensions;

-- 3. Asegurar permisos básicos en public (por si usas triggers)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;

-- 4. Reparación de rol Postgres (Superusuario efectivo en Supabase)
ALTER ROLE postgres SET search_path = public, auth, extensions;
GRANT ALL PRIVILEGES ON SCHEMA auth TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO postgres;

-- 5. Asegurar que el rol authenticator también ve auth (para leer sesiones)
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT SELECT ON TABLE auth.users TO authenticator;

COMMIT;

-- 6. Señales de recarga para despertar a los servicios
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';