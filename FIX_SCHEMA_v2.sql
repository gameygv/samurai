-- =================================================================
-- REPARACIÓN PROFUNDA DE PERMISOS (NUCLEAR FIX)
-- =================================================================

BEGIN;

-- 1. Asegurar que el rol 'authenticator' existe y tiene permisos de paso
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- 2. Garantizar acceso al esquema PUBLIC
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 3. Garantizar acceso a TODAS las tablas actuales en public
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 4. Garantizar acceso a TODAS las secuencias (para IDs autoincrementables)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Configurar permisos por defecto para el futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

COMMIT;

-- 6. FORZAR recarga de caché (Truco: crear y borrar tabla)
CREATE TABLE public._force_schema_cache_reload (id serial PRIMARY KEY);
DROP TABLE public._force_schema_cache_reload;

NOTIFY pgrst, 'reload schema';