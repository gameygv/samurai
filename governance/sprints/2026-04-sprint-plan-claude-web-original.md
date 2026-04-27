# Samurai — Prompts maestros para Claude Code (en orden)

> **Documento generado por Claude Web** (Claude Opus 4.7 en chat.claude.ai) después de analizar `gameygv/samurai`, el repo hermano `gameygv/pos-elephant-bowl`, el PDF `SAMURAI_Funcionalidades.pdf`, las transcripciones de la reunión del 25-abr con **Geoffrey** (cliente) y **Josué** (marketing/Pulso Creativo), el folder `.raise/` y `governance/`, los commits del fin de semana pasado (incluido el del 25-abr) y las épicas E1-E12 ya cerradas.
>
> **Cómo usar este archivo**: copia y pega cada bloque de prompt a Claude Code en orden. Cada uno es independiente y termina con "espera mi OK". No avances al siguiente sin haber cerrado el anterior con sus pruebas verdes.

---

## 📌 Glosario y contexto crítico (Claude Code DEBE leer esto antes del Prompt 0)

### Personas

| Persona | Rol | Lo que pidió |
|---------|-----|--------------|
| **Geoffrey** | Cliente final, dueño de The Elephant Bowl | Mejor visualización: **letra más grande** + **modo claro/oscuro alternable** |
| **Josué** / Pulso Creativo | Marketing | Catálogo de canales con sus grupos sincronizado, editor multimedia, filtros segmentados, variantes anti-ban |
| **Anahí** | Agente de ventas | Tiene 100+ grupos legacy de WhatsApp en su canal — reto de volumen |
| **Edith** | Agente de ventas | Pocos grupos en su canal |
| **Gamey** | Dev (tú) | Tiene canal "Developer" sin grupos, para sandbox |

### Canales WhatsApp conectados hoy (son 3, NO 4)

1. **Edith** — pocos grupos
2. **Anahí** — 100+ grupos legacy
3. **Developer** (Gamey) — sin grupos, sandbox de pruebas

> Próximamente se sumarán más canales de otros agentes de ventas, que probablemente también traerán grupos. El sistema debe escalar a N canales sin cambios estructurales.

### Gowa (server crítico)

**Gowa** es el **servidor que conecta los canales de WhatsApp con Samurai**. En la tabla `whatsapp_channels.provider` aparece como `'gowa'` o `'evolution'` (Evolution API es la base sobre la que corre Gowa). La integración fue complicada de estabilizar; especialmente:

- **Transcripción de audio de notas de voz** (cubierta en story S4.1 / Epic E4 — ya cerrada).
- **Envío de media en campañas** (cubierta en commit del 25-abr-2026: `feat: campañas a grupos — multi-select con checkboxes + soporte media`).
- **Distinción entre mensajes 1-a-1 vs mensajes de grupo** (fix crítico del weekend, ver abajo).

### 🔒 FIX CRÍTICO DEL FIN DE SEMANA PASADO (24-25 abr) — NO ROMPER

**El bug**:
> Antes del fix, cuando un agente de ventas (Anahí, Edith) escribía un mensaje **dentro de un grupo de WhatsApp donde estaba conectado el canal**, el chatbot Sam tomaba ese mensaje como si fuera un cliente nuevo entrante. Lo procesaba como lead, le mandaba precios, lo metía al pipeline, disparaba Meta CAPI, etc. **Esto era un fallo grave**: el "lead" era literalmente la propia agente de ventas.

**El fix**:
> Está en `evolution-webhook` y posiblemente en `process-samurai-response`. Distingue:
> - Mensajes individuales (`remoteJid` termina en `@s.whatsapp.net` o `@c.us`) → Sam los procesa normalmente.
> - Mensajes en grupos (`remoteJid` termina en `@g.us`) → Sam **NO los procesa ni responde**. Solo se loggean.
>
> Esto costó esfuerzo dejarlo funcionando porque Gowa entrega payloads similares para ambos tipos.

**Implicación para todo este sprint**:
> Cualquier prompt que pase por evolution-webhook, process-samurai-response, analyze-leads, o que toque la lógica de procesamiento de mensajes entrantes **DEBE PRESERVAR este filtro**. Cada story que toca esa zona incluye un **test de regresión obligatorio**: enviar un payload simulando un mensaje en un grupo y verificar que Sam **NO** genera respuesta ni crea/actualiza lead.

### Último commit relevante (25-abr-2026)

```
feat: campañas a grupos — multi-select con checkboxes + soporte media

- Reemplaza Select dropdown por checkboxes para seleccionar múltiples cursos
- Botones para adjuntar imagen, video o audio (sube a Supabase Storage)
- Preview de media adjunto con opción de eliminar
- Edge function send-group-message actualizada para enviar media via GOWA
- Compresión automática de imágenes via Supabase transform API
- Progreso en tiempo real y resultado visual por grupo
```

**Implicación**: la parte de **enviar imagen/video/audio en campañas a grupos** ya quedó funcionando el sábado pasado. La story S14.2 que mando aquí es solo para **extender ese mismo patrón a `MassMessageDialog`** (Difusión Masiva Individual) si aún no lo tiene, y para agregar **variantes anti-ban** (S14.3).

---

## Índice

| # | Bloque | Para qué sirve |
|---|--------|----------------|
| **0** | Bootstrap/onboarding | Pegar al inicio de **cada nueva sesión** de Claude Code |
| **1** | E13.S1 — Schema cache de grupos | Crear tabla `whatsapp_groups_cache` |
| **2** | E13.S2 — Edge function de sync de grupos | Edge function `sync-channel-groups` |
| **3** | E13.S3 — Cron de sync de grupos | pg_cron */30 |
| **4** | E13.S4 — UI catálogo de canales | Página `/channels` |
| **5** | E14.S1 — Verificación post-fix multimedia | Tests anti-regresión del commit 25-abr |
| **6** | E14.S2 — Editor multimedia en MassMessageDialog | Extender patrón existente a Difusión Individual |
| **7** | E14.S3 — Variantes anti-ban | Round-robin hasta 5 variantes |
| **8** | E15.S1 — Edge function sync de miembros | Crea contacts + leads desde grupos |
| **9** | E15.S2 — Cron de sync de miembros | pg_cron */30 |
| **10** | E15.S3 — Protección leads auto-creados | Modificar `process-followups` (MUST-AR-03) |
| **11** | E15.S4 — Autofill de academic_record | Llenar ficha cuando grupo↔curso |
| **12** | E16.S1 — FilterBuilder | Componente de query builder |
| **13** | E16.S2 — `evaluate_segment` RPC | Función Postgres con NOT EXISTS |
| **14** | E16.S3 — Integración filtros | Embebido en `/campaigns` y `/contacts` |
| **15** | E17.S1 — Theme provider + tipografía base | Quitar dark hardcoded + `<ThemeToggle>` + escala tipográfica |
| **16** | E17.S2 — Auditoría WCAG AA + zoom de texto | axe-core + control de tamaño de letra |
| **17** | Smoke tests transversales | Después de TODO, validar el flujo core |

**Plazo del lunes**: bloques 0–7 obligatorios, más **15** (theme + fonts grandes) por petición directa de Geoffrey. Bloques 8–11 (E15) **mejor postergar** porque tocan privacidad y guardrails — Claude Web recomendó hacerlos en staging primero. Bloque 16 (auditoría) puede irse a la semana siguiente.

---

# 🔵 PROMPT 0 — Bootstrap/onboarding

> Pega esto al inicio de cada sesión nueva con Claude Code. Sin esto, Claude Code no carga el contexto de RaiSE ni las reglas críticas.

```
Hola Claude Code, soy Gamey, dev principal de gameygv/samurai.

CONTEXTO DE ENTRADA (informativo):
En una sesión previa, Claude Web (Claude Opus 4.7 en chat.claude.ai) analizó:
- Este repo gameygv/samurai (RaiSE-governed, brownfield).
- El repo hermano gameygv/pos-elephant-bowl (proyecto POS que comparte la
  tabla `contacts`).
- El PDF SAMURAI_Funcionalidades.pdf v2.5.
- Transcripciones VTT de una reunión del 25-abr-2026 con Geoffrey (cliente
  final) y Josué/Pulso Creativo (marketing).
- Las épicas RaiSE existentes E1-E12.
- governance/prd.md, governance/guardrails.md, governance/backlog.md,
  .raise/manifest.yaml.
- Los commits del fin de semana 24-25-abr.

Como resultado produjo un plan de 5 épicas nuevas (E13–E17). Te voy a entregar
una story a la vez para implementar.

═══════════════════════════════════════════════════════════════════════════════
PRIORIDAD CORE INVIOLABLE — LEE Y CONFIRMA QUE LA ENTIENDES
═══════════════════════════════════════════════════════════════════════════════
La razón de existir de Samurai (ver governance/prd.md, requisitos RF-01 a
RF-04) es:

  Capturar datos del cliente en tiempo real desde WhatsApp →
  enviarlos a Meta Conversion API (CAPI) →
  mejorar el ROAS de las campañas de Facebook Ads.

Eso es lo que paga las cuentas. Cualquier cambio que hagas DEBE dejar este
flujo intacto. Específicamente, NO TOQUES estas piezas a menos que la story
te pida explícitamente modificarlas:
  - supabase/functions/evolution-webhook        (recepción de mensajes WhatsApp)
  - supabase/functions/analyze-leads            (extracción de datos en tiempo real)
  - supabase/functions/meta-capi-sender         (envío a Facebook)
  - supabase/functions/process-samurai-response (respuesta del agente Sam)
  - supabase/functions/get-samurai-context      (system prompt de Sam)

Si en cualquier momento detectas que tu cambio puede degradar la
captura→CAPI, DETENTE y avísame antes de continuar. NO improvises.

═══════════════════════════════════════════════════════════════════════════════
INTEGRACIÓN GOWA — REGLA CRÍTICA SOBRE MENSAJES DE GRUPOS
═══════════════════════════════════════════════════════════════════════════════
Gowa es el servidor que conecta los canales de WhatsApp con Samurai
(provider = 'gowa' o 'evolution' en whatsapp_channels). Configurar Gowa fue
complicado, especialmente para:
- Transcripción de notas de voz (cubierta en S4.1 / E4 — ya cerrada).
- Envío de media en campañas (cubierto en commit del 25-abr-2026).

🔒 FIX CRÍTICO DEL WEEKEND PASADO QUE NO PUEDES ROMPER:

Bug original (pre-fix):
  Cuando un agente de ventas (Anahí, Edith) escribía un mensaje DENTRO de un
  grupo de WhatsApp donde estaba conectado el canal, Sam tomaba ese mensaje
  como si fuera un cliente nuevo entrante: lo procesaba como lead, le mandaba
  precios, disparaba Meta CAPI, etc. El "lead" era literalmente la agente
  de ventas. Era un fallo grave.

Fix aplicado el weekend (24-25 abr):
  En evolution-webhook (y posiblemente process-samurai-response) se distingue
  por el remoteJid:
    - @s.whatsapp.net o @c.us  →  mensaje individual, Sam lo procesa.
    - @g.us                    →  mensaje en grupo, Sam NO procesa ni responde.

REGLAS:
1. NO toques esa lógica salvo en stories que lo pidan explícitamente.
2. Si una story tuya pasa por evolution-webhook, process-samurai-response o
   analyze-leads, AÑADE un test de regresión: simula un payload de mensaje
   en grupo (remoteJid termina en @g.us) y verifica que Sam NO crea lead
   ni genera respuesta ni dispara CAPI.
3. Si ves código que parece distinguir grupo/individual y crees que está mal,
   DETENTE y avísame antes de tocarlo.

═══════════════════════════════════════════════════════════════════════════════
CANALES WHATSAPP CONECTADOS (3, no 4 — habrá más)
═══════════════════════════════════════════════════════════════════════════════
Hoy hay 3 canales en producción:
  1. Edith     — agente de ventas, pocos grupos.
  2. Anahí     — agente de ventas, 100+ grupos legacy.
  3. Developer — usado por Gamey para pruebas, sin grupos.

Próximamente se sumarán más canales de otros agentes (probablemente con
muchos grupos también). Cualquier estructura que diseñes debe escalar a N
canales sin cambios estructurales.

═══════════════════════════════════════════════════════════════════════════════
COORDINACIÓN CON EL PROYECTO HERMANO POS
═══════════════════════════════════════════════════════════════════════════════
La tabla `contacts` es COMPARTIDA con gameygv/pos-elephant-bowl. Antes de
tocarla, lee el archivo COORDINACION_SAMURAI.md (está en el repo POS, raíz).
Reglas resumidas:
  - Columnas Samurai: SIN prefijo, SIEMPRE con DEFAULT.
  - Columnas POS: prefijo `pos_*`, NO las toques.
  - Funciones compartidas intocables: get_user_role(), handle_new_user().
  - SELECT explícito (nunca `*`) cuando leas contacts.
  - Migraciones por timestamp YYYYMMDDhhmmss.

═══════════════════════════════════════════════════════════════════════════════
INSTRUCCIONES DE TRABAJO PARA TODA STORY
═══════════════════════════════════════════════════════════════════════════════
1. Ejecuta `/rai-session-start` ahora para cargar contexto RaiSE.

2. Lee y resume (≤30 líneas total) los siguientes archivos antes de tocar nada:
   - CLAUDE.md
   - AI_RULES.md
   - AGENTS.md
   - PROJECT_STATUS.md
   - governance/prd.md
   - governance/guardrails.md
   - governance/backlog.md
   - .raise/manifest.yaml

3. Mapea (sin leer enteros) que existen estos paths:
   - src/App.tsx
   - src/integrations/supabase/client.ts
   - src/pages/Campaigns.tsx, Contacts.tsx, AcademicCatalog.tsx, Settings.tsx
   - src/components/academic/GroupCampaignSection.tsx
   - src/components/contacts/MassMessageDialog.tsx
   - supabase/functions/{evolution-webhook,process-samurai-response,
     send-message-v3,send-group-message,list-whatsapp-groups,
     process-campaign-queue,analyze-leads,process-followups,meta-capi-sender,
     get-samurai-context}/index.ts

4. Confirma que los siguientes elementos ya existen (si NO existen, repórtalo
   antes de empezar cualquier story):
   - Tabla `contact_whatsapp_groups` (creada en migración del 22-abr-2026,
     E12/S12.1).
   - Columnas `courses.whatsapp_group_jid` y `courses.whatsapp_channel_id`.
   - app_config con keys: `scheduled_campaigns`, `global_tags`,
     `agent_tags_<user_id>`.
   - Tabla `whatsapp_channels` con columnas: id, name, provider, api_key,
     instance, active.

5. Lee COORDINACION_SAMURAI.md (raíz del repo gameygv/pos-elephant-bowl).
   Confírmame que entendiste qué columnas son tuyas en `contacts` y cuáles
   del POS.

6. Confirma el patrón actual de cron (lee 1 archivo de muestra):
   SETUP_DAILY_SYNC.sql o SETUP_FOLLOWUP_CRON.sql en la raíz.

7. Ubica el commit más reciente sobre campañas a grupos
   (`git log -1 --pretty=fuller`). Confirma que ves el feat del 25-abr-2026
   sobre multi-select + media via GOWA.

═══════════════════════════════════════════════════════════════════════════════
REGLAS GENERALES DE COMMITS Y BRANCHES
═══════════════════════════════════════════════════════════════════════════════
- Branch model: `story/s{N}.{M}/{name}` desde main, merge a main al cierre.
- Commits granulares por tarea, no solo al final del story.
- TDD obligatorio en todo cambio funcional (CLAUDE.md).
- Cada migración SQL debe venir con su archivo de rollback en el mismo commit:
  supabase/migrations/<timestamp>_<n>.sql           (forward)
  supabase/rollbacks/<timestamp>_<n>_rollback.sql   (revert)
- Antes de aplicar a producción siempre: `supabase db diff --linked` para
  verificar.
- Cero commits sin: `npx vitest run`, `npx eslint .`, `npx tsc --noEmit`
  pasando.

═══════════════════════════════════════════════════════════════════════════════
ACCIÓN
═══════════════════════════════════════════════════════════════════════════════
Reporta hallazgos en ≤30 líneas con paths exactos. NO toques código todavía.
Espera mi OK explícito antes de avanzar a la primera story.
```

