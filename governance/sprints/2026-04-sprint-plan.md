# Sprint 2026-04-27 — Plan Final Ajustado

> **Origen:** Claude Web (Opus 4.7) analizó repo Samurai, repo POS, transcripciones del meet 25-abr con Geoffrey/Josué, y épicas E1-E12.
> **Revisión:** Claude Code (Opus 4.6) corrigió errores, verificó estado real del proyecto, y ajustó prioridades.
> **Fecha de revisión:** 2026-04-26

---

## Correcciones aplicadas al plan original de Claude Web

| # | Error en plan original | Corrección |
|---|---|---|
| 1 | Project ref `giwoovmvwlddaizoriz` (sin `k`) | Correcto: `giwoovmvwlddaizorizk` |
| 2 | Cron JWT via `current_setting('app.cron_service_role_jwt')` | Patrón real: ANON key hardcodeada en headers (ver SETUP_DAILY_SYNC.sql) |
| 3 | Asume `set_updated_at()` podría existir | NO existe — debe crearse en la primera migración |
| 4 | S13.2 usa `supabase.functions.invoke` inter-función | Prohibido — usar `_shared/invoke.ts` (incidente 2026-04-23) |
| 5 | Componentes < 100 líneas (regla rígida) | No aplica a este proyecto — priorizar funcionalidad |
| 6 | E17 override de escala tailwind fontSize | Riesgoso — usar CSS custom property `--font-scale` en `<html>` |
| 7 | `supabase/rollbacks/` como directorio | Solo existe `rls_rollback.sql` en raíz — crear directorio |

---

## Prioridades (recordatorio)

1. **CAPI enviando** — flujo captura→Meta intacto
2. **Chats llegando** — evolution-webhook sin tocar
3. **IA analizando** — analyze-leads sin tocar
4. **Datos de calidad** — email, CP, etc.
5. **Regla temporal activa**: IA no menciona precios (desde 2026-04-18)
6. **Fix del weekend**: mensajes en grupos (@g.us) NO se procesan como leads

---

## Fases de ejecución

### FASE 1 — Lunes (obligatorio)

#### E13: WhatsApp Channels Catalog & Cache

| Story | Qué hace | Riesgo | Archivos principales |
|---|---|---|---|
| **S13.1** | Tabla `whatsapp_groups_cache` + triggers | BAJO (tabla nueva, no toca existentes) | `supabase/migrations/20260427120000_create_whatsapp_groups_cache.sql` |
| **S13.2** | Edge function `sync-channel-groups` | BAJO (función nueva) | `supabase/functions/sync-channel-groups/index.ts` |
| **S13.3** | Cron pg_cron */30 | BAJO (job nuevo) | `supabase/migrations/20260427120100_setup_channel_groups_cron.sql` |
| **S13.4** | UI página `/channels` | BAJO (solo frontend nuevo) | `src/pages/ChannelsCatalog.tsx`, componentes en `src/components/channels/` |

**Detalle técnico S13.1:**
```sql
-- INCLUIR en la migración (NO existe en la BD):
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Tabla, índices, RLS, trigger de sync curso→cache
-- Ver archivo original de Claude Web para schema completo
```

**Detalle técnico S13.2:**
- Usar `_shared/invoke.ts` (invokeFunction) para llamar a `list-whatsapp-groups` — NUNCA `supabase.functions.invoke`
- Lock con `pg_try_advisory_lock(47131301)`
- NO sobrescribir `course_id` en UPDATE (humanos lo asignan manual)
- NO marcar stale si el canal entero falló
- Sleep 1s entre canales

**Detalle técnico S13.3:**
- Seguir patrón EXACTO de `SETUP_DAILY_SYNC.sql`: ANON key hardcodeada en headers
- URL correcta: `https://giwoovmvwlddaizorizk.supabase.co/functions/v1/sync-channel-groups`

**Detalle técnico S13.4:**
- Ruta `/channels` en App.tsx
- Item en sidebar: "Canales y Grupos"
- Data viene del cache (whatsapp_groups_cache), NO de Gowa en runtime
- Botón "Refrescar canal" → POST a sync-channel-groups con { channel_id }
- Búsqueda client-side por nombre de grupo

#### E14: Editor Multimedia en Campañas (parcial)

| Story | Qué hace | Riesgo |
|---|---|---|
| **S14.2** | Extender soporte media a MassMessageDialog (Difusión Individual) | MEDIO (modifica componente existente) |

**Qué ya existe (commit f34f164 + 735e9fd):**
- `GroupCampaignSection.tsx` — multi-select + imagen/video/audio ✅
- `send-group-message/index.ts` — envío media via GOWA FormData ✅
- Bugfixes (SSRF, memory leak, timeout, error handling) ✅

**Qué falta:**
- `MassMessageDialog.tsx` solo envía texto — necesita imagen/video/audio
- Extraer componente reutilizable `MediaUploader` de GroupCampaignSection
- Wiring con `send-message-v3` para envío individual con media

**S14.1 (tests anti-regresión) y S14.3 (variantes anti-ban) — POSTERGAR:**
- S14.1: los tests son útiles pero no bloquean funcionalidad
- S14.3: complejo (round-robin, JSON schema extendido) y no urgente para el lunes

#### E17.S1: Tema claro/oscuro + fonts grandes (Geoffrey)

