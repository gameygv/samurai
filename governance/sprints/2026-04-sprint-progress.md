# Sprint 2026-04-27 — Progreso

## Fase 1 — COMPLETADA (2026-04-27 ~01:00 AM)

| # | Story | Commit | Estado | Detalle |
|---|---|---|---|---|
| 0 | Bugfixes campañas | `735e9fd` | DEPLOY | 10 fixes: SSRF, memory leak, timeout, error handling |
| 1 | S13.1 — Schema cache | `d50f975` | DEPLOY | Tabla whatsapp_groups_cache + triggers + set_updated_at() |
| 2 | S13.2 — sync-channel-groups | `d774a69` | DEPLOY | 391 grupos synced de 2 canales (Edith + Anahí) |
| 3 | S13.3 — Cron */30 | `fb5b0a8` | DEPLOY | Job #30 activo, ANON key pattern |
| 4 | S13.4 — UI /channels | `fae2cb3` | DEPLOY | Página con tarjetas, búsqueda, refresh por canal |
| 5 | S14.2 — Media MassMessage | `78284f3` | DEPLOY | Video + audio en difusión individual |
| 6 | S17.1 — Tema + fonts | `548f0ae` | DEPLOY | ThemeToggle + FontSizeToggle en header |

**Tests:** 56/56 verdes | **TypeScript:** 0 errores

## Fase 2 — PENDIENTE (continuar esta noche)

### Samurai (en orden de ejecución)

| # | Story | Qué hace | Riesgo | Notas |
|---|---|---|---|---|
| 7 | **S14.S3** | Variantes anti-ban round-robin (hasta 5 por campaña) | MEDIO | Modifica process-campaign-queue + JSON schema |
| 8 | **S15.1** | Edge function sync-group-members mejorada | ALTO | Crea leads, toca contacts compartida. Probar con Edith primero |
| 9 | **S15.3** | Protección MUST-AR-03 en process-followups | CRÍTICO | ANTES de activar S15.2. Leads auto-from-group no se marcan PERDIDO |
| 10 | **S15.2** | Cron sync-group-members */30 (DESHABILITADO) | BAJO | Solo activar después de S15.3 |
| 11 | **S15.4** | Autofill academic_record desde grupos con curso | BAJO | Helper en _shared/ |
| 12 | **S16.1** | FilterBuilder reutilizable (AND/OR/NOT EXISTS) | MEDIO | Componente frontend nuevo |
| 13 | **S16.2** | Edge function evaluate-segment + tabla segments | MEDIO | Índices + RPC |
| 14 | **S16.3** | Integración filtros en /campaigns y /contacts | MEDIO | Embebido en páginas existentes |
| 15 | **S17.2** | Auditoría WCAG AA + zoom de texto | BAJO | axe-core, tokens de color |

### Orden recomendado para esta noche

**Prioridad alta (Josué necesita):**
1. S14.S3 — variantes anti-ban
2. S16.1 → S16.2 → S16.3 — filtros segmentados

**Prioridad media (staging primero):**
3. S15.1 → S15.3 → S15.2 → S15.4 — auto-leads

**Prioridad baja:**
4. S17.2 — auditoría WCAG

### Pendiente cruzado

- Generar `D:/github/pos/INSTRUCCIONES_SESION.md` con plan POS ajustado
- Correcciones: endpoint Gowa, cron pattern, logo/medidas configurables

## Reglas activas (recordatorio)

- Regla temporal "no precios" en get-samurai-context (desde 2026-04-18)
- Fix weekend: mensajes grupo @g.us NO procesados como leads
- Project ref: giwoovmvwlddaizorizk (con k)
- Cron pattern: ANON key hardcodeada
- Inter-función: _shared/invoke.ts (no supabase.functions.invoke)
- Deploy: siempre via deploy.sh (--no-verify-jwt)
