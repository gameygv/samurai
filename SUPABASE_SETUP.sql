-- ==========================================
-- SCRIPT MAESTRO DE CONFIGURACIÓN SAMURAI v5
-- ==========================================

-- 1. Habilitar extensión para encriptación de contraseñas
create extension if not exists pgcrypto;

-- 2. TABLA: PROFILES (Si no existe)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  role text check (role in ('admin', 'dev', 'supervisor', 'agent')),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. TABLA: ERRORES_IA
create table if not exists public.errores_ia (
  error_id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id),
  cliente_id text,
  conversacion_id text,
  mensaje_cliente text,
  respuesta_ia text,
  categoria text,
  severidad text,
  correccion_sugerida text,
  correccion_explicacion text,
  estado_correccion text default 'REPORTADA',
  aplicada_en_version text,
  conversaciones_afectadas int default 0,
  tasa_mejora_post float,
  reported_at timestamp with time zone default now(),
  applied_at timestamp with time zone,
  created_by text
);

-- 4. TABLA: VERSIONES_PROMPTS_APRENDIDAS
create table if not exists public.versiones_prompts_aprendidas (
  version_id uuid primary key default gen_random_uuid(),
  prompt_nombre text,
  version_numero text,
  contenido_anterior text,
  contenido_nuevo text,
  diff_aplicados jsonb,
  errores_corregidia int default 0,
  lista_errores_ids jsonb,
  test_accuracy_anterior float,
  test_accuracy_nuevo float,
  mejora_porcentaje float,
  created_at timestamp with time zone default now(),
  activated_at timestamp with time zone,
  usuarios_lo_usaron int default 0,
  trigger_version_anterior text,
  motivo_creacion text,
  creado_por uuid references auth.users(id)
);

-- 5. TABLA: HISTORIAL_CORREGIRIA
create table if not exists public.historial_corregiria (
  corregiria_id uuid primary key default gen_random_uuid(),
  error_id uuid references public.errores_ia(error_id),
  reportado_por text,
  reportado_en_kommo boolean default false,
  mensaje_original text,
  timestamp_reporte timestamp with time zone default now(),
  categoria text,
  subcategoria text,
  patron_identificado text,
  cliente_estado_emocional text,
  prompt_version_en_uso text,
  correccion_propuesta text,
  razon_cambio text,
  impacto_esperado text,
  aplicado boolean default false,
  aplicado_en_version text,
  fecha_aplicacion timestamp with time zone,
  test_antes_promedio float,
  test_despues_promedio float,
  mejora_detectada boolean,
  usuario_valida boolean default false,
  feedback_reporte text
);

-- 6. TABLA: ACTIVITY_LOGS (Para auditoría)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  username text,
  action text,
  resource text,
  description text,
  status text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- 7. Políticas RLS (Seguridad)
alter table public.profiles enable row level security;
alter table public.errores_ia enable row level security;
alter table public.versiones_prompts_aprendidas enable row level security;
alter table public.historial_corregiria enable row level security;
alter table public.activity_logs enable row level security;

-- Políticas permisivas para desarrollo (Ajustar en producción)
create policy "Public profiles access" on public.profiles for all using (true);
create policy "Public logs access" on public.activity_logs for all using (true);
create policy "Public errors access" on public.errores_ia for all using (true);
create policy "Public versions access" on public.versiones_prompts_aprendidas for all using (true);

-- ==========================================
-- 8. CREACIÓN DE USUARIOS DEFAULT
-- ==========================================

DO $$
DECLARE
  gamey_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  josue_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
BEGIN
  -- USUARIO: GAMEY
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gamey@samurai.local') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gamey_id, 'authenticated', 'authenticated', 'gamey@samurai.local', 
      crypt('Febrero26', gen_salt('bf')), -- Contraseña hasheada
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', ''
    );
    
    INSERT INTO public.profiles (id, username, full_name, role, is_active)
    VALUES (gamey_id, 'gamey', 'Gamey Dev', 'dev', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- USUARIO: JOSUE
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'josue@samurai.local') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', josue_id, 'authenticated', 'authenticated', 'josue@samurai.local', 
      crypt('Febrero26', gen_salt('bf')), -- Contraseña hasheada
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', ''
    );

    INSERT INTO public.profiles (id, username, full_name, role, is_active)
    VALUES (josue_id, 'josue', 'Josue Supervisor', 'supervisor', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

END $$;