| Story | Qué hace | Riesgo |
|---|---|---|
| **S17.1** | ThemeProvider + ThemeToggle + escala tipográfica | MEDIO (afecta toda la UI visualmente) |

**Enfoque ajustado (más seguro que Claude Web):**
1. `next-themes` ya instalado — solo configurar ThemeProvider en main.tsx
2. Quitar `class="dark"` hardcoded de index.html
3. CSS custom property para escala: `html { font-size: var(--font-scale, 100%); }`
4. FontSizeToggle con 3 niveles: Normal (100%), Grande (112.5%), Extra (125%)
5. ThemeToggle prominente en header (Sun/Moon)
6. NO override de tailwind fontSize (evita romper `text-[10px]` hardcoded)

---

### FASE 2 — Semana siguiente

#### E15: Auto-Lead from WhatsApp Groups (STAGING PRIMERO)

| Story | Qué hace | Riesgo | Notas |
|---|---|---|---|
| **S15.1** | Edge function sync-group-members (mejorar la existente) | ALTO (crea leads, toca contacts compartida) | Probar con canal Edith primero |
| **S15.2** | Cron pg_cron */30 (DESHABILITADO) | BAJO | No activar hasta S15.3 |
| **S15.3** | Protección MUST-AR-03 en process-followups | CRÍTICO (modifica retargeting) | ANTES de activar S15.2 |
| **S15.4** | Autofill academic_record | BAJO | Helper en _shared/ |

**ORDEN OBLIGATORIO:** S15.1 → S15.3 → S15.2 (activar cron) → S15.4

#### E14.S3: Variantes anti-ban

- Round-robin hasta 5 variantes por campaña
- Modificación de process-campaign-queue
- JSON schema extendido para scheduled_campaigns

#### E16: Filtros Segmentados

| Story | Qué hace |
|---|---|
| S16.1 | FilterBuilder reutilizable (AND/OR/NOT EXISTS) |
| S16.2 | Edge function evaluate-segment + tabla segments |
| S16.3 | Integración en /campaigns y /contacts |

#### E17.S2: Auditoría WCAG AA

- axe-core en 3 pantallas (Dashboard, Contacts, Campaigns)
- Ajuste de tokens de color
- Focus visible

---

## Checklist pre-ejecución (verificar al abrir sesión)

- [ ] Vitest pasa (56 tests verdes) — `npx vitest run`
- [ ] TypeScript compila — `npx tsc --noEmit`
- [ ] `set_updated_at()` existe o se crea en S13.1
- [ ] Project ref en todos los SQL: `giwoovmvwlddaizorizk` (con k)
- [ ] Patrón de cron: ANON key hardcodeada (como SETUP_DAILY_SYNC.sql)
- [ ] _shared/invoke.ts para llamadas inter-función
- [ ] deploy.sh para todas las edge functions (--no-verify-jwt)
- [ ] Regla temporal "no precios" sigue activa en get-samurai-context
- [ ] Fix weekend (mensajes grupo @g.us no procesados) intacto

## Archivos que se van a crear (Fase 1)

```
supabase/migrations/20260427120000_create_whatsapp_groups_cache.sql   (S13.1)
supabase/rollbacks/20260427120000_create_whatsapp_groups_cache_rollback.sql
supabase/functions/sync-channel-groups/index.ts                       (S13.2)
supabase/migrations/20260427120100_setup_channel_groups_cron.sql      (S13.3)
supabase/rollbacks/20260427120100_setup_channel_groups_cron_rollback.sql
src/pages/ChannelsCatalog.tsx                                         (S13.4)
src/components/channels/ChannelCard.tsx
src/components/channels/ChannelGroupsList.tsx
src/components/channels/SyncBanner.tsx
src/hooks/useChannelsCatalog.ts
src/components/campaigns/MediaUploader.tsx                            (S14.2)
src/components/layout/ThemeToggle.tsx                                  (S17.1)
src/components/layout/FontSizeToggle.tsx
```

## Archivos que se van a modificar (Fase 1)

```
src/App.tsx                                    (ruta /channels)
src/components/Layout.tsx (o sidebar)          (item "Canales y Grupos")
src/main.tsx                                   (ThemeProvider)
index.html                                     (quitar class="dark")
src/index.css                                  (CSS vars para tema + --font-scale)
src/components/contacts/MassMessageDialog.tsx   (media support)
src/components/academic/GroupCampaignSection.tsx (extraer MediaUploader)
deploy.sh                                      (agregar sync-channel-groups)
```

## Orden de ejecución Fase 1

```
1. S13.1 — migración SQL (tabla + triggers)
2. S13.2 — edge function sync-channel-groups
3. S13.3 — cron pg_cron
4. S13.4 — UI /channels
5. S14.2 — MediaUploader + MassMessageDialog media
6. S17.1 — tema + fonts
7. Smoke tests manuales (flujo core intacto, fix weekend intacto)
8. Deploy final
```

## Rollback de emergencia

Si algo se rompe, cada story tiene su rollback independiente:
- SQL: archivo en `supabase/rollbacks/`
- Edge functions: `supabase functions delete <name>` o redeploy versión anterior
- Frontend: `git revert <commit>`
- Crons: `SELECT cron.unschedule('<jobname>');`
