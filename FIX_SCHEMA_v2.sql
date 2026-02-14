-- =================================================================
-- REPARACIÓN DE TABLA DE MIGRACIONES (Error querying schema)
-- =================================================================

BEGIN;

-- 1. Crear la tabla de migraciones si no existe (A veces desaparece en deploys fallidos)
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version character varying(255) NOT NULL,
    PRIMARY KEY (version)
);

-- 2. Permisos explícitos para el admin de auth
GRANT ALL PRIVILEGES ON TABLE auth.schema_migrations TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON TABLE auth.schema_migrations TO postgres;
GRANT SELECT ON TABLE auth.schema_migrations TO service_role;

-- 3. Asegurar search_path correcto para el rol actual (postgres)
SET search_path = auth, public, extensions;

-- 4. Re-aplicar permisos sobre todo el esquema auth por si acaso
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;

COMMIT;

NOTIFY pgrst, 'reload schema';