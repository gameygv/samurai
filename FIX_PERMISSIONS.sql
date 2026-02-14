-- =================================================================
-- REPARACIÓN DE PERMISOS Y ESQUEMA
-- =================================================================

-- 1. Garantizar acceso al esquema public para los roles de API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Dar permisos sobre todas las tablas actuales
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Configurar permisos por defecto para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. Asegurar que las extensiones necesarias estén en public o accesibles
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- 5. Recargar la caché de PostgREST (API)
NOTIFY pgrst, 'reload schema';