---

# 🔴 PROMPT 1 — Story S13.1: Schema cache de grupos de WhatsApp

```
ROL: Estás en la sesión de Claude Code para gameygv/samurai.

CONTEXTO DE ENTRADA:
Implementamos el plan generado por Claude Web. Esta es la primera story
(S13.1) de la épica E13 (WhatsApp Channels Catalog & Sync). El objetivo de
la épica es eliminar las consultas en runtime a Gowa para listar grupos,
manteniendo un caché local que se refresca cada 30 minutos. Hoy
`list-whatsapp-groups` se llama por demanda en el frontend y eso provoca
latencias de 1-2 minutos y fallos esporádicos cuando Anahí (la agente de
ventas con 100+ grupos legacy) abre la sección. Al haber sólo 3 canales
hoy (Edith, Anahí, Developer) la primera sync será rápida; debemos diseñar
para que escale a N canales cuando se sumen más agentes.

ESTA STORY: solo el schema. Nada de UI ni edge functions todavía.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Esta story crea una tabla NUEVA (`whatsapp_groups_cache`). NO toca ninguna
tabla existente. NO debe afectar el flujo captura→CAPI→campañas. Si tu plan
de implementación toca por error tablas como `leads`, `contacts`,
`conversaciones`, `meta_capi_events` o `whatsapp_channels`, DETENTE y avísame.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito una tabla `whatsapp_groups_cache` para guardar el
catálogo local de grupos por canal con sus metadatos, separada de la
membresía `contact_whatsapp_groups` (que ya existe desde E12).

Diferencia conceptual importante:
- `contact_whatsapp_groups` (existente): junction contacto↔grupo. 1 fila por
  (contacto, grupo). Es membresía.
- `whatsapp_groups_cache` (nueva): tabla maestra de grupos. 1 fila por grupo.
  Tiene metadata del grupo en sí (jid, name, member_count, course_id, etc.).

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Crear migración FORWARD:
   `supabase/migrations/20260427120000_create_whatsapp_groups_cache.sql`

   --------------------------------------------------------------------------
   -- E13/S13.1: Tabla maestra de grupos de WhatsApp por canal.
   -- Separa metadata del grupo (esta tabla) de membresía
   -- (contact_whatsapp_groups).
   
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   
   CREATE TABLE IF NOT EXISTS public.whatsapp_groups_cache (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
     jid TEXT NOT NULL,
     name TEXT NOT NULL,
     member_count INT NOT NULL DEFAULT 0,
     course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
     is_active BOOLEAN NOT NULL DEFAULT TRUE,
     first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (channel_id, jid)
   );
   
   CREATE INDEX IF NOT EXISTS idx_wgc_channel ON public.whatsapp_groups_cache(channel_id);
   CREATE INDEX IF NOT EXISTS idx_wgc_course ON public.whatsapp_groups_cache(course_id);
   CREATE INDEX IF NOT EXISTS idx_wgc_name_trgm ON public.whatsapp_groups_cache USING gin (name gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS idx_wgc_active_synced ON public.whatsapp_groups_cache(is_active, last_synced_at);
   
   -- RLS (MUST-SE-02)
   ALTER TABLE public.whatsapp_groups_cache ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "wgc_authenticated_read"
     ON public.whatsapp_groups_cache FOR SELECT
     TO authenticated USING (true);
   
   CREATE POLICY "wgc_authenticated_write"
     ON public.whatsapp_groups_cache FOR ALL
     TO authenticated USING (true) WITH CHECK (true);
   
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups_cache TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups_cache TO service_role;
   
   -- Trigger updated_at: verifica primero que la función set_updated_at()
   -- existe. Si NO existe, créala en este mismo archivo (busca con grep antes):
   --   CREATE OR REPLACE FUNCTION public.set_updated_at()
   --   RETURNS TRIGGER AS $$
   --   BEGIN NEW.updated_at = now(); RETURN NEW; END;
   --   $$ LANGUAGE plpgsql;
   CREATE TRIGGER wgc_set_updated_at
     BEFORE UPDATE ON public.whatsapp_groups_cache
     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
   
   -- Trigger: cuando se cambia courses.whatsapp_group_jid o
   -- whatsapp_channel_id, propagar el course_id al cache.
   CREATE OR REPLACE FUNCTION public.sync_course_to_wgc()
   RETURNS TRIGGER AS $$
   BEGIN
     IF (TG_OP = 'UPDATE') AND (
        OLD.whatsapp_group_jid IS DISTINCT FROM NEW.whatsapp_group_jid OR
        OLD.whatsapp_channel_id IS DISTINCT FROM NEW.whatsapp_channel_id
     ) THEN
       UPDATE public.whatsapp_groups_cache
         SET course_id = NULL, updated_at = now()
         WHERE course_id = OLD.id;
     END IF;
     
     IF NEW.whatsapp_group_jid IS NOT NULL AND NEW.whatsapp_channel_id IS NOT NULL THEN
       UPDATE public.whatsapp_groups_cache
         SET course_id = NEW.id, updated_at = now()
         WHERE channel_id = NEW.whatsapp_channel_id
           AND jid = NEW.whatsapp_group_jid;
     END IF;
     
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   DROP TRIGGER IF EXISTS courses_sync_to_wgc ON public.courses;
   CREATE TRIGGER courses_sync_to_wgc
     AFTER INSERT OR UPDATE OF whatsapp_group_jid, whatsapp_channel_id ON public.courses
     FOR EACH ROW EXECUTE FUNCTION public.sync_course_to_wgc();
   --------------------------------------------------------------------------

B) Crear migración ROLLBACK paralela:
   `supabase/rollbacks/20260427120000_create_whatsapp_groups_cache_rollback.sql`
   --------------------------------------------------------------------------
   DROP TRIGGER IF EXISTS courses_sync_to_wgc ON public.courses;
   DROP FUNCTION IF EXISTS public.sync_course_to_wgc();
   DROP TRIGGER IF EXISTS wgc_set_updated_at ON public.whatsapp_groups_cache;
   DROP TABLE IF EXISTS public.whatsapp_groups_cache CASCADE;
   --------------------------------------------------------------------------

C) Regenerar tipos TS:
   - Ejecuta:
     `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`
   - Confirma que aparece `whatsapp_groups_cache: { Row, Insert, Update }`
     en types.ts.
   - NO modifiques types.ts a mano.

D) Test SQL en `supabase/tests/whatsapp_groups_cache.test.sql`:
   - Crea un canal y un curso de prueba.
   - Inserta 2 grupos para ese canal — verifica que ambos quedan.
   - Inserta un duplicado (mismo channel_id, mismo jid) — debe FALLAR por
     UNIQUE.
   - UPDATE en courses.whatsapp_group_jid → verifica que cache.course_id se
     actualiza.
   - UPDATE en courses.whatsapp_group_jid (a otro grupo) → verifica que el
     cache.course_id del grupo anterior se setea NULL y el nuevo se asigna.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `supabase db push` corre limpio en local.
- Migración aparece en supabase_migrations.schema_migrations tras push.
- `npx tsc --noEmit` pasa con types.ts regenerado.
- Test SQL pasa.
- Commit: `feat(E13.S1): add whatsapp_groups_cache table with course sync`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK SI SE NECESITA
═══════════════════════════════════════════════════════════════════════════════
1. Aplicar el archivo de rollback con
   `supabase db query --linked --file supabase/rollbacks/20260427120000_*.sql`
2. Verificar que la tabla NO existe:
   `\dt whatsapp_groups_cache` debe retornar 0 rows.
3. Borrar el branch y reportar el error antes de reintentar.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO modificar `contact_whatsapp_groups` ni su esquema.
- NO hacer ALTER TABLE contacts (es compartida con POS).
- NO hardcodear UUIDs ni paths absolutos.
- NO duplicar `set_updated_at()` si ya existe (haz grep primero en
  migrations/).

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Confirma que entiendes la prioridad core y la regla de mensajes en grupos.
2. Verifica que `set_updated_at()` ya existe (grep en migrations/ por
   `set_updated_at`). Si no existe, añádela en el FORWARD.
3. Verifica que `pg_trgm` no está ya habilitado (es idempotente con
   IF NOT EXISTS, pero confirma).
4. Presenta el contenido FINAL de los 2 archivos SQL y el comando exacto para
   regenerar tipos.
5. Espera mi OK explícito antes de hacer `supabase db push`.
```

---

# 🔴 PROMPT 2 — Story S13.2: Edge function `sync-channel-groups`

