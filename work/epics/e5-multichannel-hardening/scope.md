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

## Implementation Plan

### Sequencing

| Order | Story | Size | Strategy | Rationale |
|-------|-------|------|----------|-----------|
| 1 | S5.4: Fixes menores | XS | Quick win | 2 cambios de una linea, valor inmediato |
| 2 | S5.3: Transcripcion multi-provider | S | Quick win | Un check de provider, evita crashes |
| 3 | S5.1: Recordatorios por lead | M | Walking skeleton | Nueva function + cron, patron conocido (credit-reminders) |
| 4 | S5.2: Auto-routing por ciudad | M | Risk-first | Mas complejo: matching exacto + IA, integracion con analyze-leads |
| 5 | S5.5: Cerrar E3 | XS | Cleanup | Solo documentacion, sin dependencias |

**Parallelismo:** Todas las stories tocan archivos diferentes — podrian correr en paralelo.
Ejecutamos secuencialmente por ser un solo desarrollador. Quick wins primero para momentum.

**Critical path:** S5.2 (auto-routing) es la story mas compleja y con mas riesgo.

### Milestones

#### M1: Fixes + Transcripcion (after S5.4 + S5.3)
- [ ] Telefono normalizado para todos los providers
- [ ] Fallback canal con ORDER BY
- [ ] Audio Gowa no crashea
- **Demo:** Enviar mensaje por Gowa sin error de formato

#### M2: Recordatorios Funcionando (after S5.1)
- [ ] Crear recordatorio en chat con notify_wa=true
- [ ] Cron ejecuta y envia WhatsApp al agente
- [ ] Recordatorio marcado como sent (no se repite)
- **Demo:** Crear recordatorio para dentro de 1h, verificar que llega al agente

#### M3: Auto-Routing Funcionando (after S5.2)
- [ ] Lead menciona ciudad en chat
- [ ] analyze-leads extrae ciudad
- [ ] Matching exacto asigna al agente correcto
- [ ] Fallback IA asigna cuando no hay match exacto
- **Demo:** Escribir "soy de Monterrey" → lead asignado al agente de Monterrey

#### M4: Epic Complete (after S5.5)
- [ ] E3 cerrada con retrospectiva
- [ ] Todos los done criteria verificados
- **Gate:** `/rai-epic-close`

### Progress Tracking

| Story | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| S5.4: Fixes menores | complete | 2026-03-31 | 2026-03-31 | Phone norm + ORDER BY |
| S5.3: Transcripcion multi-provider | complete | 2026-03-31 | 2026-03-31 | Provider check before Graph API |
| S5.1: Recordatorios por lead | complete | 2026-03-31 | 2026-03-31 | Function + cron deployed |
| S5.2: Auto-routing por ciudad | pending | — | — | |
| S5.5: Cerrar E3 | pending | — | — | |
