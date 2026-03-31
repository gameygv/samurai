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

### S7.4: Auto-Reactivar IA (S)
**Donde:** `evolution-webhook/index.ts` o `process-followups/index.ts`
**Que:** Si lead.ai_paused = true y han pasado mas de auto_restart_delay
minutos desde que se pauso, reactivar automaticamente. El campo existe
en followup_config pero no se verifica.

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
| Auto-reactivar IA en momento inoportuno | Baja | Baja | Solo reactivar si no hay mensajes recientes del agente |
