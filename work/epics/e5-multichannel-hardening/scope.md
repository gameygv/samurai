---
epic: E5
name: multichannel-hardening
status: in-progress
---

# E5 Scope: Multi-Channel Hardening

## Objective

Completar la infraestructura multicanal para produccion: procesador de recordatorios
para agentes, auto-routing por ciudad con matching inteligente, compatibilidad
multi-provider (Meta + Gowa), y fixes menores. Preparar el sistema para operar
con 3 canales simultaneos.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Horario de IA | Bot siempre responde. Horario es del agente (Profile.tsx), no del bot |
| D2 | Recordatorios por lead | Son para el agente. Se envian por default_notification_channel |
| D3 | Cuando hacer auto-routing | Cuando analyze-leads detecta ciudad (no al crear lead) |
| D4 | Matching de ciudad | Exacto case-insensitive + fallback IA si no matchea |
| D5 | Canal para avisos | Reutilizar default_notification_channel existente |

## In Scope

- S5.1: Procesador de recordatorios por lead (nueva edge function + cron)
- S5.2: Auto-routing por ciudad en analyze-leads (matching exacto + IA)
- S5.3: Transcripcion multi-provider (fallback para canales no-Meta)
- S5.4: Fixes menores multi-provider (normalizacion telefono + orden fallback)
- S5.5: Cerrar E3 (marcar stories resueltas)

## Out of Scope

- Rediseno del sistema de canales
- Token auto-refresh de Meta
- Transcripcion de audio via Gowa (no hay API de media)
- Scheduler complejo (cron cada hora suficiente)
- Migracion de datos historicos entre canales
- Cambios al horario del bot (D1: bot siempre responde)
- Nuevo flag is_notification_channel (D5: reutilizar default_notification_channel)

## Stories

### S5.1: Procesador de Recordatorios por Lead (M)
**Donde:** Nueva edge function `process-lead-reminders` + cron job
**Que:** Revisar `leads.reminders` JSONB, encontrar recordatorios donde
datetime - notify_minutes <= ahora y notify_wa = true y no marcados como enviados.
Enviar al AGENTE (assigned_to) por el default_notification_channel.
Marcar como sent para no repetir.
**Contexto:** UI completa (RemindersBlock + ReminderItem). Datos en leads.reminders.
Falta el procesador y el cron. Patron similar a process-credit-reminders.
**Deps:** Ninguna

### S5.2: Auto-Routing por Ciudad (M)
**Donde:** `analyze-leads/index.ts` (despues de actualizar ciudad)
**Que:** Cuando analyze-leads detecta ciudad y channel_routing_mode = 'auto':
1. Buscar en profiles.territories matching exacto (case-insensitive)
2. Si no hay match → preguntarle a OpenAI cual agente tiene la ciudad mas cercana
3. Actualizar leads.assigned_to con el agente encontrado
4. Log en activity_logs
**Contexto:** profiles.territories existe. Config auto_routing_agents existe.
analyze-leads ya extrae ciudad. Solo falta el paso de matching + asignacion.
**Deps:** Ninguna (independiente de S5.1)

### S5.3: Transcripcion Multi-Provider (S)
**Donde:** `transcribe-audio/index.ts`
**Que:** Verificar provider del canal. Si != 'meta', fallback directo:
'[Nota de Voz — transcripcion no disponible en este canal]'.
No intentar Graph API para Gowa/Evolution.
**Deps:** Ninguna

### S5.4: Fixes Menores Multi-Provider (XS)
**Donde:** `send-message-v3/index.ts`
**Que:**
- Normalizacion telefono 521→52 para todos los providers (no solo Meta)
- ORDER BY created_at en fallback de canal
**Deps:** Ninguna

### S5.5: Cerrar E3 (XS)
**Donde:** `work/epics/e3-whatsapp-hardening/`
**Que:** Marcar S3.1 parcial, S3.2 completa, S3.3 completa (E4), S3.4 descoped.
Cerrar con retrospectiva.
**Deps:** Ninguna

## Done Criteria

- [ ] Recordatorios por lead enviados automaticamente al agente por WhatsApp
- [ ] Leads asignados a agente cuando analyze-leads detecta ciudad (modo auto)
- [ ] Matching exacto + fallback IA para ciudades ambiguas
- [ ] Transcripcion no crashea en canales Gowa
- [ ] Telefono normalizado para todos los providers
- [ ] Fallback de canal con ORDER BY
- [ ] E3 cerrada con retrospectiva

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lead no menciona ciudad en conversacion | Alta | Media | AI debe preguntar proactivamente (prompt config) |
| Matching IA devuelve agente incorrecto | Baja | Media | Log en activity_logs para revision manual |
| Cron de recordatorios tiene delay (hasta 1h) | Media | Baja | Aceptable para recordatorios de agente |
| Agente sin telefono en perfil | Media | Media | Skip + log warning |