```
ROL: Continúas en la sesión de Claude Code para gameygv/samurai.
DEPENDS ON: S13.1 ya cerrado (tabla whatsapp_groups_cache existe).

CONTEXTO DE ENTRADA:
Estamos implementando el plan de Claude Web. Esta es la story S13.2 de E13.
El esquema ya está. Ahora viene la edge function que llena el caché.
Recuerda: Gowa puede tardar y fallar; el diseño debe tolerarlo.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Captura→CAPI no se toca. Esta edge function es independiente del flujo
conversacional. NO debe llamar a evolution-webhook, analyze-leads, ni
meta-capi-sender. Si tu diseño los toca, DETENTE.

REGLA DE MENSAJES EN GRUPOS: esta story SOLO lista grupos (metadata), NO
recibe ni procesa mensajes. No interactúa con la lógica del fix del weekend.

COORDINACIÓN POS: esta story no toca `contacts`, así que no hay riesgo
POS aquí.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito una Edge Function que:
1. Recorra los canales de WhatsApp activos (hoy 3: Edith, Anahí, Developer;
   en el futuro más).
2. Por cada uno, llame a la Edge Function existente `list-whatsapp-groups`
   para obtener los grupos vivos.
3. Haga UPSERT en `whatsapp_groups_cache` con los metadatos.
4. Marque como `is_active = false` los grupos que están en cache pero ya no
   aparecen en la respuesta de Gowa (stale).
5. Es idempotente y tiene un lock global para que no haya runs paralelos.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Investigación PREVIA al código (haz esto y reporta antes de codear):
   1. Lee `supabase/functions/list-whatsapp-groups/index.ts` y reporta:
      - ¿Qué inputs acepta? (¿channel_id, instance, etc.?)
      - ¿Qué retorna? (¿array de objetos con jid, name, members, etc.?)
      - ¿Tiene timeout configurado?
      - ¿Cómo autentica contra Gowa?
   2. Lee 1 edge function existente como referencia de estilo, por ejemplo
      `supabase/functions/auto-sync-knowledge/index.ts`. Confirma:
      - Imports estándar (Deno, supabase-js, _shared/cors).
      - Manejo de OPTIONS para CORS.
      - Cliente Supabase con SUPABASE_SERVICE_ROLE_KEY.

B) Crear: `supabase/functions/sync-channel-groups/index.ts`
   Funcionalidad:
   1. CORS via _shared/cors.ts (SHOULD-AR-04).
   2. POST /functions/v1/sync-channel-groups con body opcional:
      { channel_id?: string, force?: boolean }
      - Sin body o body vacío → procesa TODOS los canales activos.
      - Con channel_id → procesa solo ese canal (modo manual desde UI en
        S13.4).
   3. Lock global con pg_try_advisory_lock(<int_key>) (clave fija, ej.
      47131301).
      - Si lock no se adquiere y `force !== true` → respond 409 con
        { error: 'sync_already_running' }.
      - Liberar con pg_advisory_unlock al final (try/finally).
   4. Por cada canal a procesar (SECUENCIAL, no paralelo):
      a. Invocar `list-whatsapp-groups` vía supabase.functions.invoke o fetch
         interno con la URL pública. Timeout 45s.
      b. Por cada grupo retornado:
         UPSERT en whatsapp_groups_cache por (channel_id, jid) con:
           - INSERT: name, member_count, first_seen_at=now(),
                     last_synced_at=now(), is_active=true.
           - UPDATE: name, member_count, last_synced_at=now(),
                     is_active=true.
                     CRÍTICO: NO sobrescribir course_id (puede haberlo
                     asignado un humano manualmente en el form de cursos).
      c. Después del lote: marcar como is_active=false los grupos en cache
         que NO vinieron en esta respuesta:
           UPDATE whatsapp_groups_cache
             SET is_active = false, updated_at = now()
             WHERE channel_id = $1
               AND last_synced_at < $now_at_start_of_run
               AND is_active = true;
      d. Sleep 1000 ms entre canales (rate limit Gowa). Con 3 canales hoy
         son ~3-4 segundos extra; no es crítico.
   5. Logging: INSERT en `activity_logs` con metadata:
      { action: 'sync_channel_groups', channels_synced, groups_total,
        groups_marked_stale, errors[] }
   6. Manejo de errores por canal: si un canal falla, los demás siguen.
      Cada error se acumula en errors[] del response.
   7. Response JSON 200:
      {
        ok: true,
        ran_at: ISO,
        channels_processed: number,
        channels_failed: number,
        groups_upserted: number,
        groups_marked_stale: number,
        errors: [{ channel_id, message }]
      }

C) Tests:
   1. Vitest unitario en
      `supabase/functions/sync-channel-groups/__tests__/`:
      - Mock de supabase-js.
      - Test 1: 2 canales, 3 grupos cada uno → 6 upserts.
      - Test 2: si un canal falla, el otro sigue.
      - Test 3: lock ya tomado → respond 409 sin tocar BD.
   2. Documentar contrato I/O en
      `governance/architecture/edge-functions/sync-channel-groups.md`.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `supabase functions deploy sync-channel-groups` corre limpio.
- `npx vitest run` pasa.
- `npx eslint supabase/functions/sync-channel-groups/` sin warnings.
- `npx tsc --noEmit` pasa.
- Test manual ejecutado contra un canal de prueba (preferentemente
  el canal Developer, no producción aún).
- Commit: `feat(E13.S2): add sync-channel-groups edge function`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- Si la function se despliega rota:
  `supabase functions delete sync-channel-groups`
- Si genera datos basura en whatsapp_groups_cache:
  `DELETE FROM whatsapp_groups_cache WHERE last_synced_at > '<deploy_ts>'`
  (NO borrar todos, solo los del periodo del bug)

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO crear cliente Gowa nuevo: SIEMPRE pasar por `list-whatsapp-groups`.
- NO procesar canales en paralelo (riesgo de rate limit Gowa).
- NO sobrescribir course_id en UPDATE (humanos pueden haberlo asignado
  manual).
- NO hardcodear el SERVICE_ROLE_KEY: usar
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY').
- NO marcar como is_active=false grupos del canal SI el canal entero falló
  (eso sería falso negativo). Solo marcar stale si la respuesta del canal
  fue exitosa.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Reporta los hallazgos del paso A (investigación de list-whatsapp-groups).
2. Presenta el árbol de archivos a crear y el flujo en pseudocódigo.
3. Si list-whatsapp-groups tiene un contrato distinto al esperado, DETENTE
   y avísame antes de seguir.
4. Espera mi OK antes de codear.
```

---

# 🔴 PROMPT 3 — Story S13.3: Cron pg_cron para sync de grupos

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S13.2 ya cerrado y desplegado.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Esta story añade un cron NUEVO. NO toca crons existentes (analyze-leads,
process-followups, scrape-main-website, process-credit-reminders). Si tu
plan los modifica, DETENTE.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito programar un cron que dispare `sync-channel-groups`
cada 30 minutos automáticamente.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Investigación PREVIA:
   1. Lee SETUP_DAILY_SYNC.sql (raíz del repo) — es el patrón canónico.
   2. Lee SETUP_FOLLOWUP_CRON.sql y SETUP_LEAD_REMINDERS_CRON.sql — confirma
      que usan el mismo patrón (pg_cron + pg_net.http_post + Bearer JWT).
   3. Lee ENABLE_CRONS.sql para ver cómo están registrados los crons activos.
   4. Confirma cuál es la convención exacta del project_ref Supabase
      (debería ser `giwoovmvwlddaizoriz`).

B) Crear migración FORWARD:
   `supabase/migrations/20260427120100_setup_channel_groups_cron.sql`

   --------------------------------------------------------------------------
   -- E13/S13.3: Cron que dispara sync-channel-groups cada 30 min.
   -- pg_cron y pg_net ya están habilitados (ver ENABLE_CRONS.sql).
   
   -- Idempotente: eliminar el job si ya existe
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-channel-groups-30min') THEN
       PERFORM cron.unschedule('sync-channel-groups-30min');
     END IF;
   END $$;
   
   SELECT cron.schedule(
     'sync-channel-groups-30min',
     '*/30 * * * *',
     $cron$
     SELECT net.http_post(
       url := 'https://giwoovmvwlddaizoriz.supabase.co/functions/v1/sync-channel-groups',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.cron_service_role_jwt', true)
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     );
     $cron$
   );
   --------------------------------------------------------------------------

C) Migración ROLLBACK:
   `supabase/rollbacks/20260427120100_setup_channel_groups_cron_rollback.sql`
   --------------------------------------------------------------------------
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-channel-groups-30min') THEN
       PERFORM cron.unschedule('sync-channel-groups-30min');
     END IF;
   END $$;
   --------------------------------------------------------------------------

D) Configuración del JWT (NO en SQL versionado):
   - Documenta en `governance/setup/cron-secrets.md` que se requiere ejecutar
     UNA vez en Supabase (NO en migración):
     `ALTER DATABASE postgres SET app.cron_service_role_jwt = '<service_role_jwt>';`
   - Importante: ese setting se persiste a nivel de BD pero NO se versiona.
   - Si ya hay otros crons funcionando con el mismo patrón, verifica si ya
     existe `app.cron_service_role_jwt` o si los otros usan otra convención.
     SI USAN OTRA: usa la MISMA convención.

E) Verificación post-deploy:
   - `SELECT * FROM cron.job WHERE jobname = 'sync-channel-groups-30min';`
     → debe retornar 1 row.
   - Esperar 1-2 ciclos (60 min) y revisar:
     `SELECT * FROM cron.job_run_details
      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-channel-groups-30min')
      ORDER BY start_time DESC LIMIT 5;`
     → status='succeeded' en runs recientes.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `supabase db push` aplica la migración.
- `SELECT * FROM cron.job WHERE jobname = 'sync-channel-groups-30min';` → 1 row.
- Una ejecución manual de `SELECT cron.schedule(...)` retorna sin error.
- Commit: `feat(E13.S3): schedule sync-channel-groups every 30 minutes`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- Aplicar el archivo de rollback:
  `supabase db query --linked --file supabase/rollbacks/20260427120100_*.sql`
- Verificar que el job ya no existe:
  `SELECT count(*) FROM cron.job WHERE jobname='sync-channel-groups-30min';` → 0.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO hardcodear el JWT en el SQL versionado.
- NO usar intervalos < 5 min (saturaría a Gowa, ban riesgo).
- NO duplicar pg_cron/pg_net extensions (ya habilitados).
- NO modificar otros jobs existentes.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Reporta los hallazgos del paso A (patrón exacto de los crons existentes).
2. Confirma cuál es la convención del JWT (variable de DB, app_config, etc.).
3. Presenta los 2 archivos SQL finales.
4. Espera mi OK.
```

---

# 🔴 PROMPT 4 — Story S13.4: UI catálogo de canales

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S13.1, S13.2, S13.3 cerrados. La tabla y el cron ya pueblan
el caché.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Esta story es solo frontend. NO toca el flujo conversacional. Solo añade una
ruta nueva `/channels`. Si tu plan modifica `/inbox`, `/leads` o componentes
core de Sam, DETENTE.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como Josué, necesito una página `/channels` que muestre los 3 canales
de WhatsApp con sus grupos asociados:
  1. Edith (pocos grupos)
  2. Anahí (100+ grupos legacy)
  3. Developer (Gamey, sin grupos, sandbox de pruebas)

Próximamente se sumarán más canales de otros agentes; el diseño debe
ya soportar N canales sin cambios estructurales.

La página debe tener búsqueda, vista cuadrícula/lista, y un botón
"Refrescar canal" cuando la última sync sea muy vieja. La data viene del
caché local (whatsapp_groups_cache), NO de Gowa en runtime.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Ruta:
   - Registrar `/channels` en `src/App.tsx` (regla SHOULD-CQ-05).
   - Guard de rol: solo manager+, admin, dev. Si sales_agent intenta entrar →
     redirect a `/` con toast "Esta sección requiere rol manager o superior".
   - Item nuevo en el sidebar (busca el componente del sidebar; suele estar
     en src/components/Layout.tsx o similar). Texto: "Canales y Grupos",
     ícono `lucide-react/Network` o `MessagesSquare`.

B) Componentes nuevos en `src/components/channels/` (todos <100 líneas):
   - `ChannelsCatalog.tsx` (orquestador, debería ser
     `src/pages/ChannelsCatalog.tsx`).
   - `ChannelCard.tsx`: 1 canal con metadata + nº de grupos + última sync.
   - `ChannelGroupsList.tsx`: lista grupos del canal con search/toggle vista.
   - `SyncBanner.tsx`: muestra "Última sync hace X min" + botón "Refrescar".
   - `GroupRow.tsx`: 1 fila/card de grupo con name, jid, member_count, course
     vinculado (link al curso si tiene), last_synced_at.

C) Hook personalizado en `src/hooks/useChannelsCatalog.ts`:
   - useChannelsCatalog: lista canales con conteo y sync agregado.
   - useChannelGroups(channelId): lista grupos de un canal.
   - useRefreshChannel(channelId): mutation para POST a sync-channel-groups.
   - TanStack Query con queryKey ['channels-catalog'] y
     ['channel-groups', channelId].
   - SELECT explícito (no `*`).
   - Refetch al refrescar.

D) Query SQL para useChannelsCatalog:
   ```sql
   SELECT
     c.id, c.name, c.provider, c.active,
     COUNT(g.id) FILTER (WHERE g.is_active = true) AS group_count,
     MAX(g.last_synced_at) AS last_synced_at
   FROM whatsapp_channels c
   LEFT JOIN whatsapp_groups_cache g ON g.channel_id = c.id
   WHERE c.active = true
   GROUP BY c.id, c.name, c.provider, c.active
   ORDER BY c.name;
   ```
   - Considera crearla como una vista:
     `CREATE OR REPLACE VIEW v_channels_with_group_stats AS ...`
     en una migración nueva `20260427120200_create_channels_view.sql` con su
     rollback.

E) UI:
   - Vista por defecto: grid de tarjetas de canal (1 por canal).
   - Click en una tarjeta → expande mostrando lista de grupos.
   - Buscador de grupos (Input shadcn con icono Search) — filtra client-side
     por name (incluye fuzzy con normalización lowercase + sin acentos).
   - Toggle vista cuadrícula/lista (ToggleGroup shadcn).
   - Si `last_synced_at` < 60 min → no banner.
   - Si `last_synced_at` >= 60 min o NULL → banner ámbar (Alert shadcn) con
     "Última sync hace X min" + botón "Refrescar canal".
   - Cada grupo muestra: name (truncate max 50 chars), jid en mono-font 10px,
     member_count con icono Users, badge "→ Curso: <course_name>" si
     course_id no es NULL, last_synced_at relativo ("hace 5 min").
   - Stale: grupos con is_active=false al final con badge gris
     "Inactivo desde hace X días".

F) Acción "Refrescar canal":
   - useMutation que llama POST a sync-channel-groups con { channel_id }.
   - Spinner local en la tarjeta del canal mientras corre.
   - Tras éxito: invalidate ['channels-catalog'] y
     ['channel-groups', channelId].
   - Tras error 409: toast "Sync ya en curso, intenta en unos segundos".
   - Tras error 5xx: toast con el mensaje del error.

G) Tests:
   - Vitest del hook useChannelsCatalog (mock supabase-js).
   - Test del SyncBanner: render distinto según last_synced_at.
   - Test Playwright e2e en `e2e/channels.spec.ts`:
     1. Login como manager.
     2. Click en "Canales y Grupos" del sidebar.
     3. Render de los 3 canales esperados (Edith, Anahí, Developer).
     4. El canal Anahí muestra >100 grupos (mocked).
     5. El canal Developer muestra 0 grupos.
     6. Buscar "Anahí" → solo aparece su tarjeta.
     7. Click "Refrescar canal" en Edith → spinner y luego refresh OK.
     8. Login como sales_agent → no ve el item del sidebar.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `npx vitest run`, `npx eslint .`, `npx tsc --noEmit` pasan.
- Test e2e Playwright pasa.
- Cobertura del nuevo código ≥80%.
- Cada componente nuevo es <100 líneas (regla MUST-CQ-02).
- Commits: granulares (al menos: hook, view SQL, components, e2e tests).

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- Para el código frontend: `git revert <commit>` por cada commit.
- Para la vista SQL: aplicar el archivo de rollback.
- La ruta /channels deja de aparecer al revertir el cambio en src/App.tsx.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO consultar a Gowa desde el frontend (siempre pasar por
  sync-channel-groups).
- NO cambiar `list-whatsapp-groups` (es la fuente, no la cara al usuario).
- NO bloquear la UI durante "Refrescar": spinner localizado al canal.
- NO importar Supabase con nuevo cliente: usa
  src/integrations/supabase/client.ts.
- NO usar SELECT * cuando leas contacts (regla POS).

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Identifica el componente actual del sidebar y dime su path.
2. Identifica cómo se hace el guard de rol en otras rutas (e.g. /brain) y
   replica.
3. Presenta el árbol de archivos a crear.
4. Espera mi OK.
```

