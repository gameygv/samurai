---
epic: E7
name: gowa-media-and-data-quality
status: in-progress
---

# E7 Scope: Gowa Media Support & Data Quality

## Objective

Habilitar soporte completo de media para canales Gowa/Evolution (imagenes y audio
via URL directa) y eliminar datos expirados de todas las fuentes de contexto del bot
(Base de Conocimiento, Verdad Maestra). Mejoras menores de cron y auto-reactivacion.

## In Scope

- S7.1: Media Gowa/Evolution — extraer URLs del webhook, adaptar transcribe-audio y analyze-receipt
- S7.2: Datos expirados en KB/Verdad Maestra — auditar y limpiar info de cursos pasados
- S7.3: Cron recordatorios cada 15 min (actualmente cada hora)
- S7.4: Auto-reactivar IA (auto_restart_delay existe pero no se verifica)
- S7.5: Recordatorios tipo "enviar al cliente" (campo target en reminder)

## Out of Scope

- Nuevo provider de WhatsApp
- Streaming de audio
- Rediseño del sistema de scraping
- Cambios a #CIA o sistema de prompts

## Stories

### S7.1: Media Gowa/Evolution (M)
**Donde:** `evolution-webhook/index.ts` + `transcribe-audio/index.ts` + `analyze-receipt/index.ts`
**Que:** En el bloque else del webhook (Gowa/Evolution), detectar tipo de mensaje
(imageMessage, audioMessage) y extraer URL directa. Pasar URL a transcribe-audio
y analyze-receipt como alternativa a media_id de Meta Graph API. Ambas funciones
deben soportar dos modos: Meta (media_id → Graph API) y Gowa (url directa).

### S7.2: Datos Expirados en Fuentes de Contexto (S)
**Donde:** Base de Conocimiento + Verdad Maestra (datos, no codigo)
**Que:** Auditar knowledge_documents y main_website_content para eliminar o
actualizar info de cursos/talleres con fechas pasadas. Considerar agregar
campo valid_until a knowledge_documents (como media_assets).

### S7.3: Cron Recordatorios Cada 15 Min (XS)
**Donde:** Supabase cron job
**Que:** Cambiar hourly_lead_reminders de '30 * * * *' a '*/15 * * * *'.
Reduce delay maximo de 59 min a 14 min.

### S7.4: Auto-Reactivar IA (S) — DESCOPED
**Nota:** Diferida por decision del usuario. No implementar auto-reactivacion por ahora.

### S7.5: Recordatorios al Cliente (M)
**Donde:** `process-lead-reminders/index.ts` + `ReminderItem.tsx`
**Que:** Agregar campo target: 'agent' | 'client' al reminder. Si target = 'client',
enviar por el canal del lead. Si target = 'agent' (default), enviar por canal
de notificaciones como hoy.

## Done Criteria

- [ ] Audio y imagenes de Gowa procesados (transcripcion + Ojo de Halcon)
- [ ] Cero info de cursos expirados en respuestas del bot
- [ ] Recordatorios con delay maximo de 14 min
- [ ] IA se reactiva sola cuando agente olvida encenderla
- [ ] Recordatorios pueden enviarse al cliente o al agente
- [ ] Zero regression en canales Meta

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Payload Gowa diferente al esperado | Media | Media | Log payload completo para debugging |
| URL de media Gowa expira rapido | Baja | Media | Descargar inmediatamente en fire-and-forget |

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Adaptar funciones para Gowa | Parametro dual: media_id O media_url |
| D2 | Datos expirados en KB | Limpiar ahora + valid_until en knowledge_documents |
| D3 | Recordatorios al cliente | Campo target 'agent' o 'client' con toggle UI |

## Implementation Plan

### Sequencing

| Order | Story | Size | Strategy | Rationale |
|-------|-------|------|----------|-----------|
| 1 | S7.3: Cron 15 min | XS | Quick win | Un cambio SQL |
| 2 | S7.2: Datos expirados | S | Quick win | Limpieza + migracion + filtro |
| 3 | S7.1: Media Gowa | M | Risk-first | La mas compleja, payload desconocido |
| 4 | S7.5: Recordatorios cliente | M | Feature | UI + backend, independiente |

S7.4 (auto-reactivar IA) descoped por decision del usuario.

### Milestones

#### M1: Quick Wins (after S7.3 + S7.2)
- [ ] Cron recordatorios cada 15 min
- [ ] KB filtrado por valid_until
- [ ] Datos expirados limpiados

#### M2: Gowa Media (after S7.1)
- [ ] Audio Gowa transcrito via Whisper
- [ ] Imagen Gowa analizada por Ojo de Halcon
- [ ] Zero regression en Meta

#### M3: Epic Complete (after S7.5)
- [ ] Recordatorios al cliente funcionando
- [ ] Toggle target en UI
- [ ] Retrospectiva completada

### Progress Tracking

| Story | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| S7.3: Cron 15 min | complete | 2026-03-31 | 2026-03-31 | Job 18, */15 * * * * |
| S7.2: Datos expirados | complete | 2026-03-31 | 2026-03-31 | valid_until KB + fecha en Verdad Maestra |
| S7.1: Media Gowa | pending | — | — | |
| S7.5: Recordatorios cliente | pending | — | — | |
| S7.4: Auto-reactivar IA | descoped | — | — | Diferido por usuario |
