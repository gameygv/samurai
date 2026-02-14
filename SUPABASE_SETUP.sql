-- [MANTENER TABLAS ANTERIORES...]

-- 6. TABLA: ERRORES_IA
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

-- 7. TABLA: VERSIONES_PROMPTS_APRENDIDAS
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

-- 8. TABLA: HISTORIAL_CORREGIRIA
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

-- 9. Políticas RLS
alter table public.errores_ia enable row level security;
alter table public.versiones_prompts_aprendidas enable row level security;
alter table public.historial_corregiria enable row level security;

create policy "Admins/Devs full access learning" on errores_ia for all using (true);
create policy "Admins/Devs full access versions" on versiones_prompts_aprendidas for all using (true);
create policy "Admins/Devs full access history" on historial_corregiria for all using (true);

-- 10. SEED DATA (DATOS DE EJEMPLO)
-- Limpiar datos previos de ejemplo si existen (opcional, cuidado en prod)
-- truncate table errores_ia cascade;

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