---

# 🔴 PROMPT 5 — Story S14.1: Verificación post-fix multimedia (anti-regresión)

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: ninguno (esta story es verificación + tests anti-regresión).

CONTEXTO DE ENTRADA:
El **commit del 25-abr-2026** introdujo soporte multimedia en campañas a
grupos:
  "feat: campañas a grupos — multi-select con checkboxes + soporte media.
   Edge function send-group-message actualizada para enviar media via GOWA.
   Compresión automática de imágenes via Supabase transform API"

Esa pieza ya está funcionando. Esta story tiene dos objetivos:
  1. Verificar que TODOS los caminos de envío con media siguen funcionando
     post-fix (grupo directo + grupo de curso).
  2. Crear tests de regresión para que el bug NO vuelva a aparecer si se
     refactoriza algo en el futuro.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Esta story es 100% pruebas + verificación. NO modifica producción salvo
para añadir tests al árbol.

REGLA DEL FIX DEL WEEKEND: las pruebas que escribas en esta story NO deben
disparar evolution-webhook ni process-samurai-response. Son pruebas del
canal OUT-bound (campañas), no del IN-bound (chat).

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como dev, necesito tests que cubran TODOS los flujos de envío con media en
campañas, para garantizar que ningún cambio futuro vuelva a romper la
funcionalidad recién agregada (commit 25-abr) y para identificar si quedó
algún borde sin cubrir.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Investigación con git y código:
   1. `git show HEAD --stat` y revisar EXACTAMENTE qué archivos cambió el
      commit del 25-abr.
   2. `git log --oneline -5 -- src/components/academic/GroupCampaignSection.tsx`
   3. `git log --oneline -5 -- src/components/contacts/MassMessageDialog.tsx`
   4. `git log --oneline -5 -- supabase/functions/send-group-message/`
   5. `git log --oneline -5 -- supabase/functions/send-message-v3/`
   6. `git log --oneline -5 -- supabase/functions/process-campaign-queue/`
   7. Reporta:
      - ¿GroupCampaignSection ya soporta imagen + video + audio post-fix?
      - ¿MassMessageDialog (Difusión Masiva Individual) lo soporta también o
        solo texto?
      - ¿process-campaign-queue ramifica correctamente en media vs texto?
      - ¿send-group-message envía via GOWA correctamente?
   Notar: si MassMessageDialog NO tiene aún el soporte multimedia, eso es
   trabajo de S14.2.

B) Tests anti-regresión en `src/components/__tests__/`:
   1. `campaign-direct-group-image.test.ts`:
      - Arma payload de campaña a grupo directo (sin curso) con imagen.
      - Verifica que el body enviado a process-campaign-queue tiene
        media_url y media_type='image'.
      - Verifica que send-group-message es invocado con esos campos.
   2. `campaign-course-group-image.test.ts`:
      - Mismo, pero con grupo vinculado a curso.
   3. `campaign-direct-group-video.test.ts`: video MP4.
   4. `campaign-course-group-audio.test.ts`: audio OGG.
   5. `campaign-mass-individual-image.test.ts`:
      - Si ya hay soporte multimedia → verifica que pasa.
      - Si NO → marca como `it.skip()` con TODO referenciando S14.2.

C) Si encuentras un caso roto (algo que el commit del 25-abr no cubrió):
   - NO lo arregles aquí. DETENTE y avísame para que decida si va en este
     story (excepción) o se mueve a S14.2.

D) Documenta hallazgos en
   `governance/audits/2026-04-campaigns-multimedia-coverage.md`:
   - Tabla con todos los flujos × tipos de media × estado (✅ cubierto / ❌ falta).
   - Nivel de cobertura final ofrecido por estos tests.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- Todos los tests añadidos pasan en VERDE (los que pueden, los demás van
  con `.skip()` referenciando S14.2).
- Documento de cobertura committed en governance/audits/.
- ZERO cambios de código de producción (solo tests).
- Commit: `test(E14.S1): add anti-regression coverage for multimedia campaigns`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- `git revert` de los commits → solo se eliminan los tests.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO arreglar nada en este story; solo cubrir con tests.
- NO disparar de verdad mensajes a Gowa: usar mocks.
- NO mezclar test de in-bound (chat→Sam) con out-bound (campañas).

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Confirma que entiendes que esta story SOLO añade tests.
2. Reporta los hallazgos del paso A.
3. Presenta el árbol de tests a crear.
4. Espera mi OK.
```

---

# 🔴 PROMPT 6 — Story S14.2: Editor multimedia en MassMessageDialog (Difusión Masiva Individual)

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S14.1 cerrado (ya sabemos qué falta cubrir).

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Esta story modifica el editor de Difusión Masiva Individual. NO toca el
flujo Sam (chat→IA→CAPI). Si tu fix afecta a `process-samurai-response` o
`evolution-webhook`, DETENTE.

REGLA DEL FIX DEL WEEKEND: esta story envía mensajes individuales (uno
por destinatario), por chat 1-a-1. NO envía a grupos. Eso ya lo hace
GroupCampaignSection. Por construcción no toca la regla de mensajes en grupos.

COORDINACIÓN POS: si tocas `media_assets`, no toca a POS. Si por algo
modificas `contacts` para algo, sigue las reglas POS.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como Josué, necesito que el editor de Difusión Masiva Individual
(MassMessageDialog) soporte imagen, video y audio, igual que ya lo hace el
editor de campañas a grupos (commit del 25-abr). Esto cubre el caso de
mandar mensajes individuales a leads filtrados (no a grupos).

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Lectura PREVIA:
   1. Lee `src/components/contacts/MassMessageDialog.tsx` y reporta:
      - ¿Tiene ya algún soporte de multimedia o solo texto?
      - ¿Cuál es el componente que sube archivos en GroupCampaignSection?
        Idealmente reusarlo.
   2. Lee `src/components/academic/GroupCampaignSection.tsx`:
      - Identifica el sub-componente del MediaUploader.
      - Identifica cómo se construye el payload con imagen/video/audio.
   3. Reporta si hay un hook compartido o si la lógica está duplicada.

B) Refactor + extensión:
   1. Si la lógica de multimedia está dentro de GroupCampaignSection sin ser
      reutilizable, extraer:
      - Componente: `src/components/campaigns/MediaUploader.tsx` (<100 líneas).
      - Componente: `src/components/campaigns/WhatsAppPreview.tsx` (<100 líneas).
      - Componente: `src/components/campaigns/FormatToolbar.tsx` (<100 líneas).
      - Hook: `src/hooks/useCampaignSubmit.ts` (compartido por ambos
        editores).
   2. Reemplaza el código duplicado de GroupCampaignSection con los nuevos
      componentes (debe seguir funcionando idéntico).
   3. Integra los componentes en MassMessageDialog (AÑADIR multimedia, sin
      romper el envío de solo texto que ya existe).

C) Validación con Zod en MediaUploader:
   - imagen: image/png, image/jpeg, image/webp; ≤5MB.
   - video: video/mp4; ≤16MB; duración ≤120s (validar con metadata via
     URL.createObjectURL + <video>.duration).
   - audio: audio/mpeg, audio/ogg, audio/aac; ≤16MB; duración ≤300s.

D) Subida a Storage:
   - Bucket existente 'media' (ya usado por el commit del 25-abr).
   - Path: `campaigns/{user_id}/{timestamp}_{slug}.{ext}`.
   - Confirma compresión automática vía Supabase transform API si aplica
     (lo hace ya el commit del 25-abr para imagen).

E) Estructura del payload en el JSON guardado:
   - Si MassMessageDialog ya guarda en app_config.scheduled_campaigns
     (igual que GroupCampaignSection), debe seguir el MISMO schema:
     ```json
     {
       "id": "...",
       "name": "...",
       "scheduledAt": "ISO",
       "status": "scheduled|processing|completed",
       "contacts": [...],
       "message": "<solo texto, opcional>",
       "media": {                                  // si hay
         "url": "https://.../signed",
         "type": "image|video|audio",
         "mime": "image/jpeg",
         "size_bytes": 1234567
       },
       "caption": "<texto con formato WA, si hay media>"
     }
     ```
   - Backwards compat: si NO hay `media`, usar `message` como hoy.

F) Wiring en envío:
   - process-campaign-queue debería ya soportar media tras el commit del
     25-abr. Verifica que MassMessageDialog NO requiera modificar ese
     edge function.
   - Si requiere ajuste mínimo (e.g. para Difusión Individual a 1-a-1 con
     send-message-v3), añadir el branch faltante.

G) Tests:
   - Los tests `.skip()` de S14.1 ahora deben pasar en verde.
   - Nuevo: campaña Difusión Individual con video MP4 a 5 contactos → llega.
   - Nuevo: campaña Difusión Individual con audio OGG → llega.
   - Validación: PNG de 6MB es rechazado en frontend con mensaje claro.
   - e2e Playwright en `e2e/mass-individual-multimedia.spec.ts`:
     1. Login como manager.
     2. Ir a /contacts, filtrar 3 contactos, click "Difusión a 3 contactos".
     3. Adjuntar imagen + caption.
     4. Vista previa muestra burbuja WhatsApp con la imagen.
     5. Programar para 1 min en el futuro.
     6. Esperar a que el cron lo procese.
     7. Verificar status='completed'.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `npx vitest run`, `npx eslint .`, `npx tsc --noEmit` pasan.
- Tests `.skip()` de S14.1 ahora pasan.
- e2e Playwright pasa.
- GroupCampaignSection sigue funcionando idéntico al commit del 25-abr
  (regresión cero).
- Cada componente nuevo <100 líneas.
- Commits granulares: 1 por componente extraído + 1 por integración +
  1 por tests.

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- `git revert` los commits del editor (frontend) → vuelve al estado
  post-commit del 25-abr.
- El cambio del JSON `scheduled_campaigns` es backwards-compatible.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO romper backwards compat con campañas ya programadas (sin field media).
- NO subir el archivo a Storage hasta que el user dé "Programar/Enviar".
- NO duplicar lógica entre GroupCampaignSection y MassMessageDialog: extraer
  useCampaignSubmit y los sub-componentes.
- NO usar nuevo cliente Supabase: src/integrations/supabase/client.ts.
- NO meter el caption como `message` cuando hay media (rompería el branch
  del edge function).

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Reporta hallazgos del paso A.
2. Presenta el plan de archivos a crear y a modificar, con líneas exactas.
3. Confirma que NO vas a tocar la lógica de in-bound (Sam/CAPI).
4. Espera mi OK antes de codear.
```

---

# 🔴 PROMPT 7 — Story S14.3: Variantes anti-ban round-robin

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S14.2 cerrado (editor multimedia funciona en ambos flujos).

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Solo modifica process-campaign-queue (out-bound). NO toca Sam ni CAPI ni
evolution-webhook.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como Josué, necesito crear hasta 5 variantes por campaña (cada una con su
propio texto y/o multimedia) que se distribuyan round-robin entre los
destinatarios para reducir el riesgo de baneo de WhatsApp.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Decisión arquitectónica (documenta primero):
   `governance/decisions/2026-04-campaign-variants-storage.md`
   - Decisión: variantes inline en JSON dentro de
     app_config.scheduled_campaigns (NO crear tabla campaign_variants).
   - Razón: las campañas hoy ya viven en JSON; una tabla rompería la cola
     actual sin beneficio inmediato.

B) Estructura JSON extendida:
   ```json
   {
     "id": "...",
     "name": "...",
     "scheduledAt": "ISO",
     "status": "scheduled|processing|completed",
     "contacts": [...],
     "variants": [                              // NUEVO, opcional
       {
         "position": 0,
         "label": "Variante A",
         "caption": "...",
         "media": { "url": "...", "type": "...", "mime": "...", "size_bytes": 0 }
       }
     ],
     "distribution": "round_robin"              // NUEVO, default round_robin
   }
   ```
   - Si `variants[]` está presente, se ignora `media` y `caption` raíz.
   - Si NO está presente, se usa la estructura de S14.2 (back-compat).

C) Frontend:
   - Componente nuevo `src/components/campaigns/VariantTabs.tsx` (<100 líneas).
   - Tabs shadcn con 1 a 5 variantes. Botón "+ Variante" hasta 5.
   - Cada tab embebe MediaUploader + Textarea (caption) + WhatsAppPreview de
     S14.2.
   - Al guardar campaña: si hay >1 variante, persistir en variants[];
     si hay 1, persistir como single (compatibilidad).

