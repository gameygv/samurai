---
epic: E5
name: multichannel-hardening
status: in-progress
---

# E5 Scope: Multi-Channel Hardening

## Objective

Completar la infraestructura multicanal para produccion: horario de IA por agente,
procesador de recordatorios, auto-routing por ciudad, y compatibilidad multi-provider
(Meta + Gowa). Preparar el sistema para operar con 3 canales simultaneos.

## In Scope

- S5.1: Horario de IA en respuestas (evolution-webhook revisa followup_config)
- S5.2: Procesador de recordatorios por lead (nueva edge function + cron)
- S5.3: Auto-routing por ciudad (asignar lead al agente mas cercano)
- S5.4: Transcripcion multi-provider (fallback para canales no-Meta)
- S5.5: Canal Gowa para avisos (flag is_notification_channel)
- S5.6: Normalizacion telefono multi-provider + orden fallback canal
- S5.7: Cerrar E3 (marcar stories resueltas, actualizar scope)

## Out of Scope

- Rediseno del sistema de canales
- Token auto-refresh de Meta
- Transcripcion de audio via Gowa (no hay API de media)
- Scheduler complejo (cron cada hora suficiente)
- Migracion de datos historicos entre canales

## Stories

### S5.1: Horario de IA en Respuestas (S)
**Donde:** `evolution-webhook/index.ts`
**Que:** Antes de llamar a process-samurai-response, revisar followup_config
(start_hour, end_hour, allowed_days, timezone). Si esta fuera de horario,
no invocar IA. Opcionalmente enviar mensaje de "fuera de horario".
**Contexto:** La UI ya existe en FollowupTab.tsx. La tabla followup_config ya
tiene los campos. Solo falta el check en el webhook.

### S5.2: Procesador de Recordatorios por Lead (M)
**Donde:** Nueva edge function `process-lead-reminders` + cron job
**Que:** Revisar `leads.reminders` JSONB, encontrar recordatorios donde
datetime <= ahora y notify_wa = true, enviar por WhatsApp via send-message-v3,
marcar como enviado para no repetir.
**Contexto:** UI completa en RemindersBlock.tsx + ReminderItem.tsx. Datos se
guardan en leads.reminders. Falta el procesador y el cron.

### S5.3: Auto-Routing por Ciudad (M)
**Donde:** `evolution-webhook/index.ts` + logica de matching
**Que:** Cuando se crea un lead nuevo y channel_routing_mode = 'auto', buscar
en profiles los agentes con territories que incluyan la ciudad del lead.
Asignar assigned_to al agente mas cercano.
**Contexto:** Config auto_routing_agents existe. profiles.territories existe.
Falta la logica de matching en el webhook.
**Reto:** El lead no siempre tiene ciudad al momento de creacion. Puede
necesitar re-routing cuando se detecta la ciudad.

### S5.4: Transcripcion Multi-Provider (S)
**Donde:** `transcribe-audio/index.ts`
**Que:** Verificar provider del canal antes de intentar descargar audio.
Si provider != 'meta', usar fallback (no intentar Graph API).
Fallback: '[Nota de Voz — transcripcion no disponible en este canal]'.
**Contexto:** Actualmente hardcodea Meta Graph API para todos los canales.

### S5.5: Canal Gowa para Avisos (S)
**Donde:** Migracion + `send-message-v3/index.ts` + `process-lead-reminders`
**Que:** Flag `is_notification_channel` en whatsapp_channels. Los recordatorios
y avisos usan este canal si existe. UI en ChannelsTab para activar/desactivar.
**Contexto:** default_notification_channel existe como fallback pero no es
un concepto dedicado para avisos.

### S5.6: Fixes Menores Multi-Provider (XS)
**Donde:** `send-message-v3/index.ts`
**Que:**
- Normalizacion telefono 521→52 para todos los providers
- ORDER BY created_at en fallback de canal
**Contexto:** Actualmente solo normaliza para Meta.

### S5.7: Cerrar E3 (XS)
**Donde:** `work/epics/e3-whatsapp-hardening/`
**Que:** Marcar S3.1 como parcial (token temporal renovado, permanente pendiente),
S3.2 como completada (leads borrados), S3.3 como completada (checkmarks en E4),
S3.4 como descoped (Gowa se mantiene). Cerrar epic con retrospectiva.

## Done Criteria

- [ ] IA no responde fuera de horario configurado en followup_config
- [ ] Recordatorios por lead se envian automaticamente por WhatsApp
- [ ] Leads nuevos asignados a agente por ciudad (modo auto)
- [ ] Transcripcion no crashea en canales Gowa
- [ ] Canal Gowa dedicado para avisos funciona
- [ ] Telefono normalizado para todos los providers
- [ ] E3 cerrada con retrospectiva

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lead no tiene ciudad al crearse | Alta | Media | Re-routing cuando IA detecta ciudad |
| Cron de recordatorios tiene delay | Media | Baja | Cron cada hora, no cada minuto |
| followup_config no existe para algun canal | Media | Media | Usar defaults (9-21, lun-vie) |
