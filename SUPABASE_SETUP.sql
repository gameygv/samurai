-- =================================================================
-- SCRIPT MAESTRO DE CONFIGURACIÓN SAMURAI v5.2 (FULL SETUP)
-- =================================================================

-- 1. EXTENSIONES NECESARIAS
-- Habilitar pgcrypto para encriptar contraseñas de usuarios manualmente
create extension if not exists pgcrypto;

-- 2. TABLAS DEL SISTEMA

-- 2.1 TABLA: PROFILES
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  role text check (role in ('admin', 'dev', 'supervisor', 'agent')),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2.2 TABLA: ERRORES_IA (Learning Log)
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

-- 2.3 TABLA: VERSIONES_PROMPTS_APRENDIDAS
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

-- 2.4 TABLA: HISTORIAL_CORREGIRIA
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

-- 2.5 TABLA: ACTIVITY_LOGS (Auditoría)
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

-- 3. SEGURIDAD (RLS POLICIES)
-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.errores_ia enable row level security;
alter table public.versiones_prompts_aprendidas enable row level security;
alter table public.historial_corregiria enable row level security;
alter table public.activity_logs enable row level security;

-- Crear políticas permisivas (MODO DESARROLLO)
-- NOTA: En producción, restringir esto solo a usuarios autenticados o roles específicos.
create policy "Allow all access to profiles" on public.profiles for all using (true);
create policy "Allow all access to logs" on public.activity_logs for all using (true);
create policy "Allow all access to errors" on public.errores_ia for all using (true);
create policy "Allow all access to versions" on public.versiones_prompts_aprendidas for all using (true);
create policy "Allow all access to history" on public.historial_corregiria for all using (true);


-- 4. CREACIÓN DE USUARIOS DEFAULT (Gamey & Josue)
-- Este bloque verifica si existen y si no, los inserta en auth.users y public.profiles
DO $$
DECLARE
  gamey_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  josue_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
BEGIN
  -- USUARIO: GAMEY (Dev)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gamey@samurai.local') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gamey_id, 'authenticated', 'authenticated', 'gamey@samurai.local', 
      crypt('Febrero26', gen_salt('bf')), -- Contraseña: Febrero26
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', ''
    );
    
    INSERT INTO public.profiles (id, username, full_name, role, is_active)
    VALUES (gamey_id, 'gamey', 'Gamey Dev', 'dev', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- USUARIO: JOSUE (Supervisor)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'josue@samurai.local') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', josue_id, 'authenticated', 'authenticated', 'josue@samurai.local', 
      crypt('Febrero26', gen_salt('bf')), -- Contraseña: Febrero26
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', ''
    );

    INSERT INTO public.profiles (id, username, full_name, role, is_active)
    VALUES (josue_id, 'josue', 'Josue Supervisor', 'supervisor', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

END $$;

-- 5. DATOS DE EJEMPLO (SEED DATA)
-- Poblar tablas con datos ficticios para visualización inmediata

-- Insertar Errores de Ejemplo
INSERT INTO public.errores_ia (error_id, categoria, severidad, created_by, estado_correccion, mensaje_cliente, respuesta_ia, correccion_sugerida, tasa_mejora_post, reported_at)
VALUES 
('e001-mock-uuid', 'TONO_INCORRECTO', 'ALTA', 'Anahí', 'APLICADA', 'Es muy caro', 'Es que el precio es el que es.', 'Entiendo la inversión. ¿Puedo ofrecerte cuotas?', 13.5, NOW() - INTERVAL '5 days'),
('e002-mock-uuid', 'INFO_FALTANTE', 'MEDIA', 'Edith', 'APLICADA', '¿Qué horarios tienen?', 'Sábados de 9 a 2.', 'Sábados de 9 a 2 y Domingos intensivos. (Omitió domingo)', 8.2, NOW() - INTERVAL '3 days'),
('e003-mock-uuid', 'LOGICA_FALLA', 'CRITICA', 'Anahí', 'PENDIENTE', 'Pago mañana', 'Ok, te espero.', 'Confirmar hora exacta y agendar recordatorio.', NULL, NOW() - INTERVAL '1 day'),
('e004-mock-uuid', 'TONO_INCORRECTO', 'MEDIA', 'Edith', 'VALIDADA', 'No estoy seguro', 'Pues tú decides.', 'Es normal tener dudas. ¿Qué te preocupa específicamente?', 12.1, NOW() - INTERVAL '2 days');

-- Insertar Versiones de Ejemplo
INSERT INTO public.versiones_prompts_aprendidas (prompt_nombre, version_numero, mejora_porcentaje, test_accuracy_anterior, test_accuracy_nuevo, errores_corregidia, created_at)
VALUES
('Detección Estados', 'v2.1', 7.2, 58.0, 65.2, 3, NOW() - INTERVAL '1 day'),
('Flujo Ventas', 'v2.0', 10.1, 48.0, 58.0, 5, NOW() - INTERVAL '5 days'),
('Estados Base', 'v1.1', 3.2, 45.0, 48.0, 2, NOW() - INTERVAL '10 days');

-- Insertar Logs de Actividad de Ejemplo
INSERT INTO public.activity_logs (username, action, resource, description, status, created_at)
VALUES
('gamey', 'LOGIN', 'AUTH', 'Login exitoso: gamey', 'OK', NOW() - INTERVAL '1 hour'),
('josue', 'UPDATE', 'PROMPTS', 'Ajuste de tono en Prompt Core', 'OK', NOW() - INTERVAL '3 hours'),
('system', 'ERROR', 'SYSTEM', 'Fallo conexión API externa (simulado)', 'ERROR', NOW() - INTERVAL '5 hours'),
('gamey', 'CREATE', 'BRAIN', 'Nueva versión de prompt v2.1', 'OK', NOW() - INTERVAL '1 day');