D) Backend (process-campaign-queue/index.ts):
   - Si campaign.variants tiene elementos:
     `const variantIndex = contactIndex % campaign.variants.length;`
     `const variant = campaign.variants[variantIndex];`
   - Logging por destinatario: incluir `variant_position` en el contacto.

E) UI guidance:
   - Tooltip junto al botón "+ Variante": "Recomendado: ≤150 destinatarios
     por variante por hora para reducir riesgo de baneo".
   - Label autogenerado: "Variante A", "Variante B", etc. Editable inline.
   - Al borrar una variante intermedia: re-numerar las posiciones (sin huecos).

F) Tests:
   - Vitest del distribuidor: 30/3 → 10/10/10; 7/3 → 3/2/2; 5/5 → 1/1/1/1/1.
   - UI: agregar 4 variantes, eliminar la 2 → quedan 3 con índices reordenados.
   - e2e: enviar a grupo de prueba con 2 variantes → verificar que llegaron
     mensajes distintos a destinatarios distintos (mock o stub Gowa).

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `npx vitest run`, `npx eslint .`, `npx tsc --noEmit` pasan.
- e2e Playwright pasa.
- Cobertura ≥80%.
- ZERO cambios al schema SQL en este story (ADR documentado).
- Commit: `feat(E14.S3): add campaign variants with round-robin distribution`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- `git revert` los commits → editor vuelve a S14.2.
- `supabase functions deploy <prev>` para process-campaign-queue.
- Las campañas ya programadas con variants[] no se ejecutarán correctamente
  tras el rollback. Mitigación: NO desplegar este story si hay campañas con
  variants[] ya en cola; o aplicar un script que las "aplane" a single.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO crear tabla campaign_variants (premature optimization).
- NO permitir > 5 variantes (UI obliga el límite + validación server-side).
- NO repartir aleatorio por defecto (round-robin determinista para
  diagnóstico).
- NO romper back-compat con campañas existentes sin variants.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Confirma la decisión de almacenamiento JSON inline.
2. Presenta el ADR final y el plan de archivos.
3. Espera mi OK.
```

---

# 🟡 PROMPT 8 — Story S15.1: Edge function `sync-group-members`

> **⚠️ Recomendación de Claude Web**: NO desplegar esta story el lunes en producción. Tiene implicaciones de privacidad (auto-creación de leads desde miembros de grupos) y modifica el flujo de retargeting (S15.3). Aplícala primero en staging, valida con un canal pequeño (idealmente el de Edith, que tiene pocos grupos), confirma que `process-followups` respeta el guardrail MUST-AR-03, y deja para la siguiente semana el deploy a producción.

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: E13 cerrado y desplegado. whatsapp_groups_cache en producción.

CONTEXTO DE ENTRADA:
Esta es la story S15.1 de E15 (Auto-Lead from WhatsApp Groups).
Geoffrey/Josué pidieron que el cron dé de alta como leads a TODOS los
miembros de los grupos de WhatsApp (Anahí tiene 100+ grupos legacy con
muchos contactos no registrados). Si el grupo está vinculado a un curso,
también se debe llenar contacts.academic_record con curso/profesor/
sede/fecha.

═══════════════════════════════════════════════════════════════════════════════
PRIORIDAD CORE INVIOLABLE — DOBLEMENTE IMPORTANTE EN ESTA STORY
═══════════════════════════════════════════════════════════════════════════════
Esta story crea LEADS automáticamente. El flujo Sam (chat→IA→CAPI) NO debe
ser afectado:
1. Los leads creados aquí NO deben disparar Meta CAPI hasta que el lead
   escriba por sí mismo (mensaje entrante via evolution-webhook).
2. analyze-leads NO debe procesar estos leads hasta que tengan al menos 1
   conversación entrante.
3. process-followups (cron de retargeting) NO debe marcarlos como PERDIDO
   automáticamente — ese fix es S15.3.

GUARDRAIL MUST-AR-03 EXTENDIDO: leads `auto-from-group` están protegidos
INDEFINIDAMENTE hasta que envíen su primer mensaje entrante.

═══════════════════════════════════════════════════════════════════════════════
REGLA CRÍTICA DEL FIX DEL WEEKEND
═══════════════════════════════════════════════════════════════════════════════
Esta story NO toca evolution-webhook. Pero tiene una implicación indirecta:
los leads que crees aquí pueden eventualmente recibir mensajes (entrantes)
de otros usuarios cuando estén en un grupo. Debido al fix del weekend, esos
mensajes NO se procesarán como leads (porque vienen de @g.us). Eso está bien.

PERO: si un miembro recién creado por este cron ESCRIBE 1-a-1 a Sam (chat
individual), eso SÍ debe ser procesado normalmente. Tu story no debe
interferir con eso.

VERIFICACIÓN: incluye un test que crea un lead `auto-from-group`, simula
que el lead manda un mensaje 1-a-1 (no en grupo), y verifica que evolution-
webhook lo procesa normalmente y dispara Sam (no se queda paused).

═══════════════════════════════════════════════════════════════════════════════
COORDINACIÓN POS — CRÍTICO
═══════════════════════════════════════════════════════════════════════════════
Esta story INSERT/UPDATE en `contacts`, que es compartida con POS:
- INSERT: omite columnas pos_* (toman su DEFAULT).
- UPDATE: solo modifica columnas Samurai (nunca pos_*).
- SELECT: explícito (no `*`).
- Phone duplicates: si el teléfono ya existe en contacts (porque POS lo
  creó), hacer UPDATE en lugar de INSERT, completando solo campos NULL en
  columnas Samurai.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito una Edge Function que por cada grupo activo en
whatsapp_groups_cache:
1. Liste los miembros vía Gowa.
2. UPSERT en contacts por teléfono normalizado
   (origen_contacto='auto-from-group').
3. UPSERT en leads (origen='auto-from-group', funnel_stage='INICIAL', tag).
4. INSERT en contact_whatsapp_groups (junction).
5. Si el grupo tiene course_id → llamar al helper de S15.4 para llenar
   academic_record.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Investigación PREVIA:
   1. ¿Existe edge function para listar miembros de un grupo?
      Verifica en supabase/functions/. Si NO existe, posiblemente
      `list-whatsapp-groups` lo soporte con un parámetro extra. Reporta.
   2. Si NO existe, hay que crear `list-group-members` o extender
      `list-whatsapp-groups`. DETENTE y avísame antes de tomar decisión.
   3. Lee la migración 20260422230000_add_whatsapp_groups_to_courses.sql
      para confirmar el schema de `contact_whatsapp_groups`.
   4. Lee `src/lib/phone.ts` o similar para ver si hay normalizador de
      teléfonos. Si no existe, documenta y crea uno simple con
      libphonenumber-js.

B) Crear: `supabase/functions/sync-group-members/index.ts`

   Funcionalidad:
   1. CORS y cliente Supabase con SERVICE_ROLE_KEY.
   2. Lock global con pg_try_advisory_lock(47131501).
   3. POST con body opcional:
      { group_id?: UUID, channel_id?: UUID, force?: boolean }
      - Sin body → procesa los 100 grupos más antiguos sin sync (paginación).
      - Con group_id → solo ese grupo.
      - Con channel_id → todos los grupos de ese canal.
        (RECOMENDADO para staging: probar primero con channel_id=Edith).
   4. Por cada grupo (SECUENCIAL):
      a. Obtener miembros del grupo vía la edge function adecuada.
      b. Por cada miembro:
         - Normalizar teléfono a E.164.
         - Buscar contact por telefono (SELECT explícito):
           `SELECT id, lead_id, academic_record FROM contacts WHERE telefono = $1`
         - Si EXISTE: UPDATE solo campos NULL/vacíos en columnas Samurai.
                      Mantener lead_id si ya tiene. NO tocar pos_*.
         - Si NO EXISTE: INSERT con: nombre (NULL si Gowa no lo da o el del
                        WhatsApp), telefono,
                        origen_contacto='auto-from-group',
                        grupo=NULL.
                        NO especificar columnas pos_* (toman default).
         - Buscar lead por telefono:
           `SELECT id, funnel_stage, origen FROM leads WHERE telefono = $1`
         - Si EXISTE: NO modificar.
         - Si NO EXISTE: INSERT en leads con:
             id (genera UUID), telefono, nombre (si Gowa lo da),
             funnel_stage = 'INICIAL', buying_intent = 'BAJO',
             confidence_score = 0, origen = 'auto-from-group',
             ai_paused = TRUE,                 -- Sam no debe responder
             estado_emocional_actual = 'NEUTRO'.
         - UPDATE contacts.lead_id si está NULL.
         - INSERT en contact_whatsapp_groups (ON CONFLICT DO NOTHING):
           contact_id, group_jid, group_name, course_id (si grupo lo tiene),
           channel_id, phone_number.
      c. Si el grupo tiene course_id no NULL → invocar el helper academic_record
         de S15.4 (que se implementará después; por ahora solo registrar TODO
         con un comentario).
      d. Sleep 500ms entre grupos.
   5. Logging detallado en activity_logs.
   6. Manejo de errores por grupo: continúa con los demás.
   7. Response 200 con conteos agregados.

C) Tests:
   - Vitest unitarios:
     1. Member nuevo (no existe contact ni lead) → INSERT en ambos +
        link en junction.
     2. Member que ya tiene contact (creado por POS) → UPDATE solo Samurai
        cols + INSERT lead + link.
     3. Member que ya tiene lead → solo INSERT en junction (idempotente).
     4. Lock ya tomado → 409 sin tocar BD.
     5. ai_paused=TRUE en todos los leads creados.
   - Test de seguridad CRÍTICO:
     - Después de la sync, hacer SELECT en columnas pos_* de un contact
       creado y verificar que TODOS están en su DEFAULT (no se sobrescribieron).
   - Test de regla de mensajes en grupo (referido al fix del weekend):
     - Crear un lead `auto-from-group`.
     - Simular un payload entrante de Gowa con remoteJid='<lead_phone>@s.whatsapp.net'
       (1-a-1).
     - Disparar evolution-webhook (en test).
     - Verificar que Sam SÍ procesa (porque es 1-a-1, no grupo).
     - Verificar que ai_paused se setea a FALSE tras el primer mensaje
       entrante (esto puede ya estar manejado en evolution-webhook; verificar).

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `supabase functions deploy sync-group-members` corre limpio.
- Vitest, eslint, tsc pasan.
- Test de seguridad POS pasa (columnas pos_* intactas).
- Test de fix-del-weekend pasa.
- Documentación en
  `governance/architecture/edge-functions/sync-group-members.md`.
- Commit: `feat(E15.S1): add sync-group-members edge function with POS-safe upserts`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- Si genera leads basura:
  ```sql
  DELETE FROM contact_whatsapp_groups WHERE contact_id IN (
    SELECT id FROM contacts
    WHERE origen_contacto='auto-from-group' AND created_at > '<deploy_ts>'
  );
  DELETE FROM leads WHERE origen='auto-from-group' AND created_at > '<deploy_ts>';
  DELETE FROM contacts WHERE origen_contacto='auto-from-group' AND created_at > '<deploy_ts>'
    AND id NOT IN (SELECT contact_id FROM contact_whatsapp_groups);
  ```
  PRECAUCIÓN: solo si estás seguro. Mejor: NO desplegar S15.2 (cron) hasta
  verificar manualmente con un grupo pequeño primero (canal Edith).

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO insertar leads sin ai_paused=TRUE (Sam los respondería).
- NO disparar Meta CAPI desde aquí (esos leads aún no son eventos válidos).
- NO sobrescribir pos_* columns NUNCA.
- NO usar `INSERT INTO contacts` sin lista de columnas explícita.
- NO procesar más de 100 grupos por invocación (timeout 60s edge function).
- NO procesar miembros en paralelo (rate limit Gowa).
- NO romper la regla del fix del weekend (mensajes en grupo no procesados).

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Reporta los hallazgos del paso A (¿hay edge function para miembros?).
2. Si no hay, dime exactamente cómo propones obtenerlos. Espera mi OK.
3. Confirma la lista exacta de columnas Samurai en contacts (sin pos_*).
4. Espera mi OK antes de codear.
```

---

# 🟡 PROMPT 9 — Story S15.2: Cron sync de miembros

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S15.1 cerrado y desplegado.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO DE PRIORIDAD CORE INVIOLABLE
═══════════════════════════════════════════════════════════════════════════════
Esta story añade un cron NUEVO. NO modifica crons existentes.

⚠️ IMPORTANTE: NO actives este cron en producción hasta que S15.3 esté
desplegado. S15.3 es lo que protege a los auto-leads de ser marcados como
PERDIDO. Sin S15.3, el cron de retargeting podría marcar como PERDIDOS los
miles de leads recién creados.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito un cron que dispare sync-group-members cada 30 min,
pero deshabilitado por defecto hasta que S15.3 esté listo.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Migración FORWARD:
   `supabase/migrations/20260427120300_setup_group_members_cron.sql`

   ```sql
   -- E15/S15.2: Cron para sync-group-members cada 30 min.
   -- IMPORTANTE: este cron debe activarse SOLO después de desplegar S15.3.
   
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-group-members-30min') THEN
       PERFORM cron.unschedule('sync-group-members-30min');
     END IF;
   END $$;
   
   SELECT cron.schedule(
     'sync-group-members-30min',
     '*/30 * * * *',
     $cron$
     SELECT net.http_post(
       url := 'https://giwoovmvwlddaizoriz.supabase.co/functions/v1/sync-group-members',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.cron_service_role_jwt', true)
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     );
     $cron$
   );
   
   -- DESACTIVAR INMEDIATAMENTE: queda registrado pero inactivo.
   -- Se activa manualmente tras S15.3 desplegado.
   SELECT cron.alter_job(
     (SELECT jobid FROM cron.job WHERE jobname = 'sync-group-members-30min'),
     active := false
   );
   ```

