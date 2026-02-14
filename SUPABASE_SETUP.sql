-- [MANTENER TABLAS ANTERIORES...]

-- 6. TABLA: ERRORES_IA
create table public.errores_ia (
  error_id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id), -- Quien reporta o valida
  cliente_id text,
  conversacion_id text,
  mensaje_cliente text,
  respuesta_ia text,
  categoria text, -- INFO_FALTANTE, TONO_INCORRECTO, etc
  severidad text, -- CRÍTICA, ALTA, MEDIA, BAJA
  correccion_sugerida text,
  correccion_explicacion text,
  estado_correccion text default 'REPORTADA', -- REPORTADA, EN_REVISION, APLICADA, RECHAZADA
  aplicada_en_version text,
  conversaciones_afectadas int default 0,
  tasa_mejora_post float,
  reported_at timestamp with time zone default now(),
  applied_at timestamp with time zone,
  created_by text -- "Anahí", "Edith", "Gamey"
);

-- 7. TABLA: VERSIONES_PROMPTS_APRENDIDAS
create table public.versiones_prompts_aprendidas (
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

-- 8. TABLA: HISTORIAL_CORREGIRIA
create table public.historial_corregiria (
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

-- 9. Políticas RLS
alter table public.errores_ia enable row level security;
alter table public.versiones_prompts_aprendidas enable row level security;
alter table public.historial_corregiria enable row level security;

create policy "Admins/Devs full access learning"
  on errores_ia for all
  using ( auth.uid() in (select id from profiles where role in ('admin', 'dev', 'supervisor')) );

create policy "Admins/Devs full access versions"
  on versiones_prompts_aprendidas for all
  using ( auth.uid() in (select id from profiles where role in ('admin', 'dev', 'supervisor')) );

create policy "Admins/Devs full access history"
  on historial_corregiria for all
  using ( auth.uid() in (select id from profiles where role in ('admin', 'dev', 'supervisor')) );