B) Migración ROLLBACK:
   `supabase/rollbacks/20260427120300_setup_group_members_cron_rollback.sql`
   ```sql
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-group-members-30min') THEN
       PERFORM cron.unschedule('sync-group-members-30min');
     END IF;
   END $$;
   ```

C) Documentar en `governance/operations/E15-deployment-checklist.md`:
   ```
   # Despliegue de E15 (Auto-Lead from Groups)
   
   PRE-CONDITIONS:
   - [ ] S13 (catálogo de canales) en producción.
   - [ ] S15.1 deployada y testeada en staging.
   - [ ] S15.3 (protección leads) deployada.
   
   PASOS PARA ACTIVAR:
   1. Run en staging primero: invocar sync-group-members manualmente con
      channel_id=<edith_channel_id> (canal con menos grupos).
   2. Verificar resultados: leads creados con ai_paused=TRUE, sin pos_*
      sobrescritos, sin disparar CAPI.
   3. Run query de verificación MUST-AR-03 (en Smoke tests prompt 17).
   4. Si todo OK, activar cron en producción:
      `SELECT cron.alter_job(
         (SELECT jobid FROM cron.job WHERE jobname = 'sync-group-members-30min'),
         active := true
       );`
   5. Monitorear cron.job_run_details por las primeras 4 horas.
   
   ROLLBACK SI ALGO FALLA:
   1. Desactivar el cron:
      `SELECT cron.alter_job(..., active := false);`
   2. Aplicar el script de cleanup de leads basura (en S15.1 PLAN DE ROLLBACK).
   ```

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `supabase db push` corre limpio.
- Job aparece en cron.job con active=false.
- Documento operativo committed.
- Commit: `feat(E15.S2): schedule sync-group-members cron (disabled until S15.3)`

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Confirma que entiendes que el job se deja DESHABILITADO hasta S15.3.
2. Presenta los archivos SQL.
3. Espera mi OK.
```

---

# 🟡 PROMPT 10 — Story S15.3: Protección de leads auto-creados (CRÍTICO MUST-AR-03)

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S15.1 cerrado.

═══════════════════════════════════════════════════════════════════════════════
PRIORIDAD CORE — ESTA STORY ES SOBRE EL GUARDRAIL CORE
═══════════════════════════════════════════════════════════════════════════════
Esta story modifica `process-followups`, que es la lógica de retargeting que
marca leads como PERDIDO por inactividad. El guardrail MUST-AR-03
(governance/guardrails.md) dice: "Leads nuevos protegidos 24h — no asignar
PERDIDO automáticamente". Aquí lo extendemos: leads `auto-from-group` están
protegidos INDEFINIDAMENTE hasta que envíen su primer mensaje entrante.

NO romper el flujo de retargeting para leads normales:
- Los leads creados por evolution-webhook (clientes que mandan mensaje)
  deben seguir siendo retargeteables como hoy.
- Solo los leads `origen='auto-from-group'` Y sin conversaciones entrantes
  cambian de comportamiento.

═══════════════════════════════════════════════════════════════════════════════
REGLA DEL FIX DEL WEEKEND
═══════════════════════════════════════════════════════════════════════════════
process-followups NO recibe webhooks; corre por cron y consulta la tabla
leads. Por construcción NO toca el filtro de mensajes en grupos. Pero IGUAL
añadiré una verificación manual: cuando termines, busca en process-
followups cualquier lógica que dependa de `conversaciones` y confirma que
distingue entre mensajes 1-a-1 y mensajes en grupo (esto último ya lo hace
el filtro implementado en evolution-webhook al guardar la conversación).

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito modificar `process-followups` para que NUNCA marque
como PERDIDO un lead que fue auto-creado desde un grupo de WhatsApp y aún
no ha enviado ningún mensaje (no tiene iniciativa propia).

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Lectura PREVIA:
   1. Lee `supabase/functions/process-followups/index.ts` completo. Reporta:
      - Cómo identifica los candidatos a PERDIDO.
      - Qué query usa.
      - Qué blindajes existen ya (la doc dice "Protección de 72 horas para
        leads nuevos" y "Mínimo 3 días umbral").

B) Modificación de la query:
   - Añadir condición: NO marcar como PERDIDO si:
     ```sql
     -- Lead auto-from-group sin conversaciones entrantes
     (l.origen LIKE '%auto-from-group%')
     AND NOT EXISTS (
       SELECT 1 FROM conversaciones c
       WHERE c.lead_id = l.id AND c.emisor = 'CLIENTE'
     )
     ```

C) Comentario explícito en el código:
   ```ts
   // GUARDRAIL MUST-AR-03 + E15.S3:
   // Leads auto-creados desde grupos de WhatsApp (origen='auto-from-group')
   // NO se marcan como PERDIDO hasta que envíen al menos 1 mensaje entrante.
   // Esto preserva la calidad de eventos para Meta CAPI y respeta la
   // privacidad del usuario que nunca interactuó con nosotros.
   //
   // RECUERDA: por el fix del weekend (24-25-abr) en evolution-webhook,
   // los mensajes que vienen de grupos (@g.us) NO se guardan como
   // conversaciones del lead. Por lo tanto este filtro funciona
   // correctamente.
   ```

D) Tests:
   1. Crear un lead con origen='auto-from-group' y SIN conversaciones.
      Correr process-followups manualmente.
      Verificar que el funnel_stage NO cambió.
   2. Crear un lead con origen='auto-from-group' Y con 1 conversación
      entrante.
      Correr process-followups con umbral simulado de 1 día y last_message_at
      hace 30 días.
      Verificar que el funnel_stage SÍ cambió a PERDIDO (porque ya escribió,
      ya es candidato normal).
   3. Crear un lead normal (sin origen 'auto-from-group') con last_message_at
      hace 30 días.
      Correr process-followups.
      Verificar que SÍ se marca como PERDIDO (no rompimos el flujo normal).

E) Activar el cron de S15.2 al cierre de esta story:
   ```sql
   SELECT cron.alter_job(
     (SELECT jobid FROM cron.job WHERE jobname = 'sync-group-members-30min'),
     active := true
   );
   ```
   PERO: NO ejecutes este paso aún. Confírmamelo y lo hago yo manualmente
   después de validar los tests en staging.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- Los 3 tests pasan.
- `supabase functions deploy process-followups` corre limpio.
- Cobertura del cambio ≥90% (es función crítica).
- Documentación: actualizar governance/guardrails.md con la regla extendida.
- Commit: `feat(E15.S3): protect auto-from-group leads from PERDIDO until first inbound`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- `supabase functions deploy process-followups` con la versión anterior.
- Si ya hay leads `auto-from-group` y se desactiva el cron de S15.2 al
  mismo tiempo, no hay impacto.

═══════════════════════════════════════════════════════════════════════════════
QUERY DE VERIFICACIÓN POST-DEPLOY (correr manualmente)
═══════════════════════════════════════════════════════════════════════════════
```sql
-- Esto debe retornar 0. Si no, S15.3 está roto y MUST-AR-03 violado.
SELECT count(*) FROM leads l
WHERE l.origen LIKE '%auto-from-group%'
  AND l.funnel_stage = 'PERDIDO'
  AND NOT EXISTS (
    SELECT 1 FROM conversaciones c
    WHERE c.lead_id = l.id AND c.emisor = 'CLIENTE'
  );
```

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Reporta el contenido de process-followups (paso A) y la query actual exacta.
2. Presenta el patch propuesto.
3. Espera mi OK.
```

---

# 🟡 PROMPT 11 — Story S15.4: Autofill de academic_record

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S15.1, S15.3 cerrados.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO PRIORIDAD CORE
═══════════════════════════════════════════════════════════════════════════════
Esta story añade lógica de enriquecimiento. No toca el flujo Sam. La columna
`contacts.academic_record` es de Samurai (jsonb), no toca POS. Pero IGUAL
respeta SELECT explícito.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, cuando el cron de S15.1 detecte un nuevo miembro en un grupo
con `course_id` no NULL (vinculado a un curso), debe agregar una entrada al
`contacts.academic_record` (jsonb) del contacto con curso/profesor/sede/
fecha. Idempotente: si ya existe entrada con ese course_id, no duplica.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Investigación PREVIA:
   1. Lee la columna `contacts.academic_record` (tipo: jsonb).
      Verifica si tiene un schema definido en alguna migración.
      Reporta cómo está siendo usada hoy (busca en src/ por academic_record).
   2. Lee la tabla courses para conocer columnas: id, name, professor_name (?),
      sede (?), fecha_inicio (?). Si los nombres son distintos, ajusta.

B) Schema de la entrada en academic_record:
   ```json
   [
     {
       "course_id": "uuid",
       "course_name": "...",
       "professor_name": "...",
       "sede": "...",
       "fecha_curso": "YYYY-MM-DD",
       "source": "auto-from-group",
       "added_at": "ISO"
     }
   ]
   ```

C) Helper en `supabase/functions/_shared/academic-record.ts`:
   ```ts
   export async function appendAcademicRecord(
     supabase: SupabaseClient,
     contactId: string,
     courseId: string
   ): Promise<{ added: boolean; reason?: string }> {
     // 1. Lee contacts.academic_record (SELECT explícito)
     // 2. Si ya hay entrada con ese course_id → return { added: false }
     // 3. Lee courses (SELECT explícito) para obtener course_name, etc.
     // 4. UPDATE contacts SET academic_record = academic_record || $newEntry
     // 5. return { added: true }
   }
   ```

D) Integración en sync-group-members (S15.1):
   - Después de crear/actualizar el contact y el link en
     contact_whatsapp_groups, SI el grupo tiene course_id, llamar a
     appendAcademicRecord.
   - Logging: incrementar contador `academic_records_added`.

E) Tests:
   1. Contact sin academic_record → primer auto-add → array con 1 entrada.
   2. Contact con academic_record que ya tiene ese course_id → idempotente.
   3. Contact con otro course_id → agrega segundo elemento al array.
   4. Race condition: 2 invocaciones simultáneas con mismo (contact, course)
      → solo 1 entrada (UPDATE atomic con SELECT FOR UPDATE).

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- Vitest, eslint, tsc pasan.
- Test de race condition pasa.
- Re-deploy de sync-group-members.
- Commit: `feat(E15.S4): autofill contacts.academic_record from course-linked groups`

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Reporta el uso actual de academic_record en src/.
2. Reporta los nombres exactos de columnas en courses.
3. Presenta el helper.
4. Espera mi OK.
```

---

# 🟡 PROMPT 12 — Story S16.1: FilterBuilder reutilizable

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: ninguno funcional.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO PRIORIDAD CORE
═══════════════════════════════════════════════════════════════════════════════
Solo frontend. NO toca Sam ni CAPI ni evolution-webhook.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como cualquier sección que maneje audiencias, necesito un componente
<FilterBuilder> que permita construir un árbol de reglas AND/OR/NOT con
anidación máxima 3, con campos predefinidos y operadores apropiados por
tipo. Crítico: soportar el caso "tomó nivel 1 PERO NO nivel 2" pedido
textualmente por Josué.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Campos disponibles (configurable vía prop `availableFields`):
   - Demográficos: ciudad, género, tags, score, status CRM, origen.
   - Académicos (vía academic_record jsonb): curso, profesor, sede, fecha
     (rango), nivel.
   - WhatsApp: canal, grupo (jid), is_member_of (vía
     contact_whatsapp_groups).
   - Negativos (NOT EXISTS): "no tomó curso X", "no está en grupo Y", etc.

B) Schema JSON del filtro serializado (validar con Zod):
   ```ts
   type FilterRule =
     | { type: 'leaf'; field: string; op: string; value: any }
     | { type: 'group'; logic: 'AND' | 'OR'; rules: FilterRule[] }
     | { type: 'not_exists'; field: string; op: string; value: any };
   
   const filterSchema = z.object({
     version: z.literal(1),
     root: ruleSchema  // recursivo, max depth 3
   });
   ```
   Ejemplo "tomó nivel 1 PERO NO nivel 2":
   ```json
   {
     "version": 1,
     "root": {
       "type": "group",
       "logic": "AND",
       "rules": [
         { "type": "leaf", "field": "academic_record.course_name", "op": "contains", "value": "Nivel 1" },
         { "type": "not_exists", "field": "academic_record.course_name", "op": "contains", "value": "Nivel 2" }
       ]
     }
   }
   ```

C) Componentes en `src/components/filters/`:
   - `FilterBuilder.tsx` (orquestador, <100 líneas).
   - `FilterGroup.tsx` (grupo AND/OR con sus rules como hijos).
   - `FilterRule.tsx` (1 fila [Campo] [Operador] [Valor]).
   - `FilterValueInput.tsx` (input dinámico según tipo del campo).
   - `useFilterPreviewCount.ts` (hook que llama RPC con debounce 500ms).

D) UX:
   - Botones "+ Regla", "+ Grupo", "+ NOT EXISTS".
   - Toggle AND/OR por grupo.
   - Indicador de profundidad (deshabilita "+ Grupo" si depth=3).
   - Vista previa "[N] leads cumplen criterios" actualizada en vivo.
   - Botón "Guardar como segmento" (usa tabla `segments` de S16.2).
   - Botón "Limpiar filtro".

E) Tests:
   - Vitest del parser/serializador (round-trip JSON).
   - Cada operador renderiza el input correcto.
   - Test del caso "Nivel 1 sin Nivel 2".

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- Vitest, eslint, tsc pasan.
- Cada componente <100 líneas.
- Cobertura ≥80%.
- Commit: `feat(E16.S1): add reusable FilterBuilder with NOT EXISTS support`

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Presenta el schema Zod final y un par de ejemplos de filtros serializados.
2. Presenta el árbol de archivos.
3. Espera mi OK.
```

---

# 🟡 PROMPT 13 — Story S16.2: Función Postgres `evaluate_segment`

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S16.1 cerrado.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO PRIORIDAD CORE
═══════════════════════════════════════════════════════════════════════════════
Esta story crea una función Postgres NUEVA. NO modifica funciones existentes
(get_user_role, handle_new_user — esas son intocables por reglas POS).

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como sistema, necesito una función `evaluate_segment(filter_json jsonb)`
(Postgres O Edge Function — decide cuál) que reciba el JSON del FilterBuilder
y devuelva los lead_ids que cumplen. Performance: <500ms p95 sobre 7000+
leads. SQL paramétrico SEGURO.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Decisión arquitectónica (recomendación: Edge Function):
   - Opción A: función Postgres con format(%I, %L) (mejor performance).
   - Opción B: edge function con query builder de supabase-js (más fácil
     de testear).
   Recomendación de Claude Web: B. Documentar en
   `governance/decisions/2026-04-evaluate-segment-architecture.md`.

B) Si eliges Opción B:
   - Crear `supabase/functions/evaluate-segment/index.ts`.
   - Body: { filter_json: ZodValidated, mode: 'count' | 'ids' }.
   - Construir la query con el query builder de supabase-js.
   - Para NOT EXISTS sobre academic_record:
     ```ts
     // "no tomó nivel 2" → leads cuyos contacts NO tienen academic_record con course_name like '%Nivel 2%'
     // Implementación: leads.id NOT IN (
     //   SELECT lead_id FROM contacts
     //   WHERE academic_record @> '[{"course_name": "Nivel 2"}]'::jsonb
     //   AND lead_id IS NOT NULL
     // )
     ```
   - Response: { count, lead_ids: [...] }.

C) Indexación (migración paralela):
   `supabase/migrations/20260427120500_add_segment_indexes.sql`
   ```sql
   CREATE INDEX IF NOT EXISTS idx_leads_buying_intent ON leads(buying_intent);
   CREATE INDEX IF NOT EXISTS idx_leads_funnel_stage ON leads(funnel_stage);
   CREATE INDEX IF NOT EXISTS idx_leads_ciudad ON leads(ciudad);
   CREATE INDEX IF NOT EXISTS idx_leads_origen ON leads(origen);
   CREATE INDEX IF NOT EXISTS idx_contacts_academic_record_gin
     ON contacts USING gin (academic_record);
   CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin ON contacts USING gin (tags);
   CREATE INDEX IF NOT EXISTS idx_cwg_group_jid ON contact_whatsapp_groups(group_jid);
   ```

D) Tabla `segments`:
   `supabase/migrations/20260427120600_create_segments_table.sql`
   ```sql
   CREATE TABLE IF NOT EXISTS public.segments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     definition_json JSONB NOT NULL,
     description TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (owner_id, name)
   );
   
   ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "segments_owner_all"
     ON public.segments FOR ALL TO authenticated
     USING (owner_id = auth.uid())
     WITH CHECK (owner_id = auth.uid());
   
   CREATE POLICY "segments_manager_read"
     ON public.segments FOR SELECT TO authenticated
     USING (public.get_user_role(auth.uid()) IN ('admin', 'dev', 'manager', 'gerente'));
   
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO authenticated;
   ```

E) Tests:
   - Casos canónicos:
     1. Solo demográfico: ciudad in ('CDMX', 'Monterrey').
     2. AND académico+demográfico.
     3. NOT EXISTS: "tomó Nivel 1 PERO NO Nivel 2".
     4. Anidado: "(curso A OR curso B) AND NOT curso C".
     5. Score range: between 50 and 100.
   - Benchmark: con dataset de 7000 leads de prueba, <500ms p95.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- `supabase db push` aplica migraciones.
- Si Opción B: `supabase functions deploy evaluate-segment` corre.
- Tests pasan + benchmark.
- Commit: `feat(E16.S2): add segment evaluator with NOT EXISTS support`

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO usar concatenación de string para SQL dinámico.
- NO usar SECURITY DEFINER en evaluate_segment (debe respetar RLS del caller).
- NO ignorar la regla "SELECT explícito" cuando leas contacts.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Decide: Opción A o B. Recomendación: B.
2. Presenta el plan de archivos y un sample de la query generada para
   "Nivel 1 PERO NO Nivel 2".
3. Espera mi OK.
```

---

# 🟡 PROMPT 14 — Story S16.3: Integración FilterBuilder en Campañas y Contactos

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S16.1, S16.2 cerrados.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO PRIORIDAD CORE
═══════════════════════════════════════════════════════════════════════════════
Solo frontend. Modifica src/pages/Campaigns.tsx (que ya redirige a
/academic?tab=campaigns) y src/pages/Contacts.tsx. NO toca Sam ni CAPI.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como Josué, necesito el FilterBuilder embebido en la página de Campañas
(dentro de AcademicCatalog tab=campaigns) y en /contacts, con vista previa
de conteo en vivo y opción de guardar segmentos.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) En Campaigns.tsx (CampaignsContent):
   - Debajo del bloque "Público Objetivo" actual (filtros lineales),
     añadir tab "Filtros avanzados" con <FilterBuilder>.
   - Al guardar campaña, persistir el filter_json como audience_filter en el
     JSON de scheduled_campaigns.
   - Al ejecutar la campaña en process-campaign-queue, evaluar el segment
     si hay audience_filter, y usar el resultado como destinatarios.

B) En Contacts.tsx:
   - Encima de la tabla, añadir <FilterBuilder>.
   - "Ver N leads" + "Crear campaña con esta selección".
   - Dropdown "Segmentos guardados".

C) Compatibilidad:
   - Los filtros lineales actuales siguen funcionando (no eliminar).
   - El FilterBuilder es ALTERNATIVO. Tab por defecto: filtros lineales.

D) Tests e2e:
   - `e2e/segment-filter.spec.ts`:
     1. Crear filtro "Nivel 1 AND NOT Nivel 2 AND ciudad in (CDMX)".
     2. Vista previa muestra conteo.
     3. Guardar como segmento "Nivel 1 sin Nivel 2 CDMX".
     4. Ir a /campaigns/new, cargar el segmento.
     5. Programar la campaña.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- Vitest, eslint, tsc pasan.
- e2e Playwright pasa.
- Cobertura ≥80%.
- Commit: `feat(E16.S3): integrate FilterBuilder into Campaigns and Contacts`

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Presenta el plan de modificaciones a Campaigns.tsx y Contacts.tsx.
2. Espera mi OK.
```

---

# 🟢 PROMPT 15 — Story S17.1: Theme provider + tipografía base (Geoffrey-friendly)

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: ninguno (independiente).

CONTEXTO DE ENTRADA:
Geoffrey reportó EXPLÍCITAMENTE en la reunión del 25-abr 2 cosas:
  1. La letra es muy chica, le cuesta leer (necesita TAMAÑO de fonts más
     grande por defecto).
  2. Necesita poder cambiar entre modo claro y modo oscuro (hoy está
     forzado a dark).

Esta story cubre AMBAS cosas como prioridad. Si solo cubres una, no se
considera completa.

═══════════════════════════════════════════════════════════════════════════════
RECORDATORIO PRIORIDAD CORE
═══════════════════════════════════════════════════════════════════════════════
Solo cosmético. NO toca Sam ni CAPI ni evolution-webhook.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como Geoffrey (cliente final), necesito (1) leer cómodamente con tamaño de
letra adecuado, y (2) poder alternar entre tema claro y oscuro con
persistencia.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Cambios en `index.html`:
   - Quitar `class="dark"` del `<html>`.
   - Mantener `lang="es"`.
   - Quitar `bg-slate-950` hardcoded del `<body>` (mover a token semántico).

B) Cambios en `src/main.tsx`:
   - Importar `ThemeProvider` de `next-themes` (ya está en package.json).
   - Envolver el árbol con:
     ```tsx
     <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
       <App />
     </ThemeProvider>
     ```

C) Configuración en `tailwind.config.ts`:
   - Confirmar `darkMode: 'class'`.
   - **AUMENTAR ESCALA TIPOGRÁFICA BASE**:
     ```ts
     theme: {
       extend: {
         fontSize: {
           // Subir 1 nivel respecto al default de Tailwind:
           'xs':   ['0.875rem', { lineHeight: '1.25rem' }],   // antes 0.75rem
           'sm':   ['1rem',     { lineHeight: '1.5rem' }],     // antes 0.875rem
           'base': ['1.125rem', { lineHeight: '1.75rem' }],    // antes 1rem
           'lg':   ['1.25rem',  { lineHeight: '1.875rem' }],   // antes 1.125rem
           'xl':   ['1.5rem',   { lineHeight: '2rem' }],       // antes 1.25rem
           '2xl':  ['1.875rem', { lineHeight: '2.25rem' }],    // antes 1.5rem
         }
       }
     }
     ```
   - Razón: Geoffrey pidió letra más grande. Subir un step en cada utilidad
     hace que TODA la app respire sin tocar componentes.

D) Componente nuevo: `src/components/layout/ThemeToggle.tsx`:
   - Botón shadcn con iconos `lucide-react/Sun` y `lucide-react/Moon`.
   - Usa `useTheme()` de next-themes.
   - Persistencia automática.
   - Visible en el header del Layout principal — PROMINENTE (no escondido
     en un menú colapsable; un click directo).
   - Tooltip "Cambiar tema (claro/oscuro)".

E) Tests:
   - Vitest + Testing Library: el toggle cambia data-theme entre light/dark.
   - Snapshot visual en una pantalla simple en ambos modos (opcional).
   - Test del tamaño de fonts: snapshot de un `<p class="text-base">`
     verifica `1.125rem`.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- Vitest, eslint, tsc pasan.
- Visualmente la app sigue viéndose como antes en dark, pero con letra MÁS
  GRANDE (test manual: comparar Dashboard antes/después).
- Click en el toggle cambia a light y vuelve.
- Toggle visible en el header sin tener que abrir nada.
- Commit: `feat(E17.S1): add light/dark theme toggle and bump base font sizes`

═══════════════════════════════════════════════════════════════════════════════
PLAN DE ROLLBACK
═══════════════════════════════════════════════════════════════════════════════
- `git revert` de los 3-4 commits del story.
- index.html vuelve al estado con `class="dark"`.
- tailwind.config.ts vuelve a su escala default.

═══════════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS A EVITAR
═══════════════════════════════════════════════════════════════════════════════
- NO romper el branding actual (paleta, logo).
- NO subir TODOS los tamaños desproporcionadamente: subir 1 step manteniendo
  proporciones.
- NO meter el toggle en una página específica: va en el Layout global.
- NO esconder el toggle en un menú colapsable: Geoffrey lo necesita
  accesible.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Identifica el archivo del Layout/header donde insertar el toggle.
2. Captura screenshots ANTES (Dashboard en dark con tamaños actuales).
3. Presenta el patch de index.html, src/main.tsx y tailwind.config.ts.
4. Espera mi OK.
```

---

# 🟢 PROMPT 16 — Story S17.2: Auditoría WCAG AA + control de zoom

```
ROL: Continúas en Claude Code para gameygv/samurai.
DEPENDS ON: S17.1 cerrado.

═══════════════════════════════════════════════════════════════════════════════
USER STORY
═══════════════════════════════════════════════════════════════════════════════
Como Geoffrey, necesito que el texto sea legible sin tener que subir el
contraste de mi monitor. Dashboard, Contacts y Campaigns Editor deben pasar
WCAG AA en ambos modos. Y necesito un control adicional en el header para
ajustar el tamaño de letra (tres niveles: normal/grande/extra grande) si la
escala base de S17.1 no es suficiente.

═══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════════════════════

A) Auditoría inicial:
   - Instalar `@axe-core/playwright`.
   - Crear `e2e/accessibility.spec.ts` que recorre 3 pantallas (Dashboard,
     Contacts, Campaigns) en LIGHT y DARK, y reporta violations.
   - Correr y guardar el reporte en
     `governance/audits/2026-04-axe-baseline.json`.

B) Ajuste de tokens:
   - Editar `src/index.css` (o donde estén las CSS vars: --foreground,
     --background, --muted, --primary, --ring, etc.).
   - Para los colores que no pasen AA (ratio 4.5:1 texto normal, 3:1 texto
     grande/UI), ajustar valores manteniendo el branding general.

C) Control de zoom de texto (BONUS):
   - Componente `src/components/layout/FontSizeToggle.tsx` (<100 líneas):
     - 3 niveles: Normal, Grande, Extra grande.
     - Aplica al `<html>`: `style="font-size: 100%"`, `112.5%`, `125%`.
     - Persistencia en localStorage.
     - Visible junto al ThemeToggle del header.
   - Razón: la base ya subió en S17.1, pero Geoffrey debe poder ajustarlo
     en vivo si necesita más.

D) Focus visible:
   - Todos los interactivos: outline 2px solid var(--ring) en :focus-visible.
   - Verificar contraste del ring: ratio ≥3:1 contra el fondo en ambos modos.

E) Auditoría final:
   - Re-correr e2e/accessibility.spec.ts.
   - 0 errores AA.
   - Guardar reporte: governance/audits/2026-04-axe-final.json.

═══════════════════════════════════════════════════════════════════════════════
GATES
═══════════════════════════════════════════════════════════════════════════════
- 0 errores AA en las 3 pantallas en ambos modos.
- e2e Playwright (incluyendo accessibility.spec.ts) pasa.
- FontSizeToggle persiste el setting tras refresh.
- Commits granulares.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Corre el axe baseline y reporta los issues encontrados.
2. Presenta el plan de cambios de tokens.
3. Espera mi OK.
```

---

# ✅ PROMPT 17 — Smoke tests transversales finales

```
ROL: Sesión final de Claude Code para gameygv/samurai.
DEPENDS ON: TODAS las stories cerradas.

═══════════════════════════════════════════════════════════════════════════════
PRIORIDAD CORE — VERIFICACIÓN POST-DEPLOY
═══════════════════════════════════════════════════════════════════════════════
Antes de declarar el sprint cerrado, ejecuta esta batería de tests para
confirmar que el flujo core (captura→CAPI→campañas) sigue funcionando, y
que las nuevas features funcionan sin romperlo.

═══════════════════════════════════════════════════════════════════════════════
TESTS A EJECUTAR (en orden, no avanzar si una falla)
═══════════════════════════════════════════════════════════════════════════════

[1] FLUJO CORE INTACTO — captura→CAPI
   1. Mandar un mensaje 1-a-1 (chat individual, NO grupo) a un canal
      conectado (canal Developer/Edith).
   2. Verificar en logs que evolution-webhook lo recibió.
   3. Verificar que el lead se creó/actualizó en `leads`.
   4. Verificar que analyze-leads procesó el mensaje (cron 5min).
   5. Verificar que meta-capi-sender disparó un evento si se capturó
      email/ciudad.
   6. ✅ DEBE FUNCIONAR IGUAL QUE ANTES DEL SPRINT.

[2] FIX DEL WEEKEND INTACTO — mensajes en grupo NO procesados
   1. Mandar un mensaje desde un agente DENTRO de un grupo de WhatsApp
      conectado.
   2. Verificar en logs que evolution-webhook lo recibió pero NO lo procesó
      como lead.
   3. Verificar que NO se creó ni actualizó ningún lead.
   4. Verificar que NO disparó CAPI.
   5. Verificar que Sam NO respondió.
   6. ✅ EL FIX DEL WEEKEND DEBE SEGUIR FUNCIONANDO.

[3] CATÁLOGO DE CANALES (E13)
   1. Abrir /channels.
   2. Ver los 3 canales: Edith, Anahí, Developer.
   3. Cada uno muestra su conteo de grupos (Anahí > 100, Edith bajo,
      Developer 0).
   4. SELECT count(*) FROM whatsapp_groups_cache → > 0.
   5. SELECT * FROM cron.job WHERE jobname='sync-channel-groups-30min'
      → 1 row, active=true.
   6. cron.job_run_details muestra runs exitosos en últimas 2 horas.

[4] EDITOR DE CAMPAÑAS (E14)
   1. Crear campaña con imagen + caption a un grupo directo.
   2. Vista previa muestra burbuja WhatsApp con la imagen.
   3. Programar para 1 min en el futuro.
   4. Esperar a que process-campaign-queue lo procese.
   5. Status='completed' en app_config.scheduled_campaigns.
   6. ✅ Imagen llegó (verificar en el grupo de prueba).
   7. Repetir con video MP4.
   8. Repetir con MassMessageDialog (Difusión Individual) con audio OGG.
   9. Crear campaña con 3 variantes y 30 destinatarios.
   10. Verificar distribución 10/10/10.

[5] AUTO-LEAD FROM GROUPS (E15) — solo si fue desplegado
   1. SELECT count(*) FROM contacts WHERE origen_contacto='auto-from-group';
      → debe ser ≈ miembros sincronizados.
   2. SELECT count(*) FROM leads WHERE origen LIKE '%auto-from-group%';
   3. CRÍTICO — query del guardrail MUST-AR-03:
      ```sql
      SELECT count(*) FROM leads l
      WHERE l.origen LIKE '%auto-from-group%'
        AND l.funnel_stage = 'PERDIDO'
        AND NOT EXISTS (
          SELECT 1 FROM conversaciones c
          WHERE c.lead_id = l.id AND c.emisor = 'CLIENTE'
        );
      ```
      ⚠️ DEBE RETORNAR 0. Si no, S15.3 está roto y hay que revertir.
   4. SELECT count(*) FROM contacts c
      WHERE c.origen_contacto='auto-from-group'
        AND c.pos_saldo IS NULL;
      → debe ser igual al count total de contacts auto-from-group (TODOS
      los pos_* en default).
   5. Para grupos con course_id: verificar que algunos contacts ya tienen
      academic_record con la entrada del curso.

[6] FILTROS SEGMENTADOS (E16)
   1. En /campaigns: crear filtro "tomó Nivel 1 PERO NO Nivel 2".
   2. Vista previa muestra conteo.
   3. Validar manualmente con SQL: el conteo cuadra.
   4. Guardar como segmento.
   5. Crear campaña usando ese segmento.

[7] TEMA Y ACCESIBILIDAD (E17)
   1. Toggle a light → app cambia.
   2. Toggle a dark → vuelve.
   3. Persistencia: refresh, sigue en light.
   4. Toggle de FontSize → texto crece.
   5. Reporte axe en governance/audits/2026-04-axe-final.json: 0 errores AA.
   6. Geoffrey valida visualmente.

[8] SAM SIGUE FUNCIONANDO (regresión core)
   1. Mandar mensaje 1-a-1 a un canal con Sam activo (no a un lead
      auto-from-group, sino a uno con ai_paused=false o nuevo).
   2. Verificar que Sam responde dentro de 30s.
   3. Verificar que el lead se actualizó (estado_emocional, intent).
   4. Verificar que CAPI envió evento si aplicó.

═══════════════════════════════════════════════════════════════════════════════
SI ALGUNA PRUEBA FALLA
═══════════════════════════════════════════════════════════════════════════════
1. NO declarar el sprint cerrado.
2. DETENER cualquier deploy adicional.
3. Aplicar el rollback correspondiente al story que rompió la prueba
   (ver Apéndice C del documento).
4. Reportarme los detalles.

═══════════════════════════════════════════════════════════════════════════════
DOCUMENTACIÓN FINAL
═══════════════════════════════════════════════════════════════════════════════
- Crear governance/sprints/2026-04-sprint-summary.md con:
  - Stories cerradas (S13.1-S17.2).
  - Resultado de las 8 pruebas anteriores.
  - Issues encontrados y cómo se resolvieron.
  - Pending para el siguiente sprint.

═══════════════════════════════════════════════════════════════════════════════
ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════════
1. Confirma que todas las stories están cerradas.
2. Empieza por la prueba [1] (flujo core).
3. Reporta resultado de cada prueba antes de avanzar a la siguiente.
```

---

## Apéndice A — Checklist de despliegue por entrega

### Entrega del lunes (mínimo viable)
- [ ] Bootstrap (Prompt 0) ejecutado
- [ ] E13 completa (Prompts 1-4): catálogo de canales y grupos (3 canales: Edith, Anahí, Developer)
- [ ] E14 completa (Prompts 5-7): tests anti-regresión + editor multimedia en MassMessageDialog + variantes anti-ban
- [ ] E17.S1 (Prompt 15): tema claro/oscuro + tipografía base más grande (Geoffrey explícito)
- [ ] Smoke tests [1], [2], [3], [4], [7], [8] del Prompt 17

### Entrega siguiente semana
- [ ] E15 completa (Prompts 8-11): auto-lead from groups (S15.3 ANTES de activar S15.2)
- [ ] E16 completa (Prompts 12-14): FilterBuilder + integración
- [ ] E17.S2 (Prompt 16): auditoría WCAG AA + zoom
- [ ] Smoke tests [5], [6] del Prompt 17

## Apéndice B — Recordatorios operativos

- Los 3 canales actuales (Edith, Anahí, Developer/Gamey) escalarán a más cuando se sumen agentes. Diseñar para N.
- Antes de activar el agente Sam en horario nocturno: confirmar con **Anahí** y el resto del equipo que **TODOS** los autorresponders (WhatsApp Business, autoresponder de Anahí en su teléfono, Edith) están desactivados.
- El módulo de **publicidad/community management con IA generativa de creativos** será un proyecto separado (no entra en este sprint).
- Mismo Supabase project ref para Samurai y POS: `giwoovmvwlddaizoriz`. Cada migración SQL nueva debe respetar las reglas de COORDINACION_SAMURAI.md.
- **El fix del weekend NO se toca**. Cualquier story que pase por evolution-webhook DEBE incluir test de regresión que verifique que mensajes en grupos (`@g.us`) no se procesan como leads.

## Apéndice C — Rollback global de emergencia

Si algo se rompe gravemente y necesitas revertir TODO el sprint:

```bash
# 1. Identifica los commits del sprint
git log --since="2026-04-26" --oneline

# 2. Identifica el commit ANTES del sprint (último HEAD del 25-abr)
LAST_GOOD=<hash>

# 3. Revertir el frontend (Vercel)
git checkout main
git revert --no-commit ${LAST_GOOD}..HEAD
git commit -m "revert: roll back 2026-04-sprint due to <reason>"
git push origin main
# Vercel hace redeploy automático.

# 4. Revertir migraciones SQL (en orden inverso)
for file in $(ls supabase/rollbacks/2026042712*.sql | sort -r); do
  supabase db query --linked --file "$file"
done

# 5. Revertir edge functions desplegadas
supabase functions delete sync-channel-groups
supabase functions delete sync-group-members
supabase functions delete evaluate-segment
# Re-desplegar versión anterior si modificaste process-campaign-queue,
# send-group-message, process-followups.

# 6. Verificar que el flujo core sigue:
#    Ejecutar Prompt 17 prueba [1] (captura→CAPI) y [2] (fix del weekend).

# 7. Verificar que no quedan datos basura:
#    SELECT count(*) FROM whatsapp_groups_cache;  -- debe ser 0 si se borró la tabla
#    SELECT count(*) FROM leads WHERE origen='auto-from-group' AND created_at > '2026-04-27';  -- debe ser 0
```

## Apéndice D — Continuidad con el repo POS (próximo paso)

Después de completar este sprint en Samurai, el siguiente paso es generar un **plan paralelo para `gameygv/pos-elephant-bowl`**, basado en la transcripción del 2do meet con Josué donde se trataron los temas de cambios en el POS. Cuando recibas esa transcripción de Gamey:

1. Repetir el ciclo de análisis de Claude Web → generar un `pos-prompts-claude-code.md` análogo a este documento.
2. Verificar que NO entra en conflicto con las migraciones de Samurai aplicadas en este sprint:
   - Las nuevas columnas en `contacts` que añadió Samurai (si las hubo): el POS las ignora vía SELECT explícito.
   - Las funciones `get_user_role()` y `handle_new_user()`: el POS NO las modifica.
3. Coordinar el orden de despliegue: Samurai migraciones primero, luego POS.
4. Regenerar `types.ts` en POS con `npx supabase gen types typescript --linked` para reflejar las nuevas columnas Samurai (sin tocarlas).

## Apéndice E — Cómo cargar este .md en Claude Code

**Recomendación de Claude Web sobre tu plan**: lo que propones (descargar el .md, decirle a Claude Code que lo analice, explicar contexto, arrancar prompts) está bien. Sugiero estas mejoras menores:

### Opción A (recomendada): versionar el .md en el repo

```bash
# En tu working copy de gameygv/samurai
mkdir -p governance/sprints
cp ~/Downloads/samurai-prompts-claude-code.md governance/sprints/2026-04-sprint-plan.md
git add governance/sprints/2026-04-sprint-plan.md
git commit -m "docs: add 2026-04 sprint plan from Claude Web analysis"
git push origin main
```

Luego, en Claude Code, tu primer mensaje sería:

> "Lee el archivo `governance/sprints/2026-04-sprint-plan.md` completo. Ese plan fue generado por Claude Web (Claude Opus 4.7 en chat.claude.ai) tras analizar el repo, el repo POS hermano, las transcripciones de la reunión del 25-abr con Geoffrey y Josué, y los commits del weekend. Cuando termines de leerlo, resume las épicas E13-E17 en ≤20 líneas y espera mi instrucción para empezar con el Prompt 0 (bootstrap)."

**Ventaja**: el .md queda versionado, cualquier integrante del equipo lo puede consultar, y Claude Code lo lee del filesystem (no se trunca).

### Opción B: cargarlo como adjunto en cada sesión

Si prefieres no commitearlo aún:

> "Te adjunto el plan generado por Claude Web. Léelo completo, resume las épicas E13-E17 y espera mi instrucción para empezar con el Prompt 0 (bootstrap)."

**Desventaja**: si la sesión de Claude Code se reinicia, hay que re-adjuntar.

### En ambos casos, antes de cada nueva sesión:
1. Pega el **Prompt 0** (bootstrap) primero. Sin esto Claude Code no carga las reglas de RaiSE.
2. Pega los prompts en orden. No te saltes uno.
3. Cuando termines E14 (lunes), comparte el resultado de los smoke tests [1]-[4], [7], [8] antes de continuar con E15-E16-E17.S2.
4. Cuando llegue la transcripción del 2do meet (POS), genera el plan paralelo siguiendo el patrón de